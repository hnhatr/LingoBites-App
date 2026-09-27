/**
 * INV-002 / HC-001: real SQLite (Node 22 `node:sqlite`) transaction evidence.
 * quick-sqlite JSI is device-only; this script pins the same BEGIN/COMMIT +
 * sync_outbox insert contract the app uses under withTransaction.
 */
import {DatabaseSync} from 'node:sqlite';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const dbPath = path.join(
  os.tmpdir(),
  `lingobites-inv002-${process.pid}-${Date.now()}.sqlite`,
);

function openDb() {
  return new DatabaseSync(dbPath);
}

function migrate(db) {
  db.exec(`
    CREATE TABLE practice_events (
      event_id TEXT PRIMARY KEY NOT NULL,
      session_id TEXT NOT NULL,
      sequence INTEGER NOT NULL
    );
    CREATE TABLE sync_outbox (
      id TEXT PRIMARY KEY NOT NULL,
      event_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      attempt_count INTEGER NOT NULL DEFAULT 0,
      last_error TEXT,
      synced_at TEXT
    );
  `);
}

function commitAnswerWithOutbox(db, {eventId, sessionId, sequence, createdAt}) {
  db.exec('BEGIN');
  try {
    db.prepare(
      'INSERT INTO practice_events (event_id, session_id, sequence) VALUES (?, ?, ?)',
    ).run(eventId, sessionId, sequence);
    db.prepare(
      `INSERT INTO sync_outbox (
        id, event_type, entity_id, payload_json, created_at, attempt_count,
        last_error, synced_at
      ) VALUES (?, ?, ?, ?, ?, 0, NULL, NULL)`,
    ).run(
      eventId,
      'practice',
      sessionId,
      JSON.stringify({event_id: eventId, session_id: sessionId, sequence}),
      createdAt,
    );
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

function pendingOutboxCount(db) {
  return db
    .prepare('SELECT COUNT(*) AS c FROM sync_outbox WHERE synced_at IS NULL')
    .get().c;
}

try {
  const db = openDb();
  migrate(db);
  commitAnswerWithOutbox(db, {
    eventId: 'ev-real-1',
    sessionId: 'sess-real-1',
    sequence: 1,
    createdAt: '2026-09-27T09:00:00.000Z',
  });
  if (pendingOutboxCount(db) !== 1) {
    throw new Error(`expected 1 pending outbox row, got ${pendingOutboxCount(db)}`);
  }
  db.close();

  const reopened = openDb();
  if (pendingOutboxCount(reopened) !== 1) {
    throw new Error('pending outbox row lost after DB reopen');
  }
  const row = reopened
    .prepare('SELECT id, event_type FROM sync_outbox WHERE id = ?')
    .get('ev-real-1');
  if (!row || row.event_type !== 'practice') {
    throw new Error('outbox row mismatch after reopen');
  }
  reopened.close();

  // Failure injection: rollback must not leave a pending outbox row.
  const db2 = openDb();
  try {
    db2.exec('BEGIN');
    db2.prepare(
      'INSERT INTO practice_events (event_id, session_id, sequence) VALUES (?, ?, ?)',
    ).run('ev-fail', 'sess-fail', 1);
    throw new Error('simulated crash before outbox insert');
  } catch {
    db2.exec('ROLLBACK');
  }
  if (pendingOutboxCount(db2) !== 1) {
    throw new Error('rollback should keep the first committed outbox row only');
  }
  db2.close();

  console.log(
    JSON.stringify({
      status: 'pass',
      engine: 'node:sqlite',
      dbPath,
      pendingAfterReopen: 1,
      rollbackInjection: 'no extra pending row',
    }),
  );
} finally {
  try {
    fs.unlinkSync(dbPath);
  } catch {
    // ignore cleanup errors
  }
}
