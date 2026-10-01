import {type ChildProcess, spawn} from 'node:child_process';
import {randomBytes, randomUUID} from 'node:crypto';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';

import {resetRefreshStateForTests} from '@core/auth/authSession';
import {saveSession, setActiveSessionId} from '@core/auth/sessionStore';
import {resetDatabaseForTests} from '@core/db/database';
import {runMigrations} from '@core/db/migrations';

import {
  openRealSqlite,
  type RealSqliteConnection,
} from '@test/support/adversarial/realSqlite';
import {installKeychainVault} from '@test/support/keychainVault';

import {
  applyLessonRevisionStates,
  getLessonDownload,
  saveLessonSnapshotBody,
} from '../../canonicalDownloadRepository';
import {
  fetchLessonCatalog,
  fetchLessonCreationStatus,
  fetchLessonRevisions,
  fetchLessonSnapshot,
  fetchSentenceAnalysis,
  submitLessonCreation,
} from '../../canonicalLessonClient';

/**
 * LING-173 (TASK-007) live drain: the canonical App stack runs against a
 * REAL Server + Postgres (INV-007 cross-repo evidence).
 *
 * Gated: the suite is skipped unless `LING173_LIVE_DRAIN=1` and
 * `DATABASE_URL` are set, so plain `yarn test` stays hermetic. Run it
 * explicitly:
 *
 *   LING173_LIVE_DRAIN=1 DATABASE_URL=postgresql://postgres@127.0.0.1:5432/lingobites_test \
 *     yarn jest --testPathPattern='ling173-live-lesson-drain' --no-watchman --runInBand
 *
 * Flow: learner text creation submitted with a persisted idempotency key →
 * poll to `succeeded` → catalog lists the lesson → snapshot downloads and
 * stores as one SQLite row → sentence analysis is ready → revisions report
 * `current` with the stored revision.
 */

const LIVE = (process.env.LING173_LIVE_DRAIN ?? '').trim() === '1';
const DATABASE_URL = (process.env.DATABASE_URL ?? '').trim();
const PORT = Number(process.env.LING173_LIVE_PORT ?? 45572);

const RUN = `ling173-${Date.now()}`;

const workdir = path.resolve(
  __dirname,
  '..',
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
        display_name: `LING173 ${RUN}`,
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

async function pollCreationToTerminal(
  requestId: string,
  fetchImpl: typeof fetch,
): Promise<{status: string; lessonId: string | null}> {
  const deadline = Date.now() + 120000;
  for (;;) {
    const polled = await fetchLessonCreationStatus(requestId, {fetchImpl});
    if (!polled.ok) {
      throw new Error(`creation poll failed: ${polled.message}`);
    }
    if (
      polled.value.status === 'succeeded' ||
      polled.value.status === 'failed'
    ) {
      return {status: polled.value.status, lessonId: polled.value.lesson_id};
    }
    if (Date.now() > deadline) {
      throw new Error('creation did not reach a terminal state in time');
    }
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
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
    fs.mkdtempSync(path.join(os.tmpdir(), 'ling173-live-')),
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

(LIVE && DATABASE_URL ? it : it.skip)(
  'live drain: create, download, analyze and status-check against real Server + Postgres',
  async () => {
    expect(fs.existsSync(tsxBin)).toBe(true);

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
    db.execute(
      'INSERT OR REPLACE INTO app_settings (key, value, updated_at) VALUES (?, ?, ?);',
      ['current_account_id', userId, new Date().toISOString()],
    );

    const fetchImpl = liveFetch(PORT);
    const submitted = await submitLessonCreation(
      {
        source: 'text',
        text: 'I wake up at six every morning. I brush my teeth and take a shower.',
      },
      randomUUID(),
      {fetchImpl},
    );
    expect(submitted.ok).toBe(true);
    if (!submitted.ok) {
      throw new Error(`creation submit failed: ${submitted.message}`);
    }

    const terminal = await pollCreationToTerminal(
      submitted.value.requestId,
      fetchImpl,
    );
    expect(terminal.status).toBe('succeeded');
    const lessonId = terminal.lessonId;
    expect(typeof lessonId).toBe('string');

    const catalog = await fetchLessonCatalog({limit: 20}, {fetchImpl});
    expect(catalog.ok).toBe(true);
    if (catalog.ok) {
      expect(catalog.value.lessons.some(lesson => lesson.id === lessonId)).toBe(
        true,
      );
    }

    const snapshot = await fetchLessonSnapshot(lessonId as string, {fetchImpl});
    expect(snapshot.ok).toBe(true);
    if (!snapshot.ok) {
      throw new Error(`snapshot fetch failed: ${snapshot.message}`);
    }
    expect(snapshot.value.snapshot.sentences.length).toBeGreaterThan(0);
    const stored = saveLessonSnapshotBody({body: snapshot.value.rawBody}, db);
    expect(stored.lessonId).toBe(lessonId);
    const readable = getLessonDownload(lessonId as string, db);
    expect(readable?.snapshot.sentences).toHaveLength(
      snapshot.value.snapshot.sentences.length,
    );

    const [firstSentence] = snapshot.value.snapshot.sentences;
    const analysis = await fetchSentenceAnalysis(
      lessonId as string,
      firstSentence.id,
      {fetchImpl},
    );
    if (!analysis.ok) {
      throw new Error(
        `analysis failed: kind=${analysis.kind} code=${analysis.errorCode} status=${analysis.status} message=${analysis.message}`,
      );
    }

    const revisions = await fetchLessonRevisions([lessonId as string], {
      fetchImpl,
    });
    expect(revisions.ok).toBe(true);
    if (revisions.ok) {
      const applied = applyLessonRevisionStates(revisions.value, db);
      expect(applied.removed).toEqual([]);
      expect(getLessonDownload(lessonId as string, db)?.contentRevision).toBe(
        snapshot.value.snapshot.content_revision,
      );
    }
  },
  240000,
);
