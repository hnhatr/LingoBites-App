import {
  LessonCreationAcceptedResponseSchema,
  LessonCreationStatusResponseSchema,
} from '../lesson';

const REQUEST_ID = '11111111-1111-4111-8111-111111111101';

describe('lesson creation status contract (LING-200 AD-007)', () => {
  it('parses a 202 accepted body with waiting_transcript', () => {
    const parsed = LessonCreationAcceptedResponseSchema.safeParse({
      contract_version: 1,
      request: {
        id: REQUEST_ID,
        status: 'waiting_transcript',
      },
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.request.status).toBe('waiting_transcript');
    }
  });

  it('parses GET lesson-creation status waiting_transcript with null lesson_id and error', () => {
    const parsed = LessonCreationStatusResponseSchema.safeParse({
      contract_version: 1,
      status: 'waiting_transcript',
      lesson_id: null,
      error: null,
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.lesson_id).toBeNull();
      expect(parsed.data.error).toBeNull();
    }
  });

  it('rejects an unknown creation status', () => {
    const parsed = LessonCreationStatusResponseSchema.safeParse({
      contract_version: 1,
      status: 'awaiting_magic',
      lesson_id: null,
      error: null,
    });
    expect(parsed.success).toBe(false);
  });
});
