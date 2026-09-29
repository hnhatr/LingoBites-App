import {
  launchCamera,
  launchImageLibrary,
  type Asset,
  type CameraOptions,
  type ImageLibraryOptions,
} from 'react-native-image-picker';

export type PickedImage = {
  uri: string;
  fileName?: string;
  type?: string;
  width?: number;
  height?: number;
};

export type ImagePickResult =
  | {ok: true; image: PickedImage}
  | {
      ok: false;
      reason: 'cancelled' | 'permission_denied' | 'error';
      message?: string;
    };

const baseOptions: CameraOptions & ImageLibraryOptions = {
  mediaType: 'photo',
  includeBase64: false,
  selectionLimit: 1,
  quality: 0.8,
  maxWidth: 2000,
  maxHeight: 2000,
};

function mapAsset(asset: Asset): PickedImage | null {
  if (!asset.uri) {
    return null;
  }

  return {
    uri: asset.uri,
    fileName: asset.fileName ?? undefined,
    type: asset.type ?? 'image/jpeg',
    width: asset.width ?? undefined,
    height: asset.height ?? undefined,
  };
}

function mapErrorCode(errorCode?: string): ImagePickResult {
  if (errorCode === 'permission') {
    return {ok: false, reason: 'permission_denied'};
  }

  if (errorCode === 'camera_unavailable') {
    return {
      ok: false,
      reason: 'error',
      message: 'Camera is not available on this device.',
    };
  }

  return {ok: false, reason: 'error'};
}

export async function pickImageFromCamera(): Promise<ImagePickResult> {
  const result = await launchCamera({
    ...baseOptions,
    cameraType: 'back',
    saveToPhotos: false,
  });

  if (result.didCancel) {
    return {ok: false, reason: 'cancelled'};
  }

  if (result.errorCode) {
    return mapErrorCode(result.errorCode);
  }

  const image = mapAsset(result.assets?.[0] ?? {});
  if (!image) {
    return {ok: false, reason: 'error'};
  }

  return {ok: true, image};
}

export async function pickImageFromGallery(): Promise<ImagePickResult> {
  const result = await launchImageLibrary(baseOptions);

  if (result.didCancel) {
    return {ok: false, reason: 'cancelled'};
  }

  if (result.errorCode) {
    return mapErrorCode(result.errorCode);
  }

  const image = mapAsset(result.assets?.[0] ?? {});
  if (!image) {
    return {ok: false, reason: 'error'};
  }

  return {ok: true, image};
}
