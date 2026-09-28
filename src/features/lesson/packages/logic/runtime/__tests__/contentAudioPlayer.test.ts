import type {AudioAsset} from '../../schema';
import {playContentAudio} from '../contentAudioPlayer';

const asset: AudioAsset = {
  id: 'audio-1',
  slug: 'audio-1',
  url: 'https://example.com/audio-1.mp3',
  checksum: 'sha256:placeholder',
};

describe('playContentAudio', () => {
  it('reports missing audio as an incomplete capability', () => {
    expect(playContentAudio('missing', new Map())).toEqual({
      ok: false,
      errorCode: 'NOT_DOWNLOADED',
      message: 'Âm thanh chưa được tải về máy.',
    });
  });

  it('does not claim playback when metadata exists without a local cache', () => {
    expect(playContentAudio(asset.id, new Map([[asset.id, asset]]))).toEqual({
      ok: false,
      errorCode: 'NOT_DOWNLOADED',
      message: 'Âm thanh chưa được tải về máy.',
    });
  });
});
