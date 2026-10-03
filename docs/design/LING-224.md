# Technical Design

## Metadata

Feature: Complete Speaking Shadowing (App + BE): lesson sessions, sentence-linked recordings with consent upload, synced attempts, Ôn tập cards, deletion on both sides
Issue: LING-224 (Workflow v2, LARGE, Invariants REQUIRED, Mode = Plan + Implement, QA = Skip, Max rounds = 3)
Status: READY
Feature Spec: `spec-LING-224-r1.md` (attachment `01a10303-5eb7-7410-a84b-95510bedd2f0`, SPEC_PASSED); baseline Record `01a102f9-e616-789d-b533-3665c495e9eb`
Repository / base / inspected SHA: LingoBites-Server `main` @ `1ec3d91e4867ff5b1446e4e2eca2fbca99232ce3`; LingoBites-App `main` @ `ede9ffcc893dab9a0fecbf9742408f5296deb5d4` (static reading; no test, tsc or app run). Paths below: `S:` = Server, `A:` = App.

## 1. Summary

The Server gets sentence-linked recordings (migration 027) with an idempotent create, list filters, "one completed recording per sentence" enforced in the database, and an owner-scoped delete-all guarded by a purge watermark (FR-022..FR-025). Sync gets a validated `speaking_attempts` collection holding one entity per sentence, metadata only (FR-026). The App gets local schema v4 with `sentence_id`, the upload state and a `speaking_attempts` table (FR-016). One SQLite transaction per save writes the recording, the attempt, the outbox mutation and the Ôn tập card (FR-010, FR-017, FR-019, FR-028, FR-029). A single-flight durable upload queue replaces `recordingUploadWorker` (FR-020, FR-021). The delete paths sweep `LingoBitesRecordings` and persist the Server-side work across restarts (FR-018, FR-027). The UI covers S1–S7 and the Settings row (FR-001..FR-015, FR-030).

## 2. Current Architecture

- Server recordings: `S:src/modules/recordings/controller/recordings.ts` (712 lines; POST create returns relative `/v1/recordings/:id/content`; PUT streams and validates size/SHA-256 and then calls `completeRecording`; GET list `limit ≤ 100`; DELETE `:id` deletes the object first, then the metadata). Store `S:src/modules/recordings/repository/store.ts` (raw SQL plus Prisma, atomic `DELETE … RETURNING`). Table from `S:src/common/database/migrations/007_recordings.sql`, Prisma model `Recordings` in `S:prisma/schema.prisma:317-333`. Abandoned and orphan sweep `sweepAbandonedRecordings` in `S:src/app/service/cleanup.ts:97`. Account merge reassigns `recordings.user_id` without any collision handling (`S:src/modules/admin/repository/adminStore.ts:485-492`). Migrations are applied by filename inside one transaction under an advisory lock (`S:src/common/database/migrate.ts`); the last file is `026_*`.
- Server sync: the `SyncCollectionSchema` enum (9 values) and a free-form payload (`S:src/modules/sync/model/sync.ts`). Last-writer-wins by (`occurred_at`, `mutation_id`) via `incomingWins` (`S:src/modules/sync/repository/store.ts`). Per-mutation checks run in the push controller loop (`S:src/modules/sync/controller/sync.ts:131-170`).
- App DB: `APP_SCHEMA_VERSION = 3`. `ensureSchemaV3Upgrade` is gated on `>= APP_SCHEMA_VERSION` and writes `user_version = ${APP_SCHEMA_VERSION}` (`A:src/core/db/migrations.ts:724-765`; the file has 837 lines). `speaking_recordings` has no sentence column (`A:migrations.ts:237-249`).
- App sync: a generic outbox in `sync_outbox`, where a tombstone is a payload `{tombstone:true}` and `occurred_at = createdAt` (`A:src/features/sync/logic/outboxSync.ts:322-330`). The generic pull keeps a local row when `revision = 0` and applies a tombstone by delete or flag (`A:src/features/sync/logic/pullWorker.ts:195-255`). `lesson_progress` has a dedicated apply in `A:src/core/sync/lessonProgress.ts`. The drain ownership check reads the `app_settings.current_account_id` setting (`A:src/core/sync/syncDrainOwnership.ts`).
- App upload: `A:src/features/speaking/logic/recordingUploadWorker.ts` sends `audio/m4a`, uses the relative URL, swallows errors and never retries. `authenticatedFetch` sends a request even when there is no session (`A:src/core/api/authenticatedFetch.ts`). `ensureValidSession` returns `userId` (`A:src/core/auth/authSession.ts:32`).
- App deletion: `clearAllLocalDatabaseRows` runs statement by statement with no transaction, and deletes `sync_outbox` and the whole of `app_settings` (including `current_account_id`) (`A:src/core/db/localDataWipe.ts`). Both delete actions unlink only the paths that have a DB row (`A:src/features/profile/logic/LocalDataDeletionService.ts`).
- Ôn tập: `saveFlashcard` checks the existing card (lesson_id, vocabulary_id) and inserts it, then inserts a due `review_schedule` row. It enqueues no sync mutation (`A:src/features/review/logic/FlashcardRepository.ts:82-157`).
- Navigation and Today: `SpeakingShadowing` exists only in the Lessons stack (`A:src/app/navigation/AppNavigator.tsx:158-167`). The speaking-gap and interview activities both target `SpeakingRoom` (`A:src/features/today/logic/adaptationEngine.ts:199-224`). `resolveTodayNavigation` maps `SpeakingShadowing` to `SpeakingRoom`.
- TTS: `speak(text, locale, rate)` accepts a rate in (0,1), default 0.5 (`A:src/features/audio/logic/ttsService.ts`). The recorder is called as `startRecorder(filePath)` with no audio set (`A:src/features/speaking/logic/recordingService.ts:148`).

