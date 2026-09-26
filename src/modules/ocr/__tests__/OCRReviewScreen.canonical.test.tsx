import React from 'react';
import {Text, TextInput} from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import {FeatureFlagProvider} from '@/release';
import {AppThemeProvider} from '@theme';
import {OCRReviewScreen} from '../OCRReviewScreen';

jest.mock('../OCRService', () => ({
  extractText: jest.fn(),
}));

jest.mock('@modules/analytics', () => ({
  trackEvent: jest.fn(),
  getTextLengthBucket: () => '1-100',
}));

const mockCreateGenerationJob = jest.fn();
const ALL_CAPS = {
  catalog: true,
  canonicalDelivery: true,
  aiMaterialization: true,
  packagedImport: true,
  partialRetry: true,
  privateLibrary: true,
};

// LING-41 TASK-006: ready capabilities + an injected job creator so the
// canonical creation path is deterministic without network.
jest.mock('@modules/curriculumLesson', () => {
  const actual = jest.requireActual('@modules/curriculumLesson');
  return {
    ...actual,
    useLessonServerCapabilities: () => ALL_CAPS,
    createLessonGenerationJob: (...args: unknown[]) =>
      mockCreateGenerationJob(...args),
  };
});

const createSkeleton = jest.fn();

const mockNavigate = jest.fn();
const mockTabNavigate = jest.fn();

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

function renderOCRReviewScreen() {
  return ReactTestRenderer.create(
    <FeatureFlagProvider
      releaseConfig={{releaseName: 'test', features: {}}}
    >
      <AppThemeProvider>
        <OCRReviewScreen navigation={navigation} route={route} />
      </AppThemeProvider>
    </FeatureFlagProvider>,
  );
}

describe('OCRReviewScreen canonical creation (LING-41 TASK-006)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCreateGenerationJob.mockResolvedValue({
      ok: true,
      job: {id: 'job-ocr-1'},
    });
  });

  it('creates one canonical job and opens generation progress', async () => {
    let tree!: ReactTestRenderer.ReactTestRenderer;
    await ReactTestRenderer.act(async () => {
      tree = renderOCRReviewScreen();
    });

    const input = tree!.root.findByType(TextInput);
    await ReactTestRenderer.act(async () => {
      input.props.onChangeText('Edited OCR text for the lesson.');
    });

    const analyzeButton = findPressableByLabel(
      tree!.root,
      'Phân tích & học ngay',
    );
    await ReactTestRenderer.act(async () => {
      analyzeButton?.props.onPress();
      await flushPromises();
    });

    expect(mockCreateGenerationJob).toHaveBeenCalledWith({
      confirmedText: 'Edited OCR text for the lesson.',
    });
    expect(mockTabNavigate).toHaveBeenCalledWith('Lessons', {
      screen: 'UnifiedLessonGeneration',
      params: {
        jobId: 'job-ocr-1',
        confirmedText: 'Edited OCR text for the lesson.',
        level: undefined,
      },
    });
  });

  it('makes zero v1/v2 writes on the canonical path', async () => {
    let tree!: ReactTestRenderer.ReactTestRenderer;
    await ReactTestRenderer.act(async () => {
      tree = renderOCRReviewScreen();
    });

    const analyzeButton = findPressableByLabel(
      tree!.root,
      'Phân tích & học ngay',
    );
    await ReactTestRenderer.act(async () => {
      analyzeButton?.props.onPress();
      await flushPromises();
    });

    // No v1 Analyzing navigation and no v2 skeleton request.
    expect(createSkeleton).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalledWith(
      'Analyzing',
      expect.anything(),
    );
  });
});
