import React from 'react';
import {Image, Text} from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import {FeatureFlagProvider} from '@core/release/index';
import {AppThemeProvider} from '@ui/theme/index';
import {extractText} from '../../../ocr';
import {pickImageFromGallery} from '../../logic/imagePicker';
import {ImageCaptureScreen} from '../ImageCaptureScreen';

jest.mock('../../../ocr', () => ({
  extractText: jest.fn(),
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

function deferredOcrResult() {
  let resolve!: (value: Awaited<ReturnType<typeof extractText>>) => void;
  const promise = new Promise<Awaited<ReturnType<typeof extractText>>>(res => {
    resolve = res;
  });
  return {promise, resolve};
}

async function flushPromises() {
  await Promise.resolve();
  await Promise.resolve();
}

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

  it('keeps the selected image exempt from smart invert after OCR fails', async () => {
    jest.mocked(extractText).mockResolvedValue({
      ok: false,
      errorCode: 'OCR_PROVIDER_ERROR',
      message: 'OCR failed',
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

  it('aborts the in-flight OCR controller on unmount and leaves navigation untouched', async () => {
    const {promise} = deferredOcrResult();
    jest.mocked(extractText).mockReturnValue(promise);
    const tree = await renderScreen();

    await ReactTestRenderer.act(async () => {
      findPressableByLabel(tree.root, 'Chạm để chọn ảnh')?.props.onPress();
    });
    await ReactTestRenderer.act(async () => {
      findPressableByLabel(tree.root, 'Trích xuất text')?.props.onPress();
    });

    const signal = jest.mocked(extractText).mock.calls[0][1] as AbortSignal;
    expect(signal.aborted).toBe(false);

    await ReactTestRenderer.act(async () => {
      tree.unmount();
    });

    expect(signal.aborted).toBe(true);
    expect(navigation.replace).not.toHaveBeenCalled();
  });

  it('ignores a cancelled OCR result that resolves after unmount', async () => {
    const {promise, resolve} = deferredOcrResult();
    jest.mocked(extractText).mockReturnValue(promise);
    const tree = await renderScreen();

    await ReactTestRenderer.act(async () => {
      findPressableByLabel(tree.root, 'Chạm để chọn ảnh')?.props.onPress();
    });
    await ReactTestRenderer.act(async () => {
      findPressableByLabel(tree.root, 'Trích xuất text')?.props.onPress();
    });

    await ReactTestRenderer.act(async () => {
      tree.unmount();
    });

    await ReactTestRenderer.act(async () => {
      resolve({ok: false, cancelled: true});
      await flushPromises();
    });

    expect(navigation.replace).not.toHaveBeenCalled();
  });

  it('does not let a superseded OCR request overwrite a newer one', async () => {
    const first = deferredOcrResult();
    const second = deferredOcrResult();
    jest
      .mocked(extractText)
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);
    const tree = await renderScreen();

    await ReactTestRenderer.act(async () => {
      findPressableByLabel(tree.root, 'Chạm để chọn ảnh')?.props.onPress();
    });

    const extractButton = findPressableByLabel(tree.root, 'Trích xuất text');
    await ReactTestRenderer.act(async () => {
      extractButton?.props.onPress();
      extractButton?.props.onPress();
    });

    const firstSignal = jest.mocked(extractText).mock
      .calls[0][1] as AbortSignal;
    const secondSignal = jest.mocked(extractText).mock
      .calls[1][1] as AbortSignal;
    expect(firstSignal.aborted).toBe(true);
    expect(secondSignal.aborted).toBe(false);

    await ReactTestRenderer.act(async () => {
      first.resolve({
        ok: true,
        extractedText: 'stale text',
        ocrRawText: 'stale text',
        warnings: [],
        quality: {
          text_length: 10,
          text_length_bucket: '1-100',
          line_count: 1,
          has_english_signal: true,
          low_confidence: false,
        },
      });
      await flushPromises();
    });

    expect(navigation.replace).not.toHaveBeenCalled();

    await ReactTestRenderer.act(async () => {
      second.resolve({
        ok: true,
        extractedText: 'fresh text',
        ocrRawText: 'fresh text',
        warnings: [],
        quality: {
          text_length: 10,
          text_length_bucket: '1-100',
          line_count: 1,
          has_english_signal: true,
          low_confidence: false,
        },
      });
      await flushPromises();
    });

    expect(navigation.replace).toHaveBeenCalledWith(
      'OCRReview',
      expect.objectContaining({extractedText: 'fresh text'}),
    );
  });
});
