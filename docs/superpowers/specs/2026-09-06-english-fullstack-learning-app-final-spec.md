# Specification: English Full-stack Learning App

Date: 2026-09-06
Status: **Superseded (2026-10-08)** by `docs/superpowers/plans/2026-10-07-backward-design-curriculum-plan.md` and `docs/superpowers/plans/2026-10-08-stage3-audio-evaluation-analysis.md`. Kept for history only; its decisions (incl. DEC-4, REQ-22) no longer apply.
Audience: Product owner, planning agent, implementation agents, mobile/backend engineers, content designer

## Source Inventory

| Source                                                                          | Status                                 | Use                                                                               |
| ------------------------------------------------------------------------------- | -------------------------------------- | --------------------------------------------------------------------------------- |
| `attachments/2026-09-06-english-fullstack-learning-app-design.md`               | Confirmed user-provided feature design | Primary product direction and learning model                                      |
| `mobile-app/docs/README.md`                                                     | Confirmed current docs index           | Establishes current docs vs legacy docs boundary                                  |
| `mobile-app/docs/01_Product_Overview.md`                                        | Confirmed current MVP overview         | Current LingoBites baseline and original capture-to-lesson positioning            |
| `mobile-app/docs/tasks/current-task.md`                                         | Confirmed current sprint/task baseline | Current mobile app state after Phase 1 UI handoff                                 |
| `mobile-app/docs/superpowers/plans/2026-09-04-lingobites-offline-review-mvp.md` | Confirmed current implementation plan  | Current offline review MVP constraints and implemented path                       |
| `mobile-app/src/**`                                                             | Confirmed code baseline inspected      | React Native app, SQLite repositories, review flow, audio cache, release flags    |
| `api-server/src/**`                                                             | Confirmed code baseline inspected      | Fastify API, OCR/AI analysis, async jobs, review events, chapter audio manifest   |
| `mobile-app/docs/legacy/01-ba/**`                                               | Historical reference only              | Architecture patterns and older decisions, not current canonical docs             |
| Issue comment "chốt theo khuyến nghị"                                           | Confirmed owner decision               | Converts previously recommended options into approved product/technical decisions |

## Problem Statement

For Vietnamese adults who are nearly restarting from English basics but need English for Full-stack Developer work, generic translation or vocabulary-review apps do not create observable speaking ability in realistic software-work situations. The desired outcome is an offline-first mobile learning system that guides the learner from A0 toward functional A2/B1 communication through 15-20 minute blocks, profession-specific content, active recall, speaking practice, SRS, mastery tracking, and remediation.

## Context

The current LingoBites app already provides a React Native mobile foundation with local SQLite persistence, lesson history, vocabulary flashcards, fixed-interval review, review outbox sync, audio manifest/cache support, release flags, themed UI, and a Node/Fastify API for AI/OCR, review events, and per-chapter audio manifests.

The requested feature set is larger than the existing review MVP. It changes the product from "learn from captured English text" into a curated career-learning path for one target learner profile. This spec preserves reusable platform work while defining the new course/content runtime as an incremental extension, not a rewrite.

## Outcomes

| ID    | Outcome                                                                                                                                    | Priority/Status    | Verification Coverage |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------ | ------------------ | --------------------- |
| OUT-1 | Learner can complete daily 15-20 minute study blocks that combine review, new content, listening, speaking, recall, and feedback.          | Must / Confirmed   | VC-1, VC-4            |
| OUT-2 | Learner progresses through a visible A0 to A2/B1 Full-stack English path with stages, units, prerequisites, and observable lesson outputs. | Must / Confirmed   | VC-2, VC-3            |
| OUT-3 | Learner reviews phrases, sentence patterns, Q&A turns, dialogue turns, and personal errors through offline SRS.                            | Must / Confirmed   | VC-5, VC-6            |
| OUT-4 | Learner can practice speaking through shadowing, recording, role-play, and self-check without misleading accent scoring claims.            | Must / Confirmed   | VC-7                  |
| OUT-5 | The app adapts study blocks based on review backlog, weak skills, prerequisites, recent errors, and speaking gaps using explainable rules. | Must / Confirmed   | VC-8                  |
| OUT-6 | Content, audio, progress, SRS, recordings, and learner profile data continue to work offline after content is downloaded.                  | Must / Confirmed   | VC-9, VC-10           |
| OUT-7 | MVP proves the learning loop with 15-20 complete lessons and 100-150 target chunks before expanding to the full 30-unit curriculum.        | Must / Confirmed   | VC-11                 |
| OUT-8 | Progress reports show capability evidence instead of a single misleading score.                                                            | Should / Confirmed | VC-12                 |

## Scope

### In-Scope

- Mobile app for Vietnamese learners, using Vietnamese explanations.
- Target learner: adult Vietnamese developer, nearly A0/A1 English, aiming for Full-stack Developer workplace and interview communication.
- Curated course path: Level -> Stage -> Unit -> Lesson -> Activity.
- MVP vertical slice: 8 priority units, 15-20 complete lessons, 100-150 chunks.
- Onboarding profile: role, tech stack, experience, goals, preferred daily mode, speaking availability.
- Placement-lite assessment: recognition, listening, sentence ordering, reading aloud.
- Today study center with 5-minute, normal, and deep-practice modes.
- Lesson runtime with context-first input, short Vietnamese explanation, guided practice, shadowing, active recall, personalization, role-play, exit check, and feedback.
- Offline SRS for review items beyond vocabulary: chunks, patterns, question-answer turns, dialogue turns, and personal errors.
- Mastery model with `new -> learning -> reviewing -> mastered -> relearning`.
- Error notebook and remediation rules.
- Audio sample playback, local audio package download/cache, and local recording storage.
- Progress reporting by observable ability and retention evidence.
- Versioned content package import with manifest, checksum, transaction, rollback, and stable content IDs.
- Rule-based adaptation engine with explainable decisions.
- Thin Node.js content service for manifests/package metadata and asset delivery integration.

