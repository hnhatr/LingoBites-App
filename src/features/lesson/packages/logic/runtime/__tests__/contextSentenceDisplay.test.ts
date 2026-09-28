import {isRedundantContextSentence} from '../contextSentenceDisplay';

describe('isRedundantContextSentence', () => {
  it('detects daily-work wrapper sentences that repeat the headline', () => {
    const phraseEn = 'Could you please repeat that point?';
    const phraseVi = 'Bạn có thể lặp lại điểm đó được không?';

    expect(
      isRedundantContextSentence(
        'In our daily work: "Could you please repeat that point?".',
        phraseEn,
      ),
    ).toBe(true);
    expect(
      isRedundantContextSentence(
        'Trong công việc hàng ngày: "Bạn có thể lặp lại điểm đó được không?".',
        phraseVi,
      ),
    ).toBe(true);
  });

  it('keeps distinct usage examples', () => {
    expect(
      isRedundantContextSentence(
        'In our daily work: "The QA team handles end-to-end testing".',
        'Could you please repeat that point?',
      ),
    ).toBe(false);
  });
});
