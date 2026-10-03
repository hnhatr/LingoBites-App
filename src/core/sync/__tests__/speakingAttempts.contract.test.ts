import {
  buildSpeakingAttemptPayload,
  SPEAKING_ATTEMPT_PAYLOAD_KEYS,
} from '../speakingAttempts';

const BASE_INPUT = {
  lessonId: '11111111-1111-4111-8111-111111111111',
  sentenceId: '22222222-2222-4222-8222-222222222222',
  mode: 'shadowing' as const,
  checkFullSentence: true,
  checkKeyWords: false,
  checkRhythm: true,
  durationMs: 1200,
  recordingId: '33333333-3333-4333-8333-333333333333',
};

describe('speaking_attempts contract (INV-006)', () => {
  it('buildSpeakingAttemptPayload exposes exactly the allowlisted keys', () => {
    const payload = buildSpeakingAttemptPayload(BASE_INPUT);
    expect(Object.keys(payload).sort()).toEqual(
      [...SPEAKING_ATTEMPT_PAYLOAD_KEYS].sort(),
    );
    expect(payload).toEqual({
      lesson_id: BASE_INPUT.lessonId,
      sentence_id: BASE_INPUT.sentenceId,
      mode: 'shadowing',
      check_full_sentence: true,
      check_key_words: false,
      check_rhythm: true,
      duration_ms: 1200,
      recording_id: BASE_INPUT.recordingId,
    });
  });

  it('rejects extra payload keys at the schema boundary', () => {
    const payload = buildSpeakingAttemptPayload({
      ...BASE_INPUT,
      recordingId: null,
    });
    const withExtra = {...payload, file_path: '/secret/rec.m4a'};
    const {SpeakingAttemptPayloadSchema} = require('@core/schemas/sync');
    expect(SpeakingAttemptPayloadSchema.safeParse(withExtra).success).toBe(
      false,
    );
  });

  it('rejects duration outside 1..35000', () => {
    expect(() =>
      buildSpeakingAttemptPayload({...BASE_INPUT, durationMs: 0}),
    ).toThrow();
    expect(() =>
      buildSpeakingAttemptPayload({...BASE_INPUT, durationMs: 35001}),
    ).toThrow();
  });
});
