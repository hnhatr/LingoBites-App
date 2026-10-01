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
  const control: {current: DriverControl | null} = {current: null};
  let latest: LessonCreationState = {status: 'idle'};
  function Driver() {
    const {state, submit} = useLessonCreation(submissionId);
    latest = state;
    control.current = {trigger: submit};
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
});
