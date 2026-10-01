import {type ChildProcess,spawn} from 'node:child_process';
import {randomBytes, randomUUID} from 'node:crypto';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';

import {resetRefreshStateForTests} from '@core/auth/authSession';
import {saveSession, setActiveSessionId} from '@core/auth/sessionStore';
import {resetDatabaseForTests} from '@core/db/database';
import {runMigrations} from '@core/db/migrations';
import {enqueueSyncOutboxEvent} from '@core/db/syncOutboxCore';
import {recordLessonEvent} from '@core/sync/lessonProgress';

import {
  openRealSqlite,
  type RealSqliteConnection,
} from '@test/support/adversarial/realSqlite';
import {installKeychainVault} from '@test/support/keychainVault';

import {listPendingSyncEvents} from '../../adapters/SyncOutboxRepository';
import {drainOutboxOnce} from '../../outboxSync';

/**
 * LING-172 (TASK-006) live drain: the App outbox drains against a REAL
 * Server + Postgres (INV-003 cross-repo evidence).
 *
 * Gated: runs only with `LING172_LIVE_DRAIN=1` and `DATABASE_URL` set, so
 * plain `yarn test` stays hermetic. Run it explicitly:
 *
 *   LING172_LIVE_DRAIN=1 DATABASE_URL=postgresql://lingobites:lingobites@127.0.0.1:5432/lingobites \
 *     yarn jest --testPathPattern='ling172-live-server-drain' --watchman=false
 *
 * Flow: N offline attempts (rows kept) → process restart → mixed queue with
 * an invalid flashcard mutation → drain → `lesson_progress` accepted by the
 * real server while the invalid row stays pending; pull then exposes the
 * merged `completed` state with the action times.
 */

const LIVE = (
  process.env.LING172_LIVE_DRAIN ?? ''
).trim() === '1';
const DATABASE_URL = (process.env.DATABASE_URL ?? '').trim();
const PORT = Number(process.env.LING172_LIVE_PORT ?? 45571);

const RUN = `ling172-${Date.now()}`;
const LESSON_ID = `lesson-live-${RUN}`;
const START_ID = '44444444-4444-4444-8444-444444444441';
const COMPLETE_ID = '44444444-4444-4444-8444-444444444442';
const FLASH_ID = '44444444-4444-4444-8444-444444444443';
// Action times in the recent past: the server clamps future `occurred_at`
// to its receive time (A-006), so fixed future dates would not round-trip.
const T1 = new Date(Date.now() - 10 * 60_000).toISOString();
const T2 = new Date(Date.now() - 5 * 60_000).toISOString();

const workdir = path.resolve(
  __dirname,
  '..',
  '..',
  '..',
  '..',
  '..',
  '..',
  '..',
);
const serverDir = path.join(workdir, 'LingoBites-Server');
const tsxBin = path.join(serverDir, 'node_modules', '.bin', 'tsx');

function liveFetch(port: number): typeof fetch {
  return (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.toString();
    return fetch(
      url.replace('http://localhost:3000', `http://127.0.0.1:${port}`),
      init,
    );
  };
}

async function waitForPort(port: number, deadlineMs: number): Promise<void> {
  const started = Date.now();
  for (;;) {
    const open = await new Promise<boolean>(resolve => {
      const socket = net.connect({host: '127.0.0.1', port});
      socket.once('connect', () => {
        socket.end();
        resolve(true);
      });
      socket.once('error', () => resolve(false));
    });
    if (open) {
      return;
    }
    if (Date.now() - started > deadlineMs) {
      throw new Error(`server did not listen on ${port} in time`);
    }
    await new Promise(resolve => setTimeout(resolve, 500));
  }
}

