import {mapTranscriptToPractice} from '../practiceMapper';
import type {YouTubeSegment} from '../../../../../shared/schemas/youtube-transcript-v1';

describe('practiceMapper', () => {
  const mockSegments: YouTubeSegment[] = [
    {
      id: '1',
      index: 0,
      start_ms: 0,
      end_ms: 1000,
      en: 'Hello world',
      vi: 'Xin chào thế giới',
      ipa: '',
    },
    {
      id: '2',
      index: 1,
      start_ms: 1000,
      end_ms: 2000,
      en: 'How are you?',
      vi: 'Bạn khoẻ không?',
      ipa: '',
    },
    {
      id: '3',
      index: 2,
      start_ms: 2000,
      end_ms: 3000,
      en: 'I am fine',
      vi: 'Tôi khoẻ',
      ipa: '',
    },
    {
      id: '4',
      index: 3,
      start_ms: 3000,
      end_ms: 4000,
      en: 'Missing translation',
      vi: '',
      ipa: '',
    },
  ];

  beforeEach(() => {
    // Mock Math.random to make shuffling deterministic
    jest.spyOn(Math, 'random').mockReturnValue(0.5);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('maps valid segments to multiple choice practice questions', () => {
    const questions = mapTranscriptToPractice(mockSegments, 2);

    expect(questions).toHaveLength(2);

    // First question
    expect(questions[0].id).toBe('1');
    expect(questions[0].type).toBe('multiple_choice');
    expect(questions[0].question).toBe('Hello world');
    expect(questions[0].answer).toBe('Xin chào thế giới');
    expect(questions[0].options).toContain('Xin chào thế giới');
    expect(questions[0].options).toContain('Bạn khoẻ không?');
    expect(questions[0].options).toContain('Tôi khoẻ');
    expect(questions[0].skill).toBe('translation');

    // Second question
    expect(questions[1].id).toBe('2');
    expect(questions[1].type).toBe('multiple_choice');
    expect(questions[1].question).toBe('How are you?');
    expect(questions[1].answer).toBe('Bạn khoẻ không?');
  });

  it('filters out segments without translations', () => {
    const questions = mapTranscriptToPractice(mockSegments, 10);
    expect(questions).toHaveLength(3); // 'Missing translation' is filtered out
    expect(questions.map(q => q.id)).not.toContain('4');
  });

  it('returns empty array if less than 2 valid segments are available', () => {
    const singleSegment = [mockSegments[0]];
    const questions = mapTranscriptToPractice(singleSegment, 10);
    expect(questions).toHaveLength(0);
  });

  it('respects the limit parameter', () => {
    const questions = mapTranscriptToPractice(mockSegments, 1);
    expect(questions).toHaveLength(1);
    expect(questions[0].id).toBe('1');
  });
});