## 3. Proposed Changes

| Change | Component / path | What changes | Depends on (direction) | Requirements |
|---|---|---|---|---|
| NEW | `S:…/migrations/027_recording_sentence_link.sql` (+`.down.sql`), `S:prisma/schema.prisma` | Recording columns, unique indexes, `recording_purges` (§5) | — | FR-022, FR-024, NFR-004 |
| MODIFY | `S:src/modules/recordings/{model,repository/store,controller/recordings}.ts`; NEW `controller/recordingsBulk.ts` | Create fields and idempotency, list filters, supersede and watermark on completion, `DELETE /v1/recordings` | controller → store → Postgres/storage | FR-022..FR-025, NFR-003 |
| MODIFY | `S:src/modules/admin/repository/adminStore.ts` | Merge drops source rows that collide on (user, mode, sentence) completed (target wins) | admin → recordings table | INV-003 |
| MODIFY | `S:src/modules/sync/{model,controller}/sync.ts` | `speaking_attempts` in allowlist plus strict payload validation | controller → model | FR-026, BR-005 |
| NEW | `A:src/core/db/schemaV4.ts`; MODIFY `migrations.ts`, `types.ts` | Schema v4 (§5); V3 gate pinned to literal 3 | db → — | FR-016 |
| NEW | `A:src/core/sync/speakingAttempts.ts` | Entity id, payload builder and schema, pull apply (LWW and tombstone) | features/sync, features/speaking → core | FR-026, BR-005 |
| NEW | `A:src/features/speaking/logic/shadowing/{saveShadowingAttempt,shadowingLessons,shadowingProgress}.ts`, `data/SpeakingAttemptRepository.ts` | Save transaction, sentences by `position`, BR-008 status and resume | speaking → review barrel, core | FR-003, FR-004, FR-010, FR-014, FR-017, FR-019, FR-028 |
| NEW | `A:src/features/speaking/logic/upload/{recordingUploadQueue,recordingConsent,serverRecordingDeletion}.ts` | Durable queue, consent, delete-all marker | speaking → api client → core/api | FR-020, FR-021, FR-025, FR-027 |
| MODIFY | `A:src/core/api/authenticatedFetch.ts` | Optional `expectedUserId`: throws `SyncOwnershipChangedError` before sending when there is no valid session or a different user | — | BR-001, BR-009 |
| MODIFY | `A:…/api/recordingClient.ts`, `A:src/core/schemas/recordings.ts`, `recordingService.ts` | Contract r1 mirror; `deleteAllRecordings`, `listRecordings`, content download; audio set pinned; `deleteRecordingsDirectory()` | — | FR-018, FR-020, FR-030, A-016 |
| MODIFY | `A:src/core/db/localDataWipe.ts`, `A:…/profile/logic/LocalDataDeletionService.ts` | Wipe in one transaction with an `afterWipe` hook; keeps `current_account_id`; directory sweep | profile → speaking barrel → core | FR-018, FR-027 |
| NEW / REMOVE | Screens S2, session S3–S6, S7, Settings row; REMOVE `SpeakingShadowingActivity.tsx`, `recordingUploadWorker.ts`, `errorNotebookService.ts` (+ test) | §10 | app → features | FR-001..FR-015, FR-029, FR-030 |
| MODIFY | `AppNavigator.tsx`, `immersiveTabRoutes.ts`, nav types (home, library, speaking), Today (`adaptationEngine.ts`, `todayNavigation.ts`, `TodayScreen.tsx`), `SpeakingRoomScreen.tsx`, `ProfileScreenView.tsx`, `App.tsx` | Routes `ShadowingLessonPicker`, `ShadowingSession {lessonId}`, `ShadowingSummary {…}` in both stacks; speaking-gap targets `SpeakingShadowing`; queue start/stop | app → features | FR-001, FR-002, FR-014, FR-015 |

Non-goals (by spec ID): FU-1..FU-5, P-001..P-009, A-013 formula changes, flashcard creation sync (A-018/E-027 unchanged), the other five modes (F6), Web Admin, lesson content.

Proposed save flow (one synchronous `withTransaction`, `A:src/core/db/database.ts:37`):
1. Look up `speaking_recordings.id = takeId`. If found, return it (idempotent replay).
2. INSERT the recording (`upload_state = consent=='on' ? 'pending' : 'local_only'`, `owner_user_id = current_account_id`).
3. DELETE the other rows for the same (mode, sentence_id).
4. UPSERT `speaking_attempts`.
5. Enqueue the outbox mutation.
6. When the attempt failed, call `saveFlashcard`; `ok:false` throws, which rolls back the transaction.

After COMMIT: unlink the replaced files, kick the queue, call `requestSync()`.

## 4. Architecture Decisions

