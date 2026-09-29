/**
 * Deterministic practice-question validator (SETE-198 / P3 of SETE-126 §7).
 *
 * MVP: hard pass/fail checks only. No aggregate confidence score — the
 * 0.9/0.7 thresholds from the early analysis are deliberately NOT here;
 * they need corpus calibration with a gold set (phase 2).
 *
 * Purity contract (acceptance criterion 4):
 * - Pure functions only: no I/O, no Date, no Math.random, no exceptions
 *   for control flow on invalid input (every check returns pass/fail).
 * - Zero runtime imports: this file must compile and run verbatim on both
 *   the API server (Node) and the mobile client (Hermes/RN).
 * - Vendored verbatim from `api-server/src/practice/validator.ts`; keep the
 *   logic of the two copies identical. The constant-sync test in
 *   `api-server/test/practiceValidator.test.ts` guards the contract side.
 *
 * Offset semantics: cloze `char_start`/`char_end` are UTF-16 code-unit
 * offsets (native JS `string.slice` semantics). Lesson sentences with
 * decomposed combining marks or astral-plane characters must be stored
 * NFC-normalized by the generator, otherwise span checks fail closed.
 *
 * Known limitations (out of scope for MVP, see issue):
 * - True synonymy between distractors ("xe hơi" vs "ô tô") cannot be
 *   proven mechanically; the validator catches normalization, substring
 *   and word-order equivalence only. Semantic ambiguity review needs a
 *   gold set / LLM review (phase 2).
 * - Cloze distractor validity is approximated as "filled distractor must
 *   not reproduce the canonical sentence". A distractor that forms a
 *   *different but still grammatical* sentence is not detectable here —
 *   per spec, when uniqueness cannot be proven the question is discarded,
 *   so this check fails closed on exact reproduction and documents the
 *   residual risk instead of pretending to prove it.
 * - `sentence_order` is out of scope (needs a versioned tokenizer).
 */

export const VALIDATOR_VERSION = 'validator-v1';
export const CLOZE_PLACEHOLDER = '___';
export const EXPECTED_SNAPSHOT_SCHEMA_VERSION = 'snapshot-v1';

/** Contract versions this validator accepts. Mirrors PRACTICE_CONTRACT_VERSION. */
export const SUPPORTED_CONTRACT_VERSIONS: readonly number[] = [1];

export const MEANING_MIN_OPTIONS = 3;
export const MEANING_MAX_OPTIONS = 4;
export const CLOZE_MIN_OPTIONS = 2;

/** Matches the legacy generator placeholder `Nghĩa khác N` (lessonWorker). */
const PLACEHOLDER_OPTION_PATTERN = /nghĩa\s*khác/i;

// ---------------------------------------------------------------------------
// Input types (structural; compatible with PracticeQuestionSchema output but
// decoupled from zod so this file stays dependency-free and mobile-safe).
// ---------------------------------------------------------------------------

export type PracticeOptionInput = {
  id: string;
  text: string;
};

export type SourceRefKind = 'sentence' | 'vocabulary' | 'grammar';

export type SourceRefInput = {
  kind: SourceRefKind;
  id: string;
};

export type SourceSnapshotInput = {
  snapshot_schema_version: string;
  source_text?: string;
  surface_form?: string;
  canonical_meaning?: string;
  translation?: string;
};

type QuestionBaseInput = {
  id: string;
  skill: string;
  difficulty: string;
  prompt_vi: string;
  explanation_vi: string;
  source_refs: SourceRefInput[];
  source_snapshot: SourceSnapshotInput;
  options: PracticeOptionInput[];
  correct_option_id: string;
};

export type MeaningChoiceInput = QuestionBaseInput & {
  variant: 'meaning_choice';
  vocabulary_id: string;
};

export type ClozeChoiceInput = QuestionBaseInput & {
  variant: 'cloze_choice';
  sentence_id: string;
  stem_with_placeholder: string;
  blank: {
    char_start: number;
    char_end: number;
    source_text: string;
  };
};

export type PracticeQuestionInput = MeaningChoiceInput | ClozeChoiceInput;

/** Lesson source index at the set's `lesson_revision` (built by the caller). */
export type LessonSourceIndex = {
  lessonRevision: number;
  vocabularyById: Record<string, {meaning_vi: string}>;
  sentenceById: Record<string, {text: string}>;
  /** Existence only — grammar payload is not needed for validation. */
  grammarById: Record<string, unknown>;
};

