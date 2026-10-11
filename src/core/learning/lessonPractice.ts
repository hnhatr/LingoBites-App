import {
  ActivityContentSchemas,
  type FillBlankContent,
  type ListenAndRepeatContent,
  type MultipleChoiceContent,
  SOURCE_CLIP_MAX_MS,
  type TranslationContent,
} from '@core/schemas/activityContent';
import type {
  LessonAnalysis,
  LessonSentence,
  LessonSnapshot,
} from '@core/schemas/lesson';

import {isWordLearningItem, learningItemsFromSnapshot} from './items';
import {distinctOthers, MIN_PRACTICE_QUESTIONS, wordPattern} from './practice';
import {createRandom, shuffled} from './random';

/**
 * On-device practice for a lesson without the six-step player (a learner
 * lesson made from text, a photo of text or a YouTube video): a fixed run of
 * activity sections built from the lesson's own sentences and words. No AI,
 * no I/O, no language strings; the content uses the same shapes as the
 * curriculum activity blocks so the same activity screens can render it.
 *
 * The study window (which sentences) depends only on the lesson content; the
 * seed only shuffles the questions and their options.
 */

/** D6: at most this many consecutive sentences feed one practice. */
export const LESSON_PRACTICE_WINDOW_MAX = 8;

const LISTEN_MAX = 4;
const LISTEN_WORDS_MAX = 20;
const CHOICE_MIN = 3;
const CHOICE_MAX = 5;
const TRANSLATION_MAX = 3;
const TRANSLATION_WORDS_MIN = 2;
const TRANSLATION_WORDS_MAX = 8;
const MIN_SECTIONS = 2;

export type LessonPracticeSectionKind =
  | 'listen_and_repeat'
  | 'multiple_choice'
  | 'fill_blank'
  | 'translation';

/** What one entry practises, for attempts and "save as flashcard". */
export type LessonPracticeEntryRef = {
  itemKey: string | null;
  sentenceId: string | null;
};

type SectionOf<K extends LessonPracticeSectionKind, C> = {
  kind: K;
  content: C;
  /** Entry id -> what it practises. */
  refs: Record<string, LessonPracticeEntryRef>;
};

export type LessonPracticeSection =
  | SectionOf<'listen_and_repeat', ListenAndRepeatContent>
  | SectionOf<'multiple_choice', MultipleChoiceContent>
  | SectionOf<'fill_blank', FillBlankContent>
  | SectionOf<'translation', TranslationContent>;

export type LessonPracticePlan = {
  lessonId: string;
  contentRevision: number;
  /** The study window, in lesson order. */
  sentenceIds: string[];
  sections: LessonPracticeSection[];
};

type WindowWord = {
  itemKey: string;
  word: string;
  meaningVi: string;
  sentenceIds: string[];
};

const wordCount = (text: string) =>
  text.trim().split(/\s+/).filter(Boolean).length;

function sortedSentences(snapshot: LessonSnapshot): LessonSentence[] {
  return [...snapshot.sentences].sort((a, b) => a.position - b.position);
}

function lessonWords(
  snapshot: LessonSnapshot,
  analyses: Record<string, LessonAnalysis>,
): WindowWord[] {
  return learningItemsFromSnapshot(snapshot, analyses)
    .filter(isWordLearningItem)
    .filter(item => item.word.trim() !== '' && item.meaningVi.trim() !== '')
    .map(item => ({
      itemKey: item.itemKey,
      word: item.word.trim(),
      meaningVi: item.meaningVi.trim(),
      sentenceIds: item.sentenceIds,
    }));
}

/**
 * D6/D7: the consecutive run of at most `max` sentences that carries the most
 * lesson words; the earliest run wins a tie. Shared with the six-step
 * suggestion so both practise the same part of a long lesson.
 */
export function pickStudyWindow(
  snapshot: LessonSnapshot,
  analyses: Record<string, LessonAnalysis> = snapshot.analyses,
  max: number = LESSON_PRACTICE_WINDOW_MAX,
): LessonSentence[] {
  const sentences = sortedSentences(snapshot);
  if (sentences.length <= max) {
    return sentences;
  }
  const words = lessonWords(snapshot, analyses);
  let bestStart = 0;
  let bestScore = -1;
  for (let start = 0; start + max <= sentences.length; start += 1) {
    const ids = new Set(sentences.slice(start, start + max).map(s => s.id));
    const score = words.filter(word =>
      word.sentenceIds.some(id => ids.has(id)),
    ).length;
    if (score > bestScore) {
      bestScore = score;
      bestStart = start;
    }
  }
  return sentences.slice(bestStart, bestStart + max);
}