### AD-001 — Server keeps one completed recording per (user, mode, sentence) through a partial unique index plus a serialized completion transaction
- Requirements: FR-024, BR-003, INV-003, EC-008.
- Decision and rationale: completion runs in one transaction:
  1. `SELECT … FOR UPDATE` on the row.
  2. Reject the row if it is not pending, or if it is purged (AD-003).
  3. `pg_advisory_xact_lock(hashtextextended(user_id||':'||mode||':'||sentence_id,0))`.
  4. DELETE the other **completed** rows of the same key (`RETURNING object_key`).
  5. UPDATE this row to completed, then COMMIT.
  6. Delete the superseded objects after commit, best-effort. A failure here is left to the orphan sweep (`cleanup.ts`).

  Any failure rolls back, so the previous recording survives. Pending rows of the same sentence are not deleted. They supersede when they complete, or they expire, which keeps EC-008 "later-completed wins" and FR-024 "pending never removes completed".
- Simpler alternative and why it is insufficient: delete the others after the UPDATE without a lock. Two concurrent completions each see the other as pending, and both stay completed.
- Consequences: the account merge must drop colliding source rows, or the merge fails on the index.

### AD-002 — Idempotent create via `client_recording_id`
- Requirements: FR-020, EC-003, INV-008.
- Decision and rationale: POST requires `client_recording_id` (the App `speaking_recordings.id`, which is the take id), with UNIQUE(user_id, client_recording_id).
  - A replay with the same content gets 200 and the existing row.
  - A replay with different content gets 409 `RECORDING_IDEMPOTENCY_CONFLICT`.
  - The App job needs no persisted intermediate state. A kill between create and PUT resumes on the same row.
- Simpler alternative: a retried POST creates a new pending row that expires after 24 h. That works, but it leaves orphan rows and gives no mapping from a local recording to its Server row.

### AD-003 — Delete-all with a per-user purge watermark
- Requirements: FR-025, FR-027, BR-004, INV-004, EC-009.
- Decision and rationale: `DELETE /v1/recordings` runs in this order:
  1. Upsert `recording_purges(user_id, purged_at = now())` and commit.
  2. List the user's keys and delete those objects. A storage failure answers 502 retryable.
  3. `DELETE … WHERE user_id RETURNING object_key`, then delete any keys not covered by step 2.

  A completion never succeeds for a row with `created_at <= purged_at`. Such a row is deleted, its object is deleted, and the client gets 409 `RECORDING_PURGED`. This closes the in-flight PUT race (including from another device) using one DB clock.
- Simpler alternative: rely on App ordering only. That covers one device, but not a PUT from another device that is already in flight.

### AD-004 — `speaking_attempts` entity = one per sentence (`shadowing:<sentence_id>`), LWW, local apply mirrors Server LWW
- Requirements: FR-026, BR-008, INV-005, EC-014.
- Decision and rationale: the latest attempt per sentence is all that BR-008 needs. It also bounds the data, makes duplicates impossible by key, and makes "Xoá dữ liệu" one tombstone per sentence.
- Pull apply (`core/sync/speakingAttempts.ts`, dispatched from `applySyncRecord` like `lesson_progress`) compares the remote `occurred_at` with the local key. The local key is the row's `practiced_at`, or else the newest **unsynced** outbox mutation for the entity. A remote value that is newer or equal is applied; an older one is skipped. Whichever side wins locally is also the side Server LWW keeps, so the devices converge in any order.
- A tombstone deletes the attempt row and the recording rows of the sentence in the pull transaction. The files are unlinked after commit.
- Simpler alternative: the generic `revision = 0` skip. It loses convergence when a pulled tombstone is skipped, the cursor advances, and the pending push then turns out `stale`.

### AD-005 — Upload queue lives on `speaking_recordings` (one job per row), single-flight executor
- Requirements: FR-020, FR-021, BR-001, BR-009, INV-001, INV-002, INV-008, NFR-001.
- Decision and rationale:
  - **States.** `upload_state` is one of `local_only | pending | uploaded | failed`, with `upload_attempts`, `upload_next_at` and `upload_error`. One process-wide promise chain runs the jobs.
  - **Each job.** A job runs in this order:
    1. Re-read the row.
    2. Require consent `on` and `isAccountStillOwner(owner)`.
    3. Create, then PUT, with `authenticatedFetch(…, {expectedUserId: owner})`.
    4. Before the PUT, re-check that the row is still `pending` and that no delete marker exists.
  - **Completion.** A successful completion is a conditional `UPDATE … WHERE upload_state='pending'`.
  - **Retries.** Transient failures back off with `syncRetryDelayMsWithJitter` and have no cap (the delay is capped at 5 min). Transient failures are network/timeout, 5xx, 429, 401 after refresh, no session, and PUT 404 (the row expired, so the next attempt starts again from POST).
  - **Permanent failures** set `failed` and keep the file: 400, 413, 422, 409 `RECORDING_IDEMPOTENCY_CONFLICT`, and 409 `RECORDING_PURGED`. A PUT answering 409 `RECORDING_ALREADY_COMPLETED` counts as `uploaded`.
  - **Triggers.** App start, AppState `active`, after a save, and after a consent or delete change.
- Simpler alternative: a separate jobs table. It adds a second source of truth for one-job-per-recording.