export type ValidationContext = {
  /** Contract version claimed by the practice set. */
  contractVersion: number;
  lesson: LessonSourceIndex;
  /** All question IDs in the set (for set-level uniqueness). */
  questionIdsInSet: readonly string[];
};

// ---------------------------------------------------------------------------
// Results
// ---------------------------------------------------------------------------

export type CheckCode =
  | 'CONTRACT_VERSION_SUPPORTED'
  | 'QUESTION_ID_NON_EMPTY'
  | 'QUESTION_IDS_UNIQUE'
  | 'PROMPT_NON_EMPTY'
  | 'EXPLANATION_NON_EMPTY'
  | 'OPTION_IDS_UNIQUE'
  | 'OPTION_TEXT_NON_EMPTY'
  | 'CORRECT_OPTION_IN_OPTIONS'
  | 'OPTION_TEXT_UNIQUE'
  | 'ANSWER_LEAK_FREE'
  | 'SOURCE_REFS_EXIST'
  | 'SOURCE_SNAPSHOT_MATCH'
  | 'MEANING_VOCAB_EXISTS'
  | 'MEANING_ANSWER_CANONICAL'
  | 'MEANING_OPTION_COUNT'
  | 'MEANING_ANSWER_SINGLETON'
  | 'MEANING_DISTRACTOR_DISTINCT'
  | 'MEANING_NO_PLACEHOLDER'
  | 'CLOZE_SINGLE_PLACEHOLDER'
  | 'CLOZE_SPAN_RECONSTRUCTS_STEM'
  | 'CLOZE_BLANK_MATCHES_SOURCE'
  | 'CLOZE_ANSWER_RECONSTRUCTS_CANONICAL'
  | 'CLOZE_DISTRACTOR_UNIQUE';

export type CheckResult = {
  code: CheckCode;
  passed: boolean;
  message: string;
};

export type QuestionValidation = {
  questionId: string;
  /** True iff every check passed (hard gate — no partial credit). */
  passed: boolean;
  validatorVersion: string;
  checks: CheckResult[];
};

export type SetValidation = {
  passed: boolean;
  validatorVersion: string;
  /** Set-level checks (currently QUESTION_IDS_UNIQUE). */
  checks: CheckResult[];
  perQuestion: QuestionValidation[];
  validQuestionIds: string[];
  invalidQuestionIds: string[];
};

/** Metadata shape matching PracticeValidationSchema — stamp onto questions. */
export type ValidationMetadata = {
  validator_version: string;
  checks: string[];
  passed: boolean;
};

// ---------------------------------------------------------------------------
// Normalization
// ---------------------------------------------------------------------------

/**
 * Canonical text normalization for option comparison:
 * NFKC (folds composed/decomposed Vietnamese diacritics and compatibility
 * characters) + lowercase + trim + collapse all whitespace runs to one space.
 */
export function normalizeOptionText(text: string): string {
  return (text as string)
    .normalize('NFKC')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}

// Token multiset used for word-order equivalence ("táo quả" vs "quả táo").
function sortedTokens(normalized: string): string[] {
  return normalized.split(' ').filter(Boolean).sort();
}

function sameTokenMultiset(a: string, b: string): boolean {
  const ta = sortedTokens(a);
  const tb = sortedTokens(b);
  return ta.length === tb.length && ta.every((token, i) => token === tb[i]);
}

/**
 * Mechanical equivalence between a distractor and the answer: same string,
 * substring containment either way, or same words in a different order.
 * True synonymy is NOT decidable here (see file header).
 */
export function isEquivalentToAnswer(
  distractorText: string,
  answerText: string,
): boolean {
  const d = normalizeOptionText(distractorText);
  const a = normalizeOptionText(answerText);
  if (!d || !a) {
    return true; // Empty side is degenerate — treat as equivalent (fail closed).
  }
  if (d === a) {
    return true;
  }
  if (d.includes(a) || a.includes(d)) {
    return true;
  }
  return sameTokenMultiset(d, a);
}

function check(code: CheckCode, passed: boolean, message: string): CheckResult {
  return {code, passed, message};
}

function findOption(
  question: QuestionBaseInput,
  optionId: string,
): PracticeOptionInput | undefined {
  return question.options.find(option => option.id === optionId);
}

// ---------------------------------------------------------------------------
// Common checks (§7 "Chung")
// ---------------------------------------------------------------------------

