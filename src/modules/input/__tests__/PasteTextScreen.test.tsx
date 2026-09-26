import React from 'react';
import {Text, TextInput} from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import {FeatureFlagProvider} from '@/release';
import i18n from '@/i18n';
import {AppThemeProvider} from '@theme';
import {PasteTextScreen} from '../PasteTextScreen';

const mockNavigate = jest.fn();

jest.mock('@modules/analytics', () => ({
  trackEvent: jest.fn(),
  getTextLengthBucket: () => '1-100',
}));

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

const mockTabNavigate = jest.fn();
const mockCreateGenerationJob = jest.fn();

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

const navigation = {
  navigate: mockNavigate,
  setParams: jest.fn(),
  getParent: () => ({navigate: mockTabNavigate}),
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

describe('PasteTextScreen', () => {
  beforeEach(() => {
    mockNavigate.mockReset();
    mockTabNavigate.mockReset();
    mockCreateGenerationJob.mockResolvedValue({
      ok: true,
      job: {id: 'job-1'},
    });
  });

  it('navigates to Analyzing with the confirmed text and paste source', async () => {
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

    expect(mockTabNavigate).toHaveBeenCalledWith('Lessons', {
      screen: 'UnifiedLessonGeneration',
      params: {
        jobId: 'job-1',
        confirmedText: 'We are offering a special discount for new customers.',
        level: undefined,
      },
    });
  });

  it('starts empty with a placeholder and clears entered text', async () => {
    let tree!: ReactTestRenderer.ReactTestRenderer;

    await ReactTestRenderer.act(async () => {
      tree = renderPasteTextScreen();
    });

    const input = tree!.root.findByType(TextInput);
    expect(input.props.value).toBe('');
    expect(input.props.placeholder).toBe('Dán đoạn text của bạn vào đây…');

    await ReactTestRenderer.act(async () => {
      input.props.onChangeText('Text to clear');
    });
    await ReactTestRenderer.act(async () => {
      tree!.root
        .findByProps({accessibilityLabel: 'Xóa văn bản'})
        .props.onPress();
    });

    expect(tree!.root.findByType(TextInput).props.value).toBe('');
  });

  it('hides detection, gates CTA, and marks controls disabled while empty (SETE-264)', async () => {
    let tree!: ReactTestRenderer.ReactTestRenderer;

    await ReactTestRenderer.act(async () => {
      tree = renderPasteTextScreen();
    });

    const detectionChips = () =>
      tree!.root
        .findAllByType(Text)
        .filter(node => node.props.children === 'Phát hiện: Tiếng Anh');
    const helperTexts = () =>
      tree!.root
        .findAllByType(Text)
        .filter(
          node =>
            node.props.children === 'Cần ít nhất 1 từ để trích xuất từ vựng.',
        );
    const cta = () => findPressableByLabel(tree!.root, 'Trích xuất từ vựng')!;
    const clear = () => findPressableByLabel(tree!.root, 'Xóa văn bản')!;

    expect(detectionChips()).toHaveLength(0);
    expect(helperTexts()).toHaveLength(1);

    expect(cta().props.disabled).toBe(true);
    expect(cta().props.accessibilityState).toEqual({disabled: true});
    expect(cta().props.style({pressed: false})[0].opacity).toBeLessThan(1);

    expect(clear().props.disabled).toBe(true);
    expect(clear().props.accessibilityState).toEqual({disabled: true});
    expect(clear().props.style({pressed: false}).opacity).toBeLessThan(1);

    const input = tree!.root.findByType(TextInput);
    await ReactTestRenderer.act(async () => {
      input.props.onChangeText('Hello world');
    });

    expect(detectionChips()).toHaveLength(1);
    expect(helperTexts()).toHaveLength(0);

    expect(cta().props.disabled).toBe(false);
    expect(cta().props.accessibilityState).toEqual({disabled: false});
    expect(cta().props.style({pressed: false})[0].opacity).toBe(1);

    expect(clear().props.disabled).toBe(false);
    expect(clear().props.accessibilityState).toEqual({disabled: false});
    expect(clear().props.style({pressed: false}).opacity).toBe(1);
  });

  it('blocks empty submission and does not navigate (TC-008)', async () => {
    let tree!: ReactTestRenderer.ReactTestRenderer;

    await ReactTestRenderer.act(async () => {
      tree = renderPasteTextScreen();
    });

    const input = tree!.root.findByType(TextInput);
    await ReactTestRenderer.act(async () => {
      input.props.onChangeText('   ');
    });

    const analyzeButton = findPressableByLabel(
      tree!.root,
      'Trích xuất từ vựng',
    );
    await ReactTestRenderer.act(async () => {
      analyzeButton?.props.onPress();
      await flushPromises();
    });

    expect(mockNavigate).not.toHaveBeenCalled();
    expect(JSON.stringify(tree!.toJSON())).toContain(
      i18n.t('errors.empty_input'),
    );
  });
});