### AD-006 — Server-side delete request is a durable marker processed first by the same executor
- Requirements: FR-025, FR-027, BR-004, BR-010, INV-004.
- Decision and rationale: one transaction writes `app_settings['speaking.pending_server_delete'] = {owner_user_id, requested_at}` and sets every non-`local_only` row to `local_only` (clearing `server_recording_id`). The executor handles the marker before any job, and clears it only on 200 with the same `requested_at`. Single-flight means that no upload from this device is in flight when DELETE is sent. "Xoá dữ liệu" also enqueues one tombstone per attempt.
- Simpler alternative: call delete-all inline from the UI. That fails offline and on restart (NFR-001).

### AD-007 — Full "Xoá dữ liệu" wipes in one transaction and keeps `current_account_id`
- Requirements: FR-027, BR-004.
- Decision and rationale: `clearAllLocalDatabaseRows({afterWipe})` runs the DB deletes plus `afterWipe` in `withTransaction`. `afterWipe` re-inserts the tombstones and the marker. `app_settings` is wiped except `current_account_id`. Otherwise the outbox drain ownership check fails while a session exists (`syncDrainOwnership.ts:48-63`), and the tombstones would never be pushed. Consent is wiped (asked again).
- Simpler alternative: push before wiping. That fails offline (AC-027 S2).
- Consequence: a behavior change to the existing wipe (IMP-002, Q-002).

### AD-008 — Ôn tập card key `vocabulary_id = 'shadowing:<sentence_id>'`
- Requirements: FR-028, BR-006, INV-007.
- Decision and rationale: reuse `saveFlashcard` (front `text_en`, `meaning_vi = text_vi`, `ipa`) inside the save transaction. UNIQUE(lesson_id, vocabulary_id) plus the existing check-then-insert on one synchronous connection guarantees a single card. No new review code.

## 5. Contracts, Data and Migration

**Contract revision `LING-224-contract-r1`** (this section). WP-02 and WP-03 own it and its contract tests. The App mirrors it in `A:src/core/schemas/recordings.ts` and `A:src/core/sync/speakingAttempts.ts`. Errors use the existing `apiError` envelope.

| Endpoint | Request | Success | Errors (new in bold) |
|---|---|---|---|
| `POST /v1/recordings` | `mime_type`, `byte_size`, `sha256` + **`client_recording_id` uuid, `lesson_id` uuid, `sentence_id` uuid, `mode` ∈ SpeakingMode (6 App values), `duration_ms` int 1..35000** | 201 new / **200 replay**, `{recording, upload:{method:'PUT', url:'/v1/recordings/:id/content', content_type}}` | 400 `VALIDATION_RECORDING` (field), `RECORDING_UNSUPPORTED_MIME`, `RECORDING_INVALID_SIZE`, `RECORDING_INVALID_CHECKSUM`; **409 `RECORDING_IDEMPOTENCY_CONFLICT`**; 401; 503 |
| `PUT /v1/recordings/:id/content` | bytes, `Content-Type: audio/mp4` | 200 `{recording}` | unchanged + **409 `RECORDING_PURGED`** (row and object removed, non-retryable) |
| `GET /v1/recordings` | `limit`, **`lesson_id`, `sentence_id`** (optional uuids, AND, owner-scoped) | 200 `{recordings}` | 400 `VALIDATION_RECORDING` |
| `DELETE /v1/recordings` (new) | — | 200 `{request_id, status:'success', deleted_count, purged_at}`; idempotent | 401, 502 `RECORDING_STORAGE_ERROR` (retryable), 503 |
| GET `:id`, GET `:id/content`, DELETE `:id` | unchanged | view adds the 5 fields | unchanged (NFR-003) |
| `POST /v1/sync/push` | collection **`speaking_attempts`**, `entity_id = '<mode>:<sentence_id>'`, payload strict `{lesson_id, sentence_id, mode, check_full_sentence, check_key_words, check_rhythm: bool, duration_ms 1..35000, recording_id: uuid\|null}`; tombstone payload `{}` | unchanged | **400 `VALIDATION_SYNC`** for an unknown key, a type error or an entity/sentence mismatch (whole batch, existing rule) |

`RecordingView` adds `client_recording_id`, `lesson_id`, `sentence_id`, `mode` and `duration_ms`. `SYNC_CONTRACT_VERSION` stays 2, because an additive enum value is skipped by older pullers (`pullWorker.ts` AD-008). `lesson_id` and `sentence_id` have no foreign key, because content republishing must not orphan or cascade recordings. The App joins the upload URL with `apiBaseUrl` by trimming slashes, and refuses an absolute URL whose origin differs from `apiBaseUrl` (the bearer token never leaves the API origin).

**Server data, migration `027_recording_sentence_link.sql`:**
- Pre-check `DO $$ … IF EXISTS (SELECT 1 FROM recordings) THEN RAISE EXCEPTION …`. The migration does no backfill and destroys nothing.
- Add the NOT NULL columns `client_recording_id uuid`, `lesson_id uuid`, `sentence_id uuid`, `mode text CHECK (6 values)` and `duration_ms integer CHECK (1..35000)`.
- Indexes: `UNIQUE (user_id, client_recording_id)`, `UNIQUE (user_id, mode, sentence_id) WHERE status='completed'` and `(user_id, lesson_id)`.
- `CREATE TABLE recording_purges (user_id uuid PRIMARY KEY REFERENCES users ON DELETE CASCADE, purged_at timestamptz NOT NULL)`.
- `.down.sql` drops all of the above. Prisma models are updated to match.

