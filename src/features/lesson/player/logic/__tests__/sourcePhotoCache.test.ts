import * as RNFS from '@dr.pogodin/react-native-fs';

import {
  cacheSourcePhoto,
  readCachedSourcePhoto,
  removeAllCachedSourcePhotos,
} from '../sourcePhoto';

const LESSON = '11111111-1111-4111-8111-111111111111';
const FILE = `/mock/Documents/source-photos/${LESSON}.jpg`;

const fs = RNFS as unknown as {
  exists: jest.Mock;
  mkdir: jest.Mock;
  unlink: jest.Mock;
  downloadFile: jest.Mock;
};

describe('offline copy of a source photo', () => {
  beforeEach(() => {
    fs.exists.mockReset();
    fs.mkdir.mockReset().mockResolvedValue(undefined);
    fs.unlink.mockReset().mockResolvedValue(undefined);
    fs.downloadFile = jest.fn(() => ({
      promise: Promise.resolve({statusCode: 200}),
    }));
  });

  it('reads the saved copy as a local file', async () => {
    fs.exists.mockResolvedValue(true);
    expect(await readCachedSourcePhoto(LESSON)).toEqual({
      uri: `file://${FILE}`,
      width: null,
      height: null,
    });
  });

  it('returns nothing when no copy was saved', async () => {
    fs.exists.mockResolvedValue(false);
    expect(await readCachedSourcePhoto(LESSON)).toBeNull();
  });

  it('downloads the photo and keeps it', async () => {
    await cacheSourcePhoto(LESSON, 'https://api.test/photo.jpg');
    expect(fs.downloadFile).toHaveBeenCalledWith({
      fromUrl: 'https://api.test/photo.jpg',
      toFile: FILE,
    });
    expect(fs.unlink).not.toHaveBeenCalled();
  });

  it('drops a failed download instead of keeping a broken file', async () => {
    fs.downloadFile = jest.fn(() => ({
      promise: Promise.resolve({statusCode: 500}),
    }));
    await cacheSourcePhoto(LESSON, 'https://api.test/photo.jpg');
    expect(fs.unlink).toHaveBeenCalledWith(FILE);
  });

  it('removes the whole cache when local data is cleared', async () => {
    fs.exists.mockResolvedValue(true);
    await removeAllCachedSourcePhotos();
    expect(fs.unlink).toHaveBeenCalledWith('/mock/Documents/source-photos');
  });
});
