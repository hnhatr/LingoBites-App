import AsyncStorage from '@react-native-async-storage/async-storage';
import React from 'react';
import ReactTestRenderer, {act} from 'react-test-renderer';

import {AppThemeProvider} from '@ui/theme';

import {FeatureFlagProvider} from '@core/release';

import {makeTestReleaseConfig, THEME_UI_FLAGS} from '@test/support';

import checkFixture from '../../logic/__tests__/fixtures/valid-exercise-check-response.json';
import learnerLessonFixture from '../../logic/__tests__/fixtures/valid-learner-lesson-aggregate.json';
import type {
  CurriculumLessonAnswerInput,
  CurriculumLessonCheckResult,
} from '../../logic/curriculumLessonClient';
import {
  type CurriculumLesson,
  parseCurriculumLessonAggregateResponse,
  parseCurriculumLessonBlock,
  parseCurriculumLessonCheckResponse,
} from '../../logic/curriculumLessonSchema';
import {CurriculumLessonPlayer} from '../CurriculumLessonPlayer';

async function renderWithTheme(ui: React.ReactElement) {
  let tree!: ReactTestRenderer.ReactTestRenderer;
  await act(async () => {
    tree = ReactTestRenderer.create(
      <FeatureFlagProvider
        releaseConfig={makeTestReleaseConfig(THEME_UI_FLAGS)}
      >
        <AppThemeProvider>{ui}</AppThemeProvider>
      </FeatureFlagProvider>,
    );
  });
  return tree;
}

/** Parse the canonical learner fixture through the real contract parser. */
function lessonFromFixture(): CurriculumLesson {
  const parsed = parseCurriculumLessonAggregateResponse({
    request_id: 'player-test',
    status: 'success',
    lesson: learnerLessonFixture,
  });
  if (!parsed.ok) {
    throw new Error(`fixture failed to parse: ${parsed.message}`);
  }
  return parsed.lesson;
}

function checkFromFixture(correct: boolean): CurriculumLessonCheckResult {
  const parsed = parseCurriculumLessonCheckResponse({
    ...checkFixture,
    correct,
  });
  if (!parsed.ok) {
    throw new Error(`check fixture failed to parse: ${parsed.message}`);
  }
  return parsed;
}

function progressOf(tree: ReactTestRenderer.ReactTestRenderer) {
  const node = tree.root.findByProps({testID: 'player-progress'});
  const children = node.props.children;
  return (Array.isArray(children) ? children : [children]).join('');
}

function visibleBlockTestID(tree: ReactTestRenderer.ReactTestRenderer) {
  const slot = tree.root.findByProps({testID: 'lesson-player-block'});
  const found = slot.findAll(
    node =>
      typeof node.props?.testID === 'string' &&
      (node.props.testID as string).startsWith('block-'),
  );
  return found.map(node => node.props.testID as string);
}

function hostCount(tree: ReactTestRenderer.ReactTestRenderer, testID: string) {
  // findAllByProps matches both the composite component and its host node;
  // count host nodes only for stable existence assertions.
  return tree.root
    .findAllByProps({testID})
    .filter(node => typeof node.type === 'string').length;
}

async function press(
  tree: ReactTestRenderer.ReactTestRenderer,
  testID: string,
) {
  await act(async () => {
    tree.root.findByProps({testID}).props.onPress();
  });
}

const noopCheck = async (
  _id: string,
  _answer: CurriculumLessonAnswerInput,
): Promise<CurriculumLessonCheckResult> => checkFromFixture(true);