/** One part of a long lesson that a practice run can study on its own. */
export type LessonPracticeSegment = {
  /** 0-based position among the lesson's segments. */
  index: number;
  /** Consecutive sentences, in lesson order. */
  sentenceIds: string[];
  firstSentenceEn: string;
  /** Video time span of the segment; null without timed sentences. */
  startMs: number | null;
  endMs: number | null;
};

/**
 * K1: the lesson's sentences split in order into segments of at most `max`,
 * as even as possible (17 sentences → 6, 6, 5), so the last segment is never
 * a lone sentence or two. A lesson of `max` sentences or fewer is one segment.
 */
export function lessonPracticeSegments(
  snapshot: LessonSnapshot,
  max: number = LESSON_PRACTICE_WINDOW_MAX,
): LessonPracticeSegment[] {
  const sentences = sortedSentences(snapshot);
  if (sentences.length === 0) {
    return [];
  }
  const count = Math.ceil(sentences.length / max);
  const base = Math.floor(sentences.length / count);
  const larger = sentences.length % count;
  const segments: LessonPracticeSegment[] = [];
  let start = 0;
  for (let index = 0; index < count; index += 1) {
    const size = base + (index < larger ? 1 : 0);
    const part = sentences.slice(start, start + size);
    start += size;
    const starts = part.flatMap(s => (s.start_ms === null ? [] : [s.start_ms]));
    const ends = part.flatMap(s => (s.end_ms === null ? [] : [s.end_ms]));
    segments.push({
      index,
      sentenceIds: part.map(sentence => sentence.id),
      firstSentenceEn: part[0]!.text_en,
      startMs: starts.length > 0 ? Math.min(...starts) : null,
      endMs: ends.length > 0 ? Math.max(...ends) : null,
    });
  }
  return segments;
}

/** The sentence's video clip, when it has a usable one. */
function clipOf(
  sentence: LessonSentence,
): {startMs: number; endMs: number} | null {
  const {start_ms: startMs, end_ms: endMs} = sentence;
  if (
    startMs === null ||
    endMs === null ||
    endMs <= startMs ||
    endMs - startMs > SOURCE_CLIP_MAX_MS
  ) {
    return null;
  }
  return {startMs, endMs};
}

function listenSection(
  window: readonly LessonSentence[],
): LessonPracticeSection | null {
  const picked = window
    .filter(sentence => wordCount(sentence.text_en) <= LISTEN_WORDS_MAX)
    .slice(0, LISTEN_MAX);
  if (picked.length === 0) {
    return null;
  }
  const refs: Record<string, LessonPracticeEntryRef> = {};
  const prompts = picked.map(sentence => {
    const id = `listen:${sentence.id}`;
    refs[id] = {itemKey: null, sentenceId: sentence.id};
    return {
      id,
      textEn: sentence.text_en,
      textVi: sentence.text_vi,
      sentenceId: sentence.id,
      ...(clipOf(sentence) ?? {}),
    };
  });
  return {kind: 'listen_and_repeat', content: {prompts}, refs};
}

/** "Which English word means …?": the meaning as prompt, words as options. */
function meaningSection(
  words: readonly WindowWord[],
  allWords: readonly WindowWord[],
  random: () => number,
): LessonPracticeSection | null {
  const refs: Record<string, LessonPracticeEntryRef> = {};
  const questions: MultipleChoiceContent['questions'] = [];
  for (const word of shuffled(words, random)) {
    if (questions.length >= CHOICE_MAX) {
      break;
    }
    // A distractor with the same meaning would be a second right answer.
    const others = distinctOthers(
      word.word,
      allWords
        .filter(
          other =>
            other.itemKey !== word.itemKey &&
            distinctOthers(word.meaningVi, [other.meaningVi]).length > 0,
        )
        .map(other => other.word),
    );
    if (others.length < 2) {
      continue;
    }
    const id = `meaning:${questions.length}`;
    const texts = shuffled(
      [word.word, ...shuffled(others, random).slice(0, 3)],
      random,
    );
    const options = texts.map((text, index) => ({id: `${id}:o${index}`, text}));
    questions.push({
      id,
      promptVi: word.meaningVi,
      options,
      correctOptionId: options[texts.indexOf(word.word)]!.id,
    });
    refs[id] = {itemKey: word.itemKey, sentenceId: null};
  }
  return questions.length >= CHOICE_MIN
    ? {kind: 'multiple_choice', content: {questions}, refs}
    : null;
}

