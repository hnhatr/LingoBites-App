import type {LessonAnalysis, LessonSnapshot} from '@core/schemas/lesson';

import {normalizeItemKey} from './itemKey';
import {
  isWordLearningItem,
  learningItemsFromSnapshot,
  type WordLearningItem,
} from './items';
import {createRandom, shuffled} from './random';

/**
 * On-device practice generator: deterministic multiple-choice questions built
 * from one downloaded lesson. No I/O, no language strings: the UI turns the
 * variant and the structured fields into text.
 *
 * Same `seed` + same lesson content => the same questions in the same order.
 */
export type PracticeVariant =
  | 'meaning_choice'
  | 'cloze_choice'
  | 'translation_choice';

export const PRACTICE_VARIANTS: readonly PracticeVariant[] = [
  'meaning_choice',
  'cloze_choice',
  'translation_choice',
];

export const CLOZE_BLANK = '_____';
export const DEFAULT_PRACTICE_QUESTION_COUNT = 10;
/** Below this many possible questions the lesson is not worth a quiz. */
export const MIN_PRACTICE_QUESTIONS = 3;

export type PracticeOption = {id: string; text: string};

export type PracticeQuestion = {
  id: string;
  variant: PracticeVariant;
  /**
   * meaning_choice: the English word. cloze_choice: the sentence with the word
   * replaced by `CLOZE_BLANK`. translation_choice: the English sentence.
   */
  prompt: string;
  /** cloze_choice: the Vietnamese translation of the sentence, as a hint. */
  hintVi: string | null;
  options: PracticeOption[];
  correctOptionId: string;
  /** Text of the correct option, for feedback. */
  answerText: string;
  /** `word:coffee` for word questions, null for sentence translation. */
  itemKey: string | null;
  sentenceId: string | null;
};

export type PracticeSource = {
  lessonId: string;
  contentRevision: number;
  words: WordLearningItem[];
  sentences: Array<{id: string; textEn: string; textVi: string}>;
};

export function buildPracticeSource(
  snapshot: LessonSnapshot,
  analyses: Record<string, LessonAnalysis> = snapshot.analyses,
): PracticeSource {
  const words = learningItemsFromSnapshot(snapshot, analyses).filter(
    isWordLearningItem,
  );
  return {
    lessonId: snapshot.id,
    contentRevision: snapshot.content_revision,
    words,
    sentences: [...snapshot.sentences]
      .sort((a, b) => a.position - b.position)
      .map(sentence => ({
        id: sentence.id,
        textEn: sentence.text_en,
        textVi: sentence.text_vi,
      })),
  };
}

/** Seed shared by every device: a lesson revision and the learner's attempt. */
export function practiceSeed(
  lessonId: string,
  contentRevision: number,
  attemptNo: number,
): string {
  return `${lessonId}:${contentRevision}:${attemptNo}`;
}

type Draft = Omit<
  PracticeQuestion,
  'options' | 'correctOptionId' | 'answerText'
> & {
  correct: string;
  distractors: string[];
};

const norm = (value: string) => normalizeItemKey(value);

