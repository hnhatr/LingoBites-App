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
    expect(composePickIssue(['Hi, what can I get for you?'])).toBe('too_few');
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