/** One blank per question: the word inside a window sentence. */
function fillBlankSection(
  window: readonly LessonSentence[],
  words: readonly WindowWord[],
  allWords: readonly WindowWord[],
  random: () => number,
): LessonPracticeSection | null {
  const byId = new Map(window.map(sentence => [sentence.id, sentence]));
  const refs: Record<string, LessonPracticeEntryRef> = {};
  const questions: FillBlankContent['questions'] = [];
  for (const word of shuffled(words, random)) {
    if (questions.length >= CHOICE_MAX) {
      break;
    }
    const sentence = word.sentenceIds
      .map(id => byId.get(id))
      .find(
        candidate =>
          candidate !== undefined &&
          wordPattern(word.word).test(candidate.text_en),
      );
    if (!sentence) {
      continue;
    }
    const match = wordPattern(word.word).exec(sentence.text_en);
    if (!match || match[0].trim() === '') {
      continue;
    }
    const answer = match[0];
    // A distractor that also fits the sentence would make two right answers.
    const others = distinctOthers(
      answer,
      allWords
        .filter(
          other =>
            other.itemKey !== word.itemKey &&
            !wordPattern(other.word).test(sentence.text_en),
        )
        .map(other => other.word),
    );
    if (others.length < 2) {
      continue;
    }
    const id = `fill:${questions.length}`;
    questions.push({
      id,
      beforeEn: sentence.text_en.slice(0, match.index),
      afterEn: sentence.text_en.slice(match.index + answer.length),
      answer,
      options: shuffled(
        [answer, ...shuffled(others, random).slice(0, 2)],
        random,
      ),
      textVi: sentence.text_vi,
    });
    refs[id] = {itemKey: word.itemKey, sentenceId: sentence.id};
  }
  return questions.length >= CHOICE_MIN
    ? {kind: 'fill_blank', content: {questions}, refs}
    : null;
}

/** Short sentences only: the learner types the whole English sentence. */
function translationSection(
  window: readonly LessonSentence[],
  random: () => number,
): LessonPracticeSection | null {
  const candidates = window.filter(sentence => {
    const count = wordCount(sentence.text_en);
    return count >= TRANSLATION_WORDS_MIN && count <= TRANSLATION_WORDS_MAX;
  });
  const picked = shuffled(candidates, random).slice(0, TRANSLATION_MAX);
  if (picked.length === 0) {
    return null;
  }
  const refs: Record<string, LessonPracticeEntryRef> = {};
  const sentences = picked.map(sentence => {
    const id = `translation:${sentence.id}`;
    refs[id] = {itemKey: null, sentenceId: sentence.id};
    return {id, textVi: sentence.text_vi, modelEn: sentence.text_en};
  });
  return {kind: 'translation', content: {sentences}, refs};
}

function entryCount(section: LessonPracticeSection): number {
  switch (section.kind) {
    case 'listen_and_repeat':
      return section.content.prompts.length;
    case 'translation':
      return section.content.sentences.length;
    default:
      return section.content.questions.length;
  }
}

/** Never hand the activity screens content their schema would reject. */
function isValid(section: LessonPracticeSection): boolean {
  return ActivityContentSchemas[section.kind].safeParse(section.content)
    .success;
}

/**
 * The practice run of one lesson, or `null` when the lesson has too little
 * to practise (D5: the hub then keeps its manual "complete"). Sections keep a
 * fixed order: listen and repeat, word meaning, fill the blank, translate.
 * `sentenceIds` studies one segment (`lessonPracticeSegments`); without it the
 * run studies the window with the most lesson words.
 */
export function buildLessonPracticePlan(
  snapshot: LessonSnapshot,
  seed: string,
  analyses: Record<string, LessonAnalysis> = snapshot.analyses,
  sentenceIds?: readonly string[],
): LessonPracticePlan | null {
  const window = sentenceIds
    ? sortedSentences(snapshot).filter(sentence =>
        sentenceIds.includes(sentence.id),
      )
    : pickStudyWindow(snapshot, analyses);
  if (window.length === 0) {
    return null;
  }
  const random = createRandom(seed);
  const allWords = lessonWords(snapshot, analyses);
  const windowIds = new Set(window.map(sentence => sentence.id));
  const inWindow = allWords.filter(word =>
    word.sentenceIds.some(id => windowIds.has(id)),
  );
  // Few words in the window: quiz the lesson's words rather than none.
  const meaningWords = inWindow.length >= CHOICE_MIN ? inWindow : allWords;

  const sections = [
    listenSection(window),
    meaningSection(meaningWords, allWords, random),
    fillBlankSection(window, inWindow, allWords, random),
    translationSection(window, random),
  ].filter(
    (section): section is LessonPracticeSection =>
      section !== null && isValid(section),
  );

  const entries = sections.reduce(
    (sum, section) => sum + entryCount(section),
    0,
  );
  if (sections.length < MIN_SECTIONS || entries < MIN_PRACTICE_QUESTIONS) {
    return null;
  }
  return {
    lessonId: snapshot.id,
    contentRevision: snapshot.content_revision,
    sentenceIds: window.map(sentence => sentence.id),
    sections,
  };
}