**App data, schema v4 (`ensureSchemaV4Upgrade`, one transaction, gate `>= 4`, `PRAGMA user_version = 4`, `APP_SCHEMA_VERSION = 4`):**
- The V3 gate and write become the literal `3`. Without this, a v3 DB would re-run V3 and jump straight to 4.
- `speaking_recordings` ADD `sentence_id TEXT`, `owner_user_id TEXT`, `upload_state TEXT NOT NULL DEFAULT 'local_only'`, `upload_attempts INTEGER NOT NULL DEFAULT 0`, `upload_next_at TEXT`, `upload_error TEXT` and `server_recording_id TEXT`. The ALTER tolerates the "duplicate column name" error. Old rows get NULL `sentence_id` and `local_only` (no backfill, never uploaded).
- Indexes `(mode, sentence_id)` and `(upload_state, upload_next_at)`.
- `speaking_attempts(id TEXT PK, lesson_id, sentence_id, mode, practiced_at, check_full_sentence, check_key_words, check_rhythm INTEGER, duration_ms INTEGER, recording_id TEXT, revision INTEGER NOT NULL DEFAULT 0, updated_at TEXT)` plus an index `(lesson_id, practiced_at DESC)`.
- Tombstones are hard deletes locally. A pending tombstone lives in `sync_outbox`.
- `speaking_attempts` is added to the explicit wipe list. The account replacement already deletes every table.

Consent is stored as `app_settings['speaking.recording_upload_consent'] ∈ {'on','off'}`; when the key is absent, consent is undecided (A-024).

Migration required: YES. Deploy order:
1. Server WP-01..WP-03 merge (integration branch) → `main`.
2. Before the 027 deploy, ops confirm `SELECT count(*) FROM recordings` = 0 on staging and production (RISK-001).
3. Deploy the Server.
4. Merge the App M2. The App M2 must not reach `main` first, because one unknown collection rejects the whole generic push batch (`outboxSync.ts:322-345`) and would stall the other collections.

Rollback: Server `027.down.sql`. App: no down migration (unreleased, F1).

## 6. Cross-cutting Concerns

| Concern | Relevant? | Design / mechanism | Risk |
|---|---|---|---|
| Transactions and concurrency | YES | Server: row lock plus advisory xact lock plus partial unique index (AD-001); watermark (AD-003). App: synchronous SQLite transaction per save, pull page and wipe; single-flight executor; take-id idempotency; ref guard on Save | Crash between commit and unlink leaves an orphan local file (RISK-006) |
| Security | YES | Owner-scoped queries, 404 for foreign ids (unchanged); `expectedUserId` guard; same-origin upload URL; strict sync payload (no audio, path or base64 can pass) | — |
| Client and version compatibility | YES | Breaking recordings contract allowed (NFR-004, unreleased); sync additive; Server-first order | App before Server stalls sync (RISK-003) |
| Observability | YES | Server logs superseded or orphan object delete failures (existing logger pattern); App stores `upload_error` codes; no audio, path or token in logs | — |
| Performance | NO | ≤ 1 row per sentence; lists ≤ 100 | — |

### Invariants

| INV | Enforced by (mechanism + component) | How it could break | Required test (level, infra) — owner |
|---|---|---|---|
| INV-001 | App: insert-new then delete-old in one transaction, unlink the old file after commit; executor never deletes a file; permanent failure sets `failed` and keeps the file; transient failures stay `pending` | crash mid-save; save throws; exhausted retries; missing file | Real SQLite: save R2 throws → R1 row and file remain; 400/413 → `failed` and file exists; 50 transient failures → still `pending` — WP-05, WP-07 |
| INV-002 | Executor checks `consent=='on'` and `isAccountStillOwner(owner)` per job; `authenticatedFetch` `expectedUserId` aborts before sending; consent off flips `pending→local_only` in one transaction; NULL owner never uploads | consent off mid-queue; account switch during the token refresh await; restart | Jest with mocked fetch: consent off with 2 jobs → 0 requests; session user ≠ owner → 0 requests; no session → stays `pending`, 0 requests — WP-07 |
| INV-003 | Device: AD-001-style save transaction keyed (mode, sentence_id). Server: partial UNIQUE plus locked completion (AD-001); merge collision delete | re-record race; two devices; duplicate retry; pending failure | Server real Postgres: 10 parallel completions for one sentence → 1 completed row; failed or expired B keeps A; merge with colliding sentences succeeds with 1 row. App real SQLite: AC-017 — WP-02, WP-05 |
| INV-004 | Durable marker processed before jobs (AD-006); pending rows flipped to `local_only` in the same transaction; Server watermark rejects pre-purge completions (AD-003); directory sweep after commit; wipe and re-insert in one transaction (AD-007) | in-flight upload; offline delete; restart; pull before push; in-flight PUT from another device | Server: PUT after delete-all → 409 `RECORDING_PURGED`, 0 rows and 0 objects. App: queued plus in-flight job then delete → DELETE sent after the in-flight job and nothing uploads afterwards; offline plus re-init → marker and tombstones pending; pulled older attempt after wipe skipped — WP-02, WP-08 |
| INV-005 | One entity per sentence; Server LWW; App apply mirrors LWW against the row or the pending outbox (AD-004); mutation id = outbox id (replay = `duplicate`) | retried push; out-of-order pull; tombstone vs pending write; clock skew | Server: same `mutation_id` twice → `duplicate`, 1 record. App real SQLite: 2-device interleavings (pull-then-push, push-then-pull, tombstone vs newer write) converge to the same row set — WP-03, WP-06 |
| INV-006 | Payload built only by `buildSpeakingAttemptPayload` (fixed keys); Server strict schema rejects extra keys | serializer adds `file_path` or base64 | App: drained payload keys equal the allowlist exactly. Server: payload with `file_path` → 400 — WP-05, WP-03 |
| INV-007 | `saveFlashcard` with `vocabulary_id='shadowing:<sentence_id>'` inside the save transaction plus UNIQUE(lesson_id, vocabulary_id) | double save; re-fail; pulled card | Real SQLite: fail ×3 plus a replayed take → 1 card and 1 schedule row — WP-05 |
| INV-008 | Take id = recording PK = `client_recording_id`; replay returns the existing row; ref guard; one job per row structurally | double tap; re-entrant handler; slow DB | Real SQLite: two concurrent `save(takeId)` → 1 attempt, 1 recording, ≤ 1 pending, 1 outbox row — WP-05 |
| INV-T1 (design) | A Server row created at or before the user's `purged_at` never becomes completed (AD-003) | PUT racing delete-all | Covered by the INV-004 Server test — WP-02 |
| INV-T2 (design) | An attempt row change and its outbox mutation commit together; a delete marker and the tombstones survive the "Xoá dữ liệu" wipe | crash between statements | Real SQLite: inject a throw after the outbox insert → neither persists; wipe plus afterWipe atomic — WP-05, WP-08 |