### Out-of-Scope for MVP

- Full 30-unit production content library.
- Free-form AI chatbot.
- Phoneme-level accent scoring or claims of precise pronunciation scoring.
- Human teacher marketplace, social features, leaderboard, classroom admin.
- Payment/subscription.
- Multi-device sync, account login, cloud backup, and cross-device progress restore.
- Graphical CMS for content authors.
- Long video lessons.
- General IELTS/TOEIC test-prep mode.
- Broad career support outside Full-stack Developer communication.

### Boundary Cases

| Item                                     | Proposed Handling                                                                                                    |
| ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Existing scan/paste/OCR lesson generator | Approved: hide from the English Full-stack MVP path and keep behind release flags as a legacy/future optional input. |
| Existing vocabulary-only flashcards      | Reuse repository patterns, but extend the review domain to support multiple review item types.                       |
| Existing gamification                    | Keep optional and secondary. Do not optimize MVP success around streaks.                                             |
| Existing review outbox sync              | Can remain for telemetry/history, but MVP learning must not require network.                                         |
| Native speech-to-text                    | Approved: include as optional support where available; never use it as the sole pass/fail mechanism.                 |

## Actors and Systems

| Actor/System                    | Role                                                                                                                                         |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Learner                         | Completes study blocks, speaks, records, reviews, and provides self-ratings.                                                                 |
| Mobile app                      | Runs learning path, lesson runtime, SRS, mastery, recordings, content import, offline storage, progress reports.                             |
| Content package                 | Versioned lesson/activity/audio metadata and assets with stable IDs.                                                                         |
| Node content service            | Serves content manifests and package metadata; may point clients to CDN/object storage for assets.                                           |
| Existing API service            | Keeps AI/OCR/review-event/audio-manifest capabilities where useful, but is not required for offline lesson execution after package download. |
| OS audio/recording/STT services | Play audio, record learner voice, optionally transcribe when available.                                                                      |

## Requirements

### Learner Profile and Placement

| ID    | Requirement                                                                                                                           | Source/Status          | Dependencies | Verification |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- | ------------ | ------------ |
| REQ-1 | The app must collect learner role, target tech stack, experience, learning goal, and speaking practice constraints during onboarding. | Attachment / Confirmed | DEP-1        | VC-13        |
| REQ-2 | The app must run a lightweight placement check covering recognition, listening, sentence ordering, and reading aloud.                 | Attachment / Confirmed | DEP-2        | VC-14        |
| REQ-3 | Placement feedback must recommend a starting point without negative labels such as "too weak" or a discouraging score.                | Attachment / Confirmed | DEP-2        | VC-14        |
| REQ-4 | The app should allow learners to edit career/project profile data used for personalization.                                           | Attachment / Confirmed | DEP-1        | VC-13        |

### Learning Path and Content Model

| ID     | Requirement                                                                                                                                                                                                                                                                                         | Source/Status          | Dependencies | Verification |
| ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- | ------------ | ------------ |
| REQ-5  | The app must represent the path as Level -> Stage -> Unit -> Lesson -> Activity.                                                                                                                                                                                                                    | Attachment / Confirmed | DEP-3        | VC-2         |
| REQ-6  | The full target curriculum must cover five stages: A0 foundation, A1 survival English, A1+ workplace communication, A2 Full-stack communication, and B1 interview/professional communication.                                                                                                       | Attachment / Confirmed | DEP-3        | VC-3         |
| REQ-7  | MVP must include 8 priority units: introduction, asking for repetition/clarification, team roles, daily stand-up, app description, bug report, career profile, and project/interview practice.                                                                                                      | Attachment / Confirmed | DEP-3        | VC-11        |
| REQ-8  | MVP must include 15-20 complete lessons and 100-150 chunks, not shallow coverage of all 30 units.                                                                                                                                                                                                   | Attachment / Confirmed | DEP-3        | VC-11        |
| REQ-9  | Each lesson must declare observable objective, situation, learner role, prerequisites, max 8-12 new chunks, one main sentence pattern, one pronunciation focus, input dialogue/audio, activity sequence, final speaking task, SRS items, pass conditions, expected errors, and remediation mapping. | Attachment / Confirmed | DEP-3, DEP-4 | VC-15        |
| REQ-10 | Content IDs must remain stable across package versions so progress and review schedules survive content updates.                                                                                                                                                                                    | Attachment / Confirmed | DEP-3, DEP-5 | VC-10        |
| REQ-11 | Grammar must be embedded in communicative tasks and must not become a separate grammar course in MVP.                                                                                                                                                                                               | Attachment / Confirmed | DEP-3        | VC-15        |

### Today Study Center

| ID     | Requirement                                                                                                                                                            | Source/Status                           | Dependencies | Verification |
| ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------- | ------------ | ------------ |
| REQ-12 | The app must show a Today center with due review, next lesson, old-situation practice, and mode selection.                                                             | Attachment / Confirmed                  | DEP-6        | VC-1         |
| REQ-13 | The app must support 5-minute, normal, and deep-practice modes.                                                                                                        | Attachment / Confirmed                  | DEP-6, DEP-7 | VC-1         |
| REQ-14 | When due review is greater than 20 items or estimated review time is greater than 10 minutes, the app must reduce or stop new content and offer a consolidation block. | Attachment + owner decision / Confirmed | DEP-7        | VC-8         |

### Lesson Runtime

