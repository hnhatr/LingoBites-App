# AI Analysis Async Job Client Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the synchronous AI analysis request and timer-driven progress screen with a cancellable create-and-poll async job flow that displays the backend's real six-stage progress.

**Architecture:** Keep `AIAnalysisService.analyzeText` as the UI-facing seam and give both its real and mock branches the same progress callback and abort signal. The new shared API client owns job creation, status URL resolution, retry timing, terminal-envelope validation, timeout handling, and lesson schema validation; `AnalyzingScreen` only converts progress snapshots into display state and navigation.

**Tech Stack:** React Native 0.85, React 19, TypeScript 5.8, Jest 29 with fake timers, React Test Renderer, existing `fetch`, `AbortController`, and `validateAIOutput` utilities.

## Global Constraints

- The server guide at `../LingoBites-Server/docs/01-ba/02-technical/14-ai-analysis-async-job-client-integration-guide.md` is authoritative if it conflicts with the design spec.
- Replace the sync path completely; do not add a sync/async feature flag.
- Create one fresh `Idempotency-Key` per `runAnalysisJob` call with `createRequestId()` and do not auto-retry the create request.
- Use the returned `status_url`; resolve relative URLs against `apiBaseUrl` and leave absolute HTTP(S) URLs unchanged.
- Wait for valid `Retry-After` seconds before the first poll, defaulting to 1 second; use 1.5 seconds for later polls.
- The 75-second deadline includes job creation, waits, transient failures, and polling.
- Treat `queued`, `processing`, and `paused` as in progress; retry poll fetch failures, JSON parse failures, HTTP 429, and HTTP 5xx until the deadline.
- Treat completed and failed envelopes, all HTTP 4xx envelopes, and malformed or unknown successful envelopes as terminal.
- Cancellation returns `{ok: false, cancelled: true}` and must not produce error copy, failure navigation, or an `ai_analysis_completed` event.
- Do not add cancel endpoints, SSE, partial-result UI, or AppState/background behavior.
- Reuse existing user-message constants and `validateAIOutput`; add no dependency and no new user-facing copy.
- Preserve immutable progress snapshots: never mutate a callback value already delivered to the UI.
- Do not commit unless the user explicitly asks; the checkpoint commands below stop at `git diff`.

## File Map

- Create `src/shared/api/analysisJobClient.ts`: request-body construction, create request, status URL resolution, abort-aware waits, polling state machine, error mapping, deadline, and final `AIOutput` validation.
- Create `src/shared/api/__tests__/analysisJobClient.test.ts`: deterministic create/poll/timeout/abort contract tests with fake timers and mocked fetch responses.
- Modify `src/shared/api/types.ts`: async job stage, progress, create, status, and expanded error-code contracts.
- Delete `src/shared/api/analyzeClient.ts`: remove the dead synchronous endpoint client after its behavior has moved to the job client.
- Delete `src/shared/api/__tests__/analyzeClient.test.ts`: replace its coverage with async job client coverage.
- Modify `src/modules/ai-analysis/types.ts`: add progress callback types and the cancellation-only result variant.
- Modify `src/modules/ai-analysis/MockAIAnalysisService.ts`: replace immediate mock completion with abortable six-stage simulation.
- Modify `src/modules/ai-analysis/__tests__/MockAIAnalysisService.test.ts`: verify ordered immutable progress, fixture parity, and cancellation.
- Modify `src/modules/ai-analysis/AIAnalysisService.ts`: select real/mock async job runner, thread callback/signal, and suppress completion analytics for cancellation.
- Modify `src/modules/ai-analysis/__tests__/AIAnalysisService.test.ts`: verify argument forwarding and analytics for success, failure, and cancellation.
- Modify `src/modules/ai-analysis/AnalyzingScreen.tsx`: remove fake timers and derive labels, stage states, subtitle, and progress bar from callback snapshots; abort on cleanup.
- Modify `src/modules/ai-analysis/__tests__/AnalyzingScreen.test.tsx`: drive the callback directly and verify progress rendering, success/failure navigation, and unmount behavior.

---

### Task 1: Define the async job and cancellation contracts

**Files:**

- Modify: `src/shared/api/types.ts:3-92`
- Modify: `src/modules/ai-analysis/types.ts:1-19`

**Interfaces:**

- Consumes: Existing `AIOutput`, `AnalyzeTextRequestBody`, and `ApiErrorCode` types.
- Produces: `AnalysisJobStage`, `AnalysisJobProgressBody`, `CreateAnalysisJobSuccessBody`, `AnalysisJobStatusBody`, `AnalysisProgress`, `AnalysisProgressCallback`, and the cancellation branch of `AnalyzeTextResult`.

