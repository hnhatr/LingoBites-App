import fs from 'node:fs';
import path from 'node:path';

import React from 'react';
import {act} from 'react-test-renderer';

import {parseActivityContent} from '@core/schemas/activityContent';
import {LessonSnapshotResponseSchema} from '@core/schemas/lesson';

import {byTestId, has, press, renderWithTheme} from '@test/support/lessonFlow';

import {clipReachedEnd, sourceClipOf} from '../../logic/sourceClip';
import {ListenRepeatActivity} from '../activities/ListenRepeatActivity';

const mockPlayer = {
  play: jest.fn(),
  pause: jest.fn(),
  seekTo: jest.fn(),
};
jest.mock('../../../player/components/YouTubePlayer', () => {
  const ReactActual = jest.requireActual('react');
  const {View} = jest.requireActual('react-native');
  return {
    YouTubePlayer: ReactActual.forwardRef(
      (props: Record<string, unknown>, ref: unknown) => {
        ReactActual.useImperativeHandle(ref, () => mockPlayer);
        return <View testID="mock-youtube" {...props} />;
      },
    ),
  };
});
jest.mock('@features/audio', () => ({
  speak: jest.fn(() => Promise.resolve({ok: true})),
}));
jest.mock('@features/speaking', () => ({
  loadLessonRecorder: () => null,
}));

const composed = LessonSnapshotResponseSchema.parse(
  JSON.parse(
    fs.readFileSync(
      path.join(
        __dirname,
        '../../../../../core/schemas/__tests__/fixtures/valid-lesson-snapshot-composed-response.json',
      ),
      'utf8',
    ),
  ),
).lesson;
const content = parseActivityContent(
  'listen_and_repeat',
  composed.blocks.find(block => block.data.activityKind === 'listen_and_repeat')
    ?.data.content,
)!;

const flushLazy = () =>
  act(async () => {
    await new Promise(resolve => setTimeout(resolve, 0));
  });

describe('listen and repeat source clips (S4.3)', () => {
  it('knows when a prompt has a clip and when it ended', () => {
    const prompt = content.prompts[0]!;
    expect(sourceClipOf(prompt, null)).toBeNull();
    const clip = sourceClipOf(prompt, 'vid')!;
    expect(clip).toEqual({videoId: 'vid', startMs: 0, endMs: 2000});
    expect(clipReachedEnd(1700, clip)).toBe(false);
    expect(clipReachedEnd(1900, clip)).toBe(true);
  });

  it('plays the clip of a video lesson and stops at its end', async () => {
    const tree = renderWithTheme(
      <ListenRepeatActivity
        content={content}
        onComplete={jest.fn()}
        youtubeVideoId={composed.youtube!.video_id}
      />,
    );
    await flushLazy();
    expect(has(tree, 'lesson-flow-source-clip')).toBe(true);
    press(tree, 'lesson-flow-play-clip');
    expect(mockPlayer.seekTo).toHaveBeenCalledWith(0);
    expect(mockPlayer.play).toHaveBeenCalled();
    const player = byTestId(tree, 'mock-youtube')[0]!;
    act(() => {
      (player.props.onTimeUpdate as (seconds: number) => void)(1.95);
    });
    expect(mockPlayer.pause).toHaveBeenCalled();
    // The TTS model stays as the fallback.
    expect(has(tree, 'lesson-flow-listen-model')).toBe(true);
  });

  it('keeps TTS only without a video', () => {
    const tree = renderWithTheme(
      <ListenRepeatActivity content={content} onComplete={jest.fn()} />,
    );
    expect(has(tree, 'lesson-flow-source-clip')).toBe(false);
    expect(has(tree, 'lesson-flow-listen-model')).toBe(true);
  });
});
