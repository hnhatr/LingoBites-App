import {__resetMockDatabases} from '../../../../../test-utils/sqliteMock';
import {resetDatabaseForTests} from '@shared/db/database';
import {open} from 'react-native-quick-sqlite';
import {DB_NAME} from '@shared/db/constants';
import {
  insertPendingChapterAudioAsset,
  markChapterAudioAssetReady,
} from '@features/audio/logic/data/AudioAssetRepository';
import type {ChapterAudioAsset} from '@shared/db/types';
import {sha256Hex} from '@shared/utils/sha256';
import {bytesToBase64} from '../bytesToBase64';

jest.mock('@dr.pogodin/react-native-fs', () => ({
  DocumentDirectoryPath: '/mock/Documents',
  mkdir: jest.fn(async () => {}),
  writeFile: jest.fn(async () => {}),
  unlink: jest.fn(async () => {}),
  exists: jest.fn(async () => true),
}));

jest.mock('react-native-sound', () => {
  class MockSound {
    static setActive() {}
    static setCategory() {}
    static __instances: MockSound[] = [];
    filename: string;
    cb: ((error: unknown) => void) | null = null;
    playCalled = false;
    stopCalled = false;
    releaseCalled = false;
    onEnd: (() => void) | null = null;
    constructor(
      filename: string,
      _basePath?: string,
      cb?: (error: unknown) => void,
    ) {
      this.filename = filename;
      this.cb = cb ?? null;
      MockSound.__instances.push(this);
    }
    play(onEnd?: () => void) {
      this.playCalled = true;
      this.onEnd = onEnd ?? null;
      return this;
    }
    stop() {
      this.stopCalled = true;
      return this;
    }
    release() {
      this.releaseCalled = true;
      return this;
    }
  }
  return MockSound;
});

import {
  deviceChapterAudioDownloader,
  deviceChapterAudioFileStore,
  fileExtensionFromUrl,
  playReadyChapterAudio,
  readyAudioPathOnDevice,
  sanitizeFileSegment,
} from '../deviceChapterAudio';
const RNFSMock = require('@dr.pogodin/react-native-fs') as {
  DocumentDirectoryPath: string | undefined;
  mkdir: jest.Mock;
  writeFile: jest.Mock;
  unlink: jest.Mock;
  exists: jest.Mock;
};
type MockSoundInstance = {
  filename: string;
  cb: ((error: unknown) => void) | null;
  playCalled: boolean;
  stopCalled: boolean;
  releaseCalled: boolean;
  onEnd: (() => void) | null;
  play: (onEnd?: () => void) => MockSoundInstance;
};
const SoundMock = require('react-native-sound') as {
  new (filename: string): MockSoundInstance;
  __instances: MockSoundInstance[];
};
const mockSoundInstances = SoundMock.__instances;

const ASSET: ChapterAudioAsset = {
  id: 'asset-1',
  url: 'https://cdn.example.com/audio/hello.mp3',
  bytes: 5,
  checksum: 'abc',
};

describe('sanitizeFileSegment', () => {
  it('replaces unsafe path characters and never returns empty', () => {
    expect(sanitizeFileSegment('lesson/1:word')).toBe('lesson_1_word');
    expect(sanitizeFileSegment('../..')).toBe('asset');
    expect(sanitizeFileSegment('..')).toBe('asset');
    expect(sanitizeFileSegment('')).toBe('asset');
    expect(sanitizeFileSegment('a  b')).toBe('a_b');
  });
});

describe('fileExtensionFromUrl', () => {
  it('keeps the audio container extension and falls back to mp3', () => {
    expect(fileExtensionFromUrl('https://x/a.mp3?token=1')).toBe('.mp3');
    expect(fileExtensionFromUrl('https://x/a.m4a')).toBe('.m4a');
    expect(fileExtensionFromUrl('https://x/stream')).toBe('.mp3');
  });
});

