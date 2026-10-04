import React from 'react';
import ReactTestRenderer, {act} from 'react-test-renderer';

import {AppThemeProvider} from '@ui/theme';

import {FeatureFlagProvider} from '@core/release';

const mockAuthenticatedFetch = jest.fn();

jest.mock('@core/api/authenticatedFetch', () => ({
  authenticatedFetch: (...args: unknown[]) => mockAuthenticatedFetch(...args),
}));

import {
  configureRemoteRecordingPlayback,
  playSummarySentenceRecording,
  resetRemoteRecordingPlaybackForTests,
} from '../../logic/upload/remoteRecordingPlayback';
import {ShadowingSummaryScreen} from '../ShadowingSummaryScreen';

const SERVER_RECORDING_ID = '55555555-5555-4555-8555-555555555555';

const baseRow = {
  sentenceId: '22222222-2222-4222-8222-222222222221',
  textEn: 'Line one',
  recordingId: 'rec-1',
  localFilePath: '/local/rec-1.m4a',
  serverRecordingId: null as string | null,
  uploadPending: false,
};

function paramsFor(row: typeof baseRow) {
  return {
    lessonId: '11111111-1111-4111-8111-111111111111',
    lessonTitle: 'Bài demo',
    savedCount: 0,
    failedCount: 1,
    elapsedMs: 1_000,
    failedSentences: [row],
  };
}

async function renderSummary(row: typeof baseRow) {
  let tree!: ReactTestRenderer.ReactTestRenderer;
  await act(async () => {
    tree = ReactTestRenderer.create(
      <FeatureFlagProvider releaseConfig={{releaseName: 'test', features: {}}}>
        <AppThemeProvider>
          <ShadowingSummaryScreen
            navigation={{goBack: jest.fn(), navigate: jest.fn()}}
            route={{params: paramsFor(row)} as never}
          />
        </AppThemeProvider>
      </FeatureFlagProvider>,
    );
    await Promise.resolve();
  });
  return tree;
}

function playButtons(tree: ReactTestRenderer.ReactTestRenderer) {
  return tree.root.findAll(
    node =>
      node.props.testID === `shadowing-summary-play-${baseRow.sentenceId}`,
  );
}

async function pressPlay(tree: ReactTestRenderer.ReactTestRenderer) {
  const button = playButtons(tree)[0];
  expect(button).toBeDefined();
  await act(async () => {
    button.props.onPress();
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe('LING-245 adversarial playback source loss', () => {
  beforeEach(() => {
    resetRemoteRecordingPlaybackForTests();
    mockAuthenticatedFetch.mockReset();
  });

  it('ADV-003 / AC-030 S1: an empty Server response is not cached and played as audio', async () => {
    const persistedPaths = new Set<string>();
    const playLocal = jest.fn();
    mockAuthenticatedFetch.mockResolvedValue({
      ok: true,
      text: async () => '',
    });
    configureRemoteRecordingPlayback({
      fileExists: async path => persistedPaths.has(path),
      writeFile: async path => {
        persistedPaths.add(path);
      },
      playLocal,
    });

    await playSummarySentenceRecording({
      recordingId: 'rec-1',
      localFilePath: null,
      serverRecordingId: SERVER_RECORDING_ID,
    });

    expect(playLocal.mock.calls.length).toBeLessThanOrEqual(0);
  });

  it('ADV-004 / AC-030 S2: local deletion between visibility and press removes the dead Play control', async () => {
    const fileExists = jest
      .fn()
      .mockResolvedValueOnce(true)
      .mockResolvedValue(false);
    configureRemoteRecordingPlayback({fileExists, playLocal: jest.fn()});
    const tree = await renderSummary(baseRow);

    await pressPlay(tree);

    expect(playButtons(tree).length).toBeLessThanOrEqual(0);
  });

  it('ADV-005 / AC-030 S2: a corrupt local recording removes the dead Play control', async () => {
    configureRemoteRecordingPlayback({
      fileExists: async () => true,
      playLocal: jest.fn().mockRejectedValue(new Error('corrupt audio')),
    });
    const tree = await renderSummary(baseRow);

    await pressPlay(tree);

    expect(playButtons(tree).length).toBeLessThanOrEqual(0);
  });

  it('ADV-006 / AC-030 S2: an unavailable Server recording removes the dead Play control', async () => {
    mockAuthenticatedFetch.mockResolvedValue({ok: false, status: 404});
    configureRemoteRecordingPlayback({fileExists: async () => false});
    const tree = await renderSummary({
      ...baseRow,
      localFilePath: null,
      serverRecordingId: SERVER_RECORDING_ID,
    });

    await pressPlay(tree);

    expect(playButtons(tree).length).toBeLessThanOrEqual(0);
  });
});