function runCommonChecks(
  question: PracticeQuestionInput,
  ctx: ValidationContext,
): CheckResult[] {
  const results: CheckResult[] = [];

  results.push(
    check(
      'CONTRACT_VERSION_SUPPORTED',
      SUPPORTED_CONTRACT_VERSIONS.includes(ctx.contractVersion),
      SUPPORTED_CONTRACT_VERSIONS.includes(ctx.contractVersion)
        ? `contract_version ${ctx.contractVersion} supported`
        : `contract_version ${
            ctx.contractVersion
          } not in [${SUPPORTED_CONTRACT_VERSIONS.join(', ')}]`,
    ),
  );

  results.push(
    check(
      'QUESTION_ID_NON_EMPTY',
      question.id.trim().length > 0,
      question.id.trim().length > 0
        ? 'question id present'
        : 'question id empty',
    ),
  );

  results.push(
    check(
      'PROMPT_NON_EMPTY',
      question.prompt_vi.trim().length > 0,
      question.prompt_vi.trim().length > 0
        ? 'prompt present'
        : 'prompt_vi empty',
    ),
  );

  results.push(
    check(
      'EXPLANATION_NON_EMPTY',
      question.explanation_vi.trim().length > 0,
      question.explanation_vi.trim().length > 0
        ? 'explanation present'
        : 'explanation_vi empty',
    ),
  );

  const ids = question.options.map(option => option.id);
  results.push(
    check(
      'OPTION_IDS_UNIQUE',
      new Set(ids).size === ids.length,
      new Set(ids).size === ids.length
        ? 'option ids unique'
        : 'duplicate option id',
    ),
  );

  results.push(
    check(
      'OPTION_TEXT_NON_EMPTY',
      question.options.every(option => option.text.trim().length > 0),
      question.options.every(option => option.text.trim().length > 0)
        ? 'all option texts non-empty'
        : 'empty option text',
    ),
  );

  const correct = findOption(question, question.correct_option_id);
  results.push(
    check(
      'CORRECT_OPTION_IN_OPTIONS',
      correct !== undefined,
      correct !== undefined
        ? 'correct_option_id resolves to an option'
        : `correct_option_id ${question.correct_option_id} not in options`,
    ),
  );

  const normalizedTexts = question.options.map(option =>
    normalizeOptionText(option.text),
  );
  results.push(
    check(
      'OPTION_TEXT_UNIQUE',
      new Set(normalizedTexts).size === normalizedTexts.length,
      new Set(normalizedTexts).size === normalizedTexts.length
        ? 'option texts unique after normalize'
        : 'duplicate option text after normalize',
    ),
  );

  // Answer leak: the canonical answer must not appear in pre-submit visible
  // fields outside its intended position (the options). Explanation is
  // post-submit and therefore exempt. For cloze, the stem is exempt — it
  // carries the placeholder by construction and repeated surface forms
  // elsewhere in the sentence are a phase-2 concern (see header).
  if (correct === undefined) {
    results.push(
      check(
        'ANSWER_LEAK_FREE',
        false,
        'answer unresolvable; cannot prove leak-free',
      ),
    );
  } else {
    const normalizedAnswer = normalizeOptionText(correct.text);
    const normalizedPrompt = normalizeOptionText(question.prompt_vi);
    const leaked =
      normalizedAnswer.length > 0 &&
      normalizedPrompt.includes(normalizedAnswer);
    results.push(
      check(
        'ANSWER_LEAK_FREE',
        !leaked,
        leaked
          ? 'answer text leaked in prompt_vi'
          : 'no answer leak in prompt_vi',
      ),
    );
  }

  results.push(
    check(
      'SOURCE_REFS_EXIST',
      question.source_refs.length > 0 &&
        question.source_refs.every(ref => {
          if (ref.kind === 'vocabulary') {
            return ctx.lesson.vocabularyById[ref.id] !== undefined;
          }
          if (ref.kind === 'sentence') {
            return ctx.lesson.sentenceById[ref.id] !== undefined;
          }
          return ctx.lesson.grammarById[ref.id] !== undefined;
        }),
      question.source_refs.length === 0
        ? 'source_refs empty'
        : question.source_refs.every(ref => {
            if (ref.kind === 'vocabulary') {
              return ctx.lesson.vocabularyById[ref.id] !== undefined;
            }
            if (ref.kind === 'sentence') {
              return ctx.lesson.sentenceById[ref.id] !== undefined;
            }
            return ctx.lesson.grammarById[ref.id] !== undefined;
          })
        ? `all source_refs resolve at lesson_revision ${ctx.lesson.lessonRevision}`
        : 'source_ref missing from lesson source',
    ),
  );

  results.push(runSnapshotCheck(question, ctx));

  return results;
}