async function signupOverHttp(port: number): Promise<{
  userId: string;
  session: {
    session_id: string;
    access_token: string;
    refresh_token: string;
    access_expires_at: string;
    refresh_expires_at: string;
  };
}> {
  const base = `http://127.0.0.1:${port}`;
  const identifier = randomBytes(8).toString('hex');
  const bootstrap = (await (
    await fetch(`${base}/v1/auth/bootstrap`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({
        identifier_kind: 'android_id',
        identifier_value: identifier,
      }),
    })
  ).json()) as {bootstrap_ticket: string};
  const created = (await (
    await fetch(`${base}/v1/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': randomUUID(),
      },
      body: JSON.stringify({
        bootstrap_ticket: bootstrap.bootstrap_ticket,
        display_name: `LING172 ${RUN}`,
      }),
    })
  ).json()) as {
    user: {id: string};
    session: {
      session_id: string;
      access_token: string;
      refresh_token: string;
      access_expires_at: string;
      refresh_expires_at: string;
    };
  };
  return {userId: created.user.id, session: created.session};
}

let dbFile: string;
let db: RealSqliteConnection;
let server: ChildProcess | null = null;

function openFileDb(): RealSqliteConnection {
  const connection = openRealSqlite(dbFile);
  resetDatabaseForTests(connection);
  runMigrations(connection);
  return connection;
}

beforeEach(() => {
  installKeychainVault();
  resetRefreshStateForTests();
  dbFile = path.join(
    fs.mkdtempSync(path.join(os.tmpdir(), 'ling172-live-')),
    'lingobites.sqlite',
  );
  db = openFileDb();
});

afterEach(async () => {
  if (server) {
    server.kill('SIGTERM');
    server = null;
  }
  try {
    db.close();
  } catch {
    // already closed by a restart step
  }
  resetDatabaseForTests(null);
  resetRefreshStateForTests();
  fs.rmSync(path.dirname(dbFile), {recursive: true, force: true});
});

it(
  'live drain: offline attempts, restart, then accepted; invalid flashcard cannot block lesson_progress',
  async () => {
    if (!LIVE || !DATABASE_URL) {
      console.log('skip: needs LING172_LIVE_DRAIN=1 and DATABASE_URL');
      return;
    }
    expect(fs.existsSync(tsxBin)).toBe(true);

    recordLessonEvent({
      lessonId: LESSON_ID,
      event: 'start',
      occurredAt: T1,
      eventId: START_ID,
    });
    recordLessonEvent({
      lessonId: LESSON_ID,
      event: 'complete',
      occurredAt: T2,
      eventId: COMPLETE_ID,
    });
    // Invalid flashcard mutation: the real server rejects the batch with 400.
    enqueueSyncOutboxEvent({
      id: FLASH_ID,
      eventType: 'flashcards',
      entityId: 'card-live-bad',
      payload: {word: 'x'},
      createdAt: 'not-a-date',
    });
    const offlineFetch = liveFetch(PORT);

    // N offline attempts: connection refused, rows kept with growing attempts.
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      const outcome = await drainOutboxOnce({fetchImpl: offlineFetch});
      expect(outcome).toMatchObject({status: 'failed', retryable: true});
      expect(listPendingSyncEvents().map(e => e.id).sort()).toEqual(
        [COMPLETE_ID, FLASH_ID, START_ID].sort(),
      );
    }

    // Process kill + cold start before the retry.
    db.close();
    db = openFileDb();
    expect(listPendingSyncEvents()).toHaveLength(3);

    // Bring up the real Server + Postgres.
    server = spawn(tsxBin, ['src/app/server.ts'], {
      cwd: serverDir,
      env: {
        ...process.env,
        DATABASE_URL,
        HOST: '127.0.0.1',
        PORT: String(PORT),
        AI_PROVIDER: 'mock',
        OCR_PROVIDER: 'mock',
        TRANSCRIPT_PROVIDER: 'mock',
        LOG_LEVEL: 'warn',
      },
      stdio: 'ignore',
    });
    await waitForPort(PORT, 120000);

    const {userId, session} = await signupOverHttp(PORT);
    expect(
      await saveSession({
        ...session,
        user_id: userId,
        stored_at: new Date().toISOString(),
      }),
    ).toMatchObject({ok: true});
    expect(await setActiveSessionId(session.session_id)).toMatchObject({
      ok: true,
    });
    // Mirror login: the local account pointer must match the session owner,
    // or the drain ownership guard aborts the push.
    db.execute(
      'INSERT OR REPLACE INTO app_settings (key, value, updated_at) VALUES (?, ?, ?);',
      ['current_account_id', userId, new Date().toISOString()],
    );

    const outcome = await drainOutboxOnce({fetchImpl: liveFetch(PORT)});
    expect(outcome.status).toBe('synced');
    if (outcome.status === 'synced') {
      expect(outcome.syncedIds).toEqual(
        expect.arrayContaining([START_ID, COMPLETE_ID]),
      );
    }
    // Progress accepted; the invalid flashcard row stays pending.
    expect(listPendingSyncEvents().map(e => e.id)).toEqual([FLASH_ID]);

    // Pull exposes the merged completed state with the action times.
    const pull = await (
      await fetch(
        `http://127.0.0.1:${PORT}/v1/sync/pull?cursor=&limit=100`,
        {headers: {Authorization: `Bearer ${session.access_token}`}},
      )
    ).json();
    const record = (pull.records as Array<any>).find(
      item =>
        item.collection === 'lesson_progress' &&
        item.entity_id === LESSON_ID,
    );
    expect(record?.payload).toEqual({
      status: 'completed',
      started_at: T1,
      completed_at: T2,
    });
  },
  240000,
);
