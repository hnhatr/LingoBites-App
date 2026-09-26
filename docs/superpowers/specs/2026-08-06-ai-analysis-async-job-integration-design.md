# AI Analysis Async Job — Client Integration Design

Date: 2026-08-06

## Scope

This design replaces the app's synchronous `POST /v1/ai/analyze` call with the
new async job API (`POST /v1/ai/analyses` + `GET /v1/ai/analyses/:analysis_id`)
documented in `LingoBites-Server/docs/01-ba/02-technical/14-ai-analysis-async-job-client-integration-guide.md`.
It also replaces `AnalyzingScreen`'s fake, timer-driven progress simulation
with real stage-by-stage progress from the poll response.

Out of scope: cancel endpoint, SSE/streaming, partial content before
completion — none of these exist server-side yet per the source doc. Also out
of scope: any client-side feature flag to switch between sync/async (the sync
path is being removed, not made optional), and any special handling for app
backgrounding during polling.

## Source of truth

`LingoBites-Server/docs/01-ba/02-technical/14-ai-analysis-async-job-client-integration-guide.md`.
If this spec and that doc disagree, the doc wins.

## Current state (being replaced)

- `src/shared/api/analyzeClient.ts` — `analyzeTextWithApi()`, a single blocking
  `fetch` to `POST /v1/ai/analyze`.
- `src/modules/ai-analysis/AIAnalysisService.ts` — `analyzeText()`, switches
  between `analyzeTextWithApi` (real) and `analyzeTextWithMock` (mock), adds
  analytics events.
- `src/modules/ai-analysis/AnalyzingScreen.tsx` — awaits `analyzeText()` while
  showing a 3-step list that ticks on a fixed timer and carries progress to a
  random cap (91–96%) until the real result arrives, since the sync API never
  returned real progress.
- `src/modules/ai-analysis/MockAIAnalysisService.ts` — resolves immediately
  with fixture data.

`analyzeClient.ts` and its test are deleted as part of this change — once the
async path fully replaces the sync call in-app, the sync client is dead code.

## Architecture

```
AnalyzingScreen
   └─ analyzeText(text, options, onProgress, signal) [AIAnalysisService.ts]
        ├─ useMockAi=true  → simulateAnalysisJob() [MockAIAnalysisService.ts]
        └─ useMockAi=false → runAnalysisJob()      [analysisJobClient.ts, new]
             ├─ POST /v1/ai/analyses  (Idempotency-Key header)
             └─ poll status_url every ~1.5s until completed/failed/give-up
                   → onProgress({percent, stage, message, stages}) per poll
```

`AIAnalysisService.analyzeText()` remains the seam the UI depends on — it
doesn't matter to `AnalyzingScreen` whether progress updates come from a real
poll loop or the mock's simulated one; both go through the same
`AnalysisProgressCallback` shape.

### Files

New:

- `src/shared/api/analysisJobClient.ts` — create+poll orchestration.
- `src/shared/api/__tests__/analysisJobClient.test.ts`

Edited:

- `src/shared/api/types.ts` — new request/response types, extended `ApiErrorCode`.
- `src/modules/ai-analysis/types.ts` — `AnalysisProgress`, `AnalysisProgressCallback`.
- `src/modules/ai-analysis/AIAnalysisService.ts` — call `runAnalysisJob` instead of `analyzeTextWithApi`; thread progress callback through.
- `src/modules/ai-analysis/MockAIAnalysisService.ts` — simulate the 6 staged progress updates before resolving.
- `src/modules/ai-analysis/AnalyzingScreen.tsx` — render real stages/percent/message instead of the fake timer.
- `src/modules/ai-analysis/__tests__/AIAnalysisService.test.ts`
- `src/modules/ai-analysis/__tests__/MockAIAnalysisService.test.ts`
- `src/modules/ai-analysis/__tests__/AnalyzingScreen.test.tsx`

Deleted:

- `src/shared/api/analyzeClient.ts`
- `src/shared/api/__tests__/analyzeClient.test.ts`

## Data flow & types

`src/shared/api/types.ts` additions:

