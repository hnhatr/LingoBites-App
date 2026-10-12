import {jest} from '@jest/globals';
import React from 'react';
import ReactTestRenderer, {act} from 'react-test-renderer';

const mockSpeak = jest.fn<(text: string) => Promise<unknown>>();
const mockStop = jest.fn(async () => ({ok: true}));

jest.mock('../ttsService', () => ({
  speak: (text: string) => mockSpeak(text),
  stop: () => mockStop(),
}));

import {useSpeak} from '../useSpeak';

type Speech = ReturnType<typeof useSpeak>;

let latest: Speech;

function Probe() {
  latest = useSpeak();
  return null;
}

async function mount() {
  let tree!: ReactTestRenderer.ReactTestRenderer;
  await act(async () => {
    tree = ReactTestRenderer.create(<Probe />);
  });
  return tree;
}

describe('useSpeak', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('keeps the failure as a notice and clears it on the next success', async () => {
    mockSpeak.mockResolvedValueOnce({
      ok: false,
      errorCode: 'VOICE_UNAVAILABLE',
    });
    await mount();

    await act(async () => {
      latest.speak('ship');
    });
    expect(latest.notice).toBe('VOICE_UNAVAILABLE');

    mockSpeak.mockResolvedValueOnce({ok: true});
    await act(async () => {
      latest.speak('sheep');
    });
    expect(latest.notice).toBeNull();
  });

  it('reports an unexpected rejection as unavailable', async () => {
    mockSpeak.mockRejectedValueOnce(new Error('boom'));
    await mount();

    await act(async () => {
      latest.speak('ship');
    });
    expect(latest.notice).toBe('UNAVAILABLE');
  });

  it('stops speech when the screen unmounts', async () => {
    const tree = await mount();
    mockStop.mockClear();

    act(() => tree.unmount());
    expect(mockStop).toHaveBeenCalled();
  });
});