function runSnapshotCheck(
  question: PracticeQuestionInput,
  ctx: ValidationContext,
): CheckResult {
  const snapshot = question.source_snapshot;
  if (snapshot.snapshot_schema_version !== EXPECTED_SNAPSHOT_SCHEMA_VERSION) {
    return check(
      'SOURCE_SNAPSHOT_MATCH',
      false,
      `snapshot_schema_version ${snapshot.snapshot_schema_version} != ${EXPECTED_SNAPSHOT_SCHEMA_VERSION}`,
    );
  }
  if (question.variant === 'meaning_choice') {
    const vocab = ctx.lesson.vocabularyById[question.vocabulary_id];
    if (vocab === undefined) {
      return check(
        'SOURCE_SNAPSHOT_MATCH',
        false,
        'vocabulary missing; snapshot cannot match',
      );
    }
    const matches = snapshot.canonical_meaning === vocab.meaning_vi;
    return check(
      'SOURCE_SNAPSHOT_MATCH',
      matches,
      matches
        ? 'snapshot canonical_meaning matches source'
        : 'snapshot canonical_meaning drifted from source',
    );
  }
  const sentence = ctx.lesson.sentenceById[question.sentence_id];
  if (sentence === undefined) {
    return check(
      'SOURCE_SNAPSHOT_MATCH',
      false,
      'sentence missing; snapshot cannot match',
    );
  }
  const matches = snapshot.source_text === sentence.text;
  return check(
    'SOURCE_SNAPSHOT_MATCH',
    matches,
    matches
      ? 'snapshot source_text matches source'
      : 'snapshot source_text drifted from source',
  );
}

// ---------------------------------------------------------------------------
// meaning_choice (§7)
// ---------------------------------------------------------------------------

export function validateMeaningChoice(
  question: MeaningChoiceInput,
  ctx: ValidationContext,
): QuestionValidation {
  const checks = runCommonChecks(question, ctx);

  const vocab = ctx.lesson.vocabularyById[question.vocabulary_id];
  checks.push(
    check(
      'MEANING_VOCAB_EXISTS',
      vocab !== undefined,
      vocab !== undefined
        ? 'vocabulary exists'
        : `vocabulary ${question.vocabulary_id} missing`,
    ),
  );

  const correct = findOption(question, question.correct_option_id);
  const canonicalMatch =
    vocab !== undefined &&
    correct !== undefined &&
    correct.text === vocab.meaning_vi;
  checks.push(
    check(
      'MEANING_ANSWER_CANONICAL',
      canonicalMatch,
      canonicalMatch
        ? 'answer equals canonical meaning_vi'
        : 'answer differs from canonical meaning_vi',
    ),
  );

  const countOk =
    question.options.length >= MEANING_MIN_OPTIONS &&
    question.options.length <= MEANING_MAX_OPTIONS;
  checks.push(
    check(
      'MEANING_OPTION_COUNT',
      countOk,
      countOk
        ? `${question.options.length} options within [${MEANING_MIN_OPTIONS}, ${MEANING_MAX_OPTIONS}]`
        : `${question.options.length} options outside [${MEANING_MIN_OPTIONS}, ${MEANING_MAX_OPTIONS}]`,
    ),
  );

  if (correct === undefined) {
    checks.push(
      check('MEANING_ANSWER_SINGLETON', false, 'answer unresolvable'),
    );
  } else {
    const normalizedAnswer = normalizeOptionText(correct.text);
    const occurrences = question.options.filter(
      option => normalizeOptionText(option.text) === normalizedAnswer,
    ).length;
    checks.push(
      check(
        'MEANING_ANSWER_SINGLETON',
        occurrences === 1,
        occurrences === 1
          ? 'answer appears exactly once after normalize'
          : `answer appears ${occurrences} times after normalize`,
      ),
    );
  }

  const distinct =
    correct !== undefined &&
    question.options.every(
      option =>
        option.id === correct.id ||
        !isEquivalentToAnswer(option.text, correct.text),
    );
  checks.push(
    check(
      'MEANING_DISTRACTOR_DISTINCT',
      distinct,
      distinct
        ? 'no distractor equivalent to answer'
        : 'distractor equivalent to answer',
    ),
  );

  const noPlaceholder = question.options.every(
    option => !PLACEHOLDER_OPTION_PATTERN.test(option.text),
  );
  checks.push(
    check(
      'MEANING_NO_PLACEHOLDER',
      noPlaceholder,
      noPlaceholder
        ? 'no placeholder options'
        : 'placeholder option (Nghĩa khác N)',
    ),
  );

  return finish(question.id, checks);
}

