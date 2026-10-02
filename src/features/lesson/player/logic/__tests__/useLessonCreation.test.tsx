import AsyncStorage from '@react-native-async-storage/async-storage';
import React from 'react';
import ReactTestRenderer, {act} from 'react-test-renderer';

import type {LearnerLessonCreationRequestBody} from '@core/schemas/lesson';

import {
  fetchLessonCreationStatus,
  submitLessonCreation,
} from '../canonicalLessonClient';
import {
  type LessonCreationState,
  useLessonCreation,
} from '../useLessonCreation';

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
    current: (DriverControl & {
      checkAgain: () => Promise<void>;
    }) | null;
  } = {current: null};
  let latest: LessonCreationState = {status: 'idle'};
  function Driver() {
    const {state, submit, checkAgain} = useLessonCreation(submissionId);
    latest = state;
    control.current = {trigger: submit, checkAgain};
    return null;
  }
  return {
    control,
    latest: () => latest,
    Driver,
  };
}

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
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
      void driver.control.current?.trigger({
        source: 'youtube',
        url: 'https://youtube.com/watch?v=wait',
      });
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