| ID     | Requirement                                                                                                                                                                                                                         | Source/Status          | Dependencies | Verification |
| ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- | ------------ | ------------ |
| REQ-15 | A standard 20-minute lesson block must include check-in, warm-up, due review, objective, context-first listening, explanation, guided practice, shadowing/recall, personalization, role-play, exit check, feedback, and SRS update. | Attachment / Confirmed | DEP-3, DEP-6 | VC-4         |
| REQ-16 | Activities must progress from recognition to production: listen/select, sentence ordering, fill chunk, substitution drill, shadowing, active recall, variation, and role-play.                                                      | Attachment / Confirmed | DEP-3, DEP-6 | VC-4         |
| REQ-17 | Explanations must be short Vietnamese explanations in context.                                                                                                                                                                      | Attachment / Confirmed | DEP-3        | VC-15        |
| REQ-18 | The final task of most lessons must require speaking or listening, not only reading or tapping.                                                                                                                                     | Attachment / Confirmed | DEP-8        | VC-7         |
| REQ-19 | Lesson pass states must be `pass`, `conditional_pass`, or `not_yet`. `not_yet` must create a recovery path instead of resetting the stage.                                                                                          | Attachment / Confirmed | DEP-7        | VC-16        |

### Speaking, Audio, and Recording

| ID     | Requirement                                                                                                                                                                                      | Source/Status                           | Dependencies | Verification |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------- | ------------ | ------------ |
| REQ-20 | The app must support slow and natural audio for each MVP sentence/dialogue where content exists, using lightweight compressed files with checksums; multiple voices are not required for MVP.    | Attachment + owner decision / Confirmed | DEP-4, DEP-8 | VC-7         |
| REQ-21 | The app must support shadowing, recording, playback, and self-comparison for speaking activities.                                                                                                | Attachment / Confirmed                  | DEP-8        | VC-7         |
| REQ-22 | MVP must not claim precise accent scoring. Speaking feedback must focus on task completion, key phrase use, response time, self-checklist, and optional OS speech-to-text hints where available. | Attachment + owner decision / Confirmed | DEP-8        | VC-7         |
| REQ-23 | Speaking room must support shadowing, quick answer, daily stand-up, app/system description, bug report, and mock interview practice.                                                             | Attachment / Confirmed                  | DEP-3, DEP-8 | VC-17        |

### SRS, Mastery, and Error Notebook

| ID     | Requirement                                                                                                                                              | Source/Status                                     | Dependencies  | Verification |
| ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- | ------------- | ------------ |
| REQ-24 | SRS items must support vocabulary, chunks, sentence patterns, question-answer pairs, dialogue turns, and personal error items.                           | Attachment / Confirmed                            | DEP-9         | VC-5         |
| REQ-25 | SRS item lifecycle must support `new`, `learning`, `reviewing`, `mastered`, and `relearning`.                                                            | Attachment / Confirmed                            | DEP-9         | VC-6         |
| REQ-26 | MVP scheduler must use transparent fixed intervals: 10 minutes, 1, 3, 7, 14, 30, 60, and 120 days, unless a later explicit decision changes it.          | Attachment + current MVP plan / Confirmed for MVP | DEP-9         | VC-6         |
| REQ-27 | SRS scoring must consider correctness, hints used, response time, and ability to use the item in conversation where the activity captures those signals. | Attachment / Confirmed                            | DEP-9, DEP-10 | VC-6         |
| REQ-28 | The app must save learner errors, weak chunks, recordings, and interview answers without requiring manual flashcard creation.                            | Attachment / Confirmed                            | DEP-9, DEP-11 | VC-18        |
| REQ-29 | Error categories must include vocabulary, structure, listening, pronunciation affecting meaning, slow response, and context mismatch.                    | Attachment / Confirmed                            | DEP-11        | VC-18        |

### Adaptation Rule Engine

| ID     | Requirement                                                                                                                                                                                                                                                                                                                              | Source/Status          | Dependencies         | Verification |
| ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- | -------------------- | ------------ |
| REQ-30 | The app must choose each study block from due reviews, recent errors, weak skills, prerequisites, speaking gap, and lesson progression.                                                                                                                                                                                                  | Attachment / Confirmed | DEP-7, DEP-9, DEP-11 | VC-8         |
| REQ-31 | Adaptation decisions must be explainable to the learner in short Vietnamese copy.                                                                                                                                                                                                                                                        | Attachment / Confirmed | DEP-7                | VC-8         |
| REQ-32 | MVP adaptation must be rule-based and testable without machine learning.                                                                                                                                                                                                                                                                 | Attachment / Confirmed | DEP-7                | VC-8         |
| REQ-33 | Rules must include the behaviors listed in the source design: backlog control, listening-without-transcript remediation, active recall for recognition-only weakness, prerequisite micro-lessons, variation increase for fast mastery, speaking-practice prioritization, and interview portfolio prioritization near interview practice. | Attachment / Confirmed | DEP-7                | VC-8         |

### Offline Content and Data

| ID     | Requirement                                                                                                                                                                                                | Source/Status                                  | Dependencies | Verification |
| ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- | ------------ | ------------ |
| REQ-34 | The app must download content by stage or level and execute downloaded lessons offline.                                                                                                                    | Attachment / Confirmed                         | DEP-4, DEP-5 | VC-9         |
| REQ-35 | SQLite must store content index, learner profile, progress, mastery, attempts, SRS, errors, content package metadata, and download state.                                                                  | Attachment + current code baseline / Confirmed | DEP-5        | VC-9         |
| REQ-36 | File storage must store audio assets and learner recordings with recoverable references from SQLite.                                                                                                       | Attachment + current code baseline / Confirmed | DEP-4, DEP-8 | VC-9         |
| REQ-37 | Content package import must use a hybrid ZIP package containing `manifest.json`, lesson JSON, audio/assets, checksums, transaction-safe import, rollback, and previous-version retention on failed import. | Attachment + owner decision / Confirmed        | DEP-5        | VC-10        |
| REQ-38 | App binary version and content package version must be separate.                                                                                                                                           | Attachment / Confirmed                         | DEP-5        | VC-10        |