/** Distinct, non-empty texts that differ from `correct` once normalised. */
function distinctOthers(
  correct: string,
  candidates: readonly string[],
): string[] {
  const seen = new Set([norm(correct)]);
  const result: string[] = [];
  for (const candidate of candidates) {
    const key = norm(candidate);
    if (key === '' || seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push(candidate);
  }
  return result;
}

function wordPattern(word: string): RegExp {
  const escaped = word.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(?<![\\p{L}\\p{N}])${escaped}(?![\\p{L}\\p{N}])`, 'giu');
}

function meaningDrafts(source: PracticeSource): Draft[] {
  const drafts: Draft[] = [];
  for (const item of source.words) {
    const others = distinctOthers(
      item.meaningVi,
      source.words
        .filter(other => other !== item)
        .map(other => other.meaningVi),
    );
    if (others.length < 3) {
      continue;
    }
    drafts.push({
      id: `meaning_choice:${item.itemKey}`,
      variant: 'meaning_choice',
      prompt: item.word,
      hintVi: null,
      correct: item.meaningVi,
      distractors: others,
      itemKey: item.itemKey,
      sentenceId: null,
    });
  }
  return drafts;
}

function clozeDrafts(source: PracticeSource): Draft[] {
  const drafts: Draft[] = [];
  const sentenceById = new Map(source.sentences.map(s => [s.id, s] as const));
  for (const item of source.words) {
    const sentence = item.sentenceIds
      .map(id => sentenceById.get(id))
      .find(
        candidate =>
          candidate !== undefined &&
          wordPattern(item.word).test(candidate.textEn),
      );
    if (!sentence) {
      continue;
    }
    const pattern = wordPattern(item.word);
    const blanked = sentence.textEn.replace(pattern, CLOZE_BLANK);
    // A distractor that also fits the sentence would make two right answers.
    const fitsSentence = (word: string) =>
      wordPattern(word).test(sentence.textEn);
    const others = distinctOthers(
      item.word,
      source.words
        .filter(other => other !== item && !fitsSentence(other.word))
        .map(other => other.word),
    );
    if (others.length < 2) {
      continue;
    }
    drafts.push({
      id: `cloze_choice:${item.itemKey}`,
      variant: 'cloze_choice',
      prompt: blanked,
      hintVi: sentence.textVi,
      correct: item.word,
      distractors: others,
      itemKey: item.itemKey,
      sentenceId: sentence.id,
    });
  }
  return drafts;
}

function translationDrafts(source: PracticeSource): Draft[] {
  const drafts: Draft[] = [];
  for (const sentence of source.sentences) {
    if (norm(sentence.textVi) === '') {
      continue;
    }
    const others = distinctOthers(
      sentence.textVi,
      source.sentences
        .filter(other => other.id !== sentence.id)
        .map(other => other.textVi),
    );
    if (others.length < 2) {
      continue;
    }
    drafts.push({
      id: `translation_choice:${sentence.id}`,
      variant: 'translation_choice',
      prompt: sentence.textEn,
      hintVi: null,
      correct: sentence.textVi,
      distractors: others,
      itemKey: null,
      sentenceId: sentence.id,
    });
  }
  return drafts;
}

const DRAFT_BUILDERS: Record<PracticeVariant, (s: PracticeSource) => Draft[]> =
  {
    meaning_choice: meaningDrafts,
    cloze_choice: clozeDrafts,
    translation_choice: translationDrafts,
  };

export type PracticeEligibility = {
  eligible: boolean;
  /** How many questions each variant could contribute. */
  available: Record<PracticeVariant, number>;
  total: number;
};

export function getPracticeEligibility(
  source: PracticeSource,
): PracticeEligibility {
  const available = {} as Record<PracticeVariant, number>;
  let total = 0;
  for (const variant of PRACTICE_VARIANTS) {
    available[variant] = DRAFT_BUILDERS[variant](source).length;
    total += available[variant];
  }
  return {eligible: total >= MIN_PRACTICE_QUESTIONS, available, total};
}

/**
 * Round-robins the variants (each shuffled by the seed), then builds the
 * options: the correct answer plus up to three seeded distractors, shuffled.
 */
export function generatePracticeSet(
  source: PracticeSource,
  seed: string,
  count: number = DEFAULT_PRACTICE_QUESTION_COUNT,
): PracticeQuestion[] {
  const random = createRandom(seed);
  const queues = PRACTICE_VARIANTS.map(variant =>
    shuffled(DRAFT_BUILDERS[variant](source), random),
  );

  const picked: Draft[] = [];
  while (picked.length < count && queues.some(queue => queue.length > 0)) {
    for (const queue of queues) {
      const next = queue.shift();
      if (next && picked.length < count) {
        picked.push(next);
      }
    }
  }

  return picked.map(draft => {
    const distractorCount = draft.variant === 'meaning_choice' ? 3 : 2;
    const choices = shuffled(
      [
        {text: draft.correct, isCorrect: true},
        ...shuffled(draft.distractors, random)
          .slice(0, distractorCount)
          .map(text => ({text, isCorrect: false})),
      ],
      random,
    );
    const options = choices.map((choice, index) => ({
      id: `${draft.id}:o${index}`,
      text: choice.text,
    }));
    const correctIndex = choices.findIndex(choice => choice.isCorrect);
    const {correct, distractors: _distractors, ...question} = draft;
    return {
      ...question,
      options,
      correctOptionId: options[correctIndex]!.id,
      answerText: correct,
    };
  });
}

export type PracticeGrade = {
  correct: boolean;
  correctOptionId: string;
  answerText: string;
};

export function gradeAnswer(
  question: PracticeQuestion,
  optionId: string,
): PracticeGrade {
  return {
    correct: optionId === question.correctOptionId,
    correctOptionId: question.correctOptionId,
    answerText: question.answerText,
  };
}

export type PracticeAnswer = {
  questionId: string;
  optionId: string;
};

export type PracticeSummary = {
  total: number;
  correct: number;
  /** Whole percent, 0 when nothing was answered. */
  accuracy: number;
  /** Word/phrase item keys answered wrongly, in question order, unique. */
  missedItemKeys: string[];
};

export function summarizeAnswers(
  questions: readonly PracticeQuestion[],
  answers: readonly PracticeAnswer[],
): PracticeSummary {
  const byId = new Map(
    questions.map(question => [question.id, question] as const),
  );
  let correct = 0;
  const missed: string[] = [];
  for (const answer of answers) {
    const question = byId.get(answer.questionId);
    if (!question) {
      continue;
    }
    if (gradeAnswer(question, answer.optionId).correct) {
      correct += 1;
    } else if (question.itemKey && !missed.includes(question.itemKey)) {
      missed.push(question.itemKey);
    }
  }
  const total = answers.filter(answer => byId.has(answer.questionId)).length;
  return {
    total,
    correct,
    accuracy: total === 0 ? 0 : Math.round((correct / total) * 100),
    missedItemKeys: missed,
  };
}
