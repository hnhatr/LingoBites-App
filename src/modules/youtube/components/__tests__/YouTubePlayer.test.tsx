import React from 'react';
import renderer, {act} from 'react-test-renderer';
import {
  mapYouTubePlayerError,
  YouTubePlayer,
  YOUTUBE_PLAYER_ERROR_CODES,
} from '../YouTubePlayer';

jest.mock('react-native-youtube-iframe', () => {
  const ReactActual = require('react');
  const {View} = require('react-native');

  const PLAYER_ERRORS = {
    HTML5_ERROR: 'HTML5_error',
    VIDEO_NOT_FOUND: 'video_not_found',
    EMBED_NOT_ALLOWED: 'embed_not_allowed',
    INVALID_PARAMETER: 'invalid_parameter',
  };

  const YoutubeIframe = ReactActual.forwardRef(
    (_props: unknown, ref: unknown) => {
      ReactActual.useImperativeHandle(ref, () => ({
        seekTo: jest.fn(),
        getCurrentTime: jest.fn().mockResolvedValue(12.5),
      }));

      return <View testID="youtube-iframe" {...(_props as object)} ref={ref} />;
    },
  );

  return {
    __esModule: true,
    default: YoutubeIframe,
    PLAYER_ERRORS,
  };
});

describe('mapYouTubePlayerError', () => {
  it('maps embed-not-allowed to YOUTUBE_NOT_EMBEDDABLE', () => {
    expect(mapYouTubePlayerError('embed_not_allowed')).toBe(
      YOUTUBE_PLAYER_ERROR_CODES.EMBED_NOT_ALLOWED,
    );
  });

  it('maps unknown errors to YOUTUBE_PLAYER_UNKNOWN_ERROR', () => {
    expect(mapYouTubePlayerError('something_else')).toBe(
      'YOUTUBE_PLAYER_UNKNOWN_ERROR',
    );
  });
});

describe('YouTubePlayer', () => {
  it('renders iframe wrapper', () => {
    let tree: renderer.ReactTestRenderer;
    act(() => {
      tree = renderer.create(<YouTubePlayer videoId="dQw4w9WgXcQ" />);
    });

    expect(tree!.root.findByProps({testID: 'youtube-iframe'})).toBeTruthy();
  });

  it('forwards playbackRate to the iframe', () => {
    let tree: renderer.ReactTestRenderer;
    act(() => {
      tree = renderer.create(
        <YouTubePlayer playbackRate={1.25} videoId="dQw4w9WgXcQ" />,
      );
    });

    expect(
      tree!.root.findByProps({testID: 'youtube-iframe'}).props.playbackRate,
    ).toBe(1.25);
  });
});
