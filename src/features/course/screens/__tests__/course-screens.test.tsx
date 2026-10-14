import React from 'react';
import ReactTestRenderer, {act} from 'react-test-renderer';

import {AppThemeProvider} from '@ui/theme';

import {FeatureFlagProvider} from '@core/release';

import {mockAppNavigation} from '@test/support';

import {CourseListContent} from '../../components/CourseListContent';
import {CourseLevelsScreen} from '../CourseLevelsScreen';
import {LevelUnitsScreen} from '../LevelUnitsScreen';
import {UnitLessonsScreen} from '../UnitLessonsScreen';

jest.mock('../../logic/courseClient', () => ({
  fetchCourses: jest.fn(),
  fetchCourseEntitlements: jest.fn(),
  fetchCourseLevels: jest.fn(),
  fetchLevelUnits: jest.fn(),
  fetchUnitLessons: jest.fn(),
}));

jest.mock('@core/sync/lessonProgress', () => ({
  listCompletedLessons: jest.fn(() => []),
}));

const client = jest.requireMock('../../logic/courseClient') as Record<
  | 'fetchCourses'
  | 'fetchCourseEntitlements'
  | 'fetchCourseLevels'
  | 'fetchLevelUnits'
  | 'fetchUnitLessons',
  jest.Mock
>;
const {listCompletedLessons} = jest.requireMock(
  '@core/sync/lessonProgress',
) as {listCompletedLessons: jest.Mock};

function lesson(id: string, position: number) {
  return {
    id,
    unitId: 'unit-1',
    slug: id,
    title: `Lesson ${id}`,
    description: '',
    position,
    estimatedMinutes: null,
    canDo: [] as string[],
    audience: 'all',
  };
}

function unit(id: string, position: number) {
  return {
    id,
    levelId: 'level-1',
    slug: id,
    title: `Unit ${id}`,
    description: '',
    position,
    canDo: [] as string[],
    audience: 'all',
  };
}

async function render(element: React.ReactElement) {
  let tree!: ReactTestRenderer.ReactTestRenderer;
  await act(async () => {
    tree = ReactTestRenderer.create(
      <FeatureFlagProvider releaseConfig={{releaseName: 'test', features: {}}}>
        <AppThemeProvider>{element}</AppThemeProvider>
      </FeatureFlagProvider>,
    );
  });
  return tree;
}

function press(tree: ReactTestRenderer.ReactTestRenderer, testID: string) {
  const target = tree.root
    .findAll(node => node.props.testID === testID)
    .find(node => typeof node.props.onPress === 'function');
  if (!target) throw new Error(`No pressable ${testID}`);
  act(() => {
    target.props.onPress();
  });
}

function allText(tree: ReactTestRenderer.ReactTestRenderer): string {
  return tree.root
    .findAll(node => (node.type as unknown) === 'Text')
    .flatMap(node => node.children)
    .filter((child): child is string => typeof child === 'string')
    .join('\n');
}

type StackRoute = {key: string; name: string; params?: object};

/** A Courses-tab stack whose top route is the screen under test. */
function makeNavigation(routes: StackRoute[] = [{key: 'screen', name: 'X'}]) {
  return {
    goBack: jest.fn(),
    navigate: jest.fn(),
    push: jest.fn(),
    pop: jest.fn(),
    setParams: jest.fn(),
    getState: jest.fn(() => ({routes})),
  };
}

let navigation = makeNavigation() as never;
const nav = () => navigation as unknown as ReturnType<typeof makeNavigation>;

beforeEach(() => {
  jest.clearAllMocks();
  navigation = makeNavigation() as never;
  listCompletedLessons.mockReturnValue([]);
});

