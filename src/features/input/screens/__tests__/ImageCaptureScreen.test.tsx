import React from 'react';
import {Image, Text} from 'react-native';
import ReactTestRenderer from 'react-test-renderer';

import {AppThemeProvider} from '@ui/theme';

import {FeatureFlagProvider} from '@core/release';

import {pickImageFromGallery} from '../../logic/imagePicker';
import {analyzeImage} from '../../logic/momentClient';
import {ensurePhotoConsent} from '../../logic/photoConsent';
import {ImageCaptureScreen} from '../ImageCaptureScreen';

jest.mock('../../logic/momentClient', () => ({
  analyzeImage: jest.fn(),
}));

jest.mock('../../logic/photoConsent', () => ({
  ensurePhotoConsent: jest.fn(),
}));

jest.mock('../../logic/imagePicker', () => ({
  pickImageFromCamera: jest.fn(),
  pickImageFromGallery: jest.fn(),
}));

const pickedImage = {
  uri: 'file:///selected.jpg',
  fileName: 'selected.jpg',
  type: 'image/jpeg',
  width: 1200,
  height: 900,
};

const navigation = {
  goBack: jest.fn(),
  navigate: jest.fn(),
  replace: jest.fn(),
};

const route = {
  key: 'ImageCapture',
  name: 'ImageCapture',
  params: {
    sourceType: 'gallery' as const,
  },
} as React.ComponentProps<typeof ImageCaptureScreen>['route'];

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

async function renderScreen() {
  let tree!: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(async () => {
    tree = ReactTestRenderer.create(
      <FeatureFlagProvider>
        <AppThemeProvider>
          <ImageCaptureScreen navigation={navigation as never} route={route} />
        </AppThemeProvider>
      </FeatureFlagProvider>,
    );
  });
  return tree;
}

describe('ImageCaptureScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(pickImageFromGallery).mockResolvedValue({
      ok: true,
      image: pickedImage,
    });
    jest.mocked(ensurePhotoConsent).mockResolvedValue(true);
  });

  it('marks the selected image preview as exempt from smart invert', async () => {
    const tree = await renderScreen();

    await ReactTestRenderer.act(async () => {
      findPressableByLabel(tree.root, 'Chạm để chọn ảnh')?.props.onPress();
    });

    expect(tree.root.findByType(Image).props).toMatchObject({
      accessibilityIgnoresInvertColors: true,
    });
  });

  it('keeps the selected image exempt from smart invert after analysis fails', async () => {
    jest.mocked(analyzeImage).mockResolvedValue({
      ok: false,
      kind: 'server-error',
      errorCode: 'OCR_PROVIDER_ERROR',
      message: 'Không đọc được ảnh lúc này.',
      retryable: true,
    });
    const tree = await renderScreen();

    await ReactTestRenderer.act(async () => {
      findPressableByLabel(tree.root, 'Chạm để chọn ảnh')?.props.onPress();
    });
    await ReactTestRenderer.act(async () => {
      findPressableByLabel(tree.root, 'Trích xuất text')?.props.onPress();
    });

    expect(tree.root.findByType(Image).props).toMatchObject({
      accessibilityIgnoresInvertColors: true,
    });
  });

  it('says the connection is lost only when no response arrived', async () => {
    jest.mocked(analyzeImage).mockResolvedValue({
      ok: false,
      kind: 'network-error',
      errorCode: 'NETWORK_ERROR',
      message: 'Network connection lost.',
      retryable: true,
    });
    const tree = await renderScreen();

    await ReactTestRenderer.act(async () => {
      findPressableByLabel(tree.root, 'Chạm để chọn ảnh')?.props.onPress();
    });
    await ReactTestRenderer.act(async () => {
      findPressableByLabel(tree.root, 'Trích xuất text')?.props.onPress();
    });

    const texts = tree.root
      .findAllByType(Text)
      .map(node => node.props.children);
    expect(texts).toContain(
      'Mất kết nối mạng. Vui lòng thử lại sau khi có mạng.',
    );
  });

  it('shows the server message for a rejected photo, not "offline"', async () => {
    jest.mocked(analyzeImage).mockResolvedValue({
      ok: false,
      kind: 'server-error',
      errorCode: 'IMAGE_TOO_LARGE',
      message: 'Ảnh quá lớn (tối đa 5242880 byte).',
      retryable: false,
      status: 400,
    });
    const tree = await renderScreen();

    await ReactTestRenderer.act(async () => {
      findPressableByLabel(tree.root, 'Chạm để chọn ảnh')?.props.onPress();
    });
    await ReactTestRenderer.act(async () => {
      findPressableByLabel(tree.root, 'Trích xuất text')?.props.onPress();
    });

    const texts = tree.root
      .findAllByType(Text)
      .map(node => node.props.children);
    expect(texts).toContain('Ảnh quá lớn (tối đa 5242880 byte).');
    expect(navigation.replace).not.toHaveBeenCalled();
  });

  it('opens the moment review with the analysis', async () => {
    const analysis = {
      request_id: 'r',
      status: 'success' as const,
      image_id: null,
      kind: 'text' as const,
      text: 'Iced latte',
      warnings: [],
      pii_lines: [],
      suggested_intent: 'understand' as const,
    };
    jest.mocked(analyzeImage).mockResolvedValue({ok: true, value: analysis});
    const tree = await renderScreen();

    await ReactTestRenderer.act(async () => {
      findPressableByLabel(tree.root, 'Chạm để chọn ảnh')?.props.onPress();
    });
    await ReactTestRenderer.act(async () => {
      findPressableByLabel(tree.root, 'Trích xuất text')?.props.onPress();
    });

    expect(navigation.replace).toHaveBeenCalledWith('MomentReview', {
      sourceType: 'gallery',
      image: pickedImage,
      analysis,
    });
  });
});
