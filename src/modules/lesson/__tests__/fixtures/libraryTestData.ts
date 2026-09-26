import type {ContentLessonState, FlashcardRecord, GrammarBookmark} from '@shared/db/types';

export function makeLesson(overrides: Record<string, unknown> = {}) {
  return {
    id: 'lesson-1',
    title: 'Basic Greetings',
    summary: 'Learn how to greet people in English',
    previewText: 'preview text',
    vocabularyCount: 10,
    category: 'vocabulary',
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

export function makeContentLessonState(
  overrides: Partial<ContentLessonState>
): ContentLessonState {
  return {
    lessonId: 'content-lesson-1',
    isSaved: false,
    isStarted: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    revision: 0,
    tombstone: false,
    ...overrides,
  };
}

export function makeFlashcard(overrides: Partial<FlashcardRecord>): FlashcardRecord {
  return {
    id: 'card-1',
    lessonId: 'lesson-1',
    vocabularyId: 'vocab-1',
    word: 'hello',
    phraseFromText: null,
    wordType: 'noun',
    meaningVi: 'xin chào',
    pronunciationGuideVi: 'hê-lô',
    ipa: '/həˈloʊ/',
    cefrLevel: 'A1',
    sourceSentence: null,
    example: 'Hello, how are you?',
    exampleTranslation: 'Xin chào, bạn khỏe không?',
    isSaved: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    revision: 0,
    tombstone: false,
    ...overrides,
  };
}

export function makeGrammarBookmark(
  overrides: Partial<GrammarBookmark & {title?: string; content?: string}>
): GrammarBookmark & {title?: string; content?: string} {
  return {
    lessonId: 'lesson-1',
    grammarId: 'grammar-1',
    packageId: 'pkg-1',
    savedAt: '2026-01-01T00:00:00.000Z',
    reactivatedAt: '2026-01-01T00:00:00.000Z',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    revision: 0,
    tombstone: false,
    title: 'Past Tense',
    content: 'The past tense describes actions that happened in the past',
    ...overrides,
  };
}

// Sample data for tests
export const sampleLessons = [
  makeLesson({
    id: 'lesson-1',
    title: 'Hello World',
    summary: 'Learn basic greetings',
  }),
  makeLesson({
    id: 'lesson-2',
    title: 'Numbers and Colors',
    summary: 'Learn to count and describe colors',
  }),
  makeLesson({
    id: 'lesson-3',
    title: 'Family Members',
    summary: 'Learn family vocabulary',
  }),
];

export const sampleFlashcards = [
  makeFlashcard({
    id: 'card-1',
    word: 'hello',
    meaningVi: 'xin chào',
    example: 'Hello, how are you?',
  }),
  makeFlashcard({
    id: 'card-2',
    word: 'goodbye',
    meaningVi: 'tạm biệt',
    example: 'Goodbye, see you later',
  }),
  makeFlashcard({
    id: 'card-3',
    word: 'thank you',
    meaningVi: 'cảm ơn',
    example: 'Thank you for your help',
  }),
];

export const sampleGrammarBookmarks = [
  makeGrammarBookmark({
    grammarId: 'grammar-1',
    title: 'Present Simple',
    content: 'The present simple is used for facts and habits',
  }),
  makeGrammarBookmark({
    grammarId: 'grammar-2',
    title: 'Past Tense',
    content: 'The past tense describes actions that happened in the past',
  }),
];

// Dummy test to satisfy Jest requirement
describe('libraryTestData fixtures', () => {
  it('exports test data fixtures', () => {
    expect(sampleLessons).toBeDefined();
    expect(sampleFlashcards).toBeDefined();
    expect(sampleGrammarBookmarks).toBeDefined();
  });
});
