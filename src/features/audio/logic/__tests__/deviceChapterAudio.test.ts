import {open} from 'react-native-quick-sqlite';

import {
  getReadyAudioAsset,
} from '@features/audio/logic/data/AudioAssetRepository';

import {DB_NAME} from '@core/db/constants';
import {resetDatabaseForTests} from '@core/db/database';

import {__resetMockDatabases} from '../../../../../test-utils/sqliteMock';
import {insertAudioAssetRow} from '@test/support/audioAssetSeed';
import {playReadyChapterAudio} from '../deviceChapterAudio';

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

const SoundMock = require('react-native-sound') as {
  new (filename: string): {
    filename: string;
    cb: ((error: unknown) => void) | null;
    playCalled: boolean;
    stopCalled: boolean;
    releaseCalled: boolean;
    onEnd: (() => void) | null;
    play: (onEnd?: () => void) => unknown;
  };
  __instances: Array<{
    filename: string;
    cb: ((error: unknown) => void) | null;
    playCalled: boolean;
    stopCalled: boolean;
    releaseCalled: boolean;
    onEnd: (() => void) | null;
    play: (onEnd?: () => void) => unknown;
  }>;
};
const mockSoundInstances = SoundMock.__instances;

const ASSET_ID = 'asset-1';
const ASSET_PATH = '/mock/Documents/LingoBitesAudio/ch1/asset-1.mp3';
const NOW = '2026-09-01T00:00:00.000Z';

describe('offline playback', () => {
  beforeEach(() => {
    __resetMockDatabases();
    resetDatabaseForTests(open({name: DB_NAME}));
    mockSoundInstances.length = 0;
  });

  it('resolves NOT_READY for an asset that is not downloaded yet', async () => {
    await expect(playReadyChapterAudio('missing')).resolves.toEqual({
      ok: false,
      errorCode: 'NOT_READY',
      message: expect.any(String),
    });
    expect(mockSoundInstances).toHaveLength(0);
  });

  it('plays a ready asset from its cached file path (offline)', async () => {
    insertAudioAssetRow({
      id: ASSET_ID,
      chapterId: 'ch1',
      url: 'https://cdn.example.com/audio/hello.mp3',
      localPath: ASSET_PATH,
      bytes: 5,
      checksum: 'abc',
      downloadStatus: 'ready',
      updatedAt: NOW,
    });

    const resultPromise = playReadyChapterAudio(ASSET_ID);
    expect(mockSoundInstances).toHaveLength(1);
    mockSoundInstances[0].cb?.(null);

    await expect(resultPromise).resolves.toEqual({ok: true});
    expect(mockSoundInstances[0].filename).toBe(ASSET_PATH);
    expect(mockSoundInstances[0].playCalled).toBe(true);
  });

  it('resolves UNAVAILABLE when the native player cannot load the file', async () => {
    insertAudioAssetRow({
      id: ASSET_ID,
      chapterId: 'ch1',
      url: 'https://cdn.example.com/audio/hello.mp3',
      localPath: ASSET_PATH,
      bytes: 5,
      checksum: 'abc',
      downloadStatus: 'ready',
      updatedAt: NOW,
    });

    const resultPromise = playReadyChapterAudio(ASSET_ID);
    expect(mockSoundInstances).toHaveLength(1);
    mockSoundInstances[0].cb?.(new Error('decode failed'));

    await expect(resultPromise).resolves.toEqual({
      ok: false,
      errorCode: 'UNAVAILABLE',
      message: expect.any(String),
    });
    expect(mockSoundInstances[0].playCalled).toBe(false);
  });

  it('resolves UNAVAILABLE when the native player throws during construction', async () => {
    jest.resetModules();
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

    const {insertAudioAssetRow: seedRow} =
      require('@test/support/audioAssetSeed') as typeof import('@test/support/audioAssetSeed');

    seedRow({
      id: ASSET_ID,
      chapterId: 'ch1',
      url: 'https://cdn.example.com/audio/hello.mp3',
      localPath: ASSET_PATH,
      bytes: 5,
      checksum: 'abc',
      downloadStatus: 'ready',
      updatedAt: NOW,
    });

    await expect(playWithBrokenSound(ASSET_ID)).resolves.toEqual({
      ok: false,
      errorCode: 'UNAVAILABLE',
      message: expect.any(String),
    });
  });

  it('confirms getReadyAudioAsset returns null for non-ready asset', () => {
    expect(getReadyAudioAsset('nonexistent')).toBeNull();
  });
});
