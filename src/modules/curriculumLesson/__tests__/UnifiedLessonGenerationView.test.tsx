import React from 'react';
import ReactTestRenderer, {act} from 'react-test-renderer';
import {FeatureFlagProvider} from '@/release';
import {makeTestReleaseConfig, THEME_UI_FLAGS} from '@/test-support';
import {AppThemeProvider} from '@ui/theme/index';
import {trackEvent} from '@modules/analytics';
import {UnifiedLessonGenerationView} from '../UnifiedLessonGenerationScreen';
import type {LessonGenerationJob} from '../lessonJobClient';

jest.mock('@modules/analytics', () => ({
  trackEvent: jest.fn(),
}));

const tracked = trackEvent as jest.Mock;

const JOB_ID = '00000000-0000-4000-8000-000000000070';

function pollingJob(
  status: LessonGenerationJob['status'],
  overrides: Partial<LessonGenerationJob> = {},
): LessonGenerationJob {
  return {
    id: JOB_ID,
    status,
    revision: 2,
    pollAfterMs: 1000,
    lessonId: null,
    chunks: [],
    units: [],
    error: null,
    warnings: [],
    ...overrides,
  };
}

const FAILED_CHUNK_PART = {
  kind: 'chunk' as const,
  chunk: {
    id: 'c1',
    status: 'failed' as const,
    attempts: 2,
    errorCode: 'AI_UNIT_INVALID_OUTPUT',
    retryable: true,
    revision: 2,
  },
};

const FAILED_UNIT_PART = {
  kind: 'unit' as const,
  unit: {
    key: 'grammar',
    status: 'failed' as const,
    attempts: 1,
    errorCode: 'X',
    retryable: true,
    revision: 2,
  },
};

const FAILED_PARTS = [FAILED_CHUNK_PART, FAILED_UNIT_PART];

function renderView(
  props: Partial<React.ComponentProps<typeof UnifiedLessonGenerationView>> = {},
) {
  const allProps: React.ComponentProps<typeof UnifiedLessonGenerationView> = {
    generation: {status: 'polling', job: null},
    canRetry: false,
    retrying: false,
    notice: null,
    onRetry: jest.fn(),
    onBack: jest.fn(),
    parts: [],
    retryingPart: null,
    onRetryPart: jest.fn(),
    ...props,
  };
  let tree!: ReactTestRenderer.ReactTestRenderer;
  act(() => {
    tree = ReactTestRenderer.create(
      <FeatureFlagProvider
        releaseConfig={makeTestReleaseConfig(THEME_UI_FLAGS)}
      >
        <AppThemeProvider>
          <UnifiedLessonGenerationView {...allProps} />
        </AppThemeProvider>
      </FeatureFlagProvider>,
    );
  });
  return {tree, props: allProps};
}

beforeEach(() => {
  tracked.mockClear();
});