- [ ] **Step 1: Extend shared API error and job types**

Add the missing server and client-only codes to `ApiErrorCode`, preserving all existing OCR codes, then add these shapes after `AnalyzeTextRequestBody`:

```ts
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
  status: string;
  created_at: string;
  status_url: string;
};

type AnalysisJobBaseBody = {
  analysis_id: string;
  progress: AnalysisJobProgressBody;
  partial_data: null;
  created_at: string;
  updated_at: string;
  expires_at: string;
};

export type AnalysisJobStatusBody =
  | (AnalysisJobBaseBody & {
      request_id: string;
      status: 'queued' | 'processing' | 'paused';
    })
  | (AnalysisJobBaseBody & {
      request_id: string;
      status: 'completed';
      model: string;
      schema_version: 'ai-output-v1';
      prompt_version: string;
      data: unknown;
    })
  | (AnalysisJobBaseBody & {
      status: 'failed';
      error: {
        code: ApiErrorCode;
        message: string;
        stage?: string;
        retryable?: boolean;
      };
    });
```

The expanded `ApiErrorCode` union must include:

```ts
| 'VALIDATION_MISSING_IDEMPOTENCY_KEY'
| 'IDEMPOTENCY_CONFLICT'
| 'AI_STAGE_PROVIDER_ERROR'
| 'AI_STAGE_INVALID_OUTPUT'
| 'AI_STAGE_TIMEOUT'
| 'AI_JOB_TIMEOUT'
| 'AI_FINAL_VALIDATION_FAILED'
| 'AI_JOB_NOT_FOUND'
| 'AI_POLL_GIVE_UP'
```

- [ ] **Step 2: Add the UI progress and cancellation contracts**

In `src/modules/ai-analysis/types.ts`, import `AnalysisJobStage` alongside `ApiErrorCode` and define:

```ts
export type AnalysisProgress = {
  percent: number;
  stage: string | null;
  message: string | null;
  stages: AnalysisJobStage[];
};

export type AnalysisProgressCallback = (progress: AnalysisProgress) => void;

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

- [ ] **Step 3: Run the type-aware focused suite and observe expected downstream failures**

Run:

```bash
yarn test src/modules/ai-analysis src/shared/api --runInBand
```

Expected: existing tests may fail to compile where failure results are assumed to always contain `errorCode`/`message`; this establishes the call sites Task 3 and Task 4 must narrow with `'cancelled' in result` or `result.cancelled`.

- [ ] **Step 4: Review the focused contract diff**

Run:

```bash
git diff -- src/shared/api/types.ts src/modules/ai-analysis/types.ts
```

Expected: only additive job types, new error-code literals, and the cancellation union branch.

---

### Task 2: Build and test the create-and-poll API client

**Files:**

- Create: `src/shared/api/analysisJobClient.ts`
- Create: `src/shared/api/__tests__/analysisJobClient.test.ts`
- Delete: `src/shared/api/analyzeClient.ts`
- Delete: `src/shared/api/__tests__/analyzeClient.test.ts`

**Interfaces:**

- Consumes: `AnalyzeTextRequestBody`, `ApiErrorBody`, `CreateAnalysisJobSuccessBody`, `AnalysisJobStatusBody`, `AnalyzeTextResult`, `AnalysisProgressCallback`, `createRequestId()`, `getAppConfig()`, and `validateAIOutput()`.
- Produces: `runAnalysisJob(confirmedText: string, sourceType?: AnalyzeTextRequestBody['source_type'], onProgress?: AnalysisProgressCallback, signal?: AbortSignal): Promise<AnalyzeTextResult>`.

- [ ] **Step 1: Create reusable response and timer builders in the new test file**

Start `analysisJobClient.test.ts` with fake timers, the existing lesson fixture, a fixed request ID, and explicit response factories:

```ts
import {validFullOutput} from '../../fixtures';
import {
  AI_ANALYSIS_FAILED_MESSAGE,
  EMPTY_INPUT_MESSAGE,
  NETWORK_LOST_MESSAGE,
} from '../../copy/userMessages';
import {runAnalysisJob} from '../analysisJobClient';

const mockFetch = jest.fn();
global.fetch = mockFetch as unknown as typeof fetch;

const progress = (percent: number, status = 'processing') => ({
  percent,
  current_stage: percent < 100 ? 'sentence_analysis' : null,
  message: percent < 100 ? 'Đang phân tích từng câu' : null,
  stages: [
    {name: 'source_analysis', status: 'completed', attempts: 1},
    {name: 'sentence_analysis', status, attempts: 1},
  ],
});

