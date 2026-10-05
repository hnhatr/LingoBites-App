import {
  createAppNavigation,
  type RootNavigationRef,
} from '../appNavigationAdapter';

// jest.setup.js stubs @react-navigation/native down to a couple of hooks and
// the real ESM package is not transformed under Jest; add the two pieces the
// adapter uses, with the same action shape as the library.
jest.mock('@react-navigation/native', () => ({
  createNavigationContainerRef: () => ({}),
  CommonActions: {
    reset: (state: object) => ({type: 'RESET', payload: state}),
  },
}));

type Route = {key: string; name: string; params?: object};

function fakeRef(routes: Route[] = [{key: 'tabs', name: 'Tabs'}]) {
  const ref = {
    isReady: jest.fn(() => true),
    navigate: jest.fn(),
    dispatch: jest.fn(),
    canGoBack: jest.fn(() => routes.length > 1),
    goBack: jest.fn(),
    getRootState: jest.fn(() => ({
      key: 'root',
      index: routes.length - 1,
      routeNames: [],
      routes,
      type: 'stack',
      stale: false,
    })),
  };
  return ref as typeof ref & RootNavigationRef;
}

describe('createAppNavigation (root-stack adapter)', () => {
  it('opens task flows on the root stack by route name', () => {
    const ref = fakeRef();
    const nav = createAppNavigation(ref);

    nav.openLesson('lesson-1');
    nav.openCatalog();
    nav.openReview();
    nav.openToday();
    nav.openSpeakingRoom();
    nav.openShadowing();
    nav.openShadowing({lessonId: 'lesson-2', sentenceIndex: 3});

    expect(ref.navigate.mock.calls).toEqual([
      ['CanonicalLessonPlayer', {lessonId: 'lesson-1'}],
      ['CanonicalCatalog', undefined],
      ['DailyReview', undefined],
      ['Today', undefined],
      ['SpeakingRoom', undefined],
      ['ShadowingLessonPicker', undefined],
      ['ShadowingSession', {lessonId: 'lesson-2', sentenceIndex: 3}],
    ]);
  });

  it('maps every create entry to its flow screen', () => {
    const ref = fakeRef();
    const nav = createAppNavigation(ref);

    nav.startCreate({kind: 'paste'});
    nav.startCreate({kind: 'camera'});
    nav.startCreate({kind: 'gallery'});
    nav.startCreate({kind: 'youtube', submissionId: 'yt-1'});
    nav.startCreate({kind: 'ocr', text: 'Hello', submissionId: 'ocr-1'});

    expect(ref.navigate.mock.calls).toEqual([
      ['PasteText', undefined],
      ['ImageCapture', {sourceType: 'camera'}],
      ['ImageCapture', {sourceType: 'gallery'}],
      ['LessonCreation', {submissionId: 'yt-1', initialSource: 'youtube'}],
      [
        'LessonCreation',
        {submissionId: 'ocr-1', initialSource: 'ocr', initialText: 'Hello'},
      ],
    ]);
  });

  it('generates a submission id when the caller has none', () => {
    const ref = fakeRef();
    createAppNavigation(ref).startCreate({kind: 'youtube'});
    expect(ref.navigate).toHaveBeenCalledWith('LessonCreation', {
      submissionId: expect.stringMatching(/^create-youtube-\d+$/),
      initialSource: 'youtube',
    });
  });

  it('switches tabs through the root Tabs route', () => {
    const ref = fakeRef();
    createAppNavigation(ref).goToTab('Create');
    expect(ref.navigate).toHaveBeenCalledWith('Tabs', {screen: 'Create'});
  });

  it('finishCreate replaces the whole create flow with the lesson', () => {
    // Bug repro: Create tab → paste → LessonCreation → open lesson. Back
    // from the lesson must return to the tabs, not to the creation screens.
    const ref = fakeRef([
      {key: 'tabs', name: 'Tabs'},
      {key: 'paste', name: 'PasteText'},
      {key: 'create', name: 'LessonCreation', params: {submissionId: 's'}},
    ]);
    createAppNavigation(ref).finishCreate('lesson-9');

    expect(ref.dispatch).toHaveBeenCalledTimes(1);
    const action = ref.dispatch.mock.calls[0][0];
    expect(action.type).toBe('RESET');
    expect(action.payload).toMatchObject({
      key: 'root',
      index: 1,
      routes: [
        {key: 'tabs', name: 'Tabs'},
        {name: 'CanonicalLessonPlayer', params: {lessonId: 'lesson-9'}},
      ],
    });
  });

  it('finishCreate keeps flows opened before the create flow', () => {
    const ref = fakeRef([
      {key: 'tabs', name: 'Tabs'},
      {key: 'today', name: 'Today'},
      {key: 'create', name: 'LessonCreation', params: {submissionId: 's'}},
    ]);
    createAppNavigation(ref).finishCreate('lesson-9');
    const {payload} = ref.dispatch.mock.calls[0][0];
    expect(payload.routes.map((r: Route) => r.name)).toEqual([
      'Tabs',
      'Today',
      'CanonicalLessonPlayer',
    ]);
  });

  it('is a no-op before the container is ready', () => {
    const ref = fakeRef();
    ref.isReady.mockReturnValue(false);
    const nav = createAppNavigation(ref);
    nav.openLesson('lesson-1');
    nav.finishCreate('lesson-1');
    nav.goBack();
    expect(ref.navigate).not.toHaveBeenCalled();
    expect(ref.dispatch).not.toHaveBeenCalled();
    expect(ref.goBack).not.toHaveBeenCalled();
  });

  it('goBack only pops when there is somewhere to go', () => {
    const atRoot = fakeRef();
    createAppNavigation(atRoot).goBack();
    expect(atRoot.goBack).not.toHaveBeenCalled();

    const inFlow = fakeRef([
      {key: 'tabs', name: 'Tabs'},
      {key: 'create', name: 'LessonCreation'},
    ]);
    createAppNavigation(inFlow).goBack();
    expect(inFlow.goBack).toHaveBeenCalledTimes(1);
  });
});