```ts
export type ApiErrorCode =
  | 'VALIDATION_EMPTY_TEXT'
  | 'VALIDATION_TEXT_TOO_LONG'
  | 'VALIDATION_MISSING_IDEMPOTENCY_KEY'
  | 'IDEMPOTENCY_CONFLICT'
  | 'IMAGE_TOO_LARGE'
  | 'OCR_NO_TEXT'
  | 'OCR_PROVIDER_ERROR'
  | 'AI_TIMEOUT'
  | 'AI_INVALID_OUTPUT'
  | 'AI_PROVIDER_ERROR'
  | 'AI_STAGE_PROVIDER_ERROR'
  | 'AI_STAGE_INVALID_OUTPUT'
  | 'AI_STAGE_TIMEOUT'
  | 'AI_JOB_TIMEOUT'
  | 'AI_FINAL_VALIDATION_FAILED'
  | 'AI_JOB_NOT_FOUND'
  | 'AI_POLL_GIVE_UP' // client-only: local poll timeout, no server code for this
  | 'NETWORK_ERROR';

export type AnalysisJobStage = {
  name: string;
  status:
    | 'pending'
    | 'processing'
    | 'retrying'
    | 'completed'
    | 'failed'
    | 'skipped';
  attempts: number;
};

export type AnalysisJobProgressBody = {
  percent: number;
  current_stage: string | null;
  message: string | null;
  stages: AnalysisJobStage[];
};

export type CreateAnalysisJobSuccessBody = {
  request_id: string;
  analysis_id: string;
  status: 'queued' | string;
  created_at: string;
  status_url: string;
};

export type AnalysisJobStatusBody =
  | {
      analysis_id: string;
      request_id: string;
      status: 'queued' | 'processing' | 'paused';
      progress: AnalysisJobProgressBody;
      partial_data: null;
      created_at: string;
      updated_at: string;
      expires_at: string;
    }
  | {
      analysis_id: string;
      request_id: string;
      status: 'completed';
      progress: AnalysisJobProgressBody;
      model: string;
      schema_version: 'ai-output-v1';
      prompt_version: string;
      data: unknown; // validated via validateAIOutput
      partial_data: null;
      created_at: string;
      updated_at: string;
      expires_at: string;
    }
  | {
      analysis_id: string;
      status: 'failed';
      progress: AnalysisJobProgressBody;
      error: {
        code: ApiErrorCode;
        message: string;
        stage?: string;
        retryable?: boolean;
      };
      partial_data: null;
      created_at: string;
      updated_at: string;
      expires_at: string;
    };
```

`AnalyzeTextRequestBody` (existing) is reused unchanged as the `POST
/v1/ai/analyses` body — same shape per the doc.

`src/modules/ai-analysis/types.ts` additions:

```ts
export type AnalysisProgress = {
  percent: number; // 0-100
  stage: string | null; // current_stage
  message: string | null; // ready-to-display Vietnamese string
  stages: AnalysisJobStage[];
};
export type AnalysisProgressCallback = (progress: AnalysisProgress) => void;
```

`AnalysisProgress` imports `AnalysisJobStage` from `src/shared/api/types.ts`.
The callback carries the complete stage snapshot because `AnalyzingScreen`
needs both the aggregate percent/message and each stage's status. The client
must create a new snapshot for every successful poll rather than mutate a
previous callback value.

The successful lesson and ordinary failure variants of `AnalyzeTextResult`
stay unchanged. A cancellation-only variant is added below. The job's `data`
field validates through the same `validateAIOutput` used today, so no new
lesson-parsing logic is needed.

### `analysisJobClient.ts`

Exports `runAnalysisJob(confirmedText, sourceType, onProgress, signal):
Promise<AnalyzeTextResult>`:

1. Generate a fresh Idempotency-Key (reuse `createRequestId()`) once per call
   — one call = one user action = one key, per the doc's "one key per tap"
   rule. There is no client-side auto-retry of a whole job, so key reuse across
   retries isn't needed: a failed job means the user goes back and re-taps,
   which re-mounts `AnalyzingScreen` and generates a new key for that new
   action.
