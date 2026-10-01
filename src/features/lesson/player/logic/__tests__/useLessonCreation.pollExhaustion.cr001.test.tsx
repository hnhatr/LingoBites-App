import AsyncStorage from '@react-native-async-storage/async-storage';
import React from 'react';
import ReactTestRenderer, {act} from 'react-test-renderer';

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

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
});

// CR-001: when polling exhausts without a terminal status the hook must leave
// `processing` so the screen can offer a way out instead of spinning forever.
it('does not stay in processing after poll attempts are exhausted', async () => {
  jest.useFakeTimers();
  mockedSubmit.mockResolvedValue({
    ok: true,
    value: {requestId: 'req-slow', status: 'queued'},
  });
  mockedStatus.mockResolvedValue({
    ok: true,
    value: {
      contract_version: 1,
      status: 'processing',
      lesson_id: null,
      error: null,
    },
  });
  let latest: LessonCreationState = {status: 'idle'};
  let submit: ReturnType<typeof useLessonCreation>['submit'] | null = null;
  function Driver() {
    const hook = useLessonCreation('draft-slow');
    latest = hook.state;
    submit = hook.submit;
    return null;
  }
  await act(async () => {
    ReactTestRenderer.create(<Driver />);
  });
  let done = false;
  await act(async () => {
    submit?.({source: 'text', text: 'Hello.'}).then(() => {
      done = true;
    });
    for (let i = 0; i < 70 && !done; i += 1) {
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
      jest.advanceTimersByTime(2000);
    }
  });
  jest.useRealTimers();
  expect(done).toBe(true);
  expect(latest.status).not.toBe('processing');
});