// ---------------------------------------------------------------------------
// cloze_choice (§7)
// ---------------------------------------------------------------------------

function countPlaceholders(stem: string): number {
  return stem.split(CLOZE_PLACEHOLDER).length - 1;
}

function validSpan(
  sentenceText: string,
  charStart: number,
  charEnd: number,
): boolean {
  return (
    Number.isInteger(charStart) &&
    Number.isInteger(charEnd) &&
    charStart >= 0 &&
    charStart < charEnd &&
    charEnd <= sentenceText.length
  );
}

export function validateClozeChoice(
  question: ClozeChoiceInput,
  ctx: ValidationContext,
): QuestionValidation {
  const checks = runCommonChecks(question, ctx);

  const sentence = ctx.lesson.sentenceById[question.sentence_id];
  const sentenceText = sentence?.text;

  const placeholderCount = countPlaceholders(question.stem_with_placeholder);
  checks.push(
    check(
      'CLOZE_SINGLE_PLACEHOLDER',
      placeholderCount === 1,
      placeholderCount === 1
        ? 'exactly one placeholder'
        : `${placeholderCount} placeholders`,
    ),
  );

  if (sentenceText === undefined) {
    checks.push(
      check(
        'CLOZE_SPAN_RECONSTRUCTS_STEM',
        false,
        `sentence ${question.sentence_id} missing`,
      ),
      check(
        'CLOZE_BLANK_MATCHES_SOURCE',
        false,
        `sentence ${question.sentence_id} missing`,
      ),
    );
  } else {
    const {char_start: start, char_end: end} = question.blank;
    const spanOk = validSpan(sentenceText, start, end);
    const reconstructed =
      spanOk &&
      sentenceText.slice(0, start) +
        CLOZE_PLACEHOLDER +
        sentenceText.slice(end) ===
        question.stem_with_placeholder;
    checks.push(
      check(
        'CLOZE_SPAN_RECONSTRUCTS_STEM',
        reconstructed === true,
        reconstructed === true
          ? 'span removal reconstructs stem'
          : 'span removal does not reconstruct stem',
      ),
    );

    const blankOk =
      spanOk && sentenceText.slice(start, end) === question.blank.source_text;
    checks.push(
      check(
        'CLOZE_BLANK_MATCHES_SOURCE',
        blankOk === true,
        blankOk === true
          ? 'blank matches source span'
          : 'blank mismatches source span',
      ),
    );
  }

  const correct = findOption(question, question.correct_option_id);
  const optionCountOk = question.options.length >= CLOZE_MIN_OPTIONS;
  if (!optionCountOk) {
    checks.push(
      check(
        'CLOZE_DISTRACTOR_UNIQUE',
        false,
        `only ${question.options.length} options, need >= ${CLOZE_MIN_OPTIONS}`,
      ),
    );
  }

  if (
    sentenceText === undefined ||
    correct === undefined ||
    placeholderCount !== 1
  ) {
    checks.push(
      check(
        'CLOZE_ANSWER_RECONSTRUCTS_CANONICAL',
        false,
        'answer reconstruction unprovable (missing sentence, answer, or placeholder)',
      ),
    );
    if (optionCountOk) {
      checks.push(
        check(
          'CLOZE_DISTRACTOR_UNIQUE',
          false,
          'distractor uniqueness unprovable (missing sentence, answer, or placeholder)',
        ),
      );
    }
  } else {
    const filled = question.stem_with_placeholder.replace(
      CLOZE_PLACEHOLDER,
      correct.text,
    );
    const answerOk = filled === sentenceText;
    checks.push(
      check(
        'CLOZE_ANSWER_RECONSTRUCTS_CANONICAL',
        answerOk,
        answerOk
          ? 'answer refills canonical sentence'
          : 'answer does not refill canonical sentence',
      ),
    );

    if (optionCountOk) {
      // A distractor is only publishable if filling it does NOT reproduce
      // the canonical sentence (normalized) and it differs from the answer.
      // Anything unprovable discards the question (fail closed).
      const normalizedCanonical = normalizeOptionText(sentenceText);
      const normalizedAnswer = normalizeOptionText(correct.text);
      const offending = question.options.find(
        option =>
          option.id !== correct.id &&
          (normalizeOptionText(option.text) === normalizedAnswer ||
            normalizeOptionText(
              question.stem_with_placeholder.replace(
                CLOZE_PLACEHOLDER,
                option.text,
              ),
            ) === normalizedCanonical),
      );
      checks.push(
        check(
          'CLOZE_DISTRACTOR_UNIQUE',
          offending === undefined,
          offending === undefined
            ? 'no distractor reproduces the canonical sentence'
            : `distractor ${offending.id} also fills the canonical sentence`,
        ),
      );
    }
  }

  return finish(question.id, checks);
}

