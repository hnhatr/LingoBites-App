import React from 'react';
import renderer, {act} from 'react-test-renderer';
import {FeatureFlagProvider} from '@/release';
import {AppThemeProvider} from '@ui/theme/index';
import type {YouTubeSegment} from '@shared/schemas/youtube-transcript-v1';
import {TranscriptLine} from '../../components/TranscriptLine';
import {YouTubeTranscriptPopup} from '../YouTubeTranscriptPopup';

function makeSegment(index: number, en: string): YouTubeSegment {
  return {
    id: `seg-${index}`,
    index,
    start_ms: index * 3_000,
    end_ms: index * 3_000 + 3_000,
    en,
    vi: `Câu ${index}`,
    ipa: 'ipa',
  };
}

const SEGMENTS = [
  makeSegment(0, 'First sentence'),
  makeSegment(1, 'Second sentence'),
  makeSegment(2, 'Third sentence'),
];

function renderPopup(
  props: Partial<React.ComponentProps<typeof YouTubeTranscriptPopup>> = {},
) {
  const onClose = jest.fn();
  const onSeekSegment = jest.fn();
  let tree!: renderer.ReactTestRenderer;
  act(() => {
    tree = renderer.create(
      <FeatureFlagProvider>
        <AppThemeProvider>
          <YouTubeTranscriptPopup
            activeIndex={1}
            onClose={onClose}
            onSeekSegment={onSeekSegment}
            segments={SEGMENTS}
            showIpa
            showVietnamese
            visible
            {...props}
          />
        </AppThemeProvider>
      </FeatureFlagProvider>,
    );
  });
  return {tree, onClose, onSeekSegment};
}

describe('YouTubeTranscriptPopup (SETE-325, C-4)', () => {
  it('reuses TranscriptLine once per segment', () => {
    const {tree} = renderPopup();

    const lines = tree.root.findAllByType(TranscriptLine);
    expect(lines).toHaveLength(SEGMENTS.length);
    expect(
      tree.root.findByProps({testID: 'youtube-popup-line-seg-1'}),
    ).toBeTruthy();
  });

  it('highlights the currently playing sentence', () => {
    const {tree} = renderPopup({activeIndex: 2});

    const lines = tree.root.findAllByType(TranscriptLine);
    expect(lines.map(line => line.props.isActive)).toEqual([
      false,
      false,
      true,
    ]);
  });

  it('seeks on line press and keeps the popup open', () => {
    const {tree, onSeekSegment, onClose} = renderPopup();

    act(() => {
      tree.root.findAllByType(TranscriptLine)[0].props.onPress(SEGMENTS[0]);
    });

    expect(onSeekSegment).toHaveBeenCalledWith(SEGMENTS[0]);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('closes from the close button', () => {
    const {tree, onClose} = renderPopup();

    act(() => {
      tree.root
        .findByProps({testID: 'youtube-transcript-popup-close'})
        .props.onPress();
    });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('shows Vietnamese translations inside the popup', () => {
    const {tree} = renderPopup();

    expect(
      tree.root.findByProps({testID: 'youtube-popup-line-seg-0-vi'}).props
        .children,
    ).toBe('Câu 0');
  });
});
