import React from 'react';
import ReactTestRenderer, {act} from 'react-test-renderer';

let mockIframeProps: Record<string, any> = {};
let mockCurrentTime = 0;
let mockDuration = 0;

jest.mock('react-native-youtube-iframe', () => {
  const ReactLib = require('react');
  const {View} = require('react-native');
  const MockIframe = ReactLib.forwardRef((props: any, ref: any) => {
    mockIframeProps = props;
    ReactLib.useImperativeHandle(ref, () => ({
      getCurrentTime: async () => mockCurrentTime,
      getDuration: async () => mockDuration,
      seekTo: jest.fn(),
    }));
    return <View testID="mock-youtube-iframe" />;
  });
  return {__esModule: true, default: MockIframe, PLAYER_ERRORS: {}};
});

const {YouTubePlayer} = require('../YouTubePlayer');

async function renderPlayer(props: Record<string, unknown> = {}) {
  let tree!: ReactTestRenderer.ReactTestRenderer;
  await act(async () => {
    tree = ReactTestRenderer.create(
      <YouTubePlayer videoId="abc123" {...props} />,
    );
  });
  return tree;
}

describe('YouTubePlayer', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockIframeProps = {};
    mockCurrentTime = 0;
    mockDuration = 0;
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('hides YouTube controls and captions', async () => {
    await renderPlayer();
    expect(mockIframeProps.initialPlayerParams).toMatchObject({
      controls: false,
      showClosedCaptions: false,
    });
    expect(mockIframeProps.webViewProps.injectedJavaScript).toContain(
      "unloadModule('captions')",
    );
  });

  it('keeps touches off the iframe and toggles play from the frame', async () => {
    const tree = await renderPlayer();
    const iframe = tree.root.findByProps({testID: 'mock-youtube-iframe'});
    const touchless = iframe.parent?.parent;
    expect(touchless?.props.pointerEvents).toBe('none');

    expect(mockIframeProps.play).toBe(false);
    const frame = tree.root.findByProps({testID: 'youtube-player-frame'});
    await act(async () => {
      frame.props.onPress();
    });
    expect(mockIframeProps.play).toBe(true);
    await act(async () => {
      frame.props.onPress();
    });
    expect(mockIframeProps.play).toBe(false);
  });

  it('stops just before the end and reports ended', async () => {
    const onEnded = jest.fn();
    const onPlayingChange = jest.fn();
    await renderPlayer({onEnded, onPlayingChange});
    await act(async () => {
      mockIframeProps.onReady();
      mockIframeProps.onChangeState('playing');
    });
    mockDuration = 100;
    mockCurrentTime = 50;
    await act(async () => {
      jest.advanceTimersByTime(250);
    });
    expect(onEnded).not.toHaveBeenCalled();

    mockCurrentTime = 99.7;
    await act(async () => {
      jest.advanceTimersByTime(250);
    });
    expect(onEnded).toHaveBeenCalledTimes(1);
    expect(onPlayingChange).toHaveBeenLastCalledWith(false);
    expect(mockIframeProps.play).toBe(false);
  });
});