describe('bytesToBase64', () => {
  it('encodes bytes with padding', () => {
    expect(bytesToBase64(new Uint8Array([104, 105]))).toBe('aGk=');
    expect(bytesToBase64(new Uint8Array([104, 101, 108, 108, 111]))).toBe(
      'aGVsbG8=',
    );
  });
});

describe('deviceChapterAudioDownloader', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('downloads, hashes and reports bytes for a manifest asset', async () => {
    const payload = new Uint8Array([104, 101, 108, 108, 111]);
    const fetchSpy = jest.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      arrayBuffer: async () =>
        payload.buffer.slice(
          payload.byteOffset,
          payload.byteOffset + payload.byteLength,
        ),
    } as unknown as Response);

    const result = await deviceChapterAudioDownloader.download({
      chapterId: 'ch1',
      asset: {...ASSET, checksum: sha256Hex('hello')},
    });

    expect(fetchSpy).toHaveBeenCalledWith(ASSET.url, {method: 'GET'});
    expect(result.bytes).toBe(5);
    expect(result.checksum).toBe(sha256Hex('hello'));
    expect(result.data).toBeInstanceOf(Uint8Array);
  });

  it('rejects with HTTP_ERROR on a non-2xx response', async () => {
    jest.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      status: 404,
    } as unknown as Response);

    await expect(
      deviceChapterAudioDownloader.download({chapterId: 'ch1', asset: ASSET}),
    ).rejects.toThrow('HTTP_ERROR:404');
  });

  it('rejects with FETCH_FAILED when the network is down', async () => {
    jest.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('offline'));

    await expect(
      deviceChapterAudioDownloader.download({chapterId: 'ch1', asset: ASSET}),
    ).rejects.toThrow('FETCH_FAILED');
  });
});

describe('deviceChapterAudioFileStore', () => {
  beforeEach(() => {
    RNFSMock.mkdir.mockClear();
    RNFSMock.writeFile.mockClear();
    RNFSMock.unlink.mockClear();
  });

  it('writes bytes under the chapter directory and returns the path', async () => {
    const path = await deviceChapterAudioFileStore.writeAsset({
      chapterId: 'chapter:1',
      asset: ASSET,
      data: new Uint8Array([104, 105]),
    });

    expect(path).toBe('/mock/Documents/LingoBitesAudio/chapter_1/asset-1.mp3');
    expect(RNFSMock.writeFile).toHaveBeenCalledWith(path, 'aGk=', 'base64');
  });

  it('removes a cached file and swallows removal errors', async () => {
    RNFSMock.unlink.mockRejectedValueOnce(new Error('ENOENT'));

    await expect(
      deviceChapterAudioFileStore.removeAsset('/mock/Documents/x.mp3'),
    ).resolves.toBeUndefined();
  });
});

