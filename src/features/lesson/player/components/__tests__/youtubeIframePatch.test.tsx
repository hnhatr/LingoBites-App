import React from 'react';
import ReactTestRenderer, {act} from 'react-test-renderer';

// Guards patches/react-native-youtube-iframe+2.4.1.patch: the hosted player
// page ignores the library's JSON postMessage commands, so play / pause /
// speed must reach the player through injectJavaScript.
const mockInjectJavaScript = jest.fn();
const mockPostMessage = jest.fn();
let mockOnMessage: ((event: any) => void) | undefined;

jest.unmock('react-native-youtube-iframe');

jest.mock('react-native-webview', () => {
  const ReactLib = require('react');
  const {View} = require('react-native');
  const MockWebView = ReactLib.forwardRef((props: any, ref: any) => {
    mockOnMessage = props.onMessage;
    ReactLib.useImperativeHandle(ref, () => ({
      injectJavaScript: mockInjectJavaScript,
      postMessage: mockPostMessage,
    }));
    return <View testID="mock-webview" />;
  });
  return {__esModule: true, default: MockWebView, WebView: MockWebView};
});

const YoutubeIframe = require('react-native-youtube-iframe').default;

async function sendReady() {
  await act(async () => {
    mockOnMessage?.({
      nativeEvent: {data: JSON.stringify({eventType: 'playerReady'})},
    });
  });
}

describe('react-native-youtube-iframe patch', () => {
  beforeEach(() => {
    mockInjectJavaScript.mockClear();
    mockPostMessage.mockClear();
    mockOnMessage = undefined;
  });

  it('drives play, pause and speed through injectJavaScript', async () => {
    let tree!: ReactTestRenderer.ReactTestRenderer;
    await act(async () => {
      tree = ReactTestRenderer.create(
        <YoutubeIframe height={200} videoId="abc123" play={false} />,
      );
    });
    await sendReady();

    expect(mockInjectJavaScript).toHaveBeenCalledWith(
      'player.pauseVideo(); true;',
    );
    expect(mockInjectJavaScript).toHaveBeenCalledWith(
      'player.setPlaybackRate(1); true;',
    );

    mockInjectJavaScript.mockClear();
    await act(async () => {
      tree.update(
        <YoutubeIframe
          height={200}
          videoId="abc123"
          play
          playbackRate={0.75}
        />,
      );
    });

    expect(mockInjectJavaScript).toHaveBeenCalledWith(
      'player.playVideo(); true;',
    );
    expect(mockInjectJavaScript).toHaveBeenCalledWith(
      'player.setPlaybackRate(0.75); true;',
    );
    expect(mockPostMessage).not.toHaveBeenCalled();
  });
});
