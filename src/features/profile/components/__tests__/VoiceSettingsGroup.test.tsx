import React from 'react';
import ReactTestRenderer from 'react-test-renderer';

import {AppThemeProvider} from '@ui/theme';

import {FeatureFlagProvider} from '@core/release';

import {VOICE_PREVIEW_TEXT} from '../../logic/useVoiceSettings';
import {VoiceSettingsGroup} from '../VoiceSettingsGroup';

const mockListEnUsVoices = jest.fn();
const mockGetPreferredVoiceId = jest.fn();
const mockSetPreferredVoiceId = jest.fn(async (_id: string | null) => {});
const mockPreviewVoice = jest.fn(async (_id: string, _text: string) => ({
  ok: true,
}));

jest.mock('@features/audio', () => ({
  listEnUsVoices: () => mockListEnUsVoices(),
  getPreferredVoiceId: () => mockGetPreferredVoiceId(),
  setPreferredVoiceId: (id: string | null) => mockSetPreferredVoiceId(id),
  previewVoice: (id: string, text: string) => mockPreviewVoice(id, text),
}));

const VOICES = [
  {id: 'zoe', name: 'Zoe', tier: 'premium', networkRequired: false},
  {id: 'ava', name: 'Ava', tier: 'enhanced', networkRequired: false},
  {id: 'net', name: 'Net', tier: 'standard', networkRequired: true},
];

async function render() {
  let tree!: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(async () => {
    tree = ReactTestRenderer.create(
      <FeatureFlagProvider>
        <AppThemeProvider>
          <VoiceSettingsGroup />
        </AppThemeProvider>
      </FeatureFlagProvider>,
    );
  });
  return tree;
}

function option(tree: ReactTestRenderer.ReactTestRenderer, testID: string) {
  return tree.root.find(
    node => node.props.testID === testID && node.props.onPress,
  );
}

describe('VoiceSettingsGroup', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockListEnUsVoices.mockResolvedValue({
      ok: true,
      voices: VOICES,
      recommendedId: 'zoe',
    });
    mockGetPreferredVoiceId.mockResolvedValue(null);
  });

  it('lists voices with tiers and marks automatic as selected', async () => {
    const tree = await render();
    const text = JSON.stringify(tree.toJSON());

    expect(text).toContain('Tự động');
    expect(text).toContain('Đang dùng: Zoe');
    expect(text).toContain('Premium');
    expect(text).toContain('Nâng cao');
    expect(text).toContain('Cần mạng');
    expect(option(tree, 'voice-option-auto').props.accessibilityState).toEqual({
      selected: true,
    });
  });

  it('saves and previews a chosen voice', async () => {
    const tree = await render();

    await ReactTestRenderer.act(async () => {
      option(tree, 'voice-option-1').props.onPress();
    });

    expect(mockSetPreferredVoiceId).toHaveBeenCalledWith('ava');
    expect(mockPreviewVoice).toHaveBeenCalledWith('ava', VOICE_PREVIEW_TEXT);
    expect(option(tree, 'voice-option-1').props.accessibilityState).toEqual({
      selected: true,
    });
  });

  it('previews without changing the saved voice', async () => {
    const tree = await render();

    await ReactTestRenderer.act(async () => {
      option(tree, 'voice-option-2-preview').props.onPress();
    });

    expect(mockPreviewVoice).toHaveBeenCalledWith('net', VOICE_PREVIEW_TEXT);
    expect(mockSetPreferredVoiceId).not.toHaveBeenCalled();
  });

  it('returns to automatic and previews the recommended voice', async () => {
    mockGetPreferredVoiceId.mockResolvedValue('ava');
    const tree = await render();
    expect(option(tree, 'voice-option-1').props.accessibilityState).toEqual({
      selected: true,
    });

    await ReactTestRenderer.act(async () => {
      option(tree, 'voice-option-auto').props.onPress();
    });

    expect(mockSetPreferredVoiceId).toHaveBeenCalledWith(null);
    expect(mockPreviewVoice).toHaveBeenCalledWith('zoe', VOICE_PREVIEW_TEXT);
  });

  it('treats a saved voice that is no longer installed as automatic', async () => {
    mockGetPreferredVoiceId.mockResolvedValue('removed-voice');
    const tree = await render();

    expect(option(tree, 'voice-option-auto').props.accessibilityState).toEqual({
      selected: true,
    });
  });

  it('explains when the device has no en-US voice', async () => {
    mockListEnUsVoices.mockResolvedValue({
      ok: true,
      voices: [],
      recommendedId: null,
    });
    const tree = await render();

    expect(JSON.stringify(tree.toJSON())).toContain(
      'Máy chưa có giọng tiếng Anh (Mỹ) để đọc bài.',
    );
  });
});
