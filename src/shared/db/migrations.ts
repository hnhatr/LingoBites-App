import type {QuickSQLiteConnection} from 'react-native-quick-sqlite';

const MIGRATIONS = [
  `CREATE TABLE IF NOT EXISTS app_settings (
    key TEXT PRIMARY KEY NOT NULL,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );`,
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
    UNIQUE (lesson_id, vocabulary_id)
  );`,
  `CREATE INDEX IF NOT EXISTS idx_flashcards_lesson_id ON flashcards (lesson_id);`,
  `CREATE INDEX IF NOT EXISTS idx_flashcards_is_saved ON flashcards (is_saved);`,
  `CREATE TABLE IF NOT EXISTS review_schedule (
    card_id TEXT PRIMARY KEY NOT NULL,
    lesson_id TEXT NOT NULL,
    interval_days INTEGER NOT NULL,
    next_review_at TEXT NOT NULL,
    last_reviewed_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
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
    created_at TEXT NOT NULL
  );`,
  `CREATE INDEX IF NOT EXISTS idx_review_sessions_card_id ON review_sessions (card_id);`,
  `CREATE INDEX IF NOT EXISTS idx_review_sessions_reviewed_at ON review_sessions (reviewed_at DESC);`,
  // Append-only local outbox for offline review events (SETE-87 / ADR-2). Each
  // completed review write also inserts a row here in the same transaction; a
  // background drain worker sends pending rows to the server and sets
  // `synced_at` on success. `id` is the client-generated review session id and
  // doubles as the server-side idempotency key.
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
  // Offline chapter-audio cache (SETE-88, ADR-3). The server only serves a
  // manifest; audio files are downloaded straight to device storage and this
  // table tracks each file so the cache can stay bounded (cap + eviction).
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
  // Local gamification event log (SETE-89, ADR-4). This table is the ONLY input
  // to streak / XP / badge / pet state: the state is recomputed from it on app
  // start, never held only in transient UI state. Keeping the schema minimal
  // (as decided in ADR-4) makes the state auditable and testable.
  `CREATE TABLE IF NOT EXISTS gamification_events (
    id TEXT PRIMARY KEY NOT NULL,
    event_type TEXT NOT NULL,
    source_event_id TEXT,
    points INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
  );`,
  `CREATE INDEX IF NOT EXISTS idx_gamification_events_type_created ON gamification_events (event_type, created_at);`,
  // ---- SETE-107 / M2: offline content package import ----
  // One row per imported content package. `is_active` is the single source of
  // truth for "which package's lessons the app is currently serving" — there
  // must be at most one row with is_active = 1. Activation swap is performed
  // in a single transaction (see importer/ContentPackageImporter).
  `CREATE TABLE IF NOT EXISTS content_packages (
    id TEXT PRIMARY KEY NOT NULL,
    slug TEXT NOT NULL,
    schema_version TEXT NOT NULL,
    source_url TEXT NOT NULL,
    sha256 TEXT NOT NULL,
    is_active INTEGER NOT NULL DEFAULT 0,
    imported_at TEXT NOT NULL,
    deactivated_at TEXT
  );`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_content_packages_active_singleton
    ON content_packages (is_active) WHERE is_active = 1;`,
  `CREATE INDEX IF NOT EXISTS idx_content_packages_slug ON content_packages (slug);`,
  `CREATE INDEX IF NOT EXISTS idx_content_packages_imported_at
    ON content_packages (imported_at DESC);`,
  // One row per lesson in an imported package. `package_id` references
  // content_packages.id; the importer cascades deletes for a package.
  `CREATE TABLE IF NOT EXISTS content_lessons (
    id TEXT PRIMARY KEY NOT NULL,
    package_id TEXT NOT NULL,
    slug TEXT NOT NULL,
    schema_version TEXT NOT NULL,
    title_en TEXT NOT NULL,
    title_vi TEXT NOT NULL,
    blurb_vi TEXT NOT NULL,
    level TEXT NOT NULL,
    target_skills_json TEXT NOT NULL,
    estimated_duration_minutes INTEGER NOT NULL
  );`,
  `CREATE INDEX IF NOT EXISTS idx_content_lessons_package_id
    ON content_lessons (package_id);`,
  // One row per chunk in a lesson. Nested per-chunk arrays (dialogue_turns,
  // qa_items, srs_ref_ids, etc.) are stored as JSON to keep M2 schema small;
  // they are fully validated by the M1 content lint before insert.
  `CREATE TABLE IF NOT EXISTS content_items (
    id TEXT PRIMARY KEY NOT NULL,
    lesson_id TEXT NOT NULL,
    package_id TEXT NOT NULL,
    slug TEXT NOT NULL,
    chunk_order INTEGER NOT NULL,
    phrase_en TEXT NOT NULL,
    phrase_vi TEXT NOT NULL,
    explanation_vi TEXT NOT NULL,
    context_sentence_en TEXT,
    context_sentence_vi TEXT,
    payload_json TEXT NOT NULL
  );`,
  `CREATE INDEX IF NOT EXISTS idx_content_items_lesson_id
    ON content_items (lesson_id);`,
  `CREATE INDEX IF NOT EXISTS idx_content_items_package_id
    ON content_items (package_id);`,
  // One row per ancillary content unit (vocab, grammar, dialogue_turn, srs).
  // `unit_type` discriminates so a single table covers the four unit kinds
  // and consumers can `WHERE unit_type = 'vocabulary'`.
  `CREATE TABLE IF NOT EXISTS content_units (
    id TEXT PRIMARY KEY NOT NULL,
    lesson_id TEXT NOT NULL,
    package_id TEXT NOT NULL,
    unit_type TEXT NOT NULL,
    slug TEXT NOT NULL,
    payload_json TEXT NOT NULL
  );`,
  `CREATE INDEX IF NOT EXISTS idx_content_units_lesson_id
    ON content_units (lesson_id);`,
  `CREATE INDEX IF NOT EXISTS idx_content_units_package_id
    ON content_units (package_id);`,
  `CREATE INDEX IF NOT EXISTS idx_content_units_type
    ON content_units (unit_type);`,
  // One row per declared activity. Chunk references are stored as a JSON
  // array of content_items.id values.
  `CREATE TABLE IF NOT EXISTS content_activities (
    id TEXT PRIMARY KEY NOT NULL,
    lesson_id TEXT NOT NULL,
    package_id TEXT NOT NULL,
    slug TEXT NOT NULL,
    activity_type TEXT NOT NULL,
    title_vi TEXT NOT NULL,
    chunk_ref_ids_json TEXT NOT NULL,
    qa_ref_ids_json TEXT NOT NULL,
    instructions_vi TEXT
  );`,
  `CREATE INDEX IF NOT EXISTS idx_content_activities_lesson_id
    ON content_activities (lesson_id);`,
  `CREATE INDEX IF NOT EXISTS idx_content_activities_package_id
    ON content_activities (package_id);`,
  // Audio asset metadata only. File download + storage is M5 territory; this
  // row records the contract (url + checksum + size) so the player can later
  // resolve a content chunk's audio_ref_id to a downloadable file.
  `CREATE TABLE IF NOT EXISTS content_audio_assets (
    id TEXT PRIMARY KEY NOT NULL,
    lesson_id TEXT NOT NULL,
    package_id TEXT NOT NULL,
    slug TEXT NOT NULL,
    url TEXT NOT NULL,
    checksum TEXT NOT NULL,
    bytes INTEGER NOT NULL DEFAULT 0,
    locale TEXT,
    transcript TEXT
  );`,
  `CREATE INDEX IF NOT EXISTS idx_content_audio_assets_lesson_id
    ON content_audio_assets (lesson_id);`,
  `CREATE INDEX IF NOT EXISTS idx_content_audio_assets_package_id
    ON content_audio_assets (package_id);`,
  // ---- SETE-108 / M3: lesson runtime SRS item creation on exit ----
  // One row per M1-declared SRS item (`content_units.unit_type = 'srs'`) that
  // has actually been "completed" by the learner in the lesson runtime.
  // `srs_item_id` is the stable M1 content id (see schema/index.ts) and is
  // the upsert key: replaying the same lesson never duplicates a review item,
  // it only creates rows for chunks/qa/dialogue-turns not yet completed.
  // `next_review_at` is a placeholder (`now + 1 day`) until M4's real
  // fixed-interval scheduler (`modules/content/srs/contentScheduler`, SETE-109)
  // reschedules it on the item's first real review; MVP scheduling is fixed
  // transparent intervals per REQ-26, not SM-2/FSRS.
  `CREATE TABLE IF NOT EXISTS content_review_items (
    id TEXT PRIMARY KEY NOT NULL,
    srs_item_id TEXT NOT NULL UNIQUE,
    lesson_id TEXT NOT NULL,
    package_id TEXT NOT NULL,
    item_type TEXT NOT NULL,
    source_ref_id TEXT NOT NULL,
    front TEXT NOT NULL,
    back TEXT NOT NULL,
    hint_vi TEXT,
    mastery_state TEXT NOT NULL DEFAULT 'new',
    next_review_at TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );`,
  `CREATE INDEX IF NOT EXISTS idx_content_review_items_lesson_id
    ON content_review_items (lesson_id);`,
  `CREATE INDEX IF NOT EXISTS idx_content_review_items_next_review_at
    ON content_review_items (next_review_at);`,
  // ---- SETE-110 / M5: Speaking Room recordings + Error Notebook ----
  // Recording metadata only (REQ-20/21); the audio file itself lives in the
  // app's local documents/cache directory, not inline in SQLite. `mode`
  // identifies which Speaking Room mode produced the recording (shadowing,
  // quick_answer, standup, app_description, bug_report, mock_interview).
  `CREATE TABLE IF NOT EXISTS speaking_recordings (
    id TEXT PRIMARY KEY NOT NULL,
    activity_id TEXT,
    lesson_id TEXT,
    mode TEXT NOT NULL,
    file_path TEXT NOT NULL,
    duration_ms INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
  );`,
  `CREATE INDEX IF NOT EXISTS idx_speaking_recordings_lesson_id
    ON speaking_recordings (lesson_id);`,
  `CREATE INDEX IF NOT EXISTS idx_speaking_recordings_created_at
    ON speaking_recordings (created_at DESC);`,
  // Automatic Error Notebook capture (REQ-28/29). `category` is one of the six
  // required error categories; CON-6 requires this table to carry only
  // category/timing/outcome data, never the raw sentence spoken/typed or
  // audio bytes. `review_item_id` links to the `content_review_items` row
  // (M4) the error created or updated, tagged `item_type = 'speaking_error'`
  // there so delete-my-data can scope to just this milestone's contribution.
  `CREATE TABLE IF NOT EXISTS error_events (
    id TEXT PRIMARY KEY NOT NULL,
    source TEXT NOT NULL,
    category TEXT NOT NULL,
    activity_id TEXT,
    lesson_id TEXT,
    review_item_id TEXT,
    created_at TEXT NOT NULL
  );`,
  `CREATE INDEX IF NOT EXISTS idx_error_events_lesson_id
    ON error_events (lesson_id);`,
  `CREATE INDEX IF NOT EXISTS idx_error_events_created_at
    ON error_events (created_at DESC);`,
  // ---- SETE-145 / M6: Library persistence (packaged lesson state + grammar bookmarks) ----
  // One row per packaged content lesson to track saved/started state.
  // `is_started` is marked when the user presses "Start" on the catalog (D1).
  // This table is the single source of truth for which lessons appear in the
  // "Saved" and "Started" segments of the Library (TASK-03 / TASK-04).
  `CREATE TABLE IF NOT EXISTS content_lesson_state (
    lesson_id TEXT PRIMARY KEY NOT NULL,
    is_saved INTEGER NOT NULL DEFAULT 0,
    is_started INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );`,
  `CREATE INDEX IF NOT EXISTS idx_content_lesson_state_is_saved
    ON content_lesson_state (is_saved);`,
  `CREATE INDEX IF NOT EXISTS idx_content_lesson_state_is_started
    ON content_lesson_state (is_started);`,
  // Grammar bookmarks: persistent, not in SRS, with upsert/reactivate pattern.
  // `(lesson_id, grammar_id)` is the identity key. Unsave is recorded by setting
  // `reactivated_at = null` (idempotent). The `reactivated_at` field supports a
  // future "restore recently unsaved bookmarks" UI without re-reading tombstones.
  `CREATE TABLE IF NOT EXISTS grammar_bookmarks (
    lesson_id TEXT NOT NULL,
    grammar_id TEXT NOT NULL,
    package_id TEXT NOT NULL,
    saved_at TEXT NOT NULL,
    reactivated_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE(lesson_id, grammar_id)
  );`,
  `CREATE INDEX IF NOT EXISTS idx_grammar_bookmarks_lesson_id
    ON grammar_bookmarks (lesson_id);`,
  `CREATE INDEX IF NOT EXISTS idx_grammar_bookmarks_package_id
    ON grammar_bookmarks (package_id);`,
  // ---- SETE-126 / P8: Practice set, session, and events ----
  `CREATE TABLE IF NOT EXISTS practice_sets (
    id TEXT PRIMARY KEY NOT NULL,
    contract_version INTEGER NOT NULL,
    status TEXT NOT NULL,
    lesson_id TEXT NOT NULL,
    lesson_revision INTEGER NOT NULL,
    source_fingerprint TEXT NOT NULL,
    config_hash TEXT NOT NULL,
    seed TEXT,
    difficulty TEXT NOT NULL,
    requested_count INTEGER NOT NULL,
    set_revision INTEGER NOT NULL,
    generator_json TEXT NOT NULL,
    validation_summary_json TEXT,
    created_at TEXT NOT NULL,
    ready_at TEXT,
    error_json TEXT
  );`,
  `CREATE INDEX IF NOT EXISTS idx_practice_sets_lesson_id ON practice_sets (lesson_id);`,
  `CREATE TABLE IF NOT EXISTS practice_questions (
    id TEXT PRIMARY KEY NOT NULL,
    practice_set_id TEXT NOT NULL,
    variant TEXT NOT NULL,
    skill TEXT NOT NULL,
    difficulty TEXT NOT NULL,
    prompt_vi TEXT NOT NULL,
    explanation_vi TEXT NOT NULL,
    source_refs_json TEXT NOT NULL,
    source_snapshot_json TEXT NOT NULL,
    provenance_json TEXT NOT NULL,
    validation_json TEXT NOT NULL,
    payload_json TEXT NOT NULL
  );`,
  `CREATE INDEX IF NOT EXISTS idx_practice_questions_set_id ON practice_questions (practice_set_id);`,
  `CREATE TABLE IF NOT EXISTS practice_sessions (
    id TEXT PRIMARY KEY NOT NULL,
    practice_set_id TEXT NOT NULL,
    set_revision INTEGER NOT NULL,
    lesson_id TEXT NOT NULL,
    lesson_revision INTEGER NOT NULL,
    status TEXT NOT NULL,
    question_order_json TEXT NOT NULL,
    current_index INTEGER NOT NULL,
    attempt_no INTEGER NOT NULL,
    started_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    completed_at TEXT
  );`,
  `CREATE INDEX IF NOT EXISTS idx_practice_sessions_lesson_id ON practice_sessions (lesson_id);`,
  `CREATE INDEX IF NOT EXISTS idx_practice_sessions_status ON practice_sessions (status);`,
  `CREATE TABLE IF NOT EXISTS practice_events (
    event_id TEXT PRIMARY KEY NOT NULL,
    contract_version INTEGER NOT NULL,
    session_id TEXT NOT NULL,
    question_id TEXT NOT NULL,
    sequence INTEGER NOT NULL,
    selected_option_id TEXT,
    is_correct INTEGER NOT NULL,
    answered_at TEXT NOT NULL,
    duration_ms INTEGER NOT NULL,
    try_index INTEGER NOT NULL,
    grading_json TEXT NOT NULL,
    sync_status TEXT NOT NULL
  );`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_practice_events_session_sequence ON practice_events (session_id, sequence);`,
  `CREATE INDEX IF NOT EXISTS idx_practice_events_sync_status ON practice_events (sync_status);`,
  // ---- SETE-229 / T11: saved YouTube lessons ----
  `CREATE TABLE IF NOT EXISTS youtube_lessons (
    id TEXT PRIMARY KEY NOT NULL,
    schema_version TEXT NOT NULL,
    video_id TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    channel_title TEXT NOT NULL,
    duration_seconds INTEGER NOT NULL,
    language TEXT NOT NULL,
    embeddable INTEGER NOT NULL,
    transcript_source TEXT NOT NULL,
    warnings_json TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );`,
  `CREATE INDEX IF NOT EXISTS idx_youtube_lessons_updated_at
    ON youtube_lessons (updated_at DESC);`,
  `CREATE TABLE IF NOT EXISTS youtube_sentences (
    lesson_id TEXT NOT NULL,
    sentence_id TEXT NOT NULL,
    idx INTEGER NOT NULL,
    start_ms INTEGER NOT NULL,
    end_ms INTEGER NOT NULL,
    en TEXT NOT NULL,
    vi TEXT NOT NULL,
    ipa TEXT NOT NULL,
    PRIMARY KEY (lesson_id, sentence_id)
  );`,
  `CREATE INDEX IF NOT EXISTS idx_youtube_sentences_lesson_id
    ON youtube_sentences (lesson_id, idx);`,
  // ---- SETE-290 / DEV-3: per-video resume progress ----
  `CREATE TABLE IF NOT EXISTS youtube_progress (
    lesson_id TEXT PRIMARY KEY NOT NULL,
    position_ms INTEGER NOT NULL,
    segment_index INTEGER NOT NULL,
    updated_at TEXT NOT NULL
  );`,
  `CREATE INDEX IF NOT EXISTS idx_youtube_progress_updated_at
    ON youtube_progress (updated_at DESC);`,
  `ALTER TABLE flashcards ADD COLUMN revision INTEGER NOT NULL DEFAULT 0;`,
  `ALTER TABLE flashcards ADD COLUMN tombstone INTEGER NOT NULL DEFAULT 0;`,
  `ALTER TABLE review_schedule ADD COLUMN revision INTEGER NOT NULL DEFAULT 0;`,
  `ALTER TABLE review_schedule ADD COLUMN tombstone INTEGER NOT NULL DEFAULT 0;`,
  `ALTER TABLE review_sessions ADD COLUMN revision INTEGER NOT NULL DEFAULT 0;`,
  `ALTER TABLE review_sessions ADD COLUMN tombstone INTEGER NOT NULL DEFAULT 0;`,
  `ALTER TABLE gamification_events ADD COLUMN revision INTEGER NOT NULL DEFAULT 0;`,
  `ALTER TABLE gamification_events ADD COLUMN tombstone INTEGER NOT NULL DEFAULT 0;`,
  `ALTER TABLE content_review_items ADD COLUMN revision INTEGER NOT NULL DEFAULT 0;`,
  `ALTER TABLE content_review_items ADD COLUMN tombstone INTEGER NOT NULL DEFAULT 0;`,
  `ALTER TABLE content_lesson_state ADD COLUMN revision INTEGER NOT NULL DEFAULT 0;`,
  `ALTER TABLE content_lesson_state ADD COLUMN tombstone INTEGER NOT NULL DEFAULT 0;`,
  `ALTER TABLE grammar_bookmarks ADD COLUMN revision INTEGER NOT NULL DEFAULT 0;`,
  `ALTER TABLE grammar_bookmarks ADD COLUMN tombstone INTEGER NOT NULL DEFAULT 0;`,
  `ALTER TABLE youtube_lessons ADD COLUMN revision INTEGER NOT NULL DEFAULT 0;`,
  `ALTER TABLE youtube_lessons ADD COLUMN tombstone INTEGER NOT NULL DEFAULT 0;`,
  `ALTER TABLE youtube_sentences ADD COLUMN revision INTEGER NOT NULL DEFAULT 0;`,
  `ALTER TABLE youtube_sentences ADD COLUMN tombstone INTEGER NOT NULL DEFAULT 0;`,
  `ALTER TABLE youtube_progress ADD COLUMN revision INTEGER NOT NULL DEFAULT 0;`,
  `ALTER TABLE youtube_progress ADD COLUMN tombstone INTEGER NOT NULL DEFAULT 0;`,
];

/**
 * Reverse-order DROP statements corresponding 1:1 with the entries in
 * `MIGRATIONS` added by the M2 content-package task (SETE-107). Used by
 * `downgradeMigrations` to satisfy CHANGE-3: any schema migration added in
 * this task must be reversible.
 *
 * Only the M2 tables are listed; earlier SETE-8x migrations are out of scope
 * for the M2 down path because they pre-date the package feature and are not
 * touched by the importer. If a down path for them is needed, add it there.
 */
/**
 * Reverse-order DROP statements for the M3 lesson-runtime table (SETE-108).
 * Kept separate from `DOWN_MIGRATIONS_M2` so each milestone's rollback stays
 * independently addressable, matching the CHANGE-3 convention.
 */
const DOWN_MIGRATIONS_M3: string[] = [
  `DROP INDEX IF EXISTS idx_content_review_items_next_review_at;`,
  `DROP INDEX IF EXISTS idx_content_review_items_lesson_id;`,
  `DROP TABLE IF EXISTS content_review_items;`,
];

/**
 * Reverse-order DROP statements for the M5 Speaking Room / Error Notebook
 * tables (SETE-110). Kept separate so each milestone's rollback stays
 * independently addressable, matching the CHANGE-3 convention.
 */
const DOWN_MIGRATIONS_M5: string[] = [
  `DROP INDEX IF EXISTS idx_error_events_created_at;`,
  `DROP INDEX IF EXISTS idx_error_events_lesson_id;`,
  `DROP TABLE IF EXISTS error_events;`,
  `DROP INDEX IF EXISTS idx_speaking_recordings_created_at;`,
  `DROP INDEX IF EXISTS idx_speaking_recordings_lesson_id;`,
  `DROP TABLE IF EXISTS speaking_recordings;`,
];

/**
 * Reverse-order DROP statements for the M6 Library persistence tables
 * (SETE-145 / TASK-03). Kept separate so M6's rollback stays independently
 * addressable, matching the CHANGE-3 convention.
 */
const DOWN_MIGRATIONS_M6: string[] = [
  `DROP INDEX IF EXISTS idx_grammar_bookmarks_package_id;`,
  `DROP INDEX IF EXISTS idx_grammar_bookmarks_lesson_id;`,
  `DROP TABLE IF EXISTS grammar_bookmarks;`,
  `DROP INDEX IF EXISTS idx_content_lesson_state_is_started;`,
  `DROP INDEX IF EXISTS idx_content_lesson_state_is_saved;`,
  `DROP TABLE IF EXISTS content_lesson_state;`,
];



const DOWN_MIGRATIONS_M8: string[] = [
  `DROP INDEX IF EXISTS idx_practice_events_sync_status;`,
  `DROP INDEX IF EXISTS idx_practice_events_session_sequence;`,
  `DROP TABLE IF EXISTS practice_events;`,
  `DROP INDEX IF EXISTS idx_practice_sessions_status;`,
  `DROP INDEX IF EXISTS idx_practice_sessions_lesson_id;`,
  `DROP TABLE IF EXISTS practice_sessions;`,
  `DROP INDEX IF EXISTS idx_practice_questions_set_id;`,
  `DROP TABLE IF EXISTS practice_questions;`,
  `DROP INDEX IF EXISTS idx_practice_sets_lesson_id;`,
  `DROP TABLE IF EXISTS practice_sets;`,
];

const DOWN_MIGRATIONS_M9: string[] = [
  `DROP INDEX IF EXISTS idx_youtube_sentences_lesson_id;`,
  `DROP TABLE IF EXISTS youtube_sentences;`,
  `DROP INDEX IF EXISTS idx_youtube_lessons_updated_at;`,
  `DROP TABLE IF EXISTS youtube_lessons;`,
];

const DOWN_MIGRATIONS_M10: string[] = [
  `DROP INDEX IF EXISTS idx_youtube_progress_updated_at;`,
  `DROP TABLE IF EXISTS youtube_progress;`,
];

const DOWN_MIGRATIONS_M2: string[] = [
  `DROP INDEX IF EXISTS idx_content_audio_assets_package_id;`,
  `DROP INDEX IF EXISTS idx_content_audio_assets_lesson_id;`,
  `DROP TABLE IF EXISTS content_audio_assets;`,
  `DROP INDEX IF EXISTS idx_content_activities_package_id;`,
  `DROP INDEX IF EXISTS idx_content_activities_lesson_id;`,
  `DROP TABLE IF EXISTS content_activities;`,
  `DROP INDEX IF EXISTS idx_content_units_type;`,
  `DROP INDEX IF EXISTS idx_content_units_package_id;`,
  `DROP INDEX IF EXISTS idx_content_units_lesson_id;`,
  `DROP TABLE IF EXISTS content_units;`,
  `DROP INDEX IF EXISTS idx_content_items_package_id;`,
  `DROP INDEX IF EXISTS idx_content_items_lesson_id;`,
  `DROP TABLE IF EXISTS content_items;`,
  `DROP INDEX IF EXISTS idx_content_lessons_package_id;`,
  `DROP TABLE IF EXISTS content_lessons;`,
  `DROP INDEX IF EXISTS idx_content_packages_imported_at;`,
  `DROP INDEX IF EXISTS idx_content_packages_slug;`,
  `DROP INDEX IF EXISTS idx_content_packages_active_singleton;`,
  `DROP TABLE IF EXISTS content_packages;`,
];

export function runMigrations(db: QuickSQLiteConnection): void {
  for (const sql of MIGRATIONS) {
    try {
      db.execute(sql);
    } catch (error) {
      // Ignore "duplicate column name" errors for ALTER TABLE ADD COLUMN
      // This makes migrations idempotent since they run on every app launch
      if (
        error instanceof Error &&
        error.message.includes('duplicate column name')
      ) {
        continue;
      }
      throw error;
    }
  }
}

/**
 * Reverse the M2 content-package schema migrations. Provided so the package
 * tables can be rolled back without touching earlier SETE-8x tables. Used
 * in tests; production code should call this only via an explicit operator
 * action (e.g. a maintenance screen or a "reset content" debug action).
 */
export function downgradeContentPackageMigrations(
  db: QuickSQLiteConnection,
): void {
  for (const sql of DOWN_MIGRATIONS_M2) {
    db.execute(sql);
  }
}

/**
 * Reverse the M3 lesson-runtime schema migration (SETE-108). Used in tests;
 * production code should call this only via an explicit operator action.
 */
export function downgradeLessonRuntimeMigrations(
  db: QuickSQLiteConnection,
): void {
  for (const sql of DOWN_MIGRATIONS_M3) {
    db.execute(sql);
  }
}

/**
 * Reverse the M5 Speaking Room / Error Notebook schema migrations
 * (SETE-110). Used in tests; production code should call this only via an
 * explicit operator action.
 */
export function downgradeSpeakingRoomMigrations(
  db: QuickSQLiteConnection,
): void {
  for (const sql of DOWN_MIGRATIONS_M5) {
    db.execute(sql);
  }
}

/**
 * Reverse the M6 Library persistence schema migrations (SETE-145 / TASK-03).
 * Used in tests; production code should call this only via an explicit operator action.
 */
export function downgradeLibraryPersistenceMigrations(
  db: QuickSQLiteConnection,
): void {
  for (const sql of DOWN_MIGRATIONS_M6) {
    db.execute(sql);
  }
}



/** Reverse the M8 practice schema migration. */
export function downgradePracticeMigrations(db: QuickSQLiteConnection): void {
  for (const sql of DOWN_MIGRATIONS_M8) {
    db.execute(sql);
  }
}

/** Reverse the SETE-229 saved YouTube lesson schema migration. */
export function downgradeYouTubeLessonMigrations(
  db: QuickSQLiteConnection,
): void {
  for (const sql of DOWN_MIGRATIONS_M9) {
    db.execute(sql);
  }
}

/** Reverse the SETE-290 YouTube resume-progress schema migration. */
export function downgradeYouTubeProgressMigrations(
  db: QuickSQLiteConnection,
): void {
  for (const sql of DOWN_MIGRATIONS_M10) {
    db.execute(sql);
  }
}
