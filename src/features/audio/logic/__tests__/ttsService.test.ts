import {jest} from '@jest/globals';

const mockTts = {
  getInitStatus: jest.fn(async () => 'success' as const),
  voices: jest.fn(async () => [
    {id: 'en-us', name: 'English', language: 'en-US'},
  ]),
  setDefaultLanguage: jest.fn(async () => 'success' as const),
  setDefaultRate: jest.fn(async () => 'success' as const),
  setDefaultVoice: jest.fn(async () => 'success' as const),
  speak: jest.fn(() => 'utterance-1'),
  stop: jest.fn(async () => true),
};

jest.mock('react-native-tts', () => ({default: mockTts}));

import type {Voice} from 'react-native-tts';

import {
  isEnUsVoiceAvailable,
  pickBestEnUsVoice,
  speak,
  stop,
} from '../ttsService';

function voice(overrides: Partial<Voice> & {id: string}): Voice {
  return {
    name: overrides.id,
    language: 'en-US',
    quality: 300,
    latency: 300,
    networkConnectionRequired: false,
    notInstalled: false,
    ...overrides,
  };
}

describe('ttsService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockTts.voices.mockResolvedValue([
      {id: 'en-us', name: 'English', language: 'en-US'},
    ]);
  });

  it('detects an installed en-US voice and speaks with the requested rate', async () => {
    await expect(isEnUsVoiceAvailable()).resolves.toEqual({
      ok: true,
      available: true,
    });
    await expect(speak('Hello world.', 'en-US', 0.9)).resolves.toEqual({
      ok: true,
    });
    expect(mockTts.setDefaultLanguage).toHaveBeenCalledWith('en-US');
    expect(mockTts.setDefaultRate).toHaveBeenCalledWith(0.9);
    expect(mockTts.speak).toHaveBeenCalledWith('Hello world.');
  });

  it('selects the best en-US voice after setting the language', async () => {
    const order: string[] = [];
    mockTts.voices.mockResolvedValue([
      voice({id: 'com.apple.voice.compact.en-US.Samantha', quality: 300}),
      voice({id: 'com.apple.voice.enhanced.en-US.Ava', quality: 500}),
      voice({id: 'fr-voice', language: 'fr-FR', quality: 500}),
    ] as never);
    mockTts.setDefaultLanguage.mockImplementationOnce(async () => {
      order.push('language');
      return 'success';
    });
    mockTts.setDefaultVoice.mockImplementationOnce(async () => {
      order.push('voice');
      return 'success';
    });

    await expect(speak('Hello world.')).resolves.toEqual({ok: true});
    expect(mockTts.setDefaultVoice).toHaveBeenCalledWith(
      'com.apple.voice.enhanced.en-US.Ava',
    );
    expect(order).toEqual(['language', 'voice']);
  });

  it('still speaks with the language default when the voice cannot be selected', async () => {
    mockTts.setDefaultVoice.mockRejectedValueOnce(new Error('not_found'));

    await expect(speak('Hello world.')).resolves.toEqual({ok: true});
    expect(mockTts.speak).toHaveBeenCalledWith('Hello world.');
  });

  it('normalizes rate 1.0 to default 0.5 to keep within native iOS limits', async () => {
    await expect(speak('Hello world.', 'en-US', 1.0)).resolves.toEqual({
      ok: true,
    });
    expect(mockTts.setDefaultRate).toHaveBeenCalledWith(0.5);
  });

  it('stops any speech still playing before it speaks the next text', async () => {
    const order: string[] = [];
    mockTts.stop.mockImplementationOnce(async () => {
      order.push('stop');
      return true;
    });
    mockTts.speak.mockImplementationOnce(() => {
      order.push('speak');
      return 'utterance-2';
    });

    await expect(speak('Hello world.')).resolves.toEqual({ok: true});
    expect(order).toEqual(['stop', 'speak']);
  });

  it('reports a missing en-US voice without attempting speech', async () => {
    mockTts.voices.mockResolvedValue([]);

    await expect(speak('Hello world.')).resolves.toMatchObject({
      ok: false,
      errorCode: 'VOICE_UNAVAILABLE',
    });
    expect(mockTts.speak).not.toHaveBeenCalled();
  });

  it('degrades when the native adapter rejects', async () => {
    mockTts.getInitStatus.mockRejectedValueOnce(
      new Error('missing native module'),
    );

    await expect(isEnUsVoiceAvailable()).resolves.toMatchObject({
      ok: false,
      errorCode: 'UNAVAILABLE',
    });
  });

  it('stops speech and converts native stop failures into a result', async () => {
    await expect(stop()).resolves.toEqual({ok: true});
    mockTts.stop.mockRejectedValueOnce(new Error('unavailable'));
    await expect(stop()).resolves.toMatchObject({
      ok: false,
      errorCode: 'UNAVAILABLE',
    });
  });
});

describe('pickBestEnUsVoice', () => {
  it('prefers premium over enhanced over compact iOS voices', () => {
    expect(
      pickBestEnUsVoice([
        voice({id: 'com.apple.voice.compact.en-US.Samantha', quality: 300}),
        voice({id: 'com.apple.voice.premium.en-US.Zoe', quality: 300}),
        voice({id: 'com.apple.voice.enhanced.en-US.Ava', quality: 500}),
      ])?.id,
    ).toBe('com.apple.voice.premium.en-US.Zoe');
  });

  it('skips iOS novelty voices', () => {
    expect(
      pickBestEnUsVoice([
        voice({id: 'com.apple.eloquence.en-US.Rocko', quality: 500}),
        voice({id: 'com.apple.speech.synthesis.voice.Bubbles', quality: 500}),
        voice({id: 'com.apple.voice.compact.en-US.Samantha'}),
      ])?.id,
    ).toBe('com.apple.voice.compact.en-US.Samantha');
  });

  it('prefers installed offline Android voices, then higher quality', () => {
    expect(
      pickBestEnUsVoice([
        voice({
          id: 'en-us-x-iol-network',
          quality: 500,
          networkConnectionRequired: true,
        }),
        voice({id: 'en-us-x-sfg-local', quality: 400}),
        voice({id: 'en-us-x-tpf-local', quality: 500, notInstalled: true}),
        voice({id: 'en-us-x-iom-local', quality: 300}),
      ])?.id,
    ).toBe('en-us-x-sfg-local');
  });

  it('returns null when no usable en-US voice exists', () => {
    expect(
      pickBestEnUsVoice([voice({id: 'fr', language: 'fr-FR'})]),
    ).toBeNull();
  });
});