describe('Curriculum screens (F14)', () => {
  it('shows the empty state when no course is published', async () => {
    client.fetchCourses.mockResolvedValue({ok: true, value: []});

    const tree = await render(<CourseListContent />);

    expect(
      tree.root.findAll(node => node.props.testID === 'course-list-empty')
        .length,
    ).toBeGreaterThan(0);
  });

  it('opens a course by slug from the course list', async () => {
    client.fetchCourses.mockResolvedValue({
      ok: true,
      value: [
        {
          id: 'course-1',
          slug: 'english-a1',
          title: 'English A1',
          description: '',
          sourceLanguage: 'vi',
          targetLanguage: 'en',
        },
      ],
    });

    const tree = await render(<CourseListContent />);
    press(tree, 'course-list-row-course-1');

    expect(mockAppNavigation.openCourse).toHaveBeenCalledWith({
      kind: 'course',
      courseSlug: 'english-a1',
      title: 'English A1',
    });
  });

  it('blocks a locked course until the user is entitled to it', async () => {
    const course = {
      id: 'course-2',
      slug: 'english-pro',
      title: 'English Pro',
      description: '',
      sourceLanguage: 'vi',
      targetLanguage: 'en',
      isLocked: true,
      productId: 'course.english_pro',
      priceAmount: 199000,
      priceCurrency: 'VND',
    };
    client.fetchCourses.mockResolvedValue({ok: true, value: [course]});
    client.fetchCourseEntitlements.mockResolvedValue({ok: true, value: []});

    let tree = await render(<CourseListContent />);
    press(tree, 'course-list-row-course-2');
    expect(mockAppNavigation.openCourse).not.toHaveBeenCalled();

    client.fetchCourseEntitlements.mockResolvedValue({
      ok: true,
      value: ['course-2'],
    });
    tree = await render(<CourseListContent />);
    press(tree, 'course-list-row-course-2');
    expect(mockAppNavigation.openCourse).toHaveBeenCalledWith({
      kind: 'course',
      courseSlug: 'english-pro',
      title: 'English Pro',
    });
  });

  it('shows the chosen level units under a level switcher', async () => {
    const level = (id: string, code: string, position: number) => ({
      id,
      courseId: 'course-1',
      code,
      title: `${code} – Level`,
      description: `${code} blurb`,
      position,
    });
    client.fetchCourseLevels.mockResolvedValue({
      ok: true,
      value: [level('level-1', 'A1', 0), level('level-2', 'A2', 1)],
    });
    client.fetchLevelUnits.mockResolvedValue({
      ok: true,
      value: [unit('unit-1', 0)],
    });
    client.fetchUnitLessons.mockResolvedValue({ok: true, value: []});

    const tree = await render(
      <CourseLevelsScreen
        navigation={navigation}
        route={{key: 'screen', params: {courseSlug: 'english-a1'}} as never}
      />,
    );

    expect(client.fetchCourseLevels).toHaveBeenCalledWith(
      'english-a1',
      expect.anything(),
    );
    // No level screen in between: the first level's units show at once.
    expect(client.fetchLevelUnits).toHaveBeenCalledWith(
      'level-1',
      expect.anything(),
    );
    expect(nav().setParams).toHaveBeenCalledWith({
      levelId: 'level-1',
      levelCode: 'A1',
    });
    expect(allText(tree)).toContain('A1 blurb');

    press(tree, 'course-levels-chip-level-2');
    expect(nav().setParams).toHaveBeenLastCalledWith({
      levelId: 'level-2',
      levelCode: 'A2',
    });

    press(tree, 'course-levels-units-row-unit-1');
    expect(nav().push).toHaveBeenCalledWith('UnitLessons', {
      unitId: 'unit-1',
      title: 'Unit unit-1',
    });
  });

  it('loads the level kept in the route', async () => {
    client.fetchCourseLevels.mockResolvedValue({
      ok: true,
      value: [
        {
          id: 'level-1',
          courseId: 'course-1',
          code: 'A1',
          title: 'A1',
          description: '',
          position: 0,
        },
        {
          id: 'level-2',
          courseId: 'course-1',
          code: 'A2',
          title: 'A2',
          description: '',
          position: 1,
        },
      ],
    });
    client.fetchLevelUnits.mockResolvedValue({ok: true, value: []});

    await render(
      <CourseLevelsScreen
        navigation={navigation}
        route={
          {
            key: 'screen',
            params: {courseSlug: 'english-a1', levelId: 'level-2'},
          } as never
        }
      />,
    );

    expect(client.fetchLevelUnits).toHaveBeenCalledWith(
      'level-2',
      expect.anything(),
    );
    expect(client.fetchLevelUnits).not.toHaveBeenCalledWith(
      'level-1',
      expect.anything(),
    );
  });

  it('jumps back to an ancestor screen from the header breadcrumb', async () => {
    client.fetchUnitLessons.mockResolvedValue({ok: true, value: []});
    navigation = makeNavigation([
      {key: 'list', name: 'CourseList'},
      {
        key: 'course',
        name: 'CourseLevels',
        params: {courseSlug: 'english-a1', title: 'English', levelCode: 'A1'},
      },
      {key: 'unit', name: 'UnitLessons', params: {unitId: 'unit-1'}},
    ]) as never;

    const tree = await render(
      <UnitLessonsScreen
        navigation={navigation}
        route={
          {key: 'unit', params: {unitId: 'unit-1', title: 'Greetings'}} as never
        }
      />,
    );

    const text = allText(tree);
    expect(text).toContain('English');
    expect(text).toContain('A1');
    press(tree, 'course-breadcrumb-course');
    expect(nav().pop).toHaveBeenCalledWith(1);
  });

  it('shows each unit progress from completed lesson_progress rows', async () => {
    client.fetchLevelUnits.mockResolvedValue({
      ok: true,
      value: [unit('unit-1', 0), unit('unit-2', 1)],
    });
    client.fetchUnitLessons.mockImplementation(async (unitId: string) =>
      unitId === 'unit-1'
        ? {ok: true, value: [lesson('a', 0), lesson('b', 1), lesson('c', 2)]}
        : {ok: false, kind: 'server-error', message: 'Request failed.'},
    );
    listCompletedLessons.mockReturnValue([
      {lessonId: 'a', completedAt: '2026-10-01T00:00:00.000Z'},
      {lessonId: 'c', completedAt: '2026-10-02T00:00:00.000Z'},
    ]);

    const tree = await render(
      <LevelUnitsScreen
        navigation={navigation}
        route={{params: {levelId: 'level-1', title: 'Beginner'}} as never}
      />,
    );

    const bar = tree.root.find(
      node =>
        node.props.testID === 'unit-progress-unit-1' &&
        node.props.accessibilityValue,
    );
    expect(bar.props.accessibilityValue).toEqual({min: 0, max: 3, now: 2});
    expect(bar.props.accessibilityLabel).toBe('2/3 bài');
    // A unit whose lessons failed to load hides only its own bar.
    expect(
      tree.root.findAll(node => node.props.testID === 'unit-progress-unit-2'),
    ).toHaveLength(0);

    press(tree, 'level-units-row-unit-1');
    expect(nav().push).toHaveBeenCalledWith('UnitLessons', {
      unitId: 'unit-1',
      title: 'Unit unit-1',
    });
  });

  it('marks completed lessons and opens the regular player by lesson id', async () => {
    client.fetchUnitLessons.mockResolvedValue({
      ok: true,
      value: [lesson('a', 0), lesson('b', 1)],
    });
    listCompletedLessons.mockReturnValue([
      {lessonId: 'a', completedAt: '2026-10-01T00:00:00.000Z'},
    ]);

    const tree = await render(
      <UnitLessonsScreen
        navigation={navigation}
        route={{params: {unitId: 'unit-1'}} as never}
      />,
    );

    const completedMarks = (id: string) =>
      tree.root.findAll(
        node => node.props.testID === `unit-lessons-row-${id}-chip-progress`,
      );
    expect(completedMarks('a').length).toBeGreaterThan(0);
    expect(completedMarks('b')).toHaveLength(0);
    const header = tree.root.find(
      node =>
        node.props.testID === 'unit-lessons-progress' &&
        node.props.accessibilityValue,
    );
    expect(header.props.accessibilityValue).toEqual({min: 0, max: 2, now: 1});

    press(tree, 'unit-lessons-row-b');
    expect(mockAppNavigation.openLesson).toHaveBeenCalledWith('b');

    // PR 16 (B4): the summative task waits for every lesson's practice.
    const summative = tree.root.find(
      node =>
        node.props.testID === 'unit-lessons-summative' &&
        typeof node.props.onPress === 'function',
    );
    expect(summative.props.disabled).toBe(true);
    expect(
      tree.root.findAll(
        node => node.props.testID === 'unit-lessons-summative-locked',
      ).length,
    ).toBeGreaterThan(0);
  });

  it('opens the summative task once every lesson is practised (PR 16)', async () => {
    client.fetchUnitLessons.mockResolvedValue({
      ok: true,
      value: [lesson('a', 0)],
    });
    listCompletedLessons.mockReturnValue([
      {lessonId: 'a', completedAt: '2026-10-01T00:00:00.000Z'},
    ]);
    const tree = await render(
      <UnitLessonsScreen
        navigation={navigation}
        route={{params: {unitId: 'unit-1', title: 'Đồ uống'}} as never}
      />,
    );
    press(tree, 'unit-lessons-summative');
    expect(nav().navigate).toHaveBeenCalledWith('UnitSummativeTask', {
      unitId: 'unit-1',
      title: 'Đồ uống',
    });
  });

  it('shows what a unit and a lesson teach from their first can-do', async () => {
    client.fetchLevelUnits.mockResolvedValue({
      ok: true,
      value: [
        {...unit('unit-1', 0), canDo: ['Gọi đồ uống ở quán.']},
        {...unit('unit-2', 1), description: 'Chào hỏi'},
      ],
    });
    client.fetchUnitLessons.mockResolvedValue({
      ok: true,
      value: [{...lesson('a', 0), canDo: ['Gọi một đồ uống kèm cỡ.']}],
    });
    const units = await render(
      <LevelUnitsScreen
        navigation={navigation}
        route={{params: {levelId: 'level-1'}} as never}
      />,
    );
    const unitsText = allText(units);
    expect(unitsText).toContain('Bạn sẽ: Gọi đồ uống ở quán.');
    expect(unitsText).toContain('Chào hỏi');

    const lessons = await render(
      <UnitLessonsScreen
        navigation={navigation}
        route={{params: {unitId: 'unit-1'}} as never}
      />,
    );
    expect(
      lessons.root.findAll(
        node => node.props.testID === 'unit-lessons-can-do-a',
      ).length,
    ).toBeGreaterThan(0);
    expect(allText(lessons)).toContain('Bạn sẽ: Gọi một đồ uống kèm cỡ.');
  });

  it('retries after a load error', async () => {
    client.fetchCourses
      .mockResolvedValueOnce({
        ok: false,
        kind: 'network-error',
        message: 'Network connection lost.',
      })
      .mockResolvedValueOnce({ok: true, value: []});

    const tree = await render(<CourseListContent />);
    expect(
      tree.root.findAll(node => node.props.testID === 'course-list-error')
        .length,
    ).toBeGreaterThan(0);

    await act(async () => {
      tree.root
        .findAll(
          node =>
            node.props.testID === 'course-list-retry' &&
            typeof node.props.onPress === 'function',
        )[0]
        .props.onPress();
    });

    expect(client.fetchCourses).toHaveBeenCalledTimes(2);
    expect(
      tree.root.findAll(node => node.props.testID === 'course-list-empty')
        .length,
    ).toBeGreaterThan(0);
  });
});