const response = (
  body: unknown,
  options: {ok?: boolean; status?: number; retryAfter?: string | null} = {},
) => ({
  ok: options.ok ?? true,
  status: options.status ?? 200,
  headers: {get: () => options.retryAfter ?? null},
  json: jest.fn().mockResolvedValue(body),
});

const created = (statusUrl = '/v1/ai/analyses/job-1') => ({
  request_id: 'mock-uuid',
  analysis_id: 'job-1',
  status: 'queued',
  created_at: '2026-08-06T00:00:00.000Z',
  status_url: statusUrl,
});

const inProgress = (
  status: 'queued' | 'processing' | 'paused',
  percent: number,
) => ({
  analysis_id: 'job-1',
  request_id: 'mock-uuid',
  status,
  progress: progress(percent),
  partial_data: null,
  created_at: '2026-08-06T00:00:00.000Z',
  updated_at: '2026-08-06T00:00:01.000Z',
  expires_at: '2026-08-07T00:00:00.000Z',
});
```

Use `beforeEach` to call `jest.useFakeTimers()`, `jest.setSystemTime(0)`, and reset `mockFetch`; use `afterEach` to restore real timers.

- [ ] **Step 2: Write failing create and happy-path polling tests**

Cover these assertions in separate tests:

```ts
mockFetch
  .mockResolvedValueOnce(response(created(), {status: 202, retryAfter: '1'}))
  .mockResolvedValueOnce(response(inProgress('queued', 0)))
  .mockResolvedValueOnce(response(inProgress('processing', 40)))
  .mockResolvedValueOnce(
    response({
      ...inProgress('processing', 100),
      status: 'completed',
      model: 'staged-pipeline',
      schema_version: 'ai-output-v1',
      prompt_version: 'lesson-analysis-v1',
      data: {...validFullOutput, original_text: 'Sample text.'},
    }),
  );

const onProgress = jest.fn();
const pending = runAnalysisJob('Sample text.', 'paste_text', onProgress);
await jest.advanceTimersByTimeAsync(1_000 + 1_500 + 1_500);
await expect(pending).resolves.toEqual(expect.objectContaining({ok: true}));
expect(mockFetch).toHaveBeenNthCalledWith(
  1,
  'http://localhost:3000/v1/ai/analyses',
  expect.objectContaining({
    method: 'POST',
    headers: expect.objectContaining({'Idempotency-Key': 'mock-uuid'}),
  }),
);
expect(mockFetch).toHaveBeenNthCalledWith(
  2,
  'http://localhost:3000/v1/ai/analyses/job-1',
  expect.objectContaining({method: 'GET'}),
);
expect(onProgress).toHaveBeenCalledWith({
  percent: 40,
  stage: 'sentence_analysis',
  message: 'Đang phân tích từng câu',
  stages: expect.any(Array),
});
```

Add a separate absolute URL case using `https://jobs.example.test/status/job-1` and assert the GET uses that URL unchanged. Add valid (`'0'`, `'2.5'`), missing, negative, `NaN`, and `Infinity` `Retry-After` cases and assert the first GET occurs after the expected delay.

- [ ] **Step 3: Write failing terminal create and poll error tests**

Add table-driven cases for create responses:

```ts
it.each([
  ['VALIDATION_EMPTY_TEXT', EMPTY_INPUT_MESSAGE],
  ['VALIDATION_MISSING_IDEMPOTENCY_KEY', AI_ANALYSIS_FAILED_MESSAGE],
  ['IDEMPOTENCY_CONFLICT', AI_ANALYSIS_FAILED_MESSAGE],
])('maps create error %s', async (code, message) => {
  mockFetch.mockResolvedValue(
    response(
      {request_id: 'r', status: 'failed', error: {code, message: 'server'}},
      {ok: false, status: code === 'IDEMPOTENCY_CONFLICT' ? 409 : 400},
    ),
  );
  await expect(runAnalysisJob('Sample text.')).resolves.toEqual({
    ok: false,
    errorCode: code,
    message,
  });
});
```

Also assert create fetch rejection and create JSON rejection both return `{ok: false, errorCode: 'NETWORK_ERROR', message: NETWORK_LOST_MESSAGE}`. For polling, assert a 404 `AI_JOB_NOT_FOUND` envelope and another 4xx error envelope return immediately with mapped generic copy, while a terminal job `failed` body maps its exact code and does not issue another GET.

- [ ] **Step 4: Write failing transient, malformed, timeout, and abort tests**

Add tests proving:

