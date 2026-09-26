import {uploadRecordingBackground} from '../recordingUploadWorker';
import {
  createRecordingMetadata,
  uploadRecordingBinary,
} from '@shared/api/recordingClient';
import * as RNFS from '@dr.pogodin/react-native-fs';

jest.mock('@shared/api/recordingClient', () => ({
  createRecordingMetadata: jest.fn(),
  uploadRecordingBinary: jest.fn(),
}));

jest.mock('@dr.pogodin/react-native-fs', () => ({
  stat: jest.fn(),
  hash: jest.fn(),
}));

global.fetch = jest.fn() as any;

describe('Recording Integration', () => {
  it('recording metadata + binary upload integration', async () => {
    (RNFS.stat as jest.Mock).mockResolvedValue({size: 1024});
    (RNFS.hash as jest.Mock).mockResolvedValue('fakehash123');

    const mockBlob = {size: 1024, type: 'audio/m4a'};
    (global.fetch as jest.Mock).mockResolvedValue({
      blob: async () => mockBlob,
    });

    (createRecordingMetadata as jest.Mock).mockResolvedValue({
      ok: true,
      data: {upload: {url: 'https://upload.url'}},
    });

    (uploadRecordingBinary as jest.Mock).mockResolvedValue({
      ok: true,
    });

    await uploadRecordingBackground(
      '/path/to/file.m4a',
      'lesson-1',
      'mode',
      5000,
    );

    expect(createRecordingMetadata).toHaveBeenCalledWith({
      mime_type: 'audio/m4a',
      byte_size: 1024,
      sha256: 'fakehash123',
    });

    expect(uploadRecordingBinary).toHaveBeenCalledWith(
      'https://upload.url',
      'audio/m4a',
      mockBlob,
    );
  });
});
