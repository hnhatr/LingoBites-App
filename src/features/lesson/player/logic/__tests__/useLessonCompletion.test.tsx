import React from 'react';
import ReactTestRenderer, {act} from 'react-test-renderer';

import {getLessonProgress, recordLessonEvent} from '@core/sync/lessonProgress';

import {
  type LessonCompletionState,
  useLessonCompletion,
} from '../useLessonCompletion';

const LESSON_ID = '33333333-3333-4333-8333-333333333301';

const mockRequestSync = jest.fn();

jest.mock('@features/sync', () => ({
  requestSync: () => mockRequestSync(),
}));

jest.mock('@core/sync/lessonProgress', () => ({
  getLessonProgress: jest.fn(),
  recordLessonEvent: jest.fn(),
}));

jest.mock('@react-navigation/native', () => {
  const react = require('react');
  return {
    useFocusEffect: (callback: () => void) => {
      react.useEffect(() => {
        callback();
      }, [callback]);
    },
  };
});

const mockedGet = getLessonProgress as jest.Mock;
const mockedRecord = recordLessonEvent as jest.Mock;

function makeDriver() {
  let latest!: {state: LessonCompletionState; complete: () => void};
  function Driver() {
    latest = useLessonCompletion(LESSON_ID);
    return null;
  }
  let tree!: ReactTestRenderer.ReactTestRenderer;
  act(() => {
    tree = ReactTestRenderer.create(<Driver />);
  });
  return {latest: () => latest, tree};
}

beforeEach(() => {
  jest.clearAllMocks();
  mockedGet.mockReturnValue(null);
});

describe('useLessonCompletion (LING-222 AD-004)', () => {
  it('starts unfinished when no local progress exists', () => {
    const {latest} = makeDriver();
    expect(latest().state).toBe('unfinished');
  });

  it('starts finished when the lesson is already completed locally', () => {
    mockedGet.mockReturnValue({
      lessonId: LESSON_ID,
      status: 'completed',
      startedAt: '2026-10-01T10:00:00.000Z',
      completedAt: '2026-10-01T10:00:00.000Z',
      revision: 0,
      tombstone: false,
      updatedAt: '2026-10-01T10:00:00.000Z',
    });
    const {latest} = makeDriver();
    expect(latest().state).toBe('finished');
  });

  it('records completion, marks finished, and kicks sync (AC-003 S1)', () => {
    mockedRecord.mockReturnValue({
      ok: true,
      status: 'completed',
      advanced: true,
      eventId: 'evt-1',
    });
    const {latest} = makeDriver();
    act(() => {
      latest().complete();
    });
    expect(mockedRecord).toHaveBeenCalledWith({
      lessonId: LESSON_ID,
      event: 'complete',
    });
    expect(latest().state).toBe('finished');
    expect(mockRequestSync).toHaveBeenCalledTimes(1);
  });

  it('ignores a second tap while finished (AC-003 S2)', () => {
    mockedRecord.mockReturnValue({
      ok: true,
      status: 'completed',
      advanced: true,
      eventId: 'evt-1',
    });
    const {latest} = makeDriver();
    act(() => {
      latest().complete();
      latest().complete();
    });
    expect(mockedRecord).toHaveBeenCalledTimes(1);
  });

  it('surfaces LOCAL_DB_ERROR and allows retry (AC-004 S1)', () => {
    mockedRecord
      .mockReturnValueOnce({ok: false, errorCode: 'LOCAL_DB_ERROR'})
      .mockReturnValueOnce({
        ok: true,
        status: 'completed',
        advanced: true,
        eventId: 'evt-2',
      });
    const {latest} = makeDriver();
    act(() => {
      latest().complete();
    });
    expect(latest().state).toBe('error');
    act(() => {
      latest().complete();
    });
    expect(latest().state).toBe('finished');
    expect(mockedRecord).toHaveBeenCalledTimes(2);
  });
});
