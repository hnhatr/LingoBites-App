import React from 'react';
import {Text, TextInput} from 'react-native';
import ReactTestRenderer from 'react-test-renderer';

import {AppThemeProvider} from '@ui/theme';

import {FeatureFlagProvider} from '@core/release';

import {mockAppNavigation} from '@test/support';

import {PasteTextScreen} from '../PasteTextScreen';

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
} as unknown as React.ComponentProps<typeof PasteTextScreen>['navigation'];

const route = {
  key: 'PasteText',
  name: 'PasteText',
  params: undefined,
} as React.ComponentProps<typeof PasteTextScreen>['route'];

function renderPasteTextScreen() {
  return ReactTestRenderer.create(
    <FeatureFlagProvider releaseConfig={{releaseName: 'test', features: {}}}>
      <AppThemeProvider>
        <PasteTextScreen navigation={navigation} route={route} />
      </AppThemeProvider>
    </FeatureFlagProvider>,
  );
}

describe('PasteTextScreen canonical creation (LING-176 TASK-008)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('opens LessonCreation with validated paste text', async () => {
    let tree!: ReactTestRenderer.ReactTestRenderer;
    await ReactTestRenderer.act(async () => {
      tree = renderPasteTextScreen();
    });

    const input = tree!.root.findByType(TextInput);
    await ReactTestRenderer.act(async () => {
      input.props.onChangeText(
        'We are offering a special discount for new customers.',
      );
    });

    const analyzeButton = findPressableByLabel(
      tree!.root,
      'Trích xuất từ vựng',
    );
    await ReactTestRenderer.act(async () => {
      analyzeButton?.props.onPress();
      await flushPromises();
    });

    expect(mockAppNavigation.startCreate).toHaveBeenCalledWith({
      kind: 'text',
      text: 'We are offering a special discount for new customers.',
      submissionId: expect.stringMatching(/^PasteText-/),
    });
    expect(mockTabNavigate).not.toHaveBeenCalled();
  });

  it('does not navigate to legacy Analyzing flow', async () => {
    let tree!: ReactTestRenderer.ReactTestRenderer;
    await ReactTestRenderer.act(async () => {
      tree = renderPasteTextScreen();
    });

    const input = tree!.root.findByType(TextInput);
    await ReactTestRenderer.act(async () => {
      input.props.onChangeText('Hello world from paste.');
    });

    const analyzeButton = findPressableByLabel(
      tree!.root,
      'Trích xuất từ vựng',
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
