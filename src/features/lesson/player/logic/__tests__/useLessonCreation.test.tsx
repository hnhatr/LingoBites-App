import AsyncStorage from '@react-native-async-storage/async-storage';
import React from 'react';
import {Alert} from 'react-native';
import ReactTestRenderer, {act} from 'react-test-renderer';

import type {LearnerLessonCreationRequestBody} from '@core/schemas/lesson';

import {
  fetchLessonCreationStatus,
  submitLessonCreation,
} from '../canonicalLessonClient';
import {resetCreationIdempotencyMemoryForTests} from '../creationIdempotencyStore';
import {
  type LessonCreationState,
  useLessonCreation,
} from '../useLessonCreation';
import {YOUTUBE_DISCLOSURE_KEY} from '../youtubeDisclosure';

const WAITING_REQUEST_ID = '22222222-2222-4222-8222-222222222201';
const LESSON_ID = '33333333-3333-4333-8333-333333333301';

jest.mock('../canonicalLessonClient', () => ({
  fetchLessonCreationStatus: jest.fn(),
  submitLessonCreation: jest.fn(),
}));

const mockedSubmit = submitLessonCreation as jest.Mock;
const mockedStatus = fetchLessonCreationStatus as jest.Mock;

type DriverControl = {
  trigger: (body: LearnerLessonCreationRequestBody) => Promise<void>;
};

function makeDriver(submissionId: string) {
  const control: {
    current:
      | (DriverControl & {
          checkAgain: () => Promise<void>;
          retryWithFreshKey: () => Promise<void>;
        })
      | null;
  } = {current: null};
  let latest: LessonCreationState = {status: 'idle'};
  function Driver() {
    const {state, submit, checkAgain, retryWithFreshKey} =
      useLessonCreation(submissionId);
    latest = state;
    control.current = {trigger: submit, checkAgain, retryWithFreshKey};
    return null;
  }
  return {
    control,
    latest: () => latest,
    Driver,
  };
}

function pressAlertButton(index: number) {
  const buttons = (Alert.alert as jest.Mock).mock.calls.at(-1)?.[2] as
    | {onPress?: () => void}[]
    | undefined;
  buttons?.[index]?.onPress?.();
}

async function flushDisclosureDialog() {
  await new Promise<void>(resolve => setImmediate(resolve));
}

beforeEach(async () => {
  jest.clearAllMocks();
  resetCreationIdempotencyMemoryForTests();
  await AsyncStorage.clear();
  await AsyncStorage.setItem(YOUTUBE_DISCLOSURE_KEY, '1');
});

