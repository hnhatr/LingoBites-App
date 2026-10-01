import type {LessonSentence} from '@core/schemas/lesson';

import {
  activeSentenceIndexAt,
  areCuesBoundedByDuration,
  formatCueTimestamp,
} from '../canonicalYouTubeCues';

function sentence(
  overrides: Partial<LessonSentence> & {id: string},
): LessonSentence {
  return {
    position: 0,
    text_en: 'Hello.',
    text_vi: 'Xin chào.',
    ipa: 'həˈloʊ',
    start_ms: null,
    end_ms: null,
    ...overrides,
  };
}

describe('canonical YouTube cues', () => {
  it('highlights the cue containing the playback position', () => {
    const sentences = [
      sentence({id: 's1', start_ms: 0, end_ms: 2000}),
      sentence({id: 's2', position: 1, start_ms: 2000, end_ms: 5000}),
    ];
    expect(activeSentenceIndexAt(sentences, 1500)).toBe(0);
    expect(activeSentenceIndexAt(sentences, 2000)).toBe(1);
    expect(activeSentenceIndexAt(sentences, 9000)).toBeNull();
  });

  it('ignores uncued sentences', () => {
    expect(activeSentenceIndexAt([sentence({id: 's1'})], 100)).toBeNull();
  });

  it('formats cue timestamps as m:ss', () => {
    expect(formatCueTimestamp(0)).toBe('0:00');
    expect(formatCueTimestamp(65000)).toBe('1:05');
  });

  it('validates cue bounds against the video duration', () => {
    expect(
      areCuesBoundedByDuration(
        [sentence({id: 's1', start_ms: 0, end_ms: 2000})],
        5000,
      ),
    ).toBe(true);
    expect(
      areCuesBoundedByDuration(
        [sentence({id: 's1', start_ms: 0, end_ms: 9000})],
        5000,
      ),
    ).toBe(false);
    expect(
      areCuesBoundedByDuration(
        [sentence({id: 's1', start_ms: 3000, end_ms: 2000})],
        9000,
      ),
    ).toBe(false);
  });
});
