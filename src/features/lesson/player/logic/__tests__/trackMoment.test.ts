import {
  dismissCompose,
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