## 7. Validation Strategy and Traceability

| Requirement | Design (AD / component) | Validation |
|---|---|---|
| FR-001, FR-002, FR-014 | Routes in both stacks; speaking-gap → `SpeakingShadowing` target → `resolveShadowingEntry()` (A-019) | AC-001, AC-002, AC-014 (navigator jest; red on `ede9ffc`) |
| FR-003, FR-004 | `shadowingLessons.ts` (snapshot sentences sorted by `position`), `shadowingProgress.ts` (BR-008, EC-012) | AC-003, AC-004 (pure plus real SQLite) |
| FR-005..FR-012 | `useShadowingSession` (states idle/recording/recorded/saving; 30 s timer; AppState ≠ active stops; take file replaced; slow TTS rate 0.3) | AC-005..AC-012 (jest, fake timers) |
| FR-013, FR-015, FR-030 | S7 params; consent sheet gate; `listRecordings({sentence_id})` → completed → download to `LingoBitesRecordings/_remote/` | AC-013, AC-015, AC-030 |
| FR-016 | schema v4 | AC-016 (real SQLite from v3 snapshot, re-run no-op) |
| FR-017, FR-019, FR-028, FR-029 | save transaction, AD-008 | AC-017, AC-019, AC-028, AC-029 |
| FR-018, FR-027 | AD-006, AD-007, `deleteRecordingsDirectory()` | AC-018, AC-027 |
| FR-020, FR-021 | AD-005 | AC-020, AC-021 |
| FR-022..FR-025 | AD-001..AD-003 | AC-022..AC-025 (Server, real Postgres) |
| FR-026 | AD-004 | AC-026 |

Plus the regression suites: Server `yarn test`, `yarn test:db` (recordings, sync, accountMerge); App `yarn test`, `yarn test:adversarial`, `typecheck`, `lint` (module boundaries).

## 8. Risks, Impact and Dependencies

| ID | Risk or impact | Area | Mitigation / action |
|---|---|---|---|
| RISK-001 | 027 refuses to run if legacy `recordings` rows exist (uploads never worked: E-006/E-022, so the count is expected to be 0) | Server deploy | Ops run a pre-deploy count; if > 0, the requester decides (Q-003) — owner: leader/ops |
| RISK-002 | Superseded or purged objects linger after a storage error | Server | Orphan sweep `cleanup.ts`; delete-all deletes objects first → 502 retry — WP-02 |
| RISK-003 | App push of `speaking_attempts` to an old Server rejects the whole generic batch | sync | Server-first order (§5) — leader |
| RISK-004 | `recordings.ts` controller (712 lines) grows | Server | The new route goes into `recordingsBulk.ts`; logic stays in the store — WP-02 |
| RISK-005 | iOS default codec of the recorder is UNKNOWN (node_modules not installed) | App | Pin the audio set (A-016); runtime NOT VERIFIED (no device, R5) |
| RISK-006 | Crash after commit, before unlink → orphan local file | App | Every delete action sweeps the whole directory; LOW |
| IMP-001 | Metrics count fewer recordings and no shadowing `error_events` (A-013) | analytics | None (accepted in the spec) |
| IMP-002 | Full wipe keeps `current_account_id` and becomes transactional | profile | Q-002 |

Dependencies: Server M1 deployed to staging before the App upload and sync is checked against staging; GCS bucket on staging (A-015).

