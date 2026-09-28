import {jest} from '@jest/globals';

const mockTts = {
  getInitStatus: jest.fn(async () => 'success' as const),
  voices: jest.fn(async () => [
    {id: 'en-us', name: 'English', language: 'en-US'},
  ]),
  setDefaultLanguage: jest.fn(async () => 'success' as const),
  setDefaultRate: jest.fn(async () => 'success' as const),
  speak: jest.fn(() => 'utterance-1'),
  stop: jest.fn(async () => true),
};

jest.mock('react-native-tts', () => ({default: mockTts}));

import {isEnUsVoiceAvailable, speak, stop} from '../ttsService';

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

  it('normalizes rate 1.0 to default 0.5 to keep within native iOS limits', async () => {
    await expect(speak('Hello world.', 'en-US', 1.0)).resolves.toEqual({
      ok: true,
    });
    expect(mockTts.setDefaultRate).toHaveBeenCalledWith(0.5);
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
