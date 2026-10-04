import React from 'react';
import ReactTestRenderer, {act} from 'react-test-renderer';

import {AppThemeProvider} from '@ui/theme';

import {FeatureFlagProvider} from '@core/release';

import {ShadowingSummaryScreen} from '../ShadowingSummaryScreen';

const LESSON_ID = '11111111-1111-4111-8111-111111111111';

const baseParams = {
  lessonId: LESSON_ID,
  lessonTitle: 'Bài demo',
  savedCount: 12,
  failedCount: 3,
  elapsedMs: 125_000,
  failedSentences: [
    {
      sentenceId: '22222222-2222-4222-8222-222222222221',
      textEn: 'Line one',
      recordingId: 'rec-1',
      localFilePath: '/local/rec-1.m4a',
      serverRecordingId: null,
      uploadPending: false,
    },
    {
      sentenceId: '22222222-2222-4222-8222-222222222222',
      textEn: 'Line two',
      recordingId: 'rec-2',
      localFilePath: '/local/rec-2.m4a',
      serverRecordingId: null,
      uploadPending: true,
    },
    {
      sentenceId: '22222222-2222-4222-8222-222222222223',
      textEn: 'Line three',
      recordingId: 'rec-3',
      localFilePath: null,
      serverRecordingId: '55555555-5555-4555-8555-555555555555',
      uploadPending: false,
    },
  ],
};

function renderSummary(
  params: typeof baseParams = baseParams,
  navigation = {goBack: jest.fn(), navigate: jest.fn()},
) {
  let tree!: ReactTestRenderer.ReactTestRenderer;
  act(() => {
    tree = ReactTestRenderer.create(
      <FeatureFlagProvider releaseConfig={{releaseName: 'test', features: {}}}>
        <AppThemeProvider>
          <ShadowingSummaryScreen
            navigation={navigation as never}
            route={{params} as never}
          />
        </AppThemeProvider>
      </FeatureFlagProvider>,
    );
  });
  return {tree, navigation};
}

describe('ShadowingSummaryScreen', () => {
  it('AC-013 S1: shows saved count, failed count, elapsed time, and review rows', () => {
    const {tree} = renderSummary();
    const root = tree.root;
    expect(
      root.findByProps({testID: 'shadowing-summary-saved-count'}).props
        .children,
    ).toBe(12);
    expect(
      root.findByProps({testID: 'shadowing-summary-failed-count'}).props
        .children,
    ).toBe(3);
    expect(
      root.findByProps({testID: 'shadowing-summary-elapsed'}).props.children,
    ).toBe('02:05');
    expect(
      root.findByProps({testID: 'shadowing-summary-failed-list'}),
    ).toBeTruthy();
    expect(
      root.findAll(
        node =>
          node.props.children === 'Đã thêm vào Ôn tập' ||
          (Array.isArray(node.props.children) &&
            node.props.children.includes('Đã thêm vào Ôn tập')),
      ).length,
    ).toBeGreaterThanOrEqual(3);
  });

  it('AC-013 S2: hides the failed list when there are zero failed sentences', () => {
    const {tree} = renderSummary({
      ...baseParams,
      failedCount: 0,
      failedSentences: [],
    });
    expect(
      tree.root.findAll(
        node => node.props.testID === 'shadowing-summary-failed-list',
      ),
    ).toHaveLength(0);
  });
});