### Progress and Assessment

| ID     | Requirement                                                                                                                                                                                                 | Source/Status          | Dependencies  | Verification |
| ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- | ------------- | ------------ |
| REQ-39 | Progress report must show number of sentences spoken without looking, start-to-answer time, first-listen comprehension, 7/30-day retention, passed situations, and before/after recordings where available. | Attachment / Confirmed | DEP-10        | VC-12        |
| REQ-40 | Weekly session must review mixed items, unfamiliar listening, two situations, personal speaking, recording comparison, and plan adjustment without teaching new content.                                    | Attachment / Confirmed | DEP-6, DEP-10 | VC-19        |
| REQ-41 | Stage checks must use content different from the lessons, and result in `pass`, `conditional_pass`, or `not_yet`.                                                                                           | Attachment / Confirmed | DEP-3, DEP-10 | VC-20        |

### Backend and Service Boundary

| ID     | Requirement                                                                                                                                                                                          | Source/Status                                                    | Dependencies | Verification |
| ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- | ------------ | ------------ |
| REQ-42 | The backend must provide content manifest/package metadata endpoints sufficient for the mobile app to discover available versions and assets.                                                        | Attachment + current API baseline / Proposed                     | DEP-12       | VC-21        |
| REQ-43 | The backend or storage layer must serve immutable content/audio assets addressed by manifest URLs and checksums.                                                                                     | Attachment + current audio manifest route / Proposed             | DEP-12       | VC-21        |
| REQ-44 | Existing OCR/AI lesson generation must be hidden from the English Full-stack MVP path and may remain available only behind release flags; MVP course lessons must not require runtime AI generation. | Attachment + current release config + owner decision / Confirmed | DEP-12       | VC-22        |
| REQ-45 | Server-side review-event ingestion may receive privacy-safe review history, but offline learning behavior must not depend on successful sync.                                                        | Current API baseline / Confirmed                                 | DEP-13       | VC-23        |

## Constraints

| ID    | Constraint                                                                                        | Type                | Source/Status                            | Impact                                                                                                 |
| ----- | ------------------------------------------------------------------------------------------------- | ------------------- | ---------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| CON-1 | Mobile client remains React Native with TypeScript.                                               | Technical           | Current code + attachment / Confirmed    | New modules should follow existing `src/modules`, `src/shared`, `src/release`, `src/theme` boundaries. |
| CON-2 | Local-first/offline execution is mandatory after content download.                                | Product/Technical   | Attachment / Confirmed                   | Lesson runtime, SRS, audio playback, recordings, and progress cannot require network.                  |
| CON-3 | MVP must be rule-based and must not depend on ML/AI for adaptation.                               | Product/Technical   | Attachment / Confirmed                   | Adaptation rules must be deterministic and unit-testable.                                              |
| CON-4 | MVP must not claim precise accent scoring.                                                        | Product/Legal/Trust | Attachment / Confirmed                   | Speaking evaluation copy and UI must avoid unsupported claims.                                         |
| CON-5 | Content IDs must be stable across package versions.                                               | Data                | Attachment / Confirmed                   | Content authoring and import tooling need lint/contract checks.                                        |
| CON-6 | Do not log raw vocabulary, learner text, full lesson text, recordings, or AI output in telemetry. | Privacy/Security    | Current docs/code + MVP plan / Confirmed | Analytics and sync schemas must be privacy-safe.                                                       |
| CON-7 | Legacy docs under `mobile-app/docs/legacy` must not be modified for current MVP work.             | Operational         | Current docs README / Confirmed          | New final spec belongs in current docs tree.                                                           |
| CON-8 | MVP target content is 15-20 complete lessons, not the full 30-unit roadmap.                       | Scope               | Attachment / Confirmed                   | Planning must prioritize vertical-slice quality over breadth.                                          |

## Selected Direction

Status: Approved by owner comment "chốt theo khuyến nghị"; implementation planning is explicitly deferred.

Direction: Extend the current React Native local-first app into a curated offline course runtime. Keep existing flashcard/review/storage/audio/release infrastructure where it fits, add a versioned content package domain, generalize review items beyond vocabulary, build a deterministic lesson runtime and adaptation engine, and use the Node service for content manifests/assets rather than making runtime AI central to MVP.

Rationale:

- The current app already has reusable foundations: SQLite, fixed-interval review, flashcard UI, audio manifest/cache, outbox sync, feature flags, and themed mobile UI.
- The user-provided draft explicitly says MVP should be rule-based and not depend on AI.
- A curated vertical slice is easier to verify with an A0 learner than a broad generated-content system.
- Content versioning and stable IDs are necessary before large-scale lesson authoring, otherwise progress/SRS data will become fragile.

Accepted trade-offs:

- Existing capture/OCR/AI functionality becomes secondary for this product direction.
- Review storage must be generalized, which is more work than only adding screens.
- Content authoring quality becomes a critical dependency.
- Some current gamification/review UI may need reshaping to support speaking-first learning outcomes.

Implementation discretion:

- Exact SQLite table names and TypeScript type names may differ if they preserve the domain boundaries and verification criteria.
- The approved content package format is hybrid ZIP: `manifest.json` + lesson JSON + audio/assets + checksums.
- Audio codec/bitrate may be selected during implementation based on React Native playback compatibility, as long as files remain lightweight and checksum-verified.
- OS speech-to-text is an optional enhancement only, not a required scoring path.

## Solution Options and Trade-Offs