- A poll fetch rejection, JSON rejection, HTTP 429, and HTTP 500 each consume one interval and then recover on the next successful poll.
- A successful response with `status: 'cancelled'`, no `status`, or missing required terminal fields returns `AI_INVALID_OUTPUT` immediately.
- Invalid completed `data` returns `AI_INVALID_OUTPUT` through `validateAIOutput`.
- Repeated transient responses reach 75,000 ms from the function start and return `{ok: false, errorCode: 'AI_POLL_GIVE_UP', message: AI_ANALYSIS_FAILED_MESSAGE}` without issuing a fetch after the deadline.
- Abort before create, during create, during initial wait, and during a later interval resolves `{ok: false, cancelled: true}` and causes no later fetch or progress callback.
- Two delivered progress snapshots do not share their `stages` array or stage object references:

```ts
expect(onProgress.mock.calls[0][0]).not.toBe(onProgress.mock.calls[1][0]);
expect(onProgress.mock.calls[0][0].stages).not.toBe(
  onProgress.mock.calls[1][0].stages,
);
expect(onProgress.mock.calls[0][0].stages[0]).not.toBe(
  onProgress.mock.calls[1][0].stages[0],
);
```

- [ ] **Step 5: Run the new client test and verify it fails**

Run:

```bash
yarn test src/shared/api/__tests__/analysisJobClient.test.ts --runInBand
```

Expected: FAIL because `analysisJobClient.ts` and `runAnalysisJob` do not exist.

- [ ] **Step 6: Implement request construction, URL resolution, copy mapping, and abort-aware waiting**

In `analysisJobClient.ts`, move the existing `buildRequestBody` behavior from `analyzeClient.ts`, including `Platform.OS`, default level/language/prompt version, and a separate `request_id`. Define the timing constants and helpers:

```ts
const CREATE_PATH = '/v1/ai/analyses';
const DEFAULT_RETRY_AFTER_MS = 1_000;
const POLL_INTERVAL_MS = 1_500;
const POLL_DEADLINE_MS = 75_000;

const cancelledResult = (): AnalyzeTextResult => ({ok: false, cancelled: true});

function isAborted(signal?: AbortSignal): boolean {
  return signal?.aborted === true;
}

function parseRetryAfter(value: string | null): number {
  if (value === null || value.trim() === '') {
    return DEFAULT_RETRY_AFTER_MS;
  }
  const seconds = Number(value);
  return Number.isFinite(seconds) && seconds >= 0
    ? seconds * 1_000
    : DEFAULT_RETRY_AFTER_MS;
}

function resolveStatusUrl(apiBaseUrl: string, statusUrl: string): string {
  if (/^https?:\/\//i.test(statusUrl)) {
    return statusUrl;
  }
  return `${apiBaseUrl}${statusUrl.startsWith('/') ? '' : '/'}${statusUrl}`;
}

function waitFor(ms: number, signal?: AbortSignal): Promise<boolean> {
  if (isAborted(signal)) return Promise.resolve(false);
  return new Promise(resolve => {
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve(true);
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
      resolve(false);
    };
    signal?.addEventListener('abort', onAbort, {once: true});
  });
}
```

Implement `mapApiErrorToMessage` with validation codes mapped to `EMPTY_INPUT_MESSAGE`/`TEXT_TOO_LONG_MESSAGE`, create-key and all AI job/provider/timeout/not-found/give-up codes mapped to `AI_ANALYSIS_FAILED_MESSAGE`, and `NETWORK_ERROR` mapped to `NETWORK_LOST_MESSAGE`. Do not default to arbitrary server text for the listed codes.

- [ ] **Step 7: Implement strict envelope guards and the polling state machine**

Create small guards for object, API error, create success, progress, in-progress, completed, and failed envelopes. Guards must validate the discriminator and fields the branch consumes; an HTTP-success body that does not satisfy a known branch is `AI_INVALID_OUTPUT`.

Implement `runAnalysisJob` with this signature and control flow:

```ts
export async function runAnalysisJob(
  confirmedText: string,
  sourceType: AnalyzeTextRequestBody['source_type'] = 'paste_text',
  onProgress?: AnalysisProgressCallback,
  signal?: AbortSignal,
): Promise<AnalyzeTextResult> {
  const startedAt = Date.now();
  const deadline = startedAt + POLL_DEADLINE_MS;
  if (isAborted(signal)) return cancelledResult();

  const {apiBaseUrl} = getAppConfig();
  const idempotencyKey = createRequestId();
  const requestBody = buildRequestBody(confirmedText, sourceType);
  // POST once with Accept, Content-Type, Idempotency-Key, body, and signal.
  // Parse the create envelope once; create transport/parse failures are NETWORK_ERROR.
  // Reject non-2xx/error or malformed create envelopes deterministically.
  // Resolve status_url and wait the parsed Retry-After duration.

  while (Date.now() < deadline) {
    if (isAborted(signal)) return cancelledResult();
    // GET status URL with Accept and signal.
    // AbortError/aborted signal => cancelled.
    // Fetch/JSON/429/5xx => transient; wait POLL_INTERVAL_MS and continue.
    // 4xx error envelope => mapped terminal result.
    // queued/processing/paused => emit a cloned progress snapshot.
    // completed => validate data and return lesson.
    // failed => map error.code and return failure.
    // unknown successful body => AI_INVALID_OUTPUT.
    if (Date.now() >= deadline) break;
    if (
      !(await waitFor(
        Math.min(POLL_INTERVAL_MS, deadline - Date.now()),
        signal,
      ))
    ) {
      return cancelledResult();
    }
  }

  return {
    ok: false,
    errorCode: 'AI_POLL_GIVE_UP',
    message: AI_ANALYSIS_FAILED_MESSAGE,
  };
}
```

Replace each comment block above with the concrete guarded code. Check cancellation immediately before and after every wait and fetch. When cloning progress, use `stages: body.progress.stages.map(stage => ({...stage}))`.

- [ ] **Step 8: Run the job-client tests and refine only contract mismatches**

Run:

```bash
yarn test src/shared/api/__tests__/analysisJobClient.test.ts --runInBand
```

Expected: PASS with no pending timer warning and no fetch beyond the timeout/abort boundary.

- [ ] **Step 9: Remove the synchronous client and its obsolete test**

Delete:

```text
src/shared/api/analyzeClient.ts
src/shared/api/__tests__/analyzeClient.test.ts
```

Do not remove `AIAnalyzeSuccessBody` yet if another importer remains; use `rg` only after the graph-backed work to confirm whether it is unused, and remove it from `types.ts` only when there are zero importers.

- [ ] **Step 10: Review the API slice diff**

Run:

```bash
git diff -- src/shared/api src/modules/ai-analysis/types.ts
```

Expected: the sync endpoint is gone, async client tests cover every deterministic/transient branch, and no dependency or message constant was added.

---

### Task 3: Add staged progress and cancellation to the mock and service seam

**Files:**

- Modify: `src/modules/ai-analysis/MockAIAnalysisService.ts:1-43`
- Modify: `src/modules/ai-analysis/__tests__/MockAIAnalysisService.test.ts:1-29`
- Modify: `src/modules/ai-analysis/AIAnalysisService.ts:1-52`
- Modify: `src/modules/ai-analysis/__tests__/AIAnalysisService.test.ts:1-67`

**Interfaces:**

- Consumes: `runAnalysisJob`, `AnalysisProgressCallback`, `AbortSignal`, existing fixture selection/validation, and existing analytics helpers.
- Produces: `simulateAnalysisJob(confirmedText, options?, onProgress?, signal?)` and `analyzeText(confirmedText, options?, onProgress?, signal?)`, both returning the expanded `AnalyzeTextResult`.

- [ ] **Step 1: Write failing mock progress and abort tests**

Rename test imports and describe blocks to `simulateAnalysisJob`. Use fake timers and assert:

```ts
const onProgress = jest.fn();
const pending = simulateAnalysisJob(
  'Sample confirmed text.',
  undefined,
  onProgress,
);
await jest.runAllTimersAsync();
await expect(pending).resolves.toEqual(expect.objectContaining({ok: true}));
expect(onProgress.mock.calls.map(([value]) => value.percent)).toEqual([
  15, 50, 75, 85, 95, 100,
]);
expect(onProgress.mock.calls.map(([value]) => value.stage)).toEqual([
  'source_analysis',
  'sentence_analysis',
  'learning_points',
  'pronunciation',
  'practice',
  'finalizing',
]);
```

Assert each callback contains all six stage names, completed stages stay completed, the current stage is `processing` until the final emission, snapshots do not share arrays/objects, and full/minimal/forced-invalid fixture behavior remains unchanged. Add an abort test that advances through one stage, calls `controller.abort()`, drains timers, expects `{ok: false, cancelled: true}`, and asserts the callback count no longer increases.

- [ ] **Step 2: Run the mock test and verify it fails**

Run:

```bash
yarn test src/modules/ai-analysis/__tests__/MockAIAnalysisService.test.ts --runInBand
```

Expected: FAIL because `simulateAnalysisJob` does not exist and the current mock emits no progress.

- [ ] **Step 3: Implement the six-stage mock simulation**