Assumptions:
- **A-006: NOT VERIFIED.** It is settled by `SELECT max(length(text_en))` on staging content; LOW.
- **A-014: resolved by design.** With no session there is no request and the job stays `pending`. Runtime session creation is NOT VERIFIED.
- **A-015: NOT VERIFIED.** Production refuses to start without the bucket (`S:src/common/config/env.ts:409`).
- **A-016: resolved by pinning.** Android uses `OutputFormatAndroidType.MPEG_4` plus `AudioEncoderAndroidType.AAC`; iOS uses `AVEncodingOption.aac`. A test asserts the audio set.
- **A-018: unchanged.**
- **A-020: kept (FR-030).**
- **A-021: kept.** Consent on does not touch `local_only` rows.
- **A-022: `duration_ms` 1..35000.** The App clamps it.
- **A-024: consent is per device**, and it is reset by the full wipe.

## 9. Open Questions

| ID | Question | Impact | Affected requirements | Blocking |
|---|---|---|---|---|
| Q-001 | Default: INV-004 is guaranteed for the deleting device plus any in-flight Server rows. A job queued on **another** device that has not yet called POST may upload after the delete | Rare multi-device case | INV-004, EC-009 | NO |
| Q-002 | Default: the full "Xoá dữ liệu" keeps `current_account_id` (required to push the tombstones and delete-all) | Small behavior change | FR-027 | NO |
| Q-003 | Default: if staging or production has legacy `recordings` rows, stop and ask before purging | Deploy only | FR-022 | NO |

## 10. Implementation Guidance

- Work areas: see the package outline below. Paths were verified at the frozen SHAs; "new" means it does not exist at that SHA.
- Ordering constraints:
  - M1 Server, then M2 App data/sync/upload, then M3 App UI.
  - Packages within a repository merge into `integration/LING-224`. Each milestone is released to `main`.
  - The App mirrors contract r1 and can build in parallel with mocked fetch. Staging checks need M1 deployed.
- Parallelizable work: WP-01/WP-02 run alongside WP-03; WP-04 runs alongside M1; WP-07 runs alongside WP-06.
- Design storage: WP-04 copies this design to `A:docs/design/LING-224.md` (existing folder `docs/design`).

### Work packages

Planner needed: YES — the sizing rule (≈30 min, ≤ 15 production files, schema never combined with runtime) gives **11 packages**, above the 4-package fold limit. The outline below is complete and sized, every INV has an owner, and the Implementation Planner may adopt it unchanged.

| Package | Repo / owner | Covers (FR/AC/AD/INV) | Depends on (type) | Size | Work areas (verified) | Validation |
|---|---|---|---|---|---|---|
| WP-01 | Server / Node Js Developer | FR-022 (schema), NFR-004, INV-003 (DB) | — | S | new `src/common/database/migrations/027_recording_sentence_link.sql` + `.down.sql`; `prisma/schema.prisma` | migration test: columns, both unique indexes, non-empty pre-check refuses |
| WP-02 | Server / Node Js Developer — **owner of contract r1 (recordings)** | FR-022..FR-025, NFR-003, AC-022..AC-025, AD-001..AD-003, INV-003, INV-004, INV-T1 | WP-01 HARD | M | `src/modules/recordings/model/recordings.ts`, `repository/store.ts`, `controller/recordings.ts`, new `controller/recordingsBulk.ts`, `src/modules/admin/repository/adminStore.ts` | `test/recordings.test.ts`, new `test/recordingsShadowing.test.ts`, `test/accountMerge.test.ts` (real Postgres, parallel completion, purge race) |
| WP-03 | Server / Node Js Developer — **owner of contract r1 (sync)** | FR-026 (Server), AC-026 S1, INV-005, INV-006 | — | S | `src/modules/sync/model/sync.ts`, `src/modules/sync/controller/sync.ts` | `test/sync.test.ts` + new `test/syncSpeakingAttempts.test.ts` |
| WP-04 | App / React Native Developer | FR-016, AC-016 | — | S | new `src/core/db/schemaV4.ts`; `src/core/db/migrations.ts`, `src/core/db/types.ts`; `docs/design/LING-224.md` | real SQLite v3→v4 with rows, re-run no-op, `user_version` |
| WP-05 | App / React Native Developer | FR-010 (data), FR-017, FR-019, FR-026 (push), FR-028, FR-029, AC-010 S1, AC-017, AC-019, AC-026 S2, AC-028, AC-029, AD-008, INV-003 (device), INV-006, INV-007, INV-008, INV-T2 | WP-04 HARD; WP-03 CONTRACT | M | `src/features/speaking/logic/data/SpeakingRepository.ts`, new `data/SpeakingAttemptRepository.ts`, new `logic/shadowing/saveShadowingAttempt.ts`, new `src/core/sync/speakingAttempts.ts`, `src/core/schemas/sync.ts`, remove `logic/errorNotebookService.ts` (+ test), `src/features/speaking/index.ts` | real SQLite save tests (double save, throw → rollback, fail ×3), outbox payload key allowlist |
| WP-06 | App / React Native Developer | FR-026 (pull), AC-026 S3, EC-014, AD-004, INV-005 | WP-05 HARD | S | `src/core/sync/speakingAttempts.ts`, `src/features/sync/logic/pullWorker.ts` | real SQLite 2-device convergence matrix |
| WP-07 | App / React Native Developer | FR-020, FR-021, BR-001, BR-009, AC-020, AC-021, AD-002, AD-005, INV-001, INV-002 | WP-04 HARD; WP-02 CONTRACT; WP-05 ORDERING | M | new `logic/upload/recordingUploadQueue.ts`, `recordingConsent.ts`; `logic/api/recordingClient.ts`, `src/core/schemas/recordings.ts`, `src/core/api/authenticatedFetch.ts`, `logic/recordingService.ts`, remove `logic/recordingUploadWorker.ts`, `App.tsx`, speaking `index.ts` | jest mocked fetch: MIME, URL join, back-off, 400/413 failed, restart re-init, consent off, owner mismatch, no session |
| WP-08 | App / React Native Developer | FR-018, FR-025 (client), FR-027, BR-004, BR-010, AC-018, AC-027, AD-006, AD-007, INV-004 | WP-07 HARD; WP-05 HARD | M | new `logic/upload/serverRecordingDeletion.ts`; `src/core/db/localDataWipe.ts`, `src/features/profile/logic/LocalDataDeletionService.ts`, `src/features/profile/logic/useProfileScreen.ts`, `SpeakingRepository.ts` (clear scope), `recordingService.ts` (directory sweep) | real SQLite plus fake FS: in-flight vs delete ordering, offline plus restart, files without rows swept |
| WP-09 | App / React Native Developer | FR-005..FR-012, AC-005..AC-012 (not AC-010 S2) | WP-05 HARD | M | new `src/features/speaking/screens/ShadowingSessionScreen.tsx`, `logic/shadowing/useShadowingSession.ts`, `logic/shadowing/shadowingLessons.ts`, `components/shadowing/{SentenceCard,RecorderPanel,SelfCheckList}.tsx`; remove `components/activities/SpeakingShadowingActivity.tsx`; `src/app/navigation/AppNavigator.tsx` (Lessons route), `src/features/speaking/screens/navigationTypes.ts`, `src/features/lesson/library/screens/navigationTypes.ts` | jest RNTL, fake timers, AppState, mocked recorder/TTS |
| WP-10 | App / React Native Developer | FR-001..FR-004, FR-014, AC-001..AC-004, AC-014 | WP-09 HARD | M | new `screens/ShadowingLessonPickerScreen.tsx`, `logic/shadowing/shadowingProgress.ts`; `AppNavigator.tsx`, `immersiveTabRoutes.ts`, `src/features/home/screens/navigationTypes.ts`, `SpeakingRoomScreen.tsx`, `src/features/today/logic/{adaptationEngine,todayNavigation}.ts`, `src/features/today/screens/TodayScreen.tsx`, speaking `index.ts` | real navigator tests in both tabs (red at `ede9ffc`), BR-008 table tests |
| WP-11 | App / React Native Developer | FR-013, FR-015, FR-030, AC-010 S2, AC-013, AC-015, AC-030 | WP-07, WP-08, WP-10 HARD | M | new `screens/ShadowingSummaryScreen.tsx`, `components/shadowing/ConsentSheet.tsx`, `components/SpeakingRecordingsSettingsRow.tsx`, `logic/upload/remoteRecordingPlayback.ts`; `useShadowingSession.ts`, `AppNavigator.tsx`, nav types, `immersiveTabRoutes.ts`, `src/features/profile/screens/ProfileScreenView.tsx` | jest: consent once, undecided dismiss saves nothing, summary counts, remote play request, hidden play |