| Criterion                                                   | OPT-1: Extend Current App Incrementally | OPT-2: Build Separate Course App | OPT-3: AI-Generated Adaptive Course   |
| ----------------------------------------------------------- | --------------------------------------- | -------------------------------- | ------------------------------------- |
| Reuse current implementation                                | Strong                                  | Weak                             | Moderate                              |
| Offline reliability                                         | Strong                                  | Strong                           | Weak unless generation is precomputed |
| Content quality control                                     | Strong                                  | Strong                           | Weak/Unknown                          |
| Time to MVP                                                 | Moderate                                | Weak                             | Moderate initially, risky later       |
| Fit to confirmed requirement "rule-based, not AI-dependent" | Strong                                  | Strong                           | Weak                                  |
| Migration complexity                                        | Moderate                                | Weak                             | Moderate                              |
| Long-term maintainability                                   | Strong if content domain is clean       | Moderate                         | Unknown                               |

Recommendation: OPT-1. Use the existing app as the platform foundation and implement the course runtime as a new current-MVP product layer. OPT-2 is only preferable if the existing codebase blocks clean content/runtime boundaries. OPT-3 conflicts with the MVP principle and should be deferred until the deterministic learning loop proves retention.

## Functional Architecture

```text
React Native App
  ├─ Onboarding & Career Profile
  ├─ Learning Map
  ├─ Today Study Center
  ├─ Lesson Runtime
  ├─ Speaking Room
  ├─ Review/SRS Engine
  ├─ Mastery & Error Notebook
  ├─ Adaptation Rule Engine
  ├─ Progress & Assessment
  ├─ Content Package Manager
  ├─ Audio & Recording Service
  └─ Local Data Layer (SQLite + files)

Node Content/API Service
  ├─ Content Manifest API
  ├─ Package Version Metadata
  ├─ Audio/Asset Manifest Support
  ├─ Review Event Ingestion (optional sync)
  └─ Existing OCR/AI endpoints behind flags
```

Module boundaries:

- Lesson Runtime must render declared activities and record attempts; it must not compute long-term scheduling directly.
- Review/SRS Engine must schedule review items; it must not choose the visible study block UI.
- Adaptation Rule Engine must select and explain the next block; it must not mutate content definitions.
- Content Package Manager must import immutable content versions; it must not rewrite learner progress.
- Audio & Recording Service must manage files and permissions; it must not evaluate mastery alone.

## Data Model

### New or Generalized Entities

| Entity                                                   | Purpose                                                                            | Notes                                                     |
| -------------------------------------------------------- | ---------------------------------------------------------------------------------- | --------------------------------------------------------- |
| `content_packages`                                       | Installed hybrid ZIP package version, checksum status, install status, active flag | Separates content version from binary version.            |
| `levels`, `stages`, `units`, `lessons`, `activities`     | Course structure                                                                   | May live in package JSON/SQLite plus local index tables.  |
| `content_items`                                          | Shared stable item registry for vocabulary, chunks, patterns, Q&A, dialogue turns  | Enables SRS beyond vocabulary.                            |
| `lesson_prerequisites`, `item_prerequisites`             | Unlock and remediation graph                                                       | Must be linted for cycles.                                |
| `learner_profile`, `career_profile`, `project_portfolio` | Personalization inputs                                                             | Local-first; user editable.                               |
| `lesson_attempts`, `activity_attempts`                   | Attempt and evidence history                                                       | Records hints, response time, result, mode, timestamps.   |
| `review_items`, `review_events`, `mastery_state`         | Generalized SRS and mastery                                                        | Evolves current flashcards/review tables.                 |
| `error_events`, `error_categories`, `remediation_rules`  | Error notebook and recovery path                                                   | Links failures to specific causes and next practice.      |
| `recordings`                                             | Local metadata for recorded learner audio                                          | File path, activity/attempt link, duration, created time. |

### Existing Reusable Structures

- Current `lessons` can remain for captured/generated lessons, but curated course lessons should use stable content IDs.
- Current `flashcards` can inspire UI and repository patterns, but SRS must not stay vocabulary-only.
- Current `review_schedule` and `review_sessions` implement fixed-interval behavior but need lifecycle/type expansion for the full requirement.
- Current `audio_assets` matches the content/audio manifest direction and should be reused or generalized.
- Current `sync_outbox` can continue for privacy-safe event syncing.

## Behavior and Edge Cases

### Daily Study Block

Preconditions:

- Learner profile exists.
- At least one content package with active lessons is installed.
- SRS/mastery state is initialized.

Happy path:

1. Learner opens Today.
2. App asks time/speaking availability and mode.
3. Adaptation engine reads due reviews, weak skills, prerequisites, recent errors, speaking gap, and next lesson.
4. App builds a 5-minute, normal, or deep-practice block.
5. Learner completes mixed review and lesson activities.
6. App records attempts, updates SRS/mastery/errors, stores recordings, and shows concise feedback.

Failure/alternate paths:

- No content package installed: show download/import prompt.
- Review backlog is greater than 20 due items or estimated above 10 minutes: skip or reduce new content and build a consolidation block.
- No microphone permission: allow listening/recognition activities and mark speaking activity blocked by permission.
- Audio asset missing: show retry/download fallback and do not mark listening/speaking objective passed.
- App killed mid-lesson: resume from last persisted activity state where feasible, otherwise preserve completed attempts and rebuild block.

### Lesson Pass Handling

- `pass`: learner meets exit check and final speaking/listening task requirements.
- `conditional_pass`: learner can continue, but specific review/remediation items are scheduled.
- `not_yet`: learner receives a 3-7 minute recovery path or 3-5 recovery lessons depending on severity; stage is not reset.

### Content Import

