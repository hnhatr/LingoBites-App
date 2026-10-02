/**
 * Adversarial regression tests — LING-210 r1
 *
 * Attacks INV-001 and INV-002 via paths NOT covered by the developer's
 * (a)–(h) suite. All attacks HELD; tests remain as permanent regression
 * coverage.
 *
 * INV-001: A creation key is never sent with two different trimmed links;
 *          changing the link always mints a new key before the request.
 * INV-002: For one creation attempt with the same link, every send uses
 *          the same key until success or an explicit "Thử lại video này";
 *          one link never creates two lessons.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import React from 'react';
import ReactTestRenderer, {act} from 'react-test-renderer';

import type {LearnerLessonCreationRequestBody} from '@core/schemas/lesson';

import {
  fetchLessonCreationStatus,
  submitLessonCreation,
} from '../canonicalLessonClient';
import {resetCreationIdempotencyMemoryForTests} from '../creationIdempotencyStore';
import {useLessonCreation} from '../useLessonCreation';
import {YOUTUBE_DISCLOSURE_KEY} from '../youtubeDisclosure';

jest.mock('../canonicalLessonClient', () => ({
  fetchLessonCreationStatus: jest.fn(),
  submitLessonCreation: jest.fn(),
}));

const mockedSubmit = submitLessonCreation as jest.Mock;
const mockedStatus = fetchLessonCreationStatus as jest.Mock;

const LESSON_ID = 'adv-001-lesson-33333333333';
const URL_A = 'https://youtube.com/watch?v=adv-a';
const URL_B = 'https://youtube.com/watch?v=adv-b';

type Control = {
  trigger: (body: LearnerLessonCreationRequestBody) => Promise<void>;
  retryWithFreshKey: () => Promise<void>;
};

function makeDriver(submissionId: string) {
  const control: {current: Control | null} = {current: null};
  function Driver() {
    const {submit, retryWithFreshKey} = useLessonCreation(submissionId);
    control.current = {trigger: submit, retryWithFreshKey};
    return null;
  }
  return {control, Driver};
}

function idempotencyKeyFromCall(callIndex: number): string {
  return (mockedSubmit.mock.calls[callIndex] as [unknown, string])[1];
}

beforeEach(async () => {
  jest.clearAllMocks();
  resetCreationIdempotencyMemoryForTests();
  await AsyncStorage.clear();
  await AsyncStorage.setItem(YOUTUBE_DISCLOSURE_KEY, '1');
});

// ---------------------------------------------------------------------------
// INV-002 — "reopening the screen" (unmount → remount, SAME URL)
// The existing test (d) only verifies that a *different* URL after remount
// gets a *different* key.  This test verifies the symmetric case: same URL
// after remount MUST reuse the same key (the binding persisted to AsyncStorage
// survives a full in-memory reset and must be read back correctly).
// ---------------------------------------------------------------------------
describe('ADV-001 / INV-002: same URL after unmount+remount reuses persisted key', () => {
  it('reuses the AsyncStorage-persisted key when the in-memory map is cleared on remount', async () => {
    mockedSubmit.mockResolvedValue({
      ok: true,
      value: {requestId: 'req-adv-001', status: 'queued'},
    });
    mockedStatus.mockResolvedValue({
      ok: true,
      value: {
        contract_version: 1,
        status: 'failed',
        lesson_id: null,
        error: {code: 'TRANSLATION_FAILED', retryable: true},
      },
    });

    // First mount: submit URL_A, note the key.
    const d1 = makeDriver('adv-remount-same');
    let tree!: ReactTestRenderer.ReactTestRenderer;
    await act(async () => {
      tree = ReactTestRenderer.create(<d1.Driver />);
    });
    await act(async () => {
      await d1.control.current?.trigger({source: 'youtube', url: URL_A});
    });
    const keyFirst = idempotencyKeyFromCall(0);

    // Unmount (simulates app background + in-memory map cleared).
    await act(async () => {
      tree.unmount();
    });
    resetCreationIdempotencyMemoryForTests(); // simulate cold restart

    // Second mount, same submissionId, same URL.
    mockedSubmit.mockClear();
    mockedStatus.mockResolvedValue({
      ok: true,
      value: {
        contract_version: 1,
        status: 'succeeded',
        lesson_id: LESSON_ID,
        error: null,
      },
    });
    const d2 = makeDriver('adv-remount-same');
    await act(async () => {
      ReactTestRenderer.create(<d2.Driver />);
    });
    await act(async () => {
      await d2.control.current?.trigger({source: 'youtube', url: URL_A});
    });
    const keySecond = idempotencyKeyFromCall(0);

    // INV-002: same attempt (same submissionId), same link → same key.
    expect(keySecond).toBe(keyFirst);
  });
});

// ---------------------------------------------------------------------------
// INV-002 — network-level error state retry sends same key
// The `error` state is reached when submitLessonCreation itself rejects
// (network error at POST time, before any polling).  The retry button in the
// UI calls submit(body) directly — no key rotation — so the same key must be
// used for the retry POST.
// ---------------------------------------------------------------------------
describe('ADV-002 / INV-002: network error retry reuses the same key', () => {
  it('sends the same idempotency key on a retry after a network-level POST failure', async () => {
    mockedSubmit
      .mockResolvedValueOnce({
        ok: false,
        kind: 'network-error',
        message: 'offline',
        retryable: true,
      })
      .mockResolvedValueOnce({
        ok: true,
        value: {requestId: 'req-adv-002', status: 'queued'},
      });
    mockedStatus.mockResolvedValue({
      ok: true,
      value: {
        contract_version: 1,
        status: 'succeeded',
        lesson_id: LESSON_ID,
        error: null,
      },
    });

    const d = makeDriver('adv-network-err');
    await act(async () => {
      ReactTestRenderer.create(<d.Driver />);
    });

    // First submit: network error.
    await act(async () => {
      await d.control.current?.trigger({source: 'youtube', url: URL_A});
    });
    const keyFirst = idempotencyKeyFromCall(0);

    // Retry: same URL, same hook instance, no key rotation.
    await act(async () => {
      await d.control.current?.trigger({source: 'youtube', url: URL_A});
    });
    const keyRetry = idempotencyKeyFromCall(1);

    // INV-002: retry must reuse the same key.
    expect(keyRetry).toBe(keyFirst);
  });
});

// ---------------------------------------------------------------------------
// INV-001 — URL changes between network error and retry
// After a network error the same key is stored.  If the user then changes
// the URL and submits, a new key MUST be minted (INV-001).  This attacks the
// `error` state path (distinct from test (b) which uses the same URL first
// then changes before a second submit — here the URL changes *between*
// the two submits at the same hook level).
// ---------------------------------------------------------------------------
describe('ADV-003 / INV-001: URL change after network error mints a new key', () => {
  it('mints a fresh key when the URL changes after a network-level POST failure', async () => {
    mockedSubmit
      .mockResolvedValueOnce({
        ok: false,
        kind: 'network-error',
        message: 'offline',
        retryable: true,
      })
      .mockResolvedValueOnce({
        ok: true,
        value: {requestId: 'req-adv-003', status: 'queued'},
      });
    mockedStatus.mockResolvedValue({
      ok: true,
      value: {
        contract_version: 1,
        status: 'succeeded',
        lesson_id: LESSON_ID,
        error: null,
      },
    });

    const d = makeDriver('adv-url-change-after-err');
    await act(async () => {
      ReactTestRenderer.create(<d.Driver />);
    });

    // First submit: URL_A, network error.
    await act(async () => {
      await d.control.current?.trigger({source: 'youtube', url: URL_A});
    });
    const keyA = idempotencyKeyFromCall(0);

    // Second submit: URL_B (user changed the URL), no explicit key rotation.
    await act(async () => {
      await d.control.current?.trigger({source: 'youtube', url: URL_B});
    });
    const keyB = idempotencyKeyFromCall(1);

    // INV-001: different URL → different key.
    expect(keyB).not.toBe(keyA);
  });
});

// ---------------------------------------------------------------------------
// INV-001 — trimming symmetry: whitespace-padded URL must produce same key
// as the unpadded URL, and therefore must NOT mint a new key.
// ---------------------------------------------------------------------------
describe('ADV-004 / INV-001: whitespace-padded URL is the same trimmed identity', () => {
  it('reuses the key when the submitted URL differs only by surrounding whitespace', async () => {
    mockedSubmit.mockResolvedValue({
      ok: true,
      value: {requestId: 'req-adv-004', status: 'queued'},
    });
    mockedStatus.mockResolvedValue({
      ok: true,
      value: {
        contract_version: 1,
        status: 'failed',
        lesson_id: null,
        error: {code: 'TRANSLATION_FAILED', retryable: true},
      },
    });

    const d = makeDriver('adv-trim');
    await act(async () => {
      ReactTestRenderer.create(<d.Driver />);
    });

    // First submit with exact URL.
    await act(async () => {
      await d.control.current?.trigger({source: 'youtube', url: URL_A});
    });
    const keyFirst = idempotencyKeyFromCall(0);

    // Second submit with whitespace-padded URL.
    mockedSubmit.mockClear();
    mockedStatus.mockResolvedValue({
      ok: true,
      value: {
        contract_version: 1,
        status: 'succeeded',
        lesson_id: LESSON_ID,
        error: null,
      },
    });
    await act(async () => {
      await d.control.current?.trigger({
        source: 'youtube',
        url: `  ${URL_A}  `,
      });
    });
    const keySecond = idempotencyKeyFromCall(0);

    // INV-001: trimmed identity is the same → same key (INV-002 holds too).
    expect(keySecond).toBe(keyFirst);
  });
});

// ---------------------------------------------------------------------------
// INV-002 — retryWithFreshKey + immediate re-submit with SAME URL
// After rotating the key via retryWithFreshKey, a re-submit with the same URL
// must use the newly rotated key, not the old one, and NOT double-POST.
// ---------------------------------------------------------------------------
describe('ADV-005 / INV-002: retryWithFreshKey followed by re-submit uses the rotated key', () => {
  it('uses the rotated key (not the original) after an explicit retry', async () => {
    mockedSubmit.mockResolvedValue({
      ok: true,
      value: {requestId: 'req-adv-005-a', status: 'queued'},
    });
    mockedStatus.mockResolvedValue({
      ok: true,
      value: {
        contract_version: 1,
        status: 'failed',
        lesson_id: null,
        error: {code: 'TRANSLATION_FAILED', retryable: true},
      },
    });

    const d = makeDriver('adv-rotate-resubmit');
    await act(async () => {
      ReactTestRenderer.create(<d.Driver />);
    });

    // First submit: URL_A, fails.
    await act(async () => {
      await d.control.current?.trigger({source: 'youtube', url: URL_A});
    });
    const keyBefore = idempotencyKeyFromCall(0);

    // Explicit retry rotates key.
    await act(async () => {
      await d.control.current?.retryWithFreshKey();
    });

    // Re-submit: same URL, should use the newly rotated key.
    mockedSubmit.mockClear();
    mockedStatus.mockResolvedValue({
      ok: true,
      value: {
        contract_version: 1,
        status: 'succeeded',
        lesson_id: LESSON_ID,
        error: null,
      },
    });
    await act(async () => {
      await d.control.current?.trigger({source: 'youtube', url: URL_A});
    });
    const keyAfterRotate = idempotencyKeyFromCall(0);

    // INV-002: after explicit rotate, new key is used; single POST.
    expect(keyAfterRotate).not.toBe(keyBefore);
    expect(mockedSubmit).toHaveBeenCalledTimes(1);
  });
});