Define the exact stage metadata and a short abort-aware delay:

```ts
const MOCK_STAGE_INTERVAL_MS = 450;
const MOCK_STAGES = [
  {
    name: 'source_analysis',
    weight: 15,
    message: 'Đang dịch và sắp xếp nội dung',
  },
  {name: 'sentence_analysis', weight: 35, message: 'Đang phân tích từng câu'},
  {
    name: 'learning_points',
    weight: 25,
    message: 'Đang tìm ngữ pháp và từ vựng',
  },
  {
    name: 'pronunciation',
    weight: 10,
    message: 'Đang chuẩn bị hướng dẫn phát âm',
  },
  {name: 'practice', weight: 10, message: 'Đang tạo bài luyện tập'},
  {name: 'finalizing', weight: 5, message: 'Đang kiểm tra bài học'},
] as const;
```

Export:

```ts
export async function simulateAnalysisJob(
  confirmedText: string,
  options?: AnalyzeOptions,
  onProgress?: AnalysisProgressCallback,
  signal?: AbortSignal,
): Promise<AnalyzeTextResult>;
```

For each stage, wait, return cancellation if aborted, increment percent by weight, and emit a newly created six-item stage array. After the final update, run the existing forced-invalid and fixture validation logic unchanged so the resulting lesson remains identical to the old mock.

- [ ] **Step 4: Run the mock tests**

Run:

```bash
yarn test src/modules/ai-analysis/__tests__/MockAIAnalysisService.test.ts --runInBand
```

Expected: PASS; Jest exits without open timers.

- [ ] **Step 5: Write failing service forwarding and analytics tests**

Replace the `analyzeClient` mock with:

```ts
const mockRunAnalysisJob = jest.fn();
jest.mock('../../../shared/api/analysisJobClient', () => ({
  runAnalysisJob: (...args: unknown[]) => mockRunAnalysisJob(...args),
}));
```

Mock `simulateAnalysisJob` instead of `analyzeTextWithMock`, retain a named `mockTrackEvent`, and add tests asserting both branches receive the exact callback and signal:

```ts
const onProgress = jest.fn();
const controller = new AbortController();
await analyzeText(
  ' Sample text. ',
  {sourceType: 'camera'},
  onProgress,
  controller.signal,
);
expect(mockRunAnalysisJob).toHaveBeenCalledWith(
  'Sample text.',
  'camera',
  onProgress,
  controller.signal,
);
```

Add a cancellation test returning `{ok: false, cancelled: true}` and assert only `ai_analysis_started` is tracked; success and ordinary failure must still emit one `ai_analysis_completed` event with their current payload shapes.

- [ ] **Step 6: Run the service test and verify it fails**

Run:

```bash
yarn test src/modules/ai-analysis/__tests__/AIAnalysisService.test.ts --runInBand
```

Expected: FAIL because the current service imports the old runners and accepts only two parameters.

- [ ] **Step 7: Update the service seam**

Change the service signature and selection:

```ts
export async function analyzeText(
  confirmedText: string,
  options?: AnalyzeOptions,
  onProgress?: AnalysisProgressCallback,
  signal?: AbortSignal,
): Promise<AnalyzeTextResult> {
  // preserve trim, start analytics, duration measurement, and config lookup
  const result = useMockAi
    ? await simulateAnalysisJob(trimmed, options, onProgress, signal)
    : await runAnalysisJob(
        trimmed,
        options?.sourceType ?? 'paste_text',
        onProgress,
        signal,
      );

  if (!result.ok && result.cancelled) {
    return result;
  }
  // preserve current success/failure completion analytics and return value
}
```

Use discriminated narrowing before reading `errorCode`. Do not emit a new cancellation analytics event.

- [ ] **Step 8: Run both module tests and review the seam diff**

Run:

```bash
yarn test src/modules/ai-analysis/__tests__/AIAnalysisService.test.ts src/modules/ai-analysis/__tests__/MockAIAnalysisService.test.ts --runInBand
git diff -- src/modules/ai-analysis/AIAnalysisService.ts src/modules/ai-analysis/MockAIAnalysisService.ts src/modules/ai-analysis/__tests__
```

Expected: PASS; real and mock branches expose the same four-argument contract and cancellation has no completion event.

---

### Task 4: Render backend progress and abort polling on screen cleanup

**Files:**

- Modify: `src/modules/ai-analysis/AnalyzingScreen.tsx:1-189`
- Modify: `src/modules/ai-analysis/__tests__/AnalyzingScreen.test.tsx:1-151`

**Interfaces:**

