import fs from 'node:fs';
import path from 'node:path';

import {LessonSnapshotResponseSchema} from '@core/schemas/lesson';

import {
  canComposeFrom,
  composeFailureCopy,
  composePickIssue,
  composeRefusalKey,
  composeStageIndex,
  picksFarApart,
  suggestComposePick,
  togglePick,
} from '../composePick';

function fixture(name: string) {
  return LessonSnapshotResponseSchema.parse(
    JSON.parse(
      fs.readFileSync(
        path.join(
          __dirname,
          '../../../../../core/schemas/__tests__/fixtures',
          name,
        ),
        'utf8',
      ),
    ),
  ).lesson;
}

const progress = (charged: boolean) => ({
  stage: 'writing',
  stage_started_at: null,
  elapsed_ms: 1000,
  expected_ms: 25000,
  quota_charged: charged,
  reason_vi: 'Đây là lời bài hát.',
  suggestion_vi: 'Hãy chọn một đoạn hội thoại.',
  dropped_sentence_ids: [],
});

describe('compose pick rules (S4.3 J8)', () => {
  it('runs the Server precheck on the App', () => {
    expect(composePickIssue([])).toBe('too_few');
    // One sentence is enough when it carries eight words, not a short one.
    expect(
      composePickIssue(['Can I have a large latte with oat milk, please?']),
    ).toBeNull();
    expect(composePickIssue(['Hi, what can I get for you?'])).toBe('too_thin');
    expect(composePickIssue(['Yeah.', 'Oh!', 'Can I have a latte?'])).toBe(
      'too_thin',
    );
    // OCR noise with no Latin letter at all.
    expect(
      composePickIssue(['…  ———  …', 'Can I have a large latte, please?']),
    ).toBe('too_thin');
    expect(composePickIssue(['Can I have a tea?', 'Can I have a tea?'])).toBe(
      'too_thin',
    );
    expect(
      composePickIssue(['a'.repeat(301), 'Can I have a tea, please?']),
    ).toBe('too_long');
    expect(
      composePickIssue([
        'Hi, what can I get for you?',
        'Can I have a large latte, please?',
      ]),
    ).toBeNull();
  });

  it('hints when picks are far apart and caps the pick at 8', () => {
    expect(picksFarApart([0, 1, 2])).toBe(false);
    expect(picksFarApart([0, 1, 9])).toBe(true);
    let picked: string[] = [];
    for (let i = 0; i < 10; i += 1) picked = togglePick(picked, `s${i}`);
    expect(picked).toHaveLength(8);
    expect(togglePick(picked, 's0')).not.toContain('s0');
  });

  it('offers compose on plain lessons only (J1)', () => {
    const plain = fixture('valid-lesson-snapshot-response.json');
    const sixStep = fixture('valid-lesson-snapshot-with-spec-response.json');
    const composed = fixture('valid-lesson-snapshot-composed-response.json');
    expect(canComposeFrom(plain)).toBe(plain.sentences.length >= 2);
    expect(canComposeFrom(sixStep)).toBe(false);
    expect(canComposeFrom(composed)).toBe(false);
  });

  it('says whether a failure was charged from the Server flag (§3.3)', () => {
    const notSuitable = composeFailureCopy(
      {code: 'COMPOSE_NOT_SUITABLE', retryable: false},
      progress(true),
    );
    expect(notSuitable).toMatchObject({
      reasonVi: 'Đây là lời bài hát.',
      chargedKey: 'compose.charged',
      repick: true,
      retry: false,
    });
    expect(
      composeFailureCopy(
        {code: 'COMPOSE_TIMEOUT', retryable: true},
        progress(false),
      ),
    ).toMatchObject({
      messageKey: 'compose.error_timeout',
      chargedKey: 'compose.not_charged',
      retry: true,
    });
    expect(composeRefusalKey('COMPOSE_LIMIT_REACHED')).toBe(
      'compose.error_limit',
    );
    expect(composeRefusalKey('SOMETHING_ELSE')).toBe('compose.error_generic');
  });

  it('orders the progress stages', () => {
    expect(composeStageIndex(null)).toBe(0);
    expect(composeStageIndex('writing')).toBe(2);
    expect(composeStageIndex('done')).toBe(0);
  });
});

describe('suggestComposePick (plan C)', () => {
  const plain = fixture('valid-lesson-snapshot-response.json');
  const sentence = (n: number, textEn: string) => ({
    id: `11111111-1111-4111-8111-${String(n).padStart(12, '0')}`,
    position: n,
    text_en: textEn,
    text_vi: `Câu ${n}.`,
    ipa: 'ə',
    start_ms: null,
    end_ms: null,
  });
  const lesson = (texts: string[]) => ({
    ...plain,
    sentences: texts.map((text, n) => sentence(n, text)),
    analyses: {},
    lesson_items: [],
  });
  const ids = (...positions: number[]) =>
    positions.map(
      n => `11111111-1111-4111-8111-${String(n).padStart(12, '0')}`,
    );

  it('picks every sentence of a short lesson that passes the checks', () => {
    expect(
      suggestComposePick(
        lesson([
          'I wake up at six every morning.',
          'Then I drink a cup of coffee.',
          'After that I walk to the office.',
        ]),
      ),
    ).toEqual(ids(0, 1, 2));
  });

  it('caps the pick at eight sentences', () => {
    const texts = Array.from(
      {length: 12},
      (_, n) => `This is the practice sentence number ${n}.`,
    );
    expect(suggestComposePick(lesson(texts))).toHaveLength(8);
  });

  it('keeps the longest run without a sentence too long to send', () => {
    const tooLong = `${'very '.repeat(70)}long.`;
    expect(
      suggestComposePick(
        lesson([
          'I wake up at six every morning.',
          tooLong,
          'Then I drink a cup of coffee.',
          'After that I walk to the office.',
          'I start work at nine o clock.',
        ]),
      ),
    ).toEqual(ids(2, 3, 4));
  });

  it('suggests nothing when the run would be refused or compose is not allowed', () => {
    expect(suggestComposePick(lesson(['Hi.', 'Ok.', 'Yes.']))).toEqual([]);
    expect(
      suggestComposePick(
        fixture('valid-lesson-snapshot-with-spec-response.json'),
      ),
    ).toEqual([]);
  });
});