1. Fetch manifest.
2. Download hybrid ZIP package and referenced assets.
3. Verify checksum and schema.
4. Validate stable IDs, prerequisites, answer keys, asset references, and item limits.
5. Import in transaction.
6. Activate new content version only after successful import.
7. Keep previous version active if any step fails.

## Dependencies

| ID     | Dependency                                          | Type | Affected Items                   | Owner/Status                      |
| ------ | --------------------------------------------------- | ---- | -------------------------------- | --------------------------------- |
| DEP-1  | Learner/career profile schema and privacy policy    | Hard | REQ-1, REQ-4                     | Product + mobile / Needed         |
| DEP-2  | Placement activity definitions and copy             | Hard | REQ-2, REQ-3                     | Content + product / Needed        |
| DEP-3  | MVP course content schema and first complete lesson | Hard | REQ-5 to REQ-11                  | Content + engineering / Needed    |
| DEP-4  | Audio asset production and packaging                | Hard | REQ-9, REQ-20, REQ-34            | Content/audio / Needed            |
| DEP-5  | Versioned package importer                          | Hard | REQ-10, REQ-34 to REQ-38         | Mobile/backend / Needed           |
| DEP-6  | Today/lesson runtime UI design                      | Hard | REQ-12 to REQ-19                 | Product/design/mobile / Needed    |
| DEP-7  | Rule engine policy definitions                      | Hard | REQ-14, REQ-19, REQ-30 to REQ-33 | Learning/product / Needed         |
| DEP-8  | Mobile audio recording permissions and storage      | Hard | REQ-20 to REQ-23                 | Mobile / Needed                   |
| DEP-9  | Generalized review item and scheduler model         | Hard | REQ-24 to REQ-27                 | Mobile / Needed                   |
| DEP-10 | Attempt/mastery/progress metrics model              | Hard | REQ-27, REQ-39 to REQ-41         | Mobile/product / Needed           |
| DEP-11 | Error taxonomy and remediation content              | Hard | REQ-28, REQ-29                   | Learning/content / Needed         |
| DEP-12 | Content manifest/package delivery service           | Hard | REQ-42 to REQ-44                 | Backend/content ops / Needed      |
| DEP-13 | Optional privacy-safe sync policy                   | Soft | REQ-45                           | Backend/mobile / Existing partial |

## Risks and Mitigations

| ID     | Cause -> Event -> Impact                                                                                                                | Likelihood | Impact | Mitigation                                                                                           |
| ------ | --------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ------ | ---------------------------------------------------------------------------------------------------- |
| RISK-1 | Content is the bottleneck -> lessons are incomplete or inconsistent -> MVP cannot validate learning outcome                             | High       | High   | Build one full "Daily stand-up" lesson first, create content lint, then scale to 15-20 lessons.      |
| RISK-2 | Existing review model is vocabulary-specific -> adding chunks/patterns/errors becomes tangled -> implementation slows and bugs increase | Medium     | High   | Introduce a generalized review item domain before adding speaking/error SRS.                         |
| RISK-3 | Speaking assessment overclaims accuracy -> learner trust/legal risk                                                                     | Medium     | High   | Keep MVP feedback to self-check, task completion, phrase use, response time, and optional STT hints. |
| RISK-4 | Offline package import fails partially -> learner loses access or progress links                                                        | Medium     | High   | Use transaction, checksum, rollback, old-version retention, and import tests.                        |
| RISK-5 | Review backlog becomes overwhelming -> learner stops using app                                                                          | High       | Medium | Enforce backlog rules and new-item caps from the adaptation engine.                                  |
| RISK-6 | Product scope expands to chatbot/CMS/full curriculum too early -> MVP never ships                                                       | Medium     | High   | Lock MVP to 8 priority units, 15-20 complete lessons, rule-based behavior.                           |
| RISK-7 | Stable content IDs are not governed -> progress/SRS breaks after updates                                                                | Medium     | High   | Require content ID linting and version migration tests before package activation.                    |

## Complexity Estimate

No sufficiently supported historical estimate is available in the inspected context. The repository contains previous plans and implemented slices, but there is no comparable historical dataset with normalized units, similar scope, quality, and completion metrics.

Qualitative complexity: High.

Drivers:

- New content/course domain and import/versioning.
- Generalized SRS/mastery beyond existing vocabulary flashcards.
- Lesson runtime with multiple activity types.
- Audio/recording permission and file lifecycle.
- Rule-based adaptation and remediation.
- Content production and content QA, which is outside pure coding.

Smallest useful first milestone: define content schema and implement one complete "Daily stand-up" lesson vertical slice from package import through lesson runtime, speaking/recording, SRS update, error capture, and Today scheduling.

## MVP Milestones

| Milestone                      | Goal                                                                                                      | Exit Criteria                                                                                             |
| ------------------------------ | --------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| M1 Content Contract            | Define hybrid ZIP package schema, stable IDs, validators, and one complete Daily stand-up lesson package. | Content lint passes for one Daily stand-up lesson with audio references and SRS/remediation declarations. |
| M2 Package Import              | Install/activate content package offline with rollback.                                                   | Corrupt checksum/schema fails safely; previous active package remains usable.                             |
| M3 Runtime Slice               | Render one lesson end to end with declared activities.                                                    | Learner can complete context, guided practice, shadowing, recall, role-play, exit check.                  |
| M4 Generalized SRS             | Support review items for chunks, patterns, Q&A, dialogue turns, and errors.                               | Fixed-interval scheduling and lifecycle transitions pass unit tests.                                      |
| M5 Speaking and Error Notebook | Add recording/playback, self-check, error capture, remediation.                                           | Recording metadata persists; failures schedule correct recovery.                                          |
| M6 Today and Adaptation        | Build Today block generation and explainable rules.                                                       | Backlog/weak-skill/prerequisite/speaking-gap rules produce testable decisions.                            |
| M7 MVP Content Expansion       | Produce 15-20 lessons across 8 priority units.                                                            | Content lint and scenario QA pass; weekly/stage checks available.                                         |
| M8 Pilot Readiness             | Run self-dogfood plus a 3-5 learner pilot for at least 7 days.                                            | Success metrics can be collected without manual database inspection.                                      |

