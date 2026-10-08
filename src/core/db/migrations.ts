import type {QuickSQLiteConnection} from 'react-native-quick-sqlite';

/**
 * Local SQLite schema: one baseline (backward-design curriculum, PR 5).
 *
 * The app had not shipped to learners, so the v1–v6 upgrade chain was folded
 * into this single schema (decision G2). A database still on any older
 * version is reset: every app table is dropped and the baseline is created
 * again, so downloads, flashcards and unsynced local progress on that device
 * are lost. New schema changes after this point are versioned upgrade steps
 * (`UPGRADE_STEPS`) on top of the baseline version; the baseline statements
 * always create the latest shape.
 */
export const APP_SCHEMA_VERSION = 8;

/** The version the baseline was folded at; older databases are reset. */
export const BASELINE_SCHEMA_VERSION = 7;

/**
 * `activity_attempts` (v8, PR 10): `result` may be NULL and the curriculum
 * player's lesson attempts (PR 8 payload) get their own columns;
 * `item_keys_json` is the JSON array of catalog codes practised.
 */
function activityAttemptsTable(name: string): string {
  return `CREATE TABLE IF NOT EXISTS ${name} (
    id TEXT PRIMARY KEY NOT NULL,
    kind TEXT NOT NULL,
    activity TEXT NOT NULL,
    lesson_id TEXT,
    item_key TEXT,
    session_id TEXT,
    result TEXT,
    score REAL,
    duration_ms INTEGER NOT NULL,
    occurred_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    revision INTEGER NOT NULL DEFAULT 0,
    tombstone INTEGER NOT NULL DEFAULT 0,
    block_id TEXT,
    content_revision INTEGER,
    step INTEGER,
    task_id TEXT,
    item_keys_json TEXT,
    support_level TEXT,
    outcome TEXT,
    assessed_by TEXT
  );`;
}

const ACTIVITY_ATTEMPTS_INDEX = `CREATE INDEX IF NOT EXISTS idx_activity_attempts_lesson
    ON activity_attempts (lesson_id, occurred_at DESC);`;

/**
 * Upgrade steps keyed by the version they start from; each runs in the
 * migration transaction and must keep the rows it touches.
 */
const UPGRADE_STEPS: Record<number, readonly string[]> = {
  // v7 → v8: rebuild `activity_attempts` (SQLite cannot drop NOT NULL).
  7: [
    activityAttemptsTable('activity_attempts_v8'),
    `INSERT INTO activity_attempts_v8 (
      id, kind, activity, lesson_id, item_key, session_id, result, score,
      duration_ms, occurred_at, updated_at, revision, tombstone
    ) SELECT
      id, kind, activity, lesson_id, item_key, session_id, result, score,
      duration_ms, occurred_at, updated_at, revision, tombstone
    FROM activity_attempts;`,
    'DROP TABLE activity_attempts;',
    'ALTER TABLE activity_attempts_v8 RENAME TO activity_attempts;',
    ACTIVITY_ATTEMPTS_INDEX,
  ],
};

/** Every table the baseline creates, in creation order. */
export const BASELINE_TABLES = [
  'app_settings',
  'flashcards',
  'flashcard_sources',
  'review_schedule',
  'review_sessions',
  'sync_outbox',
  'audio_assets',
  'gamification_events',
  'speaking_recordings',
  'error_events',
  'grammar_bookmarks',
  'lesson_downloads',
  'lesson_progress',
  'speaking_attempts',
  'activity_attempts',
  'lesson_bookmarks',
] as const;