describe('UnifiedLessonGenerationView', () => {
  it('renders progress while the job is active', () => {
    const {tree} = renderView({
      generation: {status: 'polling', job: pollingJob('partially_ready')},
    });
    expect(
      tree.root.findByProps({testID: 'unified-generation-progress'}),
    ).toBeDefined();
    expect(
      tree.root.findAllByProps({testID: 'unified-generation-retry'}),
    ).toHaveLength(0);
  });

  it('renders an opening state once materialized', () => {
    const {tree} = renderView({
      generation: {
        status: 'succeeded',
        job: pollingJob('ready'),
        lessonId: JOB_ID,
      },
    });
    expect(
      tree.root.findByProps({testID: 'unified-generation-opening'}),
    ).toBeDefined();
  });

  it('renders failure with retry and warning count', () => {
    const onRetry = jest.fn();
    const {tree} = renderView({
      generation: {
        status: 'failed',
        job: {
          ...pollingJob('failed'),
          error: {code: 'X', message: 'Boom.'},
          warnings: [{code: 'W', unit: null, message_vi: 'Cảnh báo'}],
        },
        error: {
          ok: false,
          kind: 'server-error',
          errorCode: 'X',
          message: 'Boom.',
          retryable: true,
        },
      },
      canRetry: true,
      onRetry,
    });
    expect(
      tree.root.findByProps({testID: 'unified-generation-failed'}),
    ).toBeDefined();
    expect(
      tree.root.findByProps({testID: 'unified-generation-error'}).props
        .children,
    ).toBe('Boom.');
    expect(
      tree.root.findByProps({testID: 'unified-generation-warnings'}),
    ).toBeDefined();
    act(() => {
      tree.root
        .findByProps({testID: 'unified-generation-retry'})
        .props.onPress();
    });
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('lists failed parts with targeted retry actions and progress', () => {
    const onRetryPart = jest.fn();
    const {tree} = renderView({
      generation: {
        status: 'polling',
        job: pollingJob('partially_ready', {
          chunks: [
            {
              id: 'c0',
              status: 'ready',
              attempts: 1,
              errorCode: null,
              retryable: false,
              revision: 1,
            },
            FAILED_CHUNK_PART.chunk,
          ],
          units: [FAILED_UNIT_PART.unit],
        }),
      },
      parts: FAILED_PARTS,
      onRetryPart,
    });
    expect(
      tree.root.findByProps({testID: 'unified-generation-failed-parts'}),
    ).toBeDefined();
    expect(
      tree.root.findByProps({testID: 'unified-generation-parts-progress'}).props
        .children,
    ).toBe('1 of 3 parts ready.');
    const chunkButton = tree.root.findByProps({
      testID: 'unified-generation-retry-chunk-c1',
    });
    expect(chunkButton.props.accessibilityLabel).toBe('Retry Section c1');
    expect(chunkButton.props.accessibilityState).toMatchObject({
      disabled: false,
    });
    const unitButton = tree.root.findByProps({
      testID: 'unified-generation-retry-unit-grammar',
    });
    expect(unitButton.props.accessibilityLabel).toBe('Retry Grammar');
    act(() => {
      unitButton.props.onPress();
    });
    expect(onRetryPart).toHaveBeenCalledWith({kind: 'unit', key: 'grammar'});
  });

  it('disables part actions while a retry is in flight', () => {
    const {tree} = renderView({
      generation: {
        status: 'failed',
        job: pollingJob('failed', {
          chunks: [FAILED_CHUNK_PART.chunk],
          error: {code: 'X', message: 'Boom.'},
        }),
        error: {
          ok: false,
          kind: 'server-error',
          errorCode: 'X',
          message: 'Boom.',
          retryable: true,
        },
      },
      canRetry: true,
      parts: [FAILED_CHUNK_PART],
      retryingPart: {kind: 'chunk', id: 'c1'},
    });
    const button = tree.root.findByProps({
      testID: 'unified-generation-retry-chunk-c1',
    });
    expect(button.props.accessibilityState).toMatchObject({disabled: true});
    expect(button.props.disabled).toBe(true);
  });

  it('hides the failed-parts section when no part needs retry', () => {
    const {tree} = renderView({
      generation: {
        status: 'polling',
        job: pollingJob('partially_ready'),
      },
    });
    expect(
      tree.root.findAllByProps({testID: 'unified-generation-failed-parts'}),
    ).toHaveLength(0);
  });

  it('hides retry when creation context is missing and shows notices', () => {
    const {tree} = renderView({
      generation: {
        status: 'failed',
        job: null,
        error: {
          ok: false,
          kind: 'network-error',
          errorCode: 'NETWORK_ERROR',
          message: 'Down.',
          retryable: true,
        },
      },
      canRetry: false,
      notice: 'Retry creation failed.',
    });
    expect(
      tree.root.findAllByProps({testID: 'unified-generation-retry'}),
    ).toHaveLength(0);
    expect(
      tree.root.findByProps({testID: 'unified-generation-notice'}).props
        .children,
    ).toBe('Retry creation failed.');
  });
});
