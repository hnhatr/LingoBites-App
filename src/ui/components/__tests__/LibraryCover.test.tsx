import React from 'react';
import ReactTestRenderer, {act} from 'react-test-renderer';

import {AppThemeProvider} from '@ui/theme';
import {cefrLevelOf, levelTone} from '@ui/theme/levelColors';
import {themes} from '@ui/theme/themeRegistry';

import {FeatureFlagProvider} from '@core/release';

import {AppText} from '../AppText';
import {
  letterboxScale,
  LibraryCover,
  type LibraryCoverProps,
  topicGlyph,
  youtubeThumbnailUrl,
} from '../LibraryCover';

function render(props: Partial<LibraryCoverProps> = {}) {
  let tree!: ReactTestRenderer.ReactTestRenderer;
  act(() => {
    tree = ReactTestRenderer.create(
      <FeatureFlagProvider>
        <AppThemeProvider>
          <LibraryCover glyph="cards" shape="pack" testID="cover" {...props} />
        </AppThemeProvider>
      </FeatureFlagProvider>,
    );
  });
  return tree;
}

const has = (tree: ReactTestRenderer.ReactTestRenderer, testID: string) =>
  tree.root.findAllByProps({testID}).length > 0;

describe('LibraryCover', () => {
  it('shows the cover picture when there is one', () => {
    const tree = render({imageUrl: 'https://cdn.example/a.png'});
    expect(has(tree, 'cover-image')).toBe(true);
    expect(has(tree, 'cover-default')).toBe(false);
  });

  it('draws the default cover without a picture', () => {
    const tree = render({imageUrl: null});
    expect(has(tree, 'cover-default')).toBe(true);
  });

  it('falls back to the default cover when the picture cannot load', () => {
    const tree = render({imageUrl: 'https://cdn.example/broken.png'});
    act(() => {
      tree.root.findByProps({testID: 'cover-image'}).props.onError();
    });
    expect(has(tree, 'cover-image')).toBe(false);
    expect(has(tree, 'cover-default')).toBe(true);
  });

  it('shows a known CEFR level and the corner badge', () => {
    const tree = render({level: 'b1', badge: 'check'});
    const chip = tree.root.findByProps({testID: 'cover-level'});
    expect(chip.findByType(AppText).props.children).toBe('B1');
    expect(has(tree, 'cover-badge-check')).toBe(true);
    expect(has(render({level: 'Beginner'}), 'cover-level')).toBe(false);
  });
});

describe('cover helpers', () => {
  it('picks a topic icon from the topic code', () => {
    expect(topicGlyph('topic:food-drink')).toBe('food');
    expect(topicGlyph('topic:shopping')).toBe('bag');
    expect(topicGlyph('topic:travel')).toBe('plane');
    expect(topicGlyph('topic:greetings')).toBe('chat');
    expect(topicGlyph('topic:weather')).toBe('cards');
    expect(topicGlyph('topic:eating-out')).toBe('food');
    expect(topicGlyph(null)).toBe('cards');
  });

  it('builds the YouTube thumbnail of a video', () => {
    expect(youtubeThumbnailUrl('abc123')).toBe(
      'https://i.ytimg.com/vi/abc123/hqdefault.jpg',
    );
  });

  it('reads CEFR levels and gives each an opaque tone', () => {
    expect(cefrLevelOf(' a2 ')).toBe('A2');
    expect(cefrLevelOf('Level 1')).toBeNull();
    const tone = levelTone(themes.default, 'C1');
    expect(tone.strong).toBe('#e0456a');
    expect(tone.soft).toMatch(/^#[0-9a-f]{6}$/);
    expect(levelTone(themes.default, null).strong).not.toBe(tone.strong);
  });
});

describe('letterboxScale', () => {
  const thumb = youtubeThumbnailUrl('abc123');

  it('enlarges a YouTube thumbnail so its black bars leave a square cover', () => {
    expect(letterboxScale(thumb, 1)).toBeCloseTo(4 / 3);
  });

  it('leaves a 16:9 cover, which already crops the bars, alone', () => {
    expect(letterboxScale(thumb, 16 / 9)).toBe(1);
  });

  it('leaves other pictures alone', () => {
    expect(letterboxScale('https://cdn.example/a.png', 1)).toBe(1);
    expect(letterboxScale(null, 1)).toBe(1);
  });
});