## Verification Criteria

### VC-1 Today Study Modes

- Covers: OUT-1, REQ-12, REQ-13.
- Given: Learner has installed MVP package and has due reviews.
- When: Learner selects 5-minute, normal, or deep-practice mode.
- Then: App builds a block with duration-appropriate review/practice composition and persists the selected mode in the session evidence.
- Evidence: Unit tests for block builder; scenario QA on device.

### VC-2 Learning Map Structure

- Covers: OUT-2, REQ-5.
- Given: Active content package is installed.
- When: Learner opens learning map.
- Then: Levels, stages, units, lessons, and prerequisites render from content data.
- Evidence: Content fixture test and UI test.

### VC-3 Curriculum Coverage

- Covers: OUT-2, REQ-6.
- Given: Full roadmap content metadata.
- When: Content lint runs.
- Then: Five required stages and their declared outputs exist.
- Evidence: Content lint report.

### VC-4 Lesson Runtime

- Covers: OUT-1, REQ-15, REQ-16.
- Given: Daily stand-up lesson package.
- When: Learner completes a normal 20-minute block.
- Then: Required activity sequence is completed or records explicit skipped/failed states with recovery.
- Evidence: Integration test and manual QA.

### VC-5 Review Item Types

- Covers: OUT-3, REQ-24.
- Given: Content declares review items of all MVP-supported types.
- When: Lesson exit update runs.
- Then: Each item type is created in SRS with stable content reference.
- Evidence: Repository unit tests.

### VC-6 Scheduler and Mastery

- Covers: OUT-3, REQ-25 to REQ-27.
- Given: Learner rates review items across attempts.
- When: Scheduler records remembered/forgot and activity evidence.
- Then: State and next review date follow the fixed interval policy and lifecycle rules.
- Evidence: Scheduler unit tests.

### VC-7 Speaking Practice

- Covers: OUT-4, REQ-20 to REQ-22.
- Given: Microphone permission is granted and lesson has audio.
- When: Learner shadows, records, plays back, and self-checks.
- Then: Recording metadata persists, playback works, and no UI claims precise accent scoring.
- Evidence: Device QA, copy review, unit tests around metadata.

### VC-8 Adaptation Rules

- Covers: OUT-5, REQ-30 to REQ-33.
- Given: Different learner states such as high backlog, listening weakness, missing speaking, repeated structure error.
- When: Rule engine builds the next block.
- Then: It chooses the expected review/remediation/new-content balance, switches to consolidation when due review is greater than 20 items or estimated review time is greater than 10 minutes, and returns a user-readable reason.
- Evidence: Rule engine table-driven tests.

### VC-9 Offline Execution

- Covers: OUT-6, REQ-34 to REQ-36.
- Given: Content package and audio are downloaded.
- When: Network is disabled.
- Then: Learner can open Today, run lessons/reviews, play cached audio, record, and persist progress.
- Evidence: Offline device QA and integration tests with network mocked unavailable.

### VC-10 Package Import Safety

- Covers: OUT-6, REQ-10, REQ-37, REQ-38.
- Given: Valid package, invalid checksum package, and invalid schema package.
- When: Import runs.
- Then: Valid hybrid ZIP package activates; invalid packages fail without corrupting current content/progress.
- Evidence: Import integration tests.

### VC-11 MVP Content Scope

- Covers: OUT-7, REQ-7, REQ-8.
- Given: MVP package candidate.
- When: Content lint and product review run.
- Then: Package includes 8 priority units, 15-20 complete lessons, and 100-150 chunks.
- Evidence: Content inventory report.

### VC-12 Progress Report

- Covers: OUT-8, REQ-39.
- Given: Learner has completed multiple lessons and reviews.
- When: Progress report opens.
- Then: Report shows capability evidence without one misleading total score.
- Evidence: UI test and product copy review.

### VC-13 Profile Editing

- Covers: REQ-1, REQ-4.
- Given: Learner has onboarding data.
- When: Learner edits role, stack, project, or interview data.
- Then: New personalization data is used in future activities without changing historical attempt records.
- Evidence: Repository and UI tests.

### VC-14 Placement

- Covers: REQ-2, REQ-3.
- Given: New learner starts placement.
- When: Learner completes recognition, listening, sentence ordering, and read-aloud tasks.
- Then: App recommends a starting point with constructive Vietnamese copy.
- Evidence: Scenario QA and copy review.

### VC-15 Lesson Content Contract

- Covers: REQ-9, REQ-11, REQ-17.
- Given: Lesson content file.
- When: Content lint runs.
- Then: Required declarations exist, new chunk count is within 8-12, grammar is tied to a speaking/listening action, and explanations are present.
- Evidence: Content lint.

### VC-16 Recovery Path

- Covers: REQ-19.
- Given: Learner receives `not_yet`.
- When: Feedback completes.
- Then: App schedules a targeted recovery path and does not reset the entire stage.
- Evidence: Rule engine and scenario tests.

### VC-17 Speaking Room Modes

- Covers: REQ-23.
- Given: MVP content installed.
- When: Learner opens speaking room.
- Then: Supported modes are available where content exists; missing content shows a clear unavailable state.
- Evidence: UI tests.

### VC-18 Error Notebook

- Covers: REQ-28, REQ-29.
- Given: Learner repeatedly fails a chunk or task.
- When: Attempt is saved.
- Then: Error is categorized and linked to review/remediation without manual flashcard creation.
- Evidence: Repository and rule tests.

