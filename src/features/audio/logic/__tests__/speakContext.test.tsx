import {jest} from '@jest/globals';
import React from 'react';
import ReactTestRenderer, {act} from 'react-test-renderer';

const mockSpeak =
  jest.fn<(text: string, ...options: unknown[]) => Promise<unknown>>();

jest.mock('../ttsService', () => ({
  speak: (text: string, ...options: unknown[]) => mockSpeak(text, ...options),
}));

import {SpeakContext, type SpeakText, useScreenSpeak} from '../speakContext';

let latest: SpeakText;

function Probe() {
  latest = useScreenSpeak();
  return null;
}

describe('useScreenSpeak', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("uses the screen's speak when a screen provides one", async () => {
    const screenSpeak = jest.fn<SpeakText>();
    await act(async () => {
      ReactTestRenderer.create(
        <SpeakContext.Provider value={screenSpeak}>
          <Probe />
        </SpeakContext.Provider>,
      );
    });

    latest('ship', 0.3);
    expect(screenSpeak).toHaveBeenCalledWith('ship', 0.3);
    expect(mockSpeak).not.toHaveBeenCalled();
  });

  it('still speaks without a screen, and a failure stays silent', async () => {
    mockSpeak.mockRejectedValueOnce(new Error('boom'));
    await act(async () => {
      ReactTestRenderer.create(<Probe />);
    });

    await act(async () => {
      latest('ship');
    });
    expect(mockSpeak).toHaveBeenCalledWith('ship', undefined, undefined);
  });
});