describe('offline playback', () => {
  beforeEach(() => {
    __resetMockDatabases();
    resetDatabaseForTests(open({name: DB_NAME}));
    mockSoundInstances.length = 0;
  });

  async function seedReadyAsset(
    asset: ChapterAudioAsset,
    localPath: string,
  ): Promise<void> {
    insertPendingChapterAudioAsset({
      chapterId: 'ch1',
      asset,
      now: '2026-09-01T00:00:00.000Z',
    });
    markChapterAudioAssetReady(
      asset.id,
      localPath,
      asset.bytes,
      '2026-09-01T00:00:00.000Z',
    );
  }

  it('resolves NOT_READY for an asset that is not downloaded yet', async () => {
    await expect(playReadyChapterAudio('missing')).resolves.toEqual({
      ok: false,
      errorCode: 'NOT_READY',
      message: expect.any(String),
    });
    expect(mockSoundInstances).toHaveLength(0);
  });

  it('plays a ready asset from its cached file path (offline)', async () => {
    await seedReadyAsset(
      ASSET,
      '/mock/Documents/LingoBitesAudio/ch1/asset-1.mp3',
    );

    const resultPromise = playReadyChapterAudio('asset-1');
    expect(mockSoundInstances).toHaveLength(1);
    mockSoundInstances[0].cb?.(null);

    await expect(resultPromise).resolves.toEqual({ok: true});
    expect(mockSoundInstances[0].filename).toBe(
      '/mock/Documents/LingoBitesAudio/ch1/asset-1.mp3',
    );
    expect(mockSoundInstances[0].playCalled).toBe(true);
  });

  it('resolves UNAVAILABLE when the native player cannot load the file', async () => {
    await seedReadyAsset(
      ASSET,
      '/mock/Documents/LingoBitesAudio/ch1/asset-1.mp3',
    );

    const resultPromise = playReadyChapterAudio('asset-1');
    expect(mockSoundInstances).toHaveLength(1);
    mockSoundInstances[0].cb?.(new Error('decode failed'));

    await expect(resultPromise).resolves.toEqual({
      ok: false,
      errorCode: 'UNAVAILABLE',
      message: expect.any(String),
    });
    expect(mockSoundInstances[0].playCalled).toBe(false);
  });

  it('returns the cached path only when the file still exists on disk', async () => {
    RNFSMock.exists.mockResolvedValueOnce(false);
    await seedReadyAsset(
      ASSET,
      '/mock/Documents/LingoBitesAudio/ch1/asset-1.mp3',
    );

    await expect(readyAudioPathOnDevice('asset-1')).resolves.toBeNull();

    RNFSMock.exists.mockResolvedValueOnce(true);
    await expect(readyAudioPathOnDevice('asset-1')).resolves.toBe(
      '/mock/Documents/LingoBitesAudio/ch1/asset-1.mp3',
    );
  });

  it('resolves UNAVAILABLE when the native player throws during construction', async () => {
    jest.resetModules();
    jest.doMock('@dr.pogodin/react-native-fs', () => ({
      DocumentDirectoryPath: '/mock/Documents',
      exists: jest.fn(async () => true),
      mkdir: jest.fn(async () => {}),
      writeFile: jest.fn(async () => {}),
      unlink: jest.fn(async () => {}),
    }));
    jest.doMock('react-native-sound', () => {
      return class ThrowingSound {
        static setActive() {}
        static setCategory() {}
        constructor() {
          throw new Error('not linked');
        }
        play() {}
        stop() {}
        release() {}
      };
    });

    const {playReadyChapterAudio: playWithBrokenSound} =
      require('../deviceChapterAudio') as typeof import('../deviceChapterAudio');

    const repository =
      require('@features/audio/logic/data/AudioAssetRepository') as {
        insertPendingChapterAudioAsset: (input: {
          chapterId: string;
          asset: ChapterAudioAsset;
          now: string;
        }) => void;
        markChapterAudioAssetReady: (
          id: string,
          localPath: string,
          bytes: number,
          now: string,
        ) => void;
      };
    repository.insertPendingChapterAudioAsset({
      chapterId: 'ch1',
      asset: ASSET,
      now: '2026-09-01T00:00:00.000Z',
    });
    repository.markChapterAudioAssetReady(
      ASSET.id,
      '/mock/Documents/LingoBitesAudio/ch1/asset-1.mp3',
      ASSET.bytes,
      '2026-09-01T00:00:00.000Z',
    );

    await expect(playWithBrokenSound('asset-1')).resolves.toEqual({
      ok: false,
      errorCode: 'UNAVAILABLE',
      message: expect.any(String),
    });
  });

  it('reports UNAVAILABLE when the device file system is not reachable', async () => {
    jest.resetModules();
    jest.doMock('@dr.pogodin/react-native-fs', () => ({
      DocumentDirectoryPath: undefined,
      mkdir: jest.fn(async () => {}),
      writeFile: jest.fn(async () => {}),
      unlink: jest.fn(async () => {}),
      exists: jest.fn(async () => true),
    }));

    const {deviceChapterAudioFileStore: storeWithoutFs} =
      require('../deviceChapterAudio') as typeof import('../deviceChapterAudio');

    await expect(
      storeWithoutFs.writeAsset({
        chapterId: 'ch1',
        asset: ASSET,
        data: new Uint8Array([1]),
      }),
    ).rejects.toThrow('UNAVAILABLE');
  });
});
