import fs from 'node:fs';
import path from 'node:path';

import {isActivityKind, parseActivityContent} from '../activityContent';
import {LessonSnapshotResponseSchema} from '../lesson';
import {
  ActivityAttemptPushPayloadSchema,
  LessonActivityAttemptPayloadSchema,
} from '../sync';

function loadFixture(name: string): unknown {
  return JSON.parse(
    fs.readFileSync(path.join(__dirname, 'fixtures', name), 'utf8'),
  );
}

describe('activity content (PR 8 contract)', () => {
  const snapshot = LessonSnapshotResponseSchema.parse(
    loadFixture('valid-lesson-snapshot-with-spec-response.json'),
  ).lesson;
  const activities = snapshot.blocks.filter(block => block.type === 'activity');

  it('parses the content of every activity of the seed lesson', () => {
    expect(activities.length).toBeGreaterThan(0);
    for (const block of activities) {
      const kind = block.data.activityKind;
      expect(isActivityKind(kind)).toBe(true);
      if (isActivityKind(kind)) {
        expect(parseActivityContent(kind, block.data.content)).not.toBeNull();
      }
    }
  });

  it('parses the composed lesson, whose step 2 replays source clips (S4.3)', () => {
    const composed = LessonSnapshotResponseSchema.parse(
      loadFixture('valid-lesson-snapshot-composed-response.json'),
    ).lesson;
    for (const block of composed.blocks.filter(b => b.type === 'activity')) {
      const kind = block.data.activityKind;
      if (isActivityKind(kind)) {
        expect(parseActivityContent(kind, block.data.content)).not.toBeNull();
      }
    }
    const repeat = composed.blocks.find(
      block => block.data.activityKind === 'listen_and_repeat',
    );
    const content = parseActivityContent(
      'listen_and_repeat',
      repeat?.data.content,
    );
    expect(content?.prompts[0]).toMatchObject({
      sentenceId: composed.sentences[0]?.id,
      startMs: 0,
      endMs: 2000,
    });
    expect(
      parseActivityContent('listen_and_repeat', {
        prompts: [{id: 'p1', textEn: 'Hi', textVi: 'Chào', startMs: 0}],
      }),
    ).toBeNull();
  });

  it('returns null for missing or malformed content', () => {
    expect(parseActivityContent('translation', undefined)).toBeNull();
    expect(parseActivityContent('translation', {prompts: []})).toBeNull();
    expect(
      parseActivityContent('role_play', {
        learnerSpeaker: 'A',
        turns: [
          {id: 't1', speaker: 'B', textEn: 'Hi', textVi: 'Chào'},
          {id: 't2', speaker: 'B', textEn: 'Bye', textVi: 'Tạm biệt'},
        ],
      }),
    ).toBeNull();
    expect(
      parseActivityContent('fill_blank', {
        questions: [
          {
            id: 'q1',
            beforeEn: 'A ',
            afterEn: '',
            answer: 'tea',
            options: ['coffee', 'milk'],
            textVi: 'trà',
          },
        ],
      }),
    ).toBeNull();
    expect(isActivityKind('vocabulary')).toBe(false);
  });
});

describe('lesson activity attempts (PR 8 contract)', () => {
  const request = loadFixture(
    'valid-sync-activity-attempt-lesson-push-request.json',
  ) as {mutations: Array<{payload: unknown}>};

  it('parses the Server fixture', () => {
    for (const mutation of request.mutations) {
      expect(
        LessonActivityAttemptPayloadSchema.safeParse(mutation.payload).success,
      ).toBe(true);
      expect(
        ActivityAttemptPushPayloadSchema.safeParse(mutation.payload).success,
      ).toBe(true);
    }
  });

  it('refuses a supported attempt that passed independently', () => {
    const payload = {
      ...(request.mutations[0]!.payload as Record<string, unknown>),
      support_level: 'hint_1',
      outcome: 'pass_independent',
    };
    expect(LessonActivityAttemptPayloadSchema.safeParse(payload).success).toBe(
      false,
    );
  });

  it('refuses answer text and bad item codes', () => {
    const base = request.mutations[1]!.payload as Record<string, unknown>;
    expect(
      LessonActivityAttemptPayloadSchema.safeParse({...base, answer: 'tea'})
        .success,
    ).toBe(false);
    expect(
      LessonActivityAttemptPayloadSchema.safeParse({
        ...base,
        item_keys: ['coffee'],
      }).success,
    ).toBe(false);
  });

  it('keeps the review, practice and game attempts', () => {
    expect(
      ActivityAttemptPushPayloadSchema.safeParse({
        kind: 'practice',
        activity: 'meaning_choice',
        lesson_id: null,
        item_key: 'word:coffee',
        session_id: null,
        result: 'correct',
        score: 1,
        duration_ms: 1200,
      }).success,
    ).toBe(true);
  });
});
