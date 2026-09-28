import React from 'react';
import ReactTestRenderer, {act} from 'react-test-renderer';
import {FeatureFlagProvider} from '@core/release/index';
import {AppThemeProvider} from '@ui/theme/index';
import {YouTubeProcessingScreen} from '../YouTubeProcessingScreen';

const mockRunYouTubeJob = jest.fn();
const mockSaveYouTubeLesson = jest.fn();
const mockReplace = jest.fn();
const mockNavigate = jest.fn();
const mockGoBack = jest.fn();

jest.mock('../../logic/api/youtubeApi', () => ({
  runYouTubeJob: (...args: unknown[]) => mockRunYouTubeJob(...args),
}));

jest.mock('../../logic/youtubeQueryPort', () => ({
  saveYouTubeLesson: (...args: unknown[]) => mockSaveYouTubeLesson(...args),
}));

const sampleLesson = {
  schema_version: 'youtube-transcript-v1',
  video: {
    id: 'dQw4w9WgXcQ',
    title: 'Sample video',
    channel_title: 'Sample channel',
    duration_seconds: 20,
    language: 'en',
    embeddable: true,
  },
  transcript_source: 'auto_caption',
  segments: [],
  warnings: [],
};

const navigation = {
  replace: mockReplace,
  navigate: mockNavigate,
  goBack: mockGoBack,
} as unknown as React.ComponentProps<
  typeof YouTubeProcessingScreen
>['navigation'];

const route = {
  key: 'YouTubeProcessing',
  name: 'YouTubeProcessing',
  params: {
    url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
  },
} as React.ComponentProps<typeof YouTubeProcessingScreen>['route'];

function renderScreen() {
  return ReactTestRenderer.create(
    <FeatureFlagProvider>
      <AppThemeProvider>
        <YouTubeProcessingScreen navigation={navigation} route={route} />
      </AppThemeProvider>
    </FeatureFlagProvider>,
  );
}

async function flushPromises() {
  await Promise.resolve();
  await Promise.resolve();
}

describe('YouTubeProcessingScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSaveYouTubeLesson.mockReturnValue({ok: true, lessonId: 'dQw4w9WgXcQ'});
  });

  it('surfaces job stage and percent while the job is running', async () => {
    mockRunYouTubeJob.mockImplementation(
      (
        _url: string,
        _cues: unknown,
        onProgress: (p: {percent: number; stage: string | null}) => void,
      ) => {
        onProgress({percent: 40, stage: 'Đang dịch transcript'});
        return new Promise(() => {});
      },
    );

    let tree!: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      tree = renderScreen();
    });
    await act(async () => {
      await flushPromises();
    });

    expect(
      tree.root.findByProps({testID: 'youtube-processing-stage'}).props
        .children,
    ).toBe('Đang dịch transcript');
    expect(
      tree.root.findByProps({testID: 'youtube-progress'}).props.children,
    ).toEqual([40, '%']);
  });

  it('opens the lesson without a warning when the local save succeeds (HVB-07)', async () => {
    mockRunYouTubeJob.mockResolvedValue({ok: true, lesson: sampleLesson});
    mockSaveYouTubeLesson.mockReturnValue({
      ok: true,
      lessonId: 'dQw4w9WgXcQ',
      duplicate: false,
    });

    act(() => {
      renderScreen();
    });
    await act(async () => {
      await flushPromises();
    });

    expect(mockSaveYouTubeLesson).toHaveBeenCalledTimes(1);
    expect(mockReplace).toHaveBeenCalledWith('YouTubeLesson', {
      lesson: sampleLesson,
    });
  });

  it('still opens the lesson with a save-failed flag when the local save fails (HVB-07)', async () => {
    mockRunYouTubeJob.mockResolvedValue({ok: true, lesson: sampleLesson});
    mockSaveYouTubeLesson.mockReturnValue({
      ok: false,
      errorCode: 'LOCAL_DB_ERROR',
    });

    act(() => {
      renderScreen();
    });
    await act(async () => {
      await flushPromises();
    });

    expect(mockReplace).toHaveBeenCalledWith('YouTubeLesson', {
      lesson: sampleLesson,
      saveFailed: true,
    });
  });

  it.each(['TRANSCRIPT_UNAVAILABLE', 'TRANSCRIPT_SOURCE_BLOCKED'] as const)(
    'returns to the existing YouTubeInput with merged params on %s (SETE-316)',
    async errorCode => {
      mockRunYouTubeJob.mockResolvedValue({
        ok: false,
        errorCode,
        message: 'No transcript',
      });

      act(() => {
        renderScreen();
      });
      await act(async () => {
        await flushPromises();
      });

      // Same instance (navigate + merge), never a pushed second input and
      // never a param-replacing push that would drop fromHome (SETE-287).
      expect(mockReplace).not.toHaveBeenCalled();
      expect(mockNavigate).toHaveBeenCalledWith({
        name: 'YouTubeInput',
        params: {
          url: route.params.url,
          transcriptRequired: errorCode,
        },
        merge: true,
      });
    },
  );

  it('offers retry with the same URL after failure', async () => {
    mockRunYouTubeJob.mockResolvedValue({
      ok: false,
      errorCode: 'NETWORK_ERROR',
      message: 'Mất kết nối',
    });

    let tree!: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      tree = renderScreen();
    });
    await act(async () => {
      await flushPromises();
    });

    const retry = tree.root.findByProps({testID: 'youtube-processing-retry'});
    expect(mockRunYouTubeJob).toHaveBeenCalledTimes(1);

    await act(async () => {
      retry.props.onPress();
      await flushPromises();
    });

    expect(mockRunYouTubeJob).toHaveBeenCalledTimes(2);
    expect(mockRunYouTubeJob.mock.calls[1][0]).toBe(route.params.url);
  });
});