R1: every package touches persisted state, sync, a migration or on-device files, so the Adversarial Reviewer applies to each one.

## 11. Readiness

Status: READY
Reason and blocking items: every FR-001..FR-030 has a design path and validation. The contract, both migrations, sync and upload semantics are defined. INV-001..INV-008 plus INV-T1/INV-T2 each have a mechanism, break modes, a test and an owning package. Q-001..Q-003 are non-blocking defaults. The scope stays within 30 FR, 2 repositories and no new surface. Decomposition needs the Implementation Planner (11 packages > fold limit); this does not block DESIGN_PASSED.

## Workflow Handoff

```yaml
workflow:
  complexity: LARGE
  stage: Technical Design
  status: DESIGN_PASSED
evidence:
  artifacts:
    - design-LING-224-r1.md
    - spec-LING-224-r1.md (01a10303-5eb7-7410-a84b-95510bedd2f0)
    - packet-architect-LING-224-r1.md (01a10304-019e-76ed-be79-5d227eb7e40e)
    - Clarification Record 01a102f9-e616-789d-b533-3665c495e9eb
  revisions:
    app: ede9ffcc893dab9a0fecbf9742408f5296deb5d4
    server: 1ec3d91e4867ff5b1446e4e2eca2fbca99232ce3
  contract_revision: LING-224-contract-r1 (section 5; owners WP-02, WP-03)
  changed_files: []
  commands:
    - multica repo checkout (both repos at frozen SHAs); git rev-parse HEAD
    - static reads/greps of the paths cited in sections 2-5
  tests: []  # none run; validation is a plan
risks: [RISK-001, RISK-002, RISK-003, RISK-004, RISK-005, RISK-006]
assumptions: [A-006 NOT VERIFIED, A-014 design-resolved, A-015 NOT VERIFIED, A-016 design-pinned, A-018 unchanged, A-020 kept, A-021 kept, A-022 1..35000, A-024 kept]
blocked_by: []
planner_needed: YES  # 11 packages > 4-package fold limit; outline in section 10
handoff:
  next_stage: Implementation Planner (dispatched by Feature Orchestrator), then requester approval
  entry_gate_satisfied: true
  reason: Design READY with contract r1, migrations, invariants and a sized package outline; folding limit exceeded so the Planner owns decomposition.
```
