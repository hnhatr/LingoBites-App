jest.mock('../composeClient', () => ({
  fetchActiveComposes: jest.fn(async () => ({ok: true, value: []})),
  fetchActiveMomentRequests: jest.fn(async () => ({ok: true, value: []})),
}));
jest.mock('../canonicalLessonClient', () => ({
  fetchLessonCreationStatus: jest.fn(),
  fetchLessonSnapshot: jest.fn(),
}));
jest.mock('../canonicalDownloadRepository', () => ({
  getLessonDownload: jest.fn(() => null),
  saveLessonSnapshotBody: jest.fn(),
}));

import {
  dismissCompose,
  hydrateComposeTracker,
  resetComposeTrackerForTests,
  resumeTrackedMoment,
  trackMoment,
  useComposeTracker,
} from '../composeTracker';

/** E6 (deferred E3): a moment request is tracked in the background and can wait for confirmation. */
function entry(requestId: string) {
  return useComposeTracker
    .getState()
    .entries.find(item => item.requestId === requestId);
}

describe('tracked moments', () => {
  beforeEach(() => {
    resetComposeTrackerForTests();
  });

  it('adds a running moment once, without a source lesson', () => {
    trackMoment({requestId: 'm1', situationVi: 'Gọi đồ uống'});
    trackMoment({requestId: 'm1', situationVi: 'Gọi đồ uống'});
    const found = entry('m1');
    expect(useComposeTracker.getState().entries.length).toBe(1);
    expect(found).toMatchObject({
      kind: 'moment',
      status: 'running',
      sourceLessonId: '',
    });
  });

  it('a moment waiting for confirmation runs again once confirmed', () => {
    trackMoment({requestId: 'm2', situationVi: null});
    useComposeTracker.setState(state => ({
      entries: state.entries.map(item => ({
        ...item,
        status: 'awaiting' as const,
      })),
    }));
    resumeTrackedMoment('m2');
    expect(entry('m2')?.status).toBe('running');
  });

  it('a rejected moment is dropped from the cards', () => {
    trackMoment({requestId: 'm3', situationVi: null});
    useComposeTracker.setState(state => ({
      entries: state.entries.map(item => ({
        ...item,
        status: 'awaiting' as const,
      })),
    }));
    dismissCompose('m3');
    expect(entry('m3')).toBeUndefined();
  });
});

describe('moments restored from the server', () => {
  it('a moment still waiting for confirmation comes back as awaiting', async () => {
    resetComposeTrackerForTests();
    const client = jest.requireMock('../composeClient') as {
      fetchActiveMomentRequests: jest.Mock;
    };
    client.fetchActiveMomentRequests.mockResolvedValueOnce({
      ok: true,
      value: [
        {
          id: '22222222-2222-4222-8222-222222222222',
          status: 'awaiting_confirmation',
          situation_vi: 'Gọi đồ uống',
        },
      ],
    });
    await hydrateComposeTracker();
    expect(entry('22222222-2222-4222-8222-222222222222')).toMatchObject({
      kind: 'moment',
      status: 'awaiting',
      sourceTitle: 'Gọi đồ uống',
    });
  });
});