// ---------------------------------------------------------------------------
// Dispatch + set-level gate
// ---------------------------------------------------------------------------

export function validateQuestion(
  question: PracticeQuestionInput,
  ctx: ValidationContext,
): QuestionValidation {
  if (question.variant === 'meaning_choice') {
    return validateMeaningChoice(question, ctx);
  }
  return validateClozeChoice(question, ctx);
}

function finish(questionId: string, checks: CheckResult[]): QuestionValidation {
  return {
    questionId,
    passed: checks.every(result => result.passed),
    validatorVersion: VALIDATOR_VERSION,
    checks,
  };
}

/**
 * Set-level validation. Besides per-question hard checks, enforces question
 * ID uniqueness across the set. A set is publishable only when every
 * published question individually passed AND its ID is unique.
 */
export function validateQuestionSet(
  questions: readonly PracticeQuestionInput[],
  ctx: ValidationContext,
): SetValidation {
  const perQuestion = questions.map(question =>
    validateQuestion(question, ctx),
  );

  const ids = questions.map(question => question.id);
  const unique = new Set(ids).size === ids.length;
  const setChecks: CheckResult[] = [
    check(
      'QUESTION_IDS_UNIQUE',
      unique,
      unique ? 'question ids unique in set' : 'duplicate question id in set',
    ),
  ];

  const duplicateIds = new Set(
    ids.filter((id, index) => ids.indexOf(id) !== index),
  );
  // A duplicated ID poisons every question carrying it: none of them may publish.
  const validQuestionIds = perQuestion
    .filter(result => result.passed && !duplicateIds.has(result.questionId))
    .map(result => result.questionId);
  const validIdSet = new Set(validQuestionIds);
  const invalidQuestionIds = perQuestion
    .filter(result => !validIdSet.has(result.questionId))
    .map(result => result.questionId);

  const passed =
    setChecks.every(result => result.passed) && invalidQuestionIds.length === 0;
  return {
    passed,
    validatorVersion: VALIDATOR_VERSION,
    checks: setChecks,
    perQuestion,
    validQuestionIds,
    invalidQuestionIds,
  };
}

/**
 * Publish gate (acceptance criterion 3): the ONLY path to a publishable
 * list. Returns questions that passed every hard check with a unique ID.
 * Generators/publishers must publish `valid` and retry-or-drop `invalid`.
 */
export function partitionForPublish(
  questions: readonly PracticeQuestionInput[],
  validation: SetValidation,
): {valid: PracticeQuestionInput[]; invalid: PracticeQuestionInput[]} {
  const validIds = new Set(validation.validQuestionIds);
  const valid: PracticeQuestionInput[] = [];
  const invalid: PracticeQuestionInput[] = [];
  for (const question of questions) {
    (validIds.has(question.id) ? valid : invalid).push(question);
  }
  return {valid, invalid};
}

/**
 * A set reaches `ready` when the publishable count meets the minimum.
 * The minimum is caller-provided policy (lesson minimum validated source /
 * requested count); default 1 keeps product policy out of the validator.
 */
export function isSetReady(
  validation: SetValidation,
  minValidCount = 1,
): boolean {
  return validation.validQuestionIds.length >= minValidCount;
}

/**
 * Stamp a validation outcome onto a question payload. Shape matches
 * PracticeValidationSchema so `validator_version` is recorded in the
 * result (completion criterion). Pure: returns check codes, no mutation.
 */
export function buildValidationMetadata(
  result: QuestionValidation,
): ValidationMetadata {
  return {
    validator_version: result.validatorVersion,
    checks: result.checks.map(checkResult => checkResult.code),
    passed: result.passed,
  };
}
