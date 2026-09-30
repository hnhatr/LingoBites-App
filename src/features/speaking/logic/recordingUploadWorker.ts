/* eslint-disable @typescript-eslint/no-unused-vars */
import * as RNFS from '@dr.pogodin/react-native-fs';

import {createRequestId} from '@core/api/requestId';

import {
  createRecordingMetadata,
  uploadRecordingBinary,
} from './api/recordingClient';

export async function uploadRecordingBackground(
  filePath: string,
  lessonId: string, // Kept for interface compatibility
  mode: string,
  durationMs: number,
) {
  try {
    const stat = await RNFS.stat(filePath);
    const sha256 = await RNFS.hash(filePath, 'sha256');

    // 1. Create metadata
    const metaRes = await createRecordingMetadata({
      mime_type: 'audio/m4a',
      byte_size: Number(stat.size),
      sha256: sha256.toLowerCase(),
    });

    if (!metaRes.ok) {
      console.warn('Failed to create recording metadata', metaRes.message);
      return;
    }

    // 2. Read file to blob
    const fileUri = filePath.startsWith('file://')
      ? filePath
      : `file://${filePath}`;
    const fileRes = await fetch(fileUri);
    const blob = await fileRes.blob();

    // 3. Upload binary
    const uploadRes = await uploadRecordingBinary(
      metaRes.data.upload.url,
      'audio/m4a',
      blob,
    );

    if (!uploadRes.ok) {
      console.warn('Failed to upload recording binary', uploadRes.message);
    } else {
      console.log('Recording uploaded successfully');
    }
  } catch (error) {
    console.error('Recording upload error:', error);
  }
}
