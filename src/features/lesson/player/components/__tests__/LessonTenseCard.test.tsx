import fs from 'node:fs';
import path from 'node:path';

import React from 'react';
import ReactTestRenderer, {act} from 'react-test-renderer';

import {AppThemeProvider} from '@ui/theme';

import {FeatureFlagProvider} from '@core/release';
import {
  type LessonItemEntry,
  type LessonSnapshot,
  LessonSnapshotResponseSchema,
} from '@core/schemas/lesson';
import {getItemMemory} from '@core/sync/learningOutcomes';

import {mockAppNavigation} from '@test/support/appNavigationMock';

import {CanonicalLessonHub} from '../CanonicalLessonHub';

/** Vocab path P6 (design B): "Thì của bài" on the lesson hub. */

jest.mock('@core/navigation', () => ({
  ...jest.requireActual('@core/navigation'),
  useOptionalAppNavigation: () =>
    require('@test/support/appNavigationMock').mockAppNavigation,
}));
jest.mock('@core/sync/learningOutcomes', () => ({
  ...jest.requireActual('@core/sync/learningOutcomes'),
  getItemMemory: jest.fn(),
}));

const mockMemory = getItemMemory as jest.MockedFunction<typeof getItemMemory>;
// The hub asks for pictures beside the snapshot; this test never answers.
global.fetch = jest.fn(
  () => new Promise<Response>(() => undefined),
) as unknown as typeof fetch;

function specSnapshot(): LessonSnapshot {
  const raw = JSON.parse(
    fs.readFileSync(
      path.join(
        __dirname,
        '../../../../../core/schemas/__tests__/fixtures',
        'valid-lesson-snapshot-with-spec-response.json',
      ),
      'utf8',
    ),
  );
  return LessonSnapshotResponseSchema.parse(raw).lesson;
}

const grammar: LessonItemEntry = {
  role: 'required',
  introduction: 'new',
  position: 99,
  item: {
    id: '66666666-6666-4666-8666-666666666601',
    code: 'grammar:present-simple',
    kind: 'grammar',
    text: 'Present simple',
    meaning_vi: 'Hiện tại đơn',
    ipa: null,
    part_of_speech: null,
    note_vi: null,
    audience: 'all',
    payload: {
      family: 'tense',
      forms: {
        affirmative: 'S + V(s/es)',
        negative: "S + don't/doesn't + V",
        question: 'Do/Does + S + V?',
      },
    },
    audio: null,
    image: null,
    examples: [],
    variants: [],
    errors: [],
  },
};

function render(snapshot: LessonSnapshot) {
  let tree!: ReactTestRenderer.ReactTestRenderer;
  act(() => {
    tree = ReactTestRenderer.create(
      <FeatureFlagProvider>
        <AppThemeProvider>
          <CanonicalLessonHub
            analyses={{}}
            onOpenSection={jest.fn()}
            snapshot={snapshot}
          />
        </AppThemeProvider>
      </FeatureFlagProvider>,
    );
  });
  return tree;
}

const byId = (tree: ReactTestRenderer.ReactTestRenderer, id: string) =>
  tree.root.findAll(node => node.props.testID === id);

const textOf = (tree: ReactTestRenderer.ReactTestRenderer, id: string) =>
  byId(tree, id)
    .map(node =>
      ([] as unknown[])
        .concat(node.props.children)
        .filter(child => typeof child === 'string')
        .join(''),
    )
    .reduce(
      (longest, text) => (text.length > longest.length ? text : longest),
      '',
    );

describe('LessonTenseCard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockMemory.mockReturnValue(null);
  });

  it('is absent from a lesson without a tense', () => {
    expect(byId(render(specSnapshot()), 'lesson-tense-card')).toHaveLength(0);
  });

  it('shows the tense, its formula and memory level', () => {
    mockMemory.mockReturnValue({
      stage: 2,
      stableAt: null,
    } as ReturnType<typeof getItemMemory>);
    const snapshot = specSnapshot();
    const tree = render({
      ...snapshot,
      lesson_items: [...(snapshot.lesson_items ?? []), grammar],
    });
    expect(byId(tree, 'lesson-tense-card').length).toBeGreaterThan(0);
    expect(textOf(tree, 'lesson-tense-formula')).toBe('S + V(s/es)');
    expect(textOf(tree, 'lesson-tense-level')).toBe('Đang nhớ');
  });

  it('practises the lesson pattern with the tense picked, and opens the map', () => {
    const snapshot = specSnapshot();
    const tree = render({
      ...snapshot,
      lesson_items: [...(snapshot.lesson_items ?? []), grammar],
    });
    const pattern = (snapshot.lesson_items ?? []).find(
      entry => entry.item.kind === 'pattern',
    )!.item.code;

    act(() => byId(tree, 'lesson-tense-practice')[0]!.props.onPress());
    expect(mockAppNavigation.openComboSetup).toHaveBeenCalledWith(
      pattern,
      'grammar:present-simple',
    );
    act(() => byId(tree, 'lesson-tense-map')[0]!.props.onPress());
    expect(mockAppNavigation.openLibrarySection).toHaveBeenCalledWith('tenses');
    act(() => byId(tree, 'lesson-tense-name')[0]!.props.onPress());
    expect(mockAppNavigation.openTenseDetail).toHaveBeenCalledWith(
      'grammar:present-simple',
    );
  });
});