describe('CurriculumLessonPlayer', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('renders the canonical fixture and traverses every block by position', async () => {
    const tree = await renderWithTheme(
      <CurriculumLessonPlayer
        lesson={lessonFromFixture()}
        onCheckExercise={noopCheck}
      />,
    );
    expect(progressOf(tree)).toBe('Part 1 of 5');
    expect(visibleBlockTestID(tree)).toContain('block-text');

    const seen: string[][] = [visibleBlockTestID(tree)];
    for (let part = 2; part <= 5; part += 1) {
      await press(tree, 'player-next');
      expect(progressOf(tree)).toBe(`Part ${part} of 5`);
      seen.push(visibleBlockTestID(tree));
    }
    expect(seen[1]).toContain('block-example');
    expect(seen[2]).toContain('block-vocabulary');
    expect(seen[3]).toContain('block-media');
    expect(seen[4]).toContain('block-exercise');

    await press(tree, 'player-next');
    expect(hostCount(tree, 'player-complete')).toBe(1);
  });

  it('navigates back with Previous and stays on the first block', async () => {
    const tree = await renderWithTheme(
      <CurriculumLessonPlayer
        lesson={lessonFromFixture()}
        onCheckExercise={noopCheck}
      />,
    );
    expect(
      tree.root.findByProps({testID: 'player-prev'}).props.accessibilityState,
    ).toEqual({disabled: true});
    await press(tree, 'player-next');
    expect(progressOf(tree)).toBe('Part 2 of 5');
    await press(tree, 'player-prev');
    expect(progressOf(tree)).toBe('Part 1 of 5');
    expect(visibleBlockTestID(tree)).toContain('block-text');
  });

  it('returns from Complete to the last block and exits on Done', async () => {
    const onExit = jest.fn();
    const tree = await renderWithTheme(
      <CurriculumLessonPlayer
        lesson={lessonFromFixture()}
        onCheckExercise={noopCheck}
        onExit={onExit}
      />,
    );
    for (let part = 0; part < 5; part += 1) {
      await press(tree, 'player-next');
    }
    expect(hostCount(tree, 'player-complete')).toBe(1);
    await press(tree, 'player-complete-back');
    expect(progressOf(tree)).toBe('Part 5 of 5');
    expect(visibleBlockTestID(tree)).toContain('block-exercise');
    await press(tree, 'player-next');
    await press(tree, 'player-complete-exit');
    expect(onExit).toHaveBeenCalledTimes(1);
  });

  it('renders blocks in ascending position order even when shuffled', async () => {
    const lesson = lessonFromFixture();
    const shuffled: CurriculumLesson = {
      ...lesson,
      blocks: [...lesson.blocks].reverse(),
    };
    const tree = await renderWithTheme(
      <CurriculumLessonPlayer lesson={shuffled} onCheckExercise={noopCheck} />,
    );
    expect(progressOf(tree)).toBe('Part 1 of 5');
    expect(visibleBlockTestID(tree)).toContain('block-text');
    await press(tree, 'player-next');
    expect(visibleBlockTestID(tree)).toContain('block-example');
  });

  it('renders an unsupported placeholder inline and keeps navigating', async () => {
    const lesson = lessonFromFixture();
    const withFallback: CurriculumLesson = {
      ...lesson,
      blocks: [
        lesson.blocks[0],
        parseCurriculumLessonBlock({type: 'quiz', position: 1}),
        ...lesson.blocks.slice(1),
      ],
    };
    const tree = await renderWithTheme(
      <CurriculumLessonPlayer
        lesson={withFallback}
        onCheckExercise={noopCheck}
      />,
    );
    expect(progressOf(tree)).toBe('Part 1 of 6');
    await press(tree, 'player-next');
    expect(hostCount(tree, 'block-unsupported')).toBe(1);
    await press(tree, 'player-next');
    expect(visibleBlockTestID(tree)).toContain('block-example');
  });

  it('dispatches on block type, never on lesson id', async () => {
    const first = lessonFromFixture();
    const second: CurriculumLesson = {
      ...first,
      id: '11111111-1111-4111-8111-111111111111',
    };
    const firstTree = await renderWithTheme(
      <CurriculumLessonPlayer lesson={first} onCheckExercise={noopCheck} />,
    );
    const secondTree = await renderWithTheme(
      <CurriculumLessonPlayer lesson={second} onCheckExercise={noopCheck} />,
    );
    expect(visibleBlockTestID(secondTree)).toEqual(
      visibleBlockTestID(firstTree),
    );
  });

  it('shows the empty-lesson placeholder with safe exit and retry', async () => {
    const lesson: CurriculumLesson = {...lessonFromFixture(), blocks: []};
    const onExit = jest.fn();
    const onRetry = jest.fn();
    const tree = await renderWithTheme(
      <CurriculumLessonPlayer
        lesson={lesson}
        onCheckExercise={noopCheck}
        onExit={onExit}
        onRetry={onRetry}
      />,
    );
    expect(hostCount(tree, 'player-empty')).toBe(1);
    await press(tree, 'player-retry');
    await press(tree, 'player-exit');
    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(onExit).toHaveBeenCalledTimes(1);
  });

  it('persists nothing while traversing the whole lesson', async () => {
    const tree = await renderWithTheme(
      <CurriculumLessonPlayer
        lesson={lessonFromFixture()}
        onCheckExercise={noopCheck}
      />,
    );
    for (let part = 0; part < 5; part += 1) {
      await press(tree, 'player-next');
    }
    const keys = await AsyncStorage.getAllKeys();
    expect(keys).toEqual([]);
    expect(AsyncStorage.setItem).not.toHaveBeenCalled();
  });
});
