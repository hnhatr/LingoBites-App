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
    nav.openLibrarySection('publicVideo');
    nav.openVideoHub();
    nav.openReview();
    nav.openItemReview();
    nav.openToday();
    nav.openSpeakingRoom();
    nav.openShadowing();
    nav.openShadowing({lessonId: 'lesson-2', sentenceIndex: 3});

    expect(ref.navigate.mock.calls).toEqual([
      ['CanonicalLessonPlayer', {lessonId: 'lesson-1'}],
      ['CanonicalCatalog', undefined],
      ['LibraryList', {section: 'publicVideo'}],
      ['VideoHub', undefined],
      ['DailyReview', undefined],
      ['ItemReview', undefined],
      ['Today', undefined],
      ['SpeakingRoom', undefined],
      ['ShadowingLessonPicker', undefined],
      ['ShadowingSession', {lessonId: 'lesson-2', sentenceIndex: 3}],
    ]);
  });

  it('maps every curriculum target to its screen', () => {
    const ref = fakeRef();
    const nav = createAppNavigation(ref);

    nav.openCourse();
    nav.openCourse({kind: 'course', courseSlug: 'english-a1', title: 'A1'});
    nav.openCourse({kind: 'level', levelId: 'level-1'});
    nav.openCourse({kind: 'unit', unitId: 'unit-1', title: 'Greetings'});

    // Curriculum screens live in the Courses tab, above its course list.
    const inCourses = (screen: string, params: object) => [
      'Tabs',
      {screen: 'Courses', params: {screen, params, initial: false}},
    ];
    expect(ref.navigate.mock.calls).toEqual([
      ['Tabs', {screen: 'Courses', params: {screen: 'CourseList'}}],
      inCourses('CourseLevels', {courseSlug: 'english-a1', title: 'A1'}),
      inCourses('LevelUnits', {levelId: 'level-1', title: undefined}),
      inCourses('UnitLessons', {unitId: 'unit-1', title: 'Greetings'}),
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
    createAppNavigation(ref).goToTab('Courses');
    expect(ref.navigate).toHaveBeenCalledWith('Tabs', {screen: 'Courses'});
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

  it('closeLesson removes the lesson and its six-step player at once', () => {
    const ref = fakeRef([
      {key: 'tabs', name: 'Tabs'},
      {key: 'today', name: 'Today'},
      {key: 'lesson', name: 'CanonicalLessonPlayer'},
      {key: 'flow', name: 'LessonFlowPlayer'},
    ]);
    createAppNavigation(ref).closeLesson();
    const {payload} = ref.dispatch.mock.calls[0][0];
    expect(payload.index).toBe(1);
    expect(payload.routes.map((r: Route) => r.name)).toEqual(['Tabs', 'Today']);
  });

  it('closeLesson does nothing outside a lesson', () => {
    const ref = fakeRef([
      {key: 'tabs', name: 'Tabs'},
      {key: 'today', name: 'Today'},
    ]);
    createAppNavigation(ref).closeLesson();
    expect(ref.dispatch).not.toHaveBeenCalled();
  });

  it('closeLessonToUnit closes the lesson and shows its unit', () => {
    const ref = fakeRef([
      {key: 'tabs', name: 'Tabs'},
      {key: 'flow', name: 'LessonFlowPlayer'},
    ]);
    createAppNavigation(ref).closeLessonToUnit({
      unitId: 'unit-1',
      title: 'Greetings',
      lessonId: 'lesson-1',
    });
    expect(ref.dispatch.mock.calls[0][0].payload.routes).toEqual([
      {key: 'tabs', name: 'Tabs'},
    ]);
    expect(ref.navigate).toHaveBeenCalledWith('Tabs', {
      screen: 'Courses',
      params: {
        screen: 'UnitLessons',
        params: {unitId: 'unit-1', title: 'Greetings'},
        initial: false,
      },
    });
  });

  it('openNextUnitLesson replaces the lesson with the next one', async () => {
    const ref = fakeRef([
      {key: 'tabs', name: 'Tabs'},
      {key: 'lesson', name: 'CanonicalLessonPlayer'},
      {key: 'flow', name: 'LessonFlowPlayer'},
    ]);
    const findNextUnitLesson = jest.fn(async () => 'lesson-2');
    createAppNavigation(ref, {findNextUnitLesson}).openNextUnitLesson({
      unitId: 'unit-1',
      lessonId: 'lesson-1',
    });
    await Promise.resolve();
    await Promise.resolve();

    expect(findNextUnitLesson).toHaveBeenCalledWith('unit-1', 'lesson-1');
    expect(ref.dispatch.mock.calls[0][0].payload).toMatchObject({
      index: 1,
      routes: [
        {key: 'tabs', name: 'Tabs'},
        {name: 'CanonicalLessonPlayer', params: {lessonId: 'lesson-2'}},
      ],
    });
  });

  it('openNextUnitLesson shows the unit after its last lesson', async () => {
    const ref = fakeRef([
      {key: 'tabs', name: 'Tabs'},
      {key: 'flow', name: 'LessonFlowPlayer'},
    ]);
    const findNextUnitLesson = jest.fn(async () => null);
    createAppNavigation(ref, {findNextUnitLesson}).openNextUnitLesson({
      unitId: 'unit-1',
      lessonId: 'lesson-3',
    });
    await Promise.resolve();
    await Promise.resolve();

    expect(ref.navigate).toHaveBeenCalledWith(
      'Tabs',
      expect.objectContaining({screen: 'Courses'}),
    );
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