- Consumes: `analyzeText(..., onProgress, signal)`, immutable `AnalysisProgress` snapshots, and existing navigation contract.
- Produces: six static labels, deterministic `StepState` derivation, server-driven percent/subtitle UI, and cleanup cancellation.

- [ ] **Step 1: Refactor the screen test harness to capture progress and signal**

Replace immediate mocked resolutions with a deferred result and capture `mockAnalyzeText.mock.calls[0]` arguments. Add text helpers over React Test Renderer:

```ts
function textContent(root: ReactTestRenderer.ReactTestInstance): string {
  return root
    .findAllByType('Text')
    .map(node => node.props.children)
    .flat(Infinity)
    .join(' ');
}

function stage(name: string, status: string) {
  return {name, status, attempts: status === 'pending' ? 0 : 1};
}
```

Keep the existing theme/provider wrapper and navigation spies.

- [ ] **Step 2: Write failing callback-driven rendering tests**

Invoke the captured third argument with snapshots and assert:

- Percent label changes to `40%` and the progress track receives `0.4`.
- A non-null server `message` replaces the fallback subtitle; a null message shows `App đang phân tích đoạn text bạn xác nhận. Giữ app mở một chút nhé.`.
- The six exact labels appear in source order.
- `completed` and `skipped` render done indicators.
- `processing`, `retrying`, and `failed` render active indicators.
- `pending` and omitted stages render pending indicators.
- Two stages can render active simultaneously.

Prefer asserting `ActivityIndicator` count and rendered check marks together with label order, rather than reaching into implementation-only state.

- [ ] **Step 3: Write failing completion, failure, and cleanup tests**

Update the success expectation to four arguments:

```ts
expect(mockAnalyzeText).toHaveBeenCalledWith(
  'Hello world',
  {sourceType: 'paste_text'},
  expect.any(Function),
  expect.any(AbortSignal),
);
```

Assert a successful result forces `100%` and all six done before the existing 220 ms hold and unchanged `navigation.reset`. Preserve the existing ordinary error-to-origin assertion. Add cancellation and unmount cases:

```ts
const renderer = renderScreen();
const signal = mockAnalyzeText.mock.calls[0][3] as AbortSignal;
expect(signal.aborted).toBe(false);
await act(async () => renderer.unmount());
expect(signal.aborted).toBe(true);
expect(mockReset).not.toHaveBeenCalled();
expect(mockDispatch).not.toHaveBeenCalled();
```

Resolve the pending service result with `{ok: false, cancelled: true}` after unmount and assert navigation remains untouched.

- [ ] **Step 4: Run the screen test and verify it fails**

Run:

```bash
yarn test src/modules/ai-analysis/__tests__/AnalyzingScreen.test.tsx --runInBand
```

Expected: FAIL because the current screen has three timer-driven stages and passes no callback or signal.

- [ ] **Step 5: Replace fake progress constants with the server stage catalog and derivation helper**

Delete `STEP_INTERVAL_MS`, `STEP_PROGRESS`, `randomProgressCap`, `activeStep`, and `progressCap`. Keep `COMPLETE_HOLD_MS = 220`. Define:

```ts
const STAGES = [
  {key: 'source_analysis', label: 'Đang dịch và sắp xếp nội dung'},
  {key: 'sentence_analysis', label: 'Đang phân tích từng câu'},
  {key: 'learning_points', label: 'Đang tìm ngữ pháp và từ vựng'},
  {key: 'pronunciation', label: 'Đang chuẩn bị hướng dẫn phát âm'},
  {key: 'practice', label: 'Đang tạo bài luyện tập'},
  {key: 'finalizing', label: 'Đang kiểm tra bài học'},
] as const;

function getStepState(
  stageName: string,
  stages: AnalysisJobStage[],
  done: boolean,
): StepState {
  if (done) return 'done';
  const status = stages.find(stage => stage.name === stageName)?.status;
  if (status === 'completed' || status === 'skipped') return 'done';
  if (status === 'processing' || status === 'retrying' || status === 'failed') {
    return 'active';
  }
  return 'pending';
}
```

- [ ] **Step 6: Wire progress state and abort lifecycle into the effect**

Initialize progress to the queued fallback:

```ts
const [progress, setProgress] = useState<AnalysisProgress>({
  percent: 0,
  stage: null,
  message: null,
  stages: [],
});
const [done, setDone] = useState(false);
```

Inside the effect, create one `AbortController`, pass `setProgress` through an `isActive` guard to the third argument, and pass `controller.signal` fourth:

```ts
const controller = new AbortController();
const result = await analyzeText(
  confirmedText,
  {sourceType},
  nextProgress => {
    if (isActive) setProgress(nextProgress);
  },
  controller.signal,
);
```