2. `POST /v1/ai/analyses`. A network/parse failure here is an immediate
   `NETWORK_ERROR` result (same behavior as today's sync client).
3. Resolve `status_url` against `apiBaseUrl` before polling. The backend
   currently returns a relative path such as `/v1/ai/analyses/:id`; if it ever
   returns an absolute `http://` or `https://` URL, use it unchanged. Do not
   rebuild the path from `analysis_id`.
4. Parse `Retry-After` as a finite, non-negative number of seconds. Wait that
   long before the first poll; fall back to 1s when the header is missing or
   invalid. Subsequent polls use a fixed 1.5s interval.
5. Each successful in-progress poll calls
   `onProgress({percent, stage: current_stage, message, stages})`. Treat
   `queued`, `processing`, and `paused` identically as "still working" per the
   backend doc.
6. Poll response handling is deterministic:
   - `completed` and `failed` are terminal.
   - A `404` error envelope with `AI_JOB_NOT_FOUND`, or any other `4xx` error
     envelope, is a terminal failure mapped by `error.code`.
   - Fetch throws, response JSON parse failures, `429`, and `5xx` responses are
     transient and retried at the next interval until the deadline.
   - A successful HTTP response with an unknown status or malformed envelope
     is terminal `AI_INVALID_OUTPUT`; do not poll an unrecognized body until
     timeout.
7. Give up at a deadline 75s after `runAnalysisJob()` starts. This includes
   the create request, initial `Retry-After` wait, transient errors, and all
   polls. Check the deadline before scheduling or issuing another poll, then
   return `AI_POLL_GIVE_UP` with `AI_ANALYSIS_FAILED_MESSAGE`.
8. Accept an optional `AbortSignal`. Check it before/after waits and fetches,
   and pass it to every fetch. If aborted, stop without another poll and return
   `{ok: false, cancelled: true}`. Cancellation is control flow, not an API
   error: it has no `errorCode` or user-facing message.
9. On `status: 'completed'` → validate `data` via `validateAIOutput` (same
   validator used by the sync path today); invalid → `AI_INVALID_OUTPUT`.
10. On `status: 'failed'` → map `error.code` to a display message via the
    table below.

The result type at the service boundary becomes:

```ts
export type AnalyzeTextResult =
  | {ok: true; lesson: AIOutput}
  | {ok: false; cancelled: true}
  | {
      ok: false;
      cancelled?: false;
      errorCode: AnalyzeErrorCode;
      message: string;
    };
```

`AIAnalysisService.analyzeText()` threads the optional signal to both real and
mock implementations. It does not emit `ai_analysis_completed` for a cancelled
run. `AnalyzingScreen` creates an `AbortController`, passes its signal to
`analyzeText`, aborts it in the effect cleanup, and ignores a cancelled result.
This prevents polling from continuing for up to 75s after Back/unmount. It is
separate from the deferred AppState/background-polling policy.

## Error handling & messages

All codes map to existing copy in `src/shared/copy/userMessages.ts` — no new
strings needed:

| Code(s)                                                                                                                                                                                              | Message                                                                                                                                       |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `VALIDATION_EMPTY_TEXT`                                                                                                                                                                              | `EMPTY_INPUT_MESSAGE`                                                                                                                         |
| `VALIDATION_TEXT_TOO_LONG`                                                                                                                                                                           | `TEXT_TOO_LONG_MESSAGE`                                                                                                                       |
| `VALIDATION_MISSING_IDEMPOTENCY_KEY`, `IDEMPOTENCY_CONFLICT`                                                                                                                                         | `AI_ANALYSIS_FAILED_MESSAGE` (client always generates the key; these indicate a client bug, not a user-recoverable state)                     |
| `AI_STAGE_PROVIDER_ERROR`, `AI_STAGE_INVALID_OUTPUT`, `AI_STAGE_TIMEOUT`, `AI_JOB_TIMEOUT`, `AI_FINAL_VALIDATION_FAILED`, `AI_JOB_NOT_FOUND`, `AI_INVALID_OUTPUT`, `AI_PROVIDER_ERROR`, `AI_TIMEOUT` | `AI_ANALYSIS_FAILED_MESSAGE` (matches today's handling of generic AI failures — the code is what analytics tracks, the message stays generic) |
| `AI_POLL_GIVE_UP` (client-only)                                                                                                                                                                      | `AI_ANALYSIS_FAILED_MESSAGE`                                                                                                                  |
| create-request fetch throw / non-JSON response                                                                                                                                                       | `NETWORK_LOST_MESSAGE` (unchanged)                                                                                                            |

A poll fetch throw, poll JSON parse failure, `429`, or `5xx` is transient and
does not produce a user-facing result unless the 75s deadline is reached. A
poll `4xx` error envelope is terminal and uses the code mapping above.

`error.retryable` from the doc is not surfaced in the UI — there is no
client-triggered retry endpoint in this slice, so a `failed` job (retryable or
not) is always handled the same way: navigate back to `origin` with
`{analyzeError: message}`, unchanged from today's `AnalyzingScreen` behavior.

## Progress UI (`AnalyzingScreen`)

Replace the 3-item fake `STEPS` array and its `setInterval` simulation with
the 6 real stages from the doc, using the doc's Vietnamese labels as static
step labels:

| Stage               | Label                           |
| ------------------- | ------------------------------- |
| `source_analysis`   | Đang dịch và sắp xếp nội dung   |
| `sentence_analysis` | Đang phân tích từng câu         |
| `learning_points`   | Đang tìm ngữ pháp và từ vựng    |
| `pronunciation`     | Đang chuẩn bị hướng dẫn phát âm |
| `practice`          | Đang tạo bài luyện tập          |
| `finalizing`        | Đang kiểm tra bài học           |

Each stage's UI state (`done`/`active`/`pending`) is derived deterministically
from `progress.stages[]`: `completed` and `skipped` → `done`; `processing`,
`retrying`, and `failed` → `active`; `pending` or a stage missing from the
server snapshot → `pending`. More than one stage may therefore be active at
once. The terminal job failure navigation normally replaces the screen
immediately after the final failed snapshot; no separate persistent failed
indicator is introduced in this slice.
`HandoffProgressTrack`'s percent comes directly from `progress.percent / 100`
instead of the random-cap simulation. The subtitle under the screen title
shows `progress.message` when present, falling back to the existing static
copy when `message` is null (e.g. right at `queued`).

On `status: 'completed'`, all steps jump to done and the screen navigates
exactly as today (same `COMPLETE_HOLD_MS` hold before transition).

## Mock behavior (`MockAIAnalysisService.ts`)

`useMockAi=true` swaps `analyzeTextWithMock` for a new
`simulateAnalysisJob(confirmedText, options, onProgress, signal)` that emits
synthetic progress through the same 6 stages (using the doc's weights:
15/35/25/10/10/5) on a short timer (comparable pacing to today's
`STEP_INTERVAL_MS`), then resolves with the existing fixture data exactly as
`analyzeTextWithMock` does today. This keeps dev/demo UX aligned with
production and exercises the same progress-rendering code path in
`AnalyzingScreen` without a real backend.
The mock checks the signal between timer waits and returns the same cancelled
result without emitting further progress when aborted.

## Testing

- `analysisJobClient.test.ts`: create success, `IDEMPOTENCY_CONFLICT`,
  validation errors, poll transitions (`queued`→`processing`→`completed`,
  →`failed`, `paused` treated as `processing`), give-up timeout, transient
  poll-error swallowing; relative and absolute `status_url`; valid, missing,
  and invalid `Retry-After`; terminal `404`/`4xx`; transient `429`/`5xx`;
  malformed/unknown success envelopes; and abort during initial wait and poll.
  Use fake timers, following the existing patterns in
  `analyzeClient.test.ts`/`appConfig.test.ts`.
- `MockAIAnalysisService.test.ts`: assert staged progress callbacks fire in
  stage order with increasing percent before the promise resolves.
- `AIAnalysisService.test.ts`: update mocks from `analyzeTextWithApi` to
  `runAnalysisJob`; assert the progress callback is threaded through
  unchanged; assert the signal is threaded through and cancellation does not
  emit `ai_analysis_completed`.
- `AnalyzingScreen.test.tsx`: drive progress via the callback instead of
  relying on the internal timer; assert the stage list renders from real
  `progress.stages[]` data and percent tracks `progress.percent`; cover
  `completed`, `skipped`, `processing`, `retrying`, multiple active stages, and
  missing stages; assert unmount aborts the run and causes no navigation.
- Delete `analyzeClient.test.ts` alongside `analyzeClient.ts`.

Smallest relevant check: `yarn test src/modules/ai-analysis src/shared/api`.

## Non-goals / explicit deferrals

- No client-side sync/async feature flag — sync is fully removed from the app.
- No cancel button — matches the doc; a `failed`/give-up job requires a fresh
  user-initiated retry (new screen entry, new Idempotency-Key).
- No AppState/background-polling handling. Screen unmount/Back cancellation is
  included to prevent an orphan poll loop, but merely backgrounding the app
  does not pause or cancel the job.
- No new analytics events beyond the existing `ai_analysis_started` /
  `ai_analysis_completed`; `error_code` on failure now includes the new codes
  above, which analytics consumers should expect.
