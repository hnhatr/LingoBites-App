import React from 'react';
import ReactTestRenderer, {act} from 'react-test-renderer';

import {AppThemeProvider} from '@ui/theme';

import {FeatureFlagProvider} from '@core/release';

import {
  formatVideoDuration,
  LessonCard,
  lessonCardAccessibilityLabel,
  lessonCardDurationLabel,
  lessonCardKind,
  type LessonCardProps,
  lessonContextLabel,
  splitLessonTitle,
} from '../LessonCard';

function render(props: Partial<LessonCardProps> = {}) {
  const onPress = jest.fn();
  const onToggleBookmark = jest.fn();
  let tree!: ReactTestRenderer.ReactTestRenderer;
  act(() => {
    tree = ReactTestRenderer.create(
      <FeatureFlagProvider>
        <AppThemeProvider>
          <LessonCard
            kind="text"
            onPress={onPress}
            onToggleBookmark={onToggleBookmark}
            testID="card"
            title="Seeing an Old Friend Again"
            {...props}
          />
        </AppThemeProvider>
      </FeatureFlagProvider>,
    );
  });
  return {tree, onPress, onToggleBookmark};
}

const button = (tree: ReactTestRenderer.ReactTestRenderer, testID: string) =>
  tree.root.find(
    node =>
      node.props.testID === testID && typeof node.props.onPress === 'function',
  );

const chipIds = (tree: ReactTestRenderer.ReactTestRenderer) => [
  ...new Set(
    tree.root
      .findAll(
        node =>
          typeof node.props.testID === 'string' &&
          node.props.testID.startsWith('card-chip-'),
      )
      .map(node => node.props.testID as string),
  ),
];

describe('lesson card helpers', () => {
  it('splits a bilingual title at the first separator', () => {
    expect(
      splitLessonTitle('Seeing an Old Friend Again · Gặp lại người bạn cũ'),
    ).toEqual({
      title: 'Seeing an Old Friend Again',
      subtitle: 'Gặp lại người bạn cũ',
    });
    expect(splitLessonTitle('Just English')).toEqual({
      title: 'Just English',
      subtitle: null,
    });
    expect(splitLessonTitle(' · Only after')).toEqual({
      title: '· Only after',
      subtitle: null,
    });
  });

  it('maps a source type to a card kind', () => {
    expect(lessonCardKind('youtube')).toBe('video');
    expect(lessonCardKind('learner_ocr')).toBe('image');
    expect(lessonCardKind('admin_text')).toBe('text');
    expect(lessonCardKind('learner_text')).toBe('text');
  });

  it('prefers the author estimate, then the video length, then sentences', () => {
    expect(
      lessonCardDurationLabel({estimatedMinutes: 4, youtubeDurationMs: 9000}),
    ).toBe('4 phút');
    expect(lessonCardDurationLabel({youtubeDurationMs: 272_000})).toBe('4:32');
    expect(lessonCardDurationLabel({sentenceCount: 24})).toBe('12 phút');
    expect(lessonCardDurationLabel({sentenceCount: 1})).toBe('1 phút');
    expect(lessonCardDurationLabel({estimatedMinutes: 0})).toBeNull();
    expect(formatVideoDuration(65_400)).toBe('1:05');
  });

  it('labels course placement by level, then course', () => {
    const unit = {
      course_id: 'c',
      course_title: 'Everyday English',
      level_id: 'l',
      level_title: 'Getting Started',
      unit_id: 'u',
      unit_title: 'Greetings',
      unit_position: 0,
      lesson_position: 0,
    };
    expect(lessonContextLabel(unit)).toBe('Getting Started');
    expect(lessonContextLabel({...unit, level_title: ' '})).toBe(
      'Everyday English',
    );
    expect(lessonContextLabel(null)).toBeNull();
  });
});

describe('LessonCard', () => {
  it('shows status chips in a fixed order and hides empty ones', () => {
    const {tree} = render({
      downloaded: true,
      progress: {state: 'in_progress', done: 8, total: 24},
      reviewDueCount: 5,
      exerciseCount: 3,
    });
    expect(chipIds(tree)).toEqual([
      'card-chip-downloaded',
      'card-chip-progress',
      'card-chip-review',
      'card-chip-exercises',
    ]);
    const text = JSON.stringify(tree.toJSON());
    expect(text).toContain('Đang học 8/24');
    expect(text).toContain('5 câu cần ôn');
    expect(text).toContain('3 bài tập');

    const bare = render({exerciseCount: 0, reviewDueCount: 0});
    expect(chipIds(bare.tree)).toEqual([]);
  });

  it('opens on press and toggles the bookmark without opening', () => {
    const {tree, onPress, onToggleBookmark} = render({bookmarked: false});
    const bookmark = button(tree, 'card-bookmark');
    expect(bookmark.props.accessibilityLabel).toBe('Lưu bài');
    act(() => bookmark.props.onPress());
    expect(onToggleBookmark).toHaveBeenCalledTimes(1);
    expect(onPress).not.toHaveBeenCalled();

    act(() => button(tree, 'card').props.onPress());
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('labels a saved card for unsaving', () => {
    const {tree} = render({bookmarked: true});
    expect(button(tree, 'card-bookmark').props.accessibilityLabel).toBe(
      'Bỏ lưu bài',
    );
  });

  it('has no bookmark button without a toggle handler', () => {
    const {tree} = render({onToggleBookmark: undefined});
    expect(
      tree.root.findAll(node => node.props.testID === 'card-bookmark'),
    ).toHaveLength(0);
  });

  it('shows a fraction only on the compact progress chip', () => {
    const {tree} = render({
      variant: 'compact',
      downloaded: true,
      progress: {state: 'in_progress', done: 8, total: 24},
    });
    const visible = tree.root
      .findAll(node => typeof node.props.children === 'string')
      .map(node => node.props.children as string);
    expect(visible).toContain('8/24');
    expect(visible).not.toContain('Đang học 8/24');
    expect(visible).not.toContain('Đã tải');
  });

  it('reads the whole card as one sentence', () => {
    expect(
      lessonCardAccessibilityLabel({
        kind: 'video',
        title: 'Asking for Directions',
        subtitle: 'Hỏi đường',
        contextLead: 'Bài 2',
        context: 'Getting Started',
        durationLabel: '3:10',
        sentenceCount: 14,
        downloaded: true,
        progress: {state: 'completed'},
        bookmarked: true,
      }),
    ).toBe(
      'Asking for Directions. Hỏi đường. Bài 2, Getting Started. Bài video, 3:10, 14 câu. Đã tải. Đã học. Đã lưu',
    );
  });
});