### VC-19 Weekly Session

- Covers: REQ-40.
- Given: Learner has a week of attempts.
- When: Weekly session starts.
- Then: App builds mixed review, unfamiliar listening, two situations, personal speaking, recording comparison, and plan adjustment without new content.
- Evidence: Scenario test.

### VC-20 Stage Check

- Covers: REQ-41.
- Given: Learner reaches stage checkpoint.
- When: Stage check starts.
- Then: App uses unseen content and returns `pass`, `conditional_pass`, or `not_yet`.
- Evidence: Content lint and scenario QA.

### VC-21 Content Service

- Covers: REQ-42, REQ-43.
- Given: Mobile requests package metadata.
- When: Backend serves manifest.
- Then: Response includes version, asset URLs, checksums, sizes, and required compatibility metadata.
- Evidence: API contract tests.

### VC-22 AI Independence

- Covers: REQ-44.
- Given: Runtime AI/OCR flags are disabled.
- When: Learner runs downloaded MVP lesson.
- Then: Lesson still works end to end.
- Evidence: Release-config integration test.

### VC-23 Optional Review Sync

- Covers: REQ-45.
- Given: Network is unavailable during reviews.
- When: Learner completes review events.
- Then: Learning state is updated locally and sync can drain later without duplicate server events.
- Evidence: Existing outbox tests extended to generalized review events.

## Assumptions

| ID    | Assumption                                                                                                 | Reason                              | Invalidated When                       | Affected Items                |
| ----- | ---------------------------------------------------------------------------------------------------------- | ----------------------------------- | -------------------------------------- | ----------------------------- |
| ASM-5 | Content authoring and audio production can be handled outside app code, with import/lint tooling in scope. | Product depends on curated lessons. | No content production capacity exists. | MVP milestones and readiness. |

## Approved Decisions

| ID    | Decision                                                                                                                                        | Status   | Impact                                                                     |
| ----- | ----------------------------------------------------------------------------------------------------------------------------------------------- | -------- | -------------------------------------------------------------------------- |
| DEC-1 | Use current `mobile-app` as the implementation base; do not use `mobile-app-sete89`, `mobile-app-sete90`, or `mobile-app-sete93`.               | Approved | Fixes the source tree for future planning.                                 |
| DEC-2 | Use hybrid ZIP content packages: `manifest.json`, lesson JSON, audio/assets, and checksums.                                                     | Approved | Fixes importer, tooling, and package validation direction.                 |
| DEC-3 | Use "Daily stand-up" as the first vertical-slice lesson.                                                                                        | Approved | Fixes the first end-to-end proof target.                                   |
| DEC-4 | Include OS speech-to-text only as optional support where available; do not use it as pass/fail.                                                 | Approved | Fixes speaking feedback scope and permission handling.                     |
| DEC-5 | Hide scan/paste/OCR/AI lesson generation from the English Full-stack MVP path and keep it behind release flags.                                 | Approved | Keeps MVP focused on curated offline learning.                             |
| DEC-6 | Treat due review greater than 20 items or estimated review time greater than 10 minutes as high backlog and switch/reduce toward consolidation. | Approved | Fixes rule-engine threshold.                                               |
| DEC-7 | Provide slow and natural audio per MVP sentence/dialogue, compressed and checksum-verified; multiple voices are not required.                   | Approved | Fixes MVP audio expectation while leaving codec/bitrate to implementation. |
| DEC-8 | Run pilot with 3-5 Vietnamese low-confidence/beginner English learners for at least 7 days, after self-dogfood.                                 | Approved | Fixes MVP validation sample and minimum duration.                          |

## Open Questions

No blocking product decisions remain for an implementation plan. Future implementation may still choose lower-level details such as exact audio codec/bitrate, ZIP internal folder names, and SQLite table names, provided the approved decisions and verification criteria remain satisfied.

## Decisions Required Before Implementation Planning

None. Owner has approved the recommended defaults. However, implementation planning is intentionally not started per owner instruction: "chưa chuyển sang implement vội".

## Traceability Summary

| Outcome | Key Requirements                   | Verification Criteria            |
| ------- | ---------------------------------- | -------------------------------- |
| OUT-1   | REQ-12 to REQ-19                   | VC-1, VC-4, VC-16                |
| OUT-2   | REQ-5 to REQ-11                    | VC-2, VC-3, VC-15                |
| OUT-3   | REQ-24 to REQ-29                   | VC-5, VC-6, VC-18                |
| OUT-4   | REQ-20 to REQ-23                   | VC-7, VC-17                      |
| OUT-5   | REQ-30 to REQ-33                   | VC-8                             |
| OUT-6   | REQ-34 to REQ-38, REQ-42 to REQ-45 | VC-9, VC-10, VC-21, VC-22, VC-23 |
| OUT-7   | REQ-7, REQ-8                       | VC-11                            |
| OUT-8   | REQ-39 to REQ-41                   | VC-12, VC-19, VC-20              |

## Readiness Summary

Stable:

- Target learner and product promise.
- Offline-first mobile direction.
- MVP vertical-slice scope.
- Rule-based adaptation principle.
- Speaking practice without accent-scoring claims.
- Need for versioned content packages and stable IDs.

Can proceed later under approved decisions:

- Implementation planning for schema/content package/importer.
- First Daily stand-up vertical slice.
- Generalized review item model.
- Today block builder and rule-engine tests.

Not started by request:

- Implementation plan for M1-M3.
- Product code changes.
- Content package scaffolding.

Recommended next step when owner resumes implementation planning: create an implementation plan for Milestone M1-M3 around one complete "Daily stand-up" lesson. Do not expand to 15-20 lessons until the schema, importer, runtime, SRS update, speaking recording, and remediation path work end to end for that first lesson.