On cleanup set `isActive = false`, call `controller.abort()`, and clear only the completion hold timer. After awaiting, return immediately if inactive or `!result.ok && result.cancelled`. Preserve ordinary failure navigation and success reset. On success call `setProgress(previous => ({...previous, percent: 100}))`, `setDone(true)`, then use the existing hold.

- [ ] **Step 7: Render real percent, message, and stage states**

Derive:

```ts
const normalizedProgress = done
  ? 1
  : Math.max(0, Math.min(1, progress.percent / 100));
const percentLabel = `${done ? 100 : Math.round(progress.percent)}%`;
const subtitle =
  progress.message ??
  'App đang phân tích đoạn text bạn xác nhận. Giữ app mở một chút nhé.';
```

Render `STAGES`, call `getStepState(step.key, progress.stages, done)` for each row, and pass `normalizedProgress` to `HandoffProgressTrack`. Do not derive labels from `progress.message`; the six row labels remain static while the subtitle is server-controlled.

- [ ] **Step 8: Run the screen tests**

Run:

```bash
yarn test src/modules/ai-analysis/__tests__/AnalyzingScreen.test.tsx --runInBand
```

Expected: PASS with callback-driven progress and no state update after unmount.

- [ ] **Step 9: Review the UI slice diff**

Run:

```bash
git diff -- src/modules/ai-analysis/AnalyzingScreen.tsx src/modules/ai-analysis/__tests__/AnalyzingScreen.test.tsx
```

Expected: no `setInterval`, random cap, three-stage copy, cancel button, or AppState handling remains.

---

### Task 5: Verify the full integration and dead-code removal

**Files:**

- Verify all files listed in the File Map.

**Interfaces:**

- Consumes: Completed Tasks 1-4.
- Produces: A fully tested async analysis path with no synchronous client imports.

- [ ] **Step 1: Update the knowledge graph after all file changes**

Run the project `code-review-graph` incremental update for the repository, then query importers of `src/shared/api/analyzeClient.ts` and tests for `runAnalysisJob`, `simulateAnalysisJob`, `analyzeText`, and `AnalyzingScreen`.

Expected: no importer references the deleted sync client; each new or changed seam has focused test coverage.

- [ ] **Step 2: Run the smallest relevant suite from the design spec**

Run:

```bash
yarn test src/modules/ai-analysis src/shared/api --runInBand
```

Expected: PASS; no open-handle or pending-timer warning.

- [ ] **Step 3: Run lint on the changed TypeScript slice**

Run:

```bash
yarn eslint src/shared/api/analysisJobClient.ts src/shared/api/__tests__/analysisJobClient.test.ts src/shared/api/types.ts src/modules/ai-analysis/AIAnalysisService.ts src/modules/ai-analysis/MockAIAnalysisService.ts src/modules/ai-analysis/AnalyzingScreen.tsx src/modules/ai-analysis/types.ts src/modules/ai-analysis/__tests__/AIAnalysisService.test.ts src/modules/ai-analysis/__tests__/MockAIAnalysisService.test.ts src/modules/ai-analysis/__tests__/AnalyzingScreen.test.tsx
```

Expected: exit code 0 with no lint errors.

- [ ] **Step 4: Confirm the old endpoint and fake progress are absent**

Run:

```bash
rg -n "v1/ai/analyze|analyzeTextWithApi|randomProgressCap|STEP_PROGRESS|setInterval" src
```

Expected: no matches for the removed synchronous client or timer-driven analysis progress. The `/v1/ai/analyses` plural endpoint is allowed and should be present.

- [ ] **Step 5: Inspect the final focused diff and working tree**

Run:

```bash
git diff --check
git status --short
git diff -- src/shared/api src/modules/ai-analysis
```

Expected: no whitespace errors; only the planned files are changed/deleted/created. Do not commit unless explicitly requested by the user.

## Self-Review Results

- Spec coverage: Every data contract, status branch, error mapping, poll timing, deadline, progress state, mock behavior, cancellation rule, navigation behavior, and explicit non-goal maps to Tasks 1-5.
- Placeholder scan: No `TBD`, `TODO`, "implement later," generic error-handling instruction, or undefined neighboring interface remains. The polling step provides exact guards, branches, constants, and output contracts while leaving ordinary local variable arrangement to the implementer.
- Type consistency: `runAnalysisJob`, `simulateAnalysisJob`, and `analyzeText` consistently use `AnalysisProgressCallback` before `AbortSignal`; `AnalyzeTextResult` uses the same cancellation discriminator at every layer; UI stage status literals match `AnalysisJobStage`.
