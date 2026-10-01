import {
  resolveLessonDestination,
  startLessonFromConfirmedText,
} from '../startLessonFromConfirmedText';

describe('startLessonFromConfirmedText', () => {
  beforeEach(() => jest.clearAllMocks());

  it('resolves destination to canonical_creation', () => {
    expect(resolveLessonDestination()).toBe('canonical_creation');
  });

  it('navigates to LessonCreation with validated text', async () => {
    const navigate = jest.fn();
    const result = await startLessonFromConfirmedText({
      confirmedText: 'hello world',
      sourceType: 'paste_text',
      origin: 'PasteText',
      navigate,
    });

    expect(result).toEqual({ok: true});
    expect(navigate).toHaveBeenCalledWith(
      'LessonCreation',
      expect.objectContaining({
        initialSource: 'text',
        initialText: 'hello world',
      }),
    );
  });

  it('rejects invalid text without navigating', async () => {
    const navigate = jest.fn();
    const result = await startLessonFromConfirmedText({
      confirmedText: '   ',
      sourceType: 'paste_text',
      navigate,
    });

    expect(result.ok).toBe(false);
    expect(navigate).not.toHaveBeenCalled();
  });
});
