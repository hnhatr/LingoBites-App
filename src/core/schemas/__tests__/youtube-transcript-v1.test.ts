import validYoutubeTranscriptJson from '../../fixtures/youtube-transcript-valid.json';
import {
  SCHEMA_VERSION,
  YOUTUBE_MAX_SEGMENT_CHAR_COUNT,
  YOUTUBE_MAX_SEGMENTS,
  YOUTUBE_SEGMENT_SILENCE_GAP_MS,
  validateCreateYouTubeTranscriptRequest,
  validateGetYouTubeTranscriptResponse,
  validateYouTubeTranscript,
  type YouTubeTranscript,
} from '../youtube-transcript-v1';

export const validYoutubeTranscript =
  validYoutubeTranscriptJson as YouTubeTranscript;

export {
  SCHEMA_VERSION,
  YOUTUBE_MAX_SEGMENT_CHAR_COUNT,
  YOUTUBE_MAX_SEGMENTS,
  YOUTUBE_SEGMENT_SILENCE_GAP_MS,
};

describe('validateYouTubeTranscript', () => {
  it('accepts shared valid fixture', () => {
    const result = validateYouTubeTranscript(validYoutubeTranscript);
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.data.schema_version).toBe(SCHEMA_VERSION);
      expect(result.data.segments).toHaveLength(2);
    }
  });

  it('rejects payload when end_ms is not greater than start_ms', () => {
    const result = validateYouTubeTranscript({
      ...validYoutubeTranscript,
      segments: [
        {
          ...validYoutubeTranscript.segments[0],
          start_ms: 1000,
          end_ms: 1000,
        },
      ],
    });
    expect(result.valid).toBe(false);
  });
});

describe('validateCreateYouTubeTranscriptRequest', () => {
  it('accepts auto-caption request with url only', () => {
    const result = validateCreateYouTubeTranscriptRequest({
      url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    });
    expect(result.valid).toBe(true);
  });

  it('accepts manual transcript cues', () => {
    const result = validateCreateYouTubeTranscriptRequest({
      url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      transcript: {
        cues: [{startMs: 0, endMs: 1200, text: 'Hello there'}],
      },
    });
    expect(result.valid).toBe(true);
  });
});

describe('validateGetYouTubeTranscriptResponse', () => {
  it('accepts completed job payload', () => {
    const result = validateGetYouTubeTranscriptResponse({
      request_id: 'req-1',
      status: 'completed',
      progress: {percent: 100, stage: 'finalizing'},
      data: validYoutubeTranscript,
    });
    expect(result.valid).toBe(true);
  });

  it('accepts failed job payload with error code', () => {
    const result = validateGetYouTubeTranscriptResponse({
      request_id: 'req-2',
      status: 'failed',
      progress: {percent: 40, stage: 'transcript_acquire'},
      error: {
        code: 'TRANSCRIPT_UNAVAILABLE',
        message: 'No English captions available.',
      },
    });
    expect(result.valid).toBe(true);
  });
});
