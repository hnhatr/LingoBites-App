import React from 'react';
import {Image, Text, TextInput} from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import {FeatureFlagProvider} from '@/release';
import {AppThemeProvider} from '@theme';
import {OCRReviewScreen} from '../OCRReviewScreen';

const mockNavigate = jest.fn();
const mockCreateGenerationJob = jest.fn();
const mockTabNavigate = jest.fn();

jest.mock('../OCRService', () => ({
  extractText: jest.fn(),
}));

jest.mock('@modules/curriculumLesson', () => {
  const actual = jest.requireActual('@modules/curriculumLesson');
  return {
    ...actual,
    useLessonServerCapabilities: () => ({
      catalog: true,
      canonicalDelivery: true,
      aiMaterialization: true,
      packagedImport: true,
      partialRetry: true,
      privateLibrary: true,
    }),
    createLessonGenerationJob: (...args: unknown[]) =>
      mockCreateGenerationJob(...args),
  };
});

function findPressableByLabel(
  root: ReactTestRenderer.ReactTestInstance,
  label: string,
) {
  const textNode = root
    .findAllByType(Text)
    .find(node => node.props.children === label);

  let current = textNode?.parent;
  while (current && typeof current.props.onPress !== 'function') {
    current = current.parent;
  }

  return current;
}

async function flushPromises() {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

const navigation = {
  navigate: mockNavigate,
  setParams: jest.fn(),
  getParent: () => ({navigate: mockTabNavigate}),
} as unknown as React.ComponentProps<typeof OCRReviewScreen>['navigation'];

const route = {
  key: 'OCRReview',
  name: 'OCRReview',
  params: {
    imageUri: 'file:///sample.jpg',
    sourceType: 'gallery' as const,
    extractedText: 'Original OCR text.',
    warnings: [],
  },
} as React.ComponentProps<typeof OCRReviewScreen>['route'];

describe('OCRReviewScreen', () => {
  beforeEach(() => {
    mockNavigate.mockReset();
    mockTabNavigate.mockReset();
    mockCreateGenerationJob.mockReset();
    mockCreateGenerationJob.mockResolvedValue({
      ok: true,
      job: {id: 'job-ocr-1'},
    });
  });

  it('navigates to UnifiedLessonGeneration with edited confirmed text and gallery source (TC-006)', async () => {
    let tree!: ReactTestRenderer.ReactTestRenderer;

    await ReactTestRenderer.act(async () => {
      tree = ReactTestRenderer.create(
        <FeatureFlagProvider releaseConfig={{releaseName: 'test', features: {}}}>
          <AppThemeProvider>
            <OCRReviewScreen navigation={navigation} route={route} />
          </AppThemeProvider>
        </FeatureFlagProvider>,
      );
    });

    const input = tree!.root.findByType(TextInput);
    await ReactTestRenderer.act(async () => {
      input.props.onChangeText('Edited OCR text.');
    });

    const analyzeButton = findPressableByLabel(
      tree!.root,
      'Phân tích & học ngay',
    );

    await ReactTestRenderer.act(async () => {
      analyzeButton?.props.onPress();
      await flushPromises();
    });

    expect(mockTabNavigate).toHaveBeenCalledWith('Lessons', {
      screen: 'UnifiedLessonGeneration',
      params: {
        jobId: 'job-ocr-1',
        confirmedText: 'Edited OCR text.',
        level: undefined,
      },
    });
  });

  it('renders correctly and does not crash when extractedText is undefined', async () => {
    const routeWithUndefinedText = {
      ...route,
      params: {
        ...route.params,
        extractedText: undefined as unknown as string,
      },
    };

    let tree!: ReactTestRenderer.ReactTestRenderer;

    await ReactTestRenderer.act(async () => {
      tree = ReactTestRenderer.create(
        <FeatureFlagProvider releaseConfig={{releaseName: 'test', features: {}}}>
          <AppThemeProvider>
            <OCRReviewScreen
              navigation={navigation}
              route={routeWithUndefinedText}
            />
          </AppThemeProvider>
        </FeatureFlagProvider>,
      );
    });

    const input = tree!.root.findByType(TextInput);
    expect(input.props.value).toBe('');
  });

  it('marks the source preview image as exempt from smart invert', async () => {
    let tree!: ReactTestRenderer.ReactTestRenderer;

    await ReactTestRenderer.act(async () => {
      tree = ReactTestRenderer.create(
        <FeatureFlagProvider releaseConfig={{releaseName: 'test', features: {}}}>
          <AppThemeProvider>
            <OCRReviewScreen navigation={navigation} route={route} />
          </AppThemeProvider>
        </FeatureFlagProvider>,
      );
    });

    expect(tree!.root.findByType(Image).props).toMatchObject({
      accessibilityIgnoresInvertColors: true,
    });
  });
});