export const BASELINE_STATEMENTS: string[] = [
  `CREATE TABLE IF NOT EXISTS app_settings (
    key TEXT PRIMARY KEY NOT NULL,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );`,
  // One card per learning item across lessons (decision G3): `item_key` is the
  // catalog item code (`word:coffee`, `pattern:can-i-have`); analysed words of
  // learner lessons get the code the Server derives for the same text, so they
  // match the catalog item once it exists. `item_id` is the catalog uuid when
  // known. `lesson_id` is the lesson the card was first saved from (every
  // source lesson is in `flashcard_sources`); `vocabulary_id` keeps the id of
  // the saved entry for display and sync only and is not an identity.
  `CREATE TABLE IF NOT EXISTS flashcards (
    id TEXT PRIMARY KEY NOT NULL,
    lesson_id TEXT NOT NULL,
    vocabulary_id TEXT NOT NULL,
    word TEXT NOT NULL,
    phrase_from_text TEXT,
    word_type TEXT,
    meaning_vi TEXT NOT NULL,
    pronunciation_guide_vi TEXT,
    ipa TEXT,
    cefr_level TEXT,
    source_sentence TEXT,
    example TEXT,
    example_translation TEXT,
    is_saved INTEGER NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    revision INTEGER NOT NULL DEFAULT 0,
    tombstone INTEGER NOT NULL DEFAULT 0,
    item_key TEXT NOT NULL,
    item_id TEXT,
    kind TEXT
  );`,
  `CREATE INDEX IF NOT EXISTS idx_flashcards_lesson_id ON flashcards (lesson_id);`,
  `CREATE INDEX IF NOT EXISTS idx_flashcards_is_saved ON flashcards (is_saved);`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_flashcards_item_key_live
    ON flashcards (item_key)
    WHERE tombstone = 0;`,
  `CREATE TABLE IF NOT EXISTS flashcard_sources (
    card_id TEXT NOT NULL,
    lesson_id TEXT NOT NULL,
    source_sentence TEXT,
    created_at TEXT NOT NULL,
    PRIMARY KEY (card_id, lesson_id)
  );`,
  `CREATE INDEX IF NOT EXISTS idx_flashcard_sources_lesson
    ON flashcard_sources (lesson_id);`,
  `CREATE TABLE IF NOT EXISTS review_schedule (
    card_id TEXT PRIMARY KEY NOT NULL,
    lesson_id TEXT NOT NULL,
    interval_days INTEGER NOT NULL,
    next_review_at TEXT NOT NULL,
    last_reviewed_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    revision INTEGER NOT NULL DEFAULT 0,
    tombstone INTEGER NOT NULL DEFAULT 0
  );`,
  `CREATE INDEX IF NOT EXISTS idx_review_schedule_due ON review_schedule (next_review_at);`,
  `CREATE TABLE IF NOT EXISTS review_sessions (
    id TEXT PRIMARY KEY NOT NULL,
    card_id TEXT NOT NULL,
    lesson_id TEXT NOT NULL,
    rating TEXT NOT NULL,
    reviewed_at TEXT NOT NULL,
    interval_days INTEGER NOT NULL,
    next_review_at TEXT NOT NULL,
    created_at TEXT NOT NULL,
    revision INTEGER NOT NULL DEFAULT 0,
    tombstone INTEGER NOT NULL DEFAULT 0
  );`,
  `CREATE INDEX IF NOT EXISTS idx_review_sessions_card_id ON review_sessions (card_id);`,
  `CREATE INDEX IF NOT EXISTS idx_review_sessions_reviewed_at ON review_sessions (reviewed_at DESC);`,
  // Append-only local outbox (SETE-87 / ADR-2): `id` doubles as the server-side
  // idempotency key; a drain worker sets `synced_at` on success.
  `CREATE TABLE IF NOT EXISTS sync_outbox (
    id TEXT PRIMARY KEY NOT NULL,
    event_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    payload_json TEXT NOT NULL,
    created_at TEXT NOT NULL,
    attempt_count INTEGER NOT NULL DEFAULT 0,
    last_error TEXT,
    synced_at TEXT
  );`,
  `CREATE INDEX IF NOT EXISTS idx_sync_outbox_pending ON sync_outbox (synced_at, created_at);`,
  // Offline audio cache (SETE-88, ADR-3), bounded by cap + eviction.
  `CREATE TABLE IF NOT EXISTS audio_assets (
    id TEXT PRIMARY KEY NOT NULL,
    chapter_id TEXT NOT NULL,
    url TEXT NOT NULL,
    local_path TEXT,
    bytes INTEGER NOT NULL DEFAULT 0,
    checksum TEXT NOT NULL,
    download_status TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );`,
  `CREATE INDEX IF NOT EXISTS idx_audio_assets_chapter_id ON audio_assets (chapter_id);`,
  `CREATE INDEX IF NOT EXISTS idx_audio_assets_download_status ON audio_assets (download_status);`,
  // The only input to streak / XP / badge state (SETE-89, ADR-4).
  `CREATE TABLE IF NOT EXISTS gamification_events (
    id TEXT PRIMARY KEY NOT NULL,
    event_type TEXT NOT NULL,
    source_event_id TEXT,
    points INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    revision INTEGER NOT NULL DEFAULT 0,
    tombstone INTEGER NOT NULL DEFAULT 0
  );`,
  `CREATE INDEX IF NOT EXISTS idx_gamification_events_type_created ON gamification_events (event_type, created_at);`,
  `CREATE TABLE IF NOT EXISTS speaking_recordings (
    id TEXT PRIMARY KEY NOT NULL,
    activity_id TEXT,
    lesson_id TEXT,
    mode TEXT NOT NULL,
    file_path TEXT NOT NULL,
    duration_ms INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    sentence_id TEXT,
    owner_user_id TEXT,
    upload_state TEXT NOT NULL DEFAULT 'local_only',
    upload_attempts INTEGER NOT NULL DEFAULT 0,
    upload_next_at TEXT,
    upload_error TEXT,
    server_recording_id TEXT
  );`,
  `CREATE INDEX IF NOT EXISTS idx_speaking_recordings_created_at
    ON speaking_recordings (created_at DESC);`,
  `CREATE INDEX IF NOT EXISTS idx_speaking_recordings_lesson_id
    ON speaking_recordings (lesson_id);`,
  `CREATE INDEX IF NOT EXISTS idx_speaking_recordings_mode_sentence_id
    ON speaking_recordings (mode, sentence_id);`,
  `CREATE INDEX IF NOT EXISTS idx_speaking_recordings_upload_state_upload_next_at
    ON speaking_recordings (upload_state, upload_next_at);`,
  `CREATE TABLE IF NOT EXISTS error_events (
    id TEXT PRIMARY KEY NOT NULL,
    source TEXT NOT NULL,
    category TEXT NOT NULL,
    activity_id TEXT,
    lesson_id TEXT,
    review_item_id TEXT,
    created_at TEXT NOT NULL
  );`,
  `CREATE INDEX IF NOT EXISTS idx_error_events_created_at
    ON error_events (created_at DESC);`,
  `CREATE INDEX IF NOT EXISTS idx_error_events_lesson_id
    ON error_events (lesson_id);`,
  // Kept for the current grammar section (decision G4); PR 6 decides its fate.
  `CREATE TABLE IF NOT EXISTS grammar_bookmarks (
    lesson_id TEXT NOT NULL,
    grammar_id TEXT NOT NULL,
    package_id TEXT NOT NULL,
    saved_at TEXT NOT NULL,
    reactivated_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    revision INTEGER NOT NULL DEFAULT 0,
    tombstone INTEGER NOT NULL DEFAULT 0,
    name TEXT,
    description TEXT,
    formula TEXT,
    analysis TEXT,
    sentence_en TEXT,
    item_key TEXT,
    UNIQUE (lesson_id, grammar_id)
  );`,
  `CREATE INDEX IF NOT EXISTS idx_grammar_bookmarks_lesson_id
    ON grammar_bookmarks (lesson_id);`,
  `CREATE INDEX IF NOT EXISTS idx_grammar_bookmarks_package_id
    ON grammar_bookmarks (package_id);`,
  // AD-005/AD-007 download row: the snapshot is stored verbatim.
  `CREATE TABLE IF NOT EXISTS lesson_downloads (
    lesson_id TEXT PRIMARY KEY NOT NULL,
    content_revision INTEGER,
    server_revision INTEGER,
    contract_version INTEGER,
    snapshot_json TEXT NOT NULL,
    media_dir TEXT,
    downloaded_at TEXT
  );`,
  `CREATE TABLE IF NOT EXISTS lesson_progress (
    lesson_id TEXT PRIMARY KEY NOT NULL,
    status TEXT NOT NULL,
    started_at TEXT NOT NULL,
    completed_at TEXT,
    revision INTEGER NOT NULL DEFAULT 0,
    tombstone INTEGER NOT NULL DEFAULT 0,
    updated_at TEXT NOT NULL
  );`,
  `CREATE TABLE IF NOT EXISTS speaking_attempts (
    id TEXT PRIMARY KEY NOT NULL,
    lesson_id TEXT NOT NULL,
    sentence_id TEXT NOT NULL,
    mode TEXT NOT NULL,
    practiced_at TEXT NOT NULL,
    check_full_sentence INTEGER NOT NULL,
    check_key_words INTEGER NOT NULL,
    check_rhythm INTEGER NOT NULL,
    duration_ms INTEGER NOT NULL,
    recording_id TEXT,
    revision INTEGER NOT NULL DEFAULT 0,
    updated_at TEXT NOT NULL
  );`,
  `CREATE INDEX IF NOT EXISTS idx_speaking_attempts_lesson_practiced_at
    ON speaking_attempts (lesson_id, practiced_at DESC);`,
  // `item_key` carries the catalog item code (sync payload name unchanged).
  activityAttemptsTable('activity_attempts'),
  ACTIVITY_ATTEMPTS_INDEX,
  `CREATE TABLE IF NOT EXISTS lesson_bookmarks (
    lesson_id TEXT PRIMARY KEY NOT NULL,
    title TEXT NOT NULL,
    source_type TEXT NOT NULL,
    sentence_count INTEGER NOT NULL DEFAULT 0,
    estimated_minutes INTEGER,
    context_label TEXT,
    saved_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    revision INTEGER NOT NULL DEFAULT 0,
    tombstone INTEGER NOT NULL DEFAULT 0
  );`,
  `CREATE INDEX IF NOT EXISTS idx_lesson_bookmarks_saved
    ON lesson_bookmarks (tombstone, saved_at DESC);`,
];

export function readAppSchemaVersion(db: QuickSQLiteConnection): number {
  try {
    const rows = db.execute('PRAGMA user_version;').rows;
    const value = (rows?.item(0) as {user_version?: unknown} | undefined)
      ?.user_version;
    const parsed = typeof value === 'number' ? value : Number(value ?? 0);
    return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 0;
  } catch {
    // Connections that cannot report a version are treated as new; every
    // baseline statement is idempotent.
    return 0;
  }
}

function appTableNames(db: QuickSQLiteConnection): string[] {
  const rows = db.execute(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%';",
  ).rows;
  const names: string[] = [];
  for (let index = 0; index < (rows?.length ?? 0); index += 1) {
    const name = (rows?.item(index) as {name?: unknown} | undefined)?.name;
    if (typeof name === 'string') names.push(name);
  }
  return names;
}

/**
 * Creates the baseline on a new database, resets any database from the old
 * chain, versioned (v1–v6) or not (decision G2), upgrades a baseline database
 * step by step, and leaves a current one untouched. A database newer than
 * this build is left alone as well.
 */
export function runMigrations(db: QuickSQLiteConnection): void {
  const version = readAppSchemaVersion(db);
  if (version >= APP_SCHEMA_VERSION) {
    return;
  }
  if (version >= BASELINE_SCHEMA_VERSION) {
    upgrade(db, version);
    return;
  }
  db.execute('BEGIN;');
  try {
    // Any table left by the old chain (including pre-versioned installs at
    // `user_version` 0) goes, so the baseline never meets an old shape.
    for (const table of appTableNames(db)) {
      db.execute(`DROP TABLE IF EXISTS "${table}";`);
    }
    for (const statement of BASELINE_STATEMENTS) {
      db.execute(statement);
    }
    db.execute(`PRAGMA user_version = ${APP_SCHEMA_VERSION};`);
    db.execute('COMMIT;');
  } catch (error) {
    db.execute('ROLLBACK;');
    throw error;
  }
}

function upgrade(db: QuickSQLiteConnection, from: number): void {
  db.execute('BEGIN;');
  try {
    for (let version = from; version < APP_SCHEMA_VERSION; version += 1) {
      for (const statement of UPGRADE_STEPS[version] ?? []) {
        db.execute(statement);
      }
    }
    db.execute(`PRAGMA user_version = ${APP_SCHEMA_VERSION};`);
    db.execute('COMMIT;');
  } catch (error) {
    db.execute('ROLLBACK;');
    throw error;
  }
}
