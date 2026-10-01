import React from 'react';
import {Text, TextInput} from 'react-native';
import ReactTestRenderer from 'react-test-renderer';

import {AppThemeProvider} from '@ui/theme';

import {FeatureFlagProvider} from '@core/release';

import {OCRReviewScreen} from '../OCRReviewScreen';

jest.mock('../../logic/OCRService', () => ({
  extractText: jest.fn(),
}));

jest.mock('@features/analytics', () => ({
  trackEvent: jest.fn(),
  getTextLengthBucket: () => '1-100',
}));

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
    <FeatureFlagProvider releaseConfig={{releaseName: 'test', features: {}}}>
      <AppThemeProvider>
        <OCRReviewScreen navigation={navigation} route={route} />
      </AppThemeProvider>
    </FeatureFlagProvider>,
  );
}

describe('OCRReviewScreen canonical creation (LING-176 TASK-008)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('opens LessonCreation with edited OCR text', async () => {
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

    expect(mockTabNavigate).toHaveBeenCalledWith('Lessons', {
      screen: 'LessonCreation',
      params: expect.objectContaining({
        initialSource: 'ocr',
        initialText: 'Edited OCR text for the lesson.',
        submissionId: expect.stringMatching(/^OCRReview-/),
      }),
    });
  });

  it('does not navigate to legacy Analyzing flow', async () => {
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

    expect(mockNavigate).not.toHaveBeenCalledWith(
      'Analyzing',
      expect.anything(),
    );
  });
});
