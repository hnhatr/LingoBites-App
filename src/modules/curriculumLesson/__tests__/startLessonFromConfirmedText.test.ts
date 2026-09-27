import {
  resolveLessonDestination,
  startLessonFromConfirmedText,
} from '../startLessonFromConfirmedText';

describe('startLessonFromConfirmedText', () => {
  beforeEach(() => jest.clearAllMocks());

  it('unconditionally resolves destination to unified_lesson', () => {
    expect(resolveLessonDestination()).toBe('unified_lesson');
  });

  it('creates one job and navigates to generation progress for unified', async () => {
    const navigate = jest.fn();
    const createGenerationJob = jest.fn().mockResolvedValue({
      ok: true,
      job: {id: 'job-1'},
    });
    const result = await startLessonFromConfirmedText({
      confirmedText: 'hello world',
      sourceType: 'paste_text',
      navigate,
      createGenerationJob,
    });

    expect(result).toEqual({ok: true});
    expect(createGenerationJob).toHaveBeenCalledWith({
      confirmedText: 'hello world',
    });
    expect(navigate).toHaveBeenCalledWith('UnifiedLessonGeneration', {
      jobId: 'job-1',
      confirmedText: 'hello world',
    });
  });

  it('fails closed for unified when no job creator is injected', async () => {
    const navigate = jest.fn();
    const result = await startLessonFromConfirmedText({
      confirmedText: 'hello world',
      sourceType: 'paste_text',
      navigate,
    });

    expect(result.ok).toBe(false);
    expect(navigate).not.toHaveBeenCalled();
  });

  it('maps unified creation failure to the retryable contract', async () => {
    const navigate = jest.fn();
    const createGenerationJob = jest.fn().mockResolvedValue({
      ok: false,
      message: 'Server busy.',
      retryable: true,
    });
    const result = await startLessonFromConfirmedText({
      confirmedText: 'hello world',
      sourceType: 'paste_text',
      navigate,
      createGenerationJob,
    });

    expect(result).toEqual({
      ok: false,
      message: 'Server busy.',
      retryable: true,
    });
    expect(navigate).not.toHaveBeenCalled();
  });
});