describe('useLessonCreation (INV-006)', () => {
  it('submits with the persisted key and reaches succeeded', async () => {
    mockedSubmit.mockResolvedValue({
      ok: true,
      value: {requestId: 'req-1', status: 'queued'},
    });
    mockedStatus.mockResolvedValue({
      ok: true,
      value: {
        contract_version: 1,
        status: 'succeeded',
        lesson_id: '33333333-3333-4333-8333-333333333301',
        error: null,
      },
    });

    const driver = makeDriver('draft-1');
    const FirstDriver = driver.Driver;
    await act(async () => {
      ReactTestRenderer.create(<FirstDriver />);
    });
    await act(async () => {
      await driver.control.current?.trigger({
        source: 'text',
        text: 'Hello world.',
      });
    });
    const final = driver.latest();
    expect(final.status).toBe('succeeded');
    if (final.status === 'succeeded') {
      expect(final.lessonId).toBe('33333333-3333-4333-8333-333333333301');
    }
    const submitCall = mockedSubmit.mock.calls[0] as [unknown, string];
    expect(typeof submitCall[1]).toBe('string');
    // The terminal success clears the key so a later draft starts fresh.
    expect(
      await AsyncStorage.getItem('lesson-creation-idempotency:draft-1'),
    ).toBeNull();
  });

  it('surfaces a terminal failure with its retryability', async () => {
    mockedSubmit.mockResolvedValue({
      ok: true,
      value: {requestId: 'req-2', status: 'queued'},
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

    const driver = makeDriver('draft-2');
    const SecondDriver = driver.Driver;
    await act(async () => {
      ReactTestRenderer.create(<SecondDriver />);
    });
    await act(async () => {
      await driver.control.current?.trigger({
        source: 'youtube',
        url: 'https://youtube.com/watch?v=x',
      });
    });
    expect(driver.latest()).toEqual({
      status: 'failed',
      requestId: 'req-2',
      code: 'TRANSLATION_FAILED',
      retryable: true,
    });
  });

  it('shows waiting_transcript immediately when the server accepts with that status (AC-020 S1)', async () => {
    jest.useFakeTimers();
    mockedSubmit.mockResolvedValue({
      ok: true,
      value: {requestId: WAITING_REQUEST_ID, status: 'waiting_transcript'},
    });
    mockedStatus.mockResolvedValue({
      ok: true,
      value: {
        contract_version: 1,
        status: 'waiting_transcript',
        lesson_id: null,
        error: null,
      },
    });

    const driver = makeDriver('draft-wait');
    const WaitDriver = driver.Driver;
    await act(async () => {
      ReactTestRenderer.create(<WaitDriver />);
    });
    await act(async () => {
      driver.control.current
        ?.trigger({
          source: 'youtube',
          url: 'https://youtube.com/watch?v=wait',
        })
        .catch(() => undefined);
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(driver.latest()).toEqual({
      status: 'waiting_transcript',
      requestId: WAITING_REQUEST_ID,
      polling: true,
    });
    jest.useRealTimers();
  });

  it('keeps the same request id after poll exhaustion and checkAgain (AC-020 S2)', async () => {
    jest.useFakeTimers();
    mockedSubmit.mockResolvedValue({
      ok: true,
      value: {requestId: WAITING_REQUEST_ID, status: 'waiting_transcript'},
    });
    mockedStatus.mockResolvedValue({
      ok: true,
      value: {
        contract_version: 1,
        status: 'waiting_transcript',
        lesson_id: null,
        error: null,
      },
    });

    const driver = makeDriver('draft-wait-exhaust');
    const ExhaustDriver = driver.Driver;
    await act(async () => {
      ReactTestRenderer.create(<ExhaustDriver />);
    });
    let done = false;
    await act(async () => {
      driver.control.current
        ?.trigger({
          source: 'youtube',
          url: 'https://youtube.com/watch?v=wait',
        })
        .then(() => {
          done = true;
        });
      for (let i = 0; i < 70 && !done; i += 1) {
        await Promise.resolve();
        await Promise.resolve();
        jest.advanceTimersByTime(2000);
      }
    });
    jest.useRealTimers();
    expect(driver.latest()).toEqual({
      status: 'waiting_transcript',
      requestId: WAITING_REQUEST_ID,
      polling: false,
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
    await act(async () => {
      await driver.control.current?.checkAgain();
    });
    expect(driver.latest()).toEqual({
      status: 'succeeded',
      requestId: WAITING_REQUEST_ID,
      lessonId: LESSON_ID,
    });
  });

  it('opens the lesson id when waiting later succeeds (AC-020 S3)', async () => {
    mockedSubmit.mockResolvedValue({
      ok: true,
      value: {requestId: WAITING_REQUEST_ID, status: 'queued'},
    });
    mockedStatus
      .mockResolvedValueOnce({
        ok: true,
        value: {
          contract_version: 1,
          status: 'waiting_transcript',
          lesson_id: null,
          error: null,
        },
      })
      .mockResolvedValueOnce({
        ok: true,
        value: {
          contract_version: 1,
          status: 'succeeded',
          lesson_id: LESSON_ID,
          error: null,
        },
      });

    const driver = makeDriver('draft-wait-success');
    const SuccessDriver = driver.Driver;
    await act(async () => {
      ReactTestRenderer.create(<SuccessDriver />);
    });
    await act(async () => {
      await driver.control.current?.trigger({
        source: 'youtube',
        url: 'https://youtube.com/watch?v=ok',
      });
    });
    expect(driver.latest()).toEqual({
      status: 'succeeded',
      requestId: WAITING_REQUEST_ID,
      lessonId: LESSON_ID,
    });
  });
});

describe('useLessonCreation YouTube disclosure (LING-191)', () => {
  beforeEach(async () => {
    await AsyncStorage.removeItem(YOUTUBE_DISCLOSURE_KEY);
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  });

  afterEach(() => {
    (Alert.alert as jest.Mock).mockRestore?.();
    jest.restoreAllMocks();
  });

  it('does not submit until the learner confirms the disclosure', async () => {
    mockedSubmit.mockResolvedValue({
      ok: true,
      value: {requestId: 'req-yt', status: 'queued'},
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

    const driver = makeDriver('draft-yt-gate');
    const GateDriver = driver.Driver;
    await act(async () => {
      ReactTestRenderer.create(<GateDriver />);
    });
    let pending!: Promise<void>;
    await act(async () => {
      pending = driver.control.current?.trigger({
        source: 'youtube',
        url: 'https://youtube.com/watch?v=gate',
      }) as Promise<void>;
      await flushDisclosureDialog();
    });
    expect(Alert.alert).toHaveBeenCalledTimes(1);
    expect(mockedSubmit).not.toHaveBeenCalled();
    await act(async () => {
      pressAlertButton(1);
      await pending;
    });
    expect(mockedSubmit).toHaveBeenCalledTimes(1);
    expect(await AsyncStorage.getItem(YOUTUBE_DISCLOSURE_KEY)).toBe('1');
  });

  it('leaves state idle when the learner cancels the disclosure', async () => {
    const driver = makeDriver('draft-yt-cancel');
    const CancelDriver = driver.Driver;
    await act(async () => {
      ReactTestRenderer.create(<CancelDriver />);
    });
    await act(async () => {
      const pending = driver.control.current?.trigger({
        source: 'youtube',
        url: 'https://youtube.com/watch?v=cancel',
      });
      await flushDisclosureDialog();
      pressAlertButton(0);
      await pending;
    });
    expect(mockedSubmit).not.toHaveBeenCalled();
    expect(driver.latest()).toEqual({status: 'idle'});
    expect(await AsyncStorage.getItem(YOUTUBE_DISCLOSURE_KEY)).toBeNull();
  });

  it('sends exactly one request when submit is tapped twice before confirm', async () => {
    mockedSubmit.mockResolvedValue({
      ok: true,
      value: {requestId: 'req-double', status: 'queued'},
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

    const driver = makeDriver('draft-yt-double');
    const DoubleDriver = driver.Driver;
    await act(async () => {
      ReactTestRenderer.create(<DoubleDriver />);
    });
    await act(async () => {
      const first = driver.control.current?.trigger({
        source: 'youtube',
        url: 'https://youtube.com/watch?v=double',
      });
      driver.control.current
        ?.trigger({
          source: 'youtube',
          url: 'https://youtube.com/watch?v=double',
        })
        .catch(() => undefined);
      await flushDisclosureDialog();
      pressAlertButton(1);
      await first;
    });
    expect(mockedSubmit).toHaveBeenCalledTimes(1);
  });

  it('does not submit after unmount when the dialog is confirmed late', async () => {
    mockedSubmit.mockResolvedValue({
      ok: true,
      value: {requestId: 'req-unmount', status: 'queued'},
    });

    const driver = makeDriver('draft-yt-unmount');
    const UnmountDriver = driver.Driver;
    let tree!: ReactTestRenderer.ReactTestRenderer;
    await act(async () => {
      tree = ReactTestRenderer.create(<UnmountDriver />);
    });
    await act(async () => {
      driver.control.current
        ?.trigger({
          source: 'youtube',
          url: 'https://youtube.com/watch?v=unmount',
        })
        .catch(() => undefined);
      await flushDisclosureDialog();
    });
    await act(async () => {
      tree.unmount();
      pressAlertButton(1);
      await Promise.resolve();
    });
    expect(mockedSubmit).not.toHaveBeenCalled();
  });

  it('skips the disclosure for text submits', async () => {
    mockedSubmit.mockResolvedValue({
      ok: true,
      value: {requestId: 'req-text', status: 'queued'},
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

    const driver = makeDriver('draft-text');
    const TextDriver = driver.Driver;
    await act(async () => {
      ReactTestRenderer.create(<TextDriver />);
    });
    await act(async () => {
      await driver.control.current?.trigger({
        source: 'text',
        text: 'Hello',
      });
    });
    expect(Alert.alert).not.toHaveBeenCalled();
    expect(await AsyncStorage.getItem(YOUTUBE_DISCLOSURE_KEY)).toBeNull();
    expect(mockedSubmit).toHaveBeenCalledTimes(1);
  });

  it('does not show the disclosure on checkAgain (INV-002 g)', async () => {
    await AsyncStorage.setItem(YOUTUBE_DISCLOSURE_KEY, '1');
    jest.useFakeTimers();
    mockedSubmit.mockResolvedValue({
      ok: true,
      value: {requestId: WAITING_REQUEST_ID, status: 'waiting_transcript'},
    });
    mockedStatus.mockResolvedValue({
      ok: true,
      value: {
        contract_version: 1,
        status: 'waiting_transcript',
        lesson_id: null,
        error: null,
      },
    });

    const driver = makeDriver('draft-check-again');
    const CheckDriver = driver.Driver;
    await act(async () => {
      ReactTestRenderer.create(<CheckDriver />);
    });
    let done = false;
    await act(async () => {
      driver.control.current
        ?.trigger({
          source: 'youtube',
          url: 'https://youtube.com/watch?v=wait',
        })
        .then(() => {
          done = true;
        });
      for (let i = 0; i < 70 && !done; i += 1) {
        await Promise.resolve();
        jest.advanceTimersByTime(2000);
      }
    });
    jest.useRealTimers();
    jest.clearAllMocks();
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
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
      await driver.control.current?.checkAgain();
    });
    expect(Alert.alert).not.toHaveBeenCalled();
    expect(mockedSubmit).not.toHaveBeenCalled();
  });
});

const URL_A = 'https://youtube.com/watch?v=link-a';
const URL_B = 'https://youtube.com/watch?v=link-b';

function idempotencyKeyFromCall(index: number): string {
  return (mockedSubmit.mock.calls[index] as [unknown, string])[1];
}

async function submitYoutube(
  driver: ReturnType<typeof makeDriver>,
  url: string,
) {
  await act(async () => {
    await driver.control.current?.trigger({source: 'youtube', url});
  });
}

describe('useLessonCreation idempotency (INV-001 / INV-002)', () => {
  beforeEach(async () => {
    jest.useRealTimers();
    await AsyncStorage.setItem(YOUTUBE_DISCLOSURE_KEY, '1');
  });

  it('(a) mints a new key after failed when the trimmed URL changes', async () => {
    mockedSubmit.mockResolvedValue({
      ok: true,
      value: {requestId: 'req-a', status: 'queued'},
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
    const driver = makeDriver('inv-failed-ab');
    await act(async () => {
      ReactTestRenderer.create(<driver.Driver />);
    });
    await submitYoutube(driver, URL_A);
    const keyA = idempotencyKeyFromCall(0);
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
    await submitYoutube(driver, URL_B);
    expect(idempotencyKeyFromCall(0)).not.toBe(keyA);
  });

  it('(b) mints a new key after network error when the URL changes', async () => {
    mockedSubmit
      .mockResolvedValueOnce({
        ok: false,
        kind: 'network-error',
        message: 'offline',
        retryable: true,
      })
      .mockResolvedValueOnce({
        ok: true,
        value: {requestId: 'req-b', status: 'queued'},
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
    const driver = makeDriver('inv-error-ab');
    await act(async () => {
      ReactTestRenderer.create(<driver.Driver />);
    });
    await submitYoutube(driver, URL_A);
    const keyA = idempotencyKeyFromCall(0);
    await submitYoutube(driver, URL_B);
    expect(idempotencyKeyFromCall(1)).not.toBe(keyA);
  });

  it('(d) mints a new key after remount when the URL changes', async () => {
    mockedSubmit.mockResolvedValue({
      ok: true,
      value: {requestId: 'req-d', status: 'queued'},
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
    const driver = makeDriver('inv-remount');
    let tree!: ReactTestRenderer.ReactTestRenderer;
    await act(async () => {
      tree = ReactTestRenderer.create(<driver.Driver />);
    });
    await submitYoutube(driver, URL_A);
    const keyA = idempotencyKeyFromCall(0);
    await act(async () => {
      tree.unmount();
    });
    const driver2 = makeDriver('inv-remount');
    await act(async () => {
      ReactTestRenderer.create(<driver2.Driver />);
    });
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
    await submitYoutube(driver2, URL_B);
    expect(idempotencyKeyFromCall(0)).not.toBe(keyA);
  }, 15000);

  it('(e) reuses the same key when resubmitting the same trimmed URL after failed', async () => {
    mockedSubmit.mockResolvedValue({
      ok: true,
      value: {requestId: 'req-e', status: 'queued'},
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
    const driver = makeDriver('inv-same-url');
    await act(async () => {
      ReactTestRenderer.create(<driver.Driver />);
    });
    await submitYoutube(driver, URL_A);
    const keyA = idempotencyKeyFromCall(0);
    mockedSubmit.mockClear();
    await submitYoutube(driver, ` ${URL_A} `);
    expect(idempotencyKeyFromCall(0)).toBe(keyA);
  });

  it('(f) sends exactly one POST when submit is called twice in a row', async () => {
    mockedSubmit.mockResolvedValue({
      ok: true,
      value: {requestId: 'req-f', status: 'queued'},
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
    const driver = makeDriver('inv-double');
    await act(async () => {
      ReactTestRenderer.create(<driver.Driver />);
    });
    await act(async () => {
      const first = driver.control.current?.trigger({
        source: 'youtube',
        url: URL_A,
      });
      const second = driver.control.current?.trigger({
        source: 'youtube',
        url: URL_A,
      });
      await Promise.all([first, second]);
    });
    expect(mockedSubmit).toHaveBeenCalledTimes(1);
  });

  it('(h) rotates the key after retryWithFreshKey for the same URL', async () => {
    mockedSubmit.mockResolvedValue({
      ok: true,
      value: {requestId: 'req-h', status: 'queued'},
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
    const driver = makeDriver('inv-retry');
    await act(async () => {
      ReactTestRenderer.create(<driver.Driver />);
    });
    await submitYoutube(driver, URL_A);
    const keyBefore = idempotencyKeyFromCall(0);
    await act(async () => {
      await driver.control.current?.retryWithFreshKey();
    });
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
    await submitYoutube(driver, URL_A);
    expect(idempotencyKeyFromCall(0)).not.toBe(keyBefore);
  });
});
