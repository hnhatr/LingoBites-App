import {
  CURRICULUM_LESSON_FIXTURE_REVISION,
  CURRICULUM_LESSON_SERVER_FIXTURE_SHA,
  CurriculumLessonAggregateSuccessResponseSchema,
  CurriculumLessonBlockSchema,
  CurriculumLessonCheckRequestBodySchema,
  CurriculumLessonErrorCodeSchema,
  parseCurriculumLessonAggregateResponse,
  parseCurriculumLessonBlock,
  parseCurriculumLessonCheckResponse,
} from '../curriculumLessonSchema';
import aggregateFixture from './fixtures/valid-learner-lesson-aggregate.json';
import aggregateResponseFixture from './fixtures/valid-lesson-aggregate-response.json';
import checkResponseFixture from './fixtures/valid-exercise-check-response.json';
import provenance from './fixtures/provenance.json';

describe('curriculumLessonSchema provenance', () => {
  it('records the originating Server SHA and fixture revision', () => {
    expect(provenance.serverCommitSha).toBe(
      '8deca0b3922fcf8d654323ff729e0feda4959c5a',
    );
    expect(provenance.fixtureRevision).toBe('ling-21-wave1-r1');
    expect(provenance.serverCommitSha).toBe(
      CURRICULUM_LESSON_SERVER_FIXTURE_SHA,
    );
    expect(provenance.fixtureRevision).toBe(CURRICULUM_LESSON_FIXTURE_REVISION);
    expect(provenance.files).toEqual([
      'valid-learner-lesson-aggregate.json',
      'valid-lesson-aggregate-response.json',
      'valid-exercise-check-response.json',
    ]);
  });
});

describe('curriculumLessonSchema canonical fixtures', () => {
  it('accepts the canonical learner aggregate with all five block variants', () => {
    const parsed = parseCurriculumLessonAggregateResponse({
      request_id: 'req-1',
      status: 'success',
      lesson: aggregateFixture,
    });
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.requestId).toBe('req-1');
    expect(parsed.lesson.id).toBe(aggregateFixture.id);
    expect(parsed.lesson.blocks.map(block => block.type)).toEqual([
      'text',
      'example',
      'vocabulary',
      'media',
      'exercise',
    ]);
  });

  it('keeps vocabulary items in fixture order with nullable media fields', () => {
    const parsed = parseCurriculumLessonAggregateResponse({
      request_id: 'req-1',
      status: 'success',
      lesson: aggregateFixture,
    });
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const vocabulary = parsed.lesson.blocks[2];
    expect(vocabulary?.type).toBe('vocabulary');
    if (vocabulary?.type !== 'vocabulary') return;
    expect(vocabulary.items).toHaveLength(1);
    expect(vocabulary.items[0]).toMatchObject({
      lemma: 'name',
      meaning: 'tên',
      ipa: '/neɪm/',
      audio: null,
      image: null,
    });
  });

  it('accepts the canonical aggregate success envelope strictly', () => {
    expect(
      CurriculumLessonAggregateSuccessResponseSchema.safeParse(
        aggregateResponseFixture,
      ).success,
    ).toBe(true);
  });

  it('accepts the canonical exercise-check success envelope', () => {
    const parsed = parseCurriculumLessonCheckResponse(checkResponseFixture);
    expect(parsed).toMatchObject({ok: true, correct: true});
    if (!parsed.ok) return;
    expect(parsed.explanation).toMatchObject({en: 'Correct!'});
  });

  it('accepts the strict check request body shape', () => {
    expect(
      CurriculumLessonCheckRequestBodySchema.safeParse({
        answer: {optionId: 'a'},
      }).success,
    ).toBe(true);
    expect(
      CurriculumLessonCheckRequestBodySchema.safeParse({answer: {}}).success,
    ).toBe(false);
    expect(
      CurriculumLessonCheckRequestBodySchema.safeParse({
        answer: {optionId: 'a', extra: 1},
      }).success,
    ).toBe(false);
  });

  it('recognises the four learner error codes', () => {
    for (const code of [
      'LESSON_NOT_FOUND',
      'LESSON_CONTENT_INVALID',
      'EXERCISE_NOT_FOUND',
      'INVALID_EXERCISE_ANSWER',
    ]) {
      expect(CurriculumLessonErrorCodeSchema.safeParse(code).success).toBe(
        true,
      );
    }
  });

  it.each([
    ['valid-learner-lesson-aggregate.json', aggregateFixture],
    ['valid-lesson-aggregate-response.json', aggregateResponseFixture],
    ['valid-exercise-check-response.json', checkResponseFixture],
  ])(
    'fixture %s leaks no answer_key, object_key, or admin fields',
    (_name, fixture) => {
      const serialised = JSON.stringify(fixture);
      expect(serialised).not.toContain('answer_key');
      expect(serialised).not.toContain('object_key');
      expect(serialised).not.toContain('credentials');
    },
  );
});

describe('parseCurriculumLessonBlock fallback', () => {
  it('degrades an unknown block type to unsupported and keeps the rest', () => {
    const lesson = {
      ...(aggregateFixture as {blocks: unknown[]}),
      blocks: [
        ...(aggregateFixture as {blocks: unknown[]}).blocks,
        {id: 'block-x', type: 'quiz', position: 9, data: {}},
      ],
    };
    const parsed = parseCurriculumLessonAggregateResponse({
      request_id: 'req-1',
      status: 'success',
      lesson,
    });
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.lesson.blocks).toHaveLength(6);
    expect(parsed.lesson.blocks[5]).toMatchObject({
      type: 'unsupported',
      blockId: 'block-x',
      position: 9,
    });
  });

  it('degrades a malformed known block without losing its identity', () => {
    const fallback = parseCurriculumLessonBlock({
      id: 'block-bad',
      type: 'text',
      position: 3,
      data: {},
    });
    expect(fallback).toMatchObject({
      type: 'unsupported',
      blockId: 'block-bad',
      position: 3,
    });
  });

  it('nulls identity fields the payload does not provide as strings', () => {
    expect(parseCurriculumLessonBlock({type: 'mystery'})).toMatchObject({
      type: 'unsupported',
      blockId: null,
      position: null,
    });
  });

  it('rejects an exercise block with fewer than two options', () => {
    const raw = {
      id: '00000000-0000-4000-8000-000000000015',
      type: 'exercise',
      position: 4,
      exercise: {
        id: '00000000-0000-4000-8000-000000000040',
        type: 'multiple_choice',
        instruction: 'Choose one.',
        prompt: 'Pick.',
        config: {options: [{id: 'a', label: 'Only'}]},
      },
    };
    expect(CurriculumLessonBlockSchema.safeParse(raw).success).toBe(false);
    expect(parseCurriculumLessonBlock(raw).type).toBe('unsupported');
  });

  it('treats a malformed envelope as a content error, not a lesson', () => {
    expect(parseCurriculumLessonAggregateResponse({nope: true}).ok).toBe(false);
    expect(
      parseCurriculumLessonAggregateResponse({
        request_id: 'req-1',
        status: 'success',
        lesson: {...aggregateFixture, blocks: 'not-an-array'},
      }).ok,
    ).toBe(false);
  });

  it('treats a malformed check envelope as a failure', () => {
    expect(parseCurriculumLessonCheckResponse({correct: 'yes'}).ok).toBe(false);
  });
});

describe('curriculumLessonSchema canonical dialect (ling-21-wave1-r1)', () => {
  const blockId = '00000000-0000-4000-8000-000000000060';

  function block(type: string, payload: unknown, position = 5) {
    return {id: blockId, type, position, ...(payload as object)};
  }

  it('parses context, grammar, and activity blocks strictly', () => {
    expect(
      parseCurriculumLessonBlock(
        block('context', {
          data: {
            phraseEn: 'Daily stand-up',
            phraseVi: 'Họp stand-up',
            explanationVi: 'Giải thích',
          },
        }),
      ).type,
    ).toBe('context');
    expect(
      parseCurriculumLessonBlock(
        block('grammar', {
          data: {
            nameEn: 'Present simple',
            nameVi: 'Hiện tại đơn',
            pattern: 'Subject + V',
            explanationVi: 'Mẫu câu',
            examples: [{en: 'I work', vi: 'Tôi làm việc'}],
          },
        }),
      ).type,
    ).toBe('grammar');
    expect(
      parseCurriculumLessonBlock(
        block('activity', {
          data: {activityKind: 'role_play', titleVi: 'Nhập vai'},
        }),
      ).type,
    ).toBe('activity');
  });

  it('parses fill_blank and translation exercises without answer keys', () => {
    for (const exerciseType of ['fill_blank', 'translation'] as const) {
      const parsed = parseCurriculumLessonBlock(
        block('exercise', {
          exercise: {
            id: '00000000-0000-4000-8000-000000000061',
            type: exerciseType,
            instruction: 'Answer.',
            prompt: 'Say hello.',
            config: exerciseType === 'translation' ? {hintVi: 'Chào'} : {},
          },
        }),
      );
      expect(parsed.type).toBe('exercise');
      if (parsed.type !== 'exercise') continue;
      expect(parsed.exercise.type).toBe(exerciseType);
      expect(JSON.stringify(parsed)).not.toContain('answer_key');
    }
  });

  it('degrades an exercise block that leaks answer_key to unsupported', () => {
    const raw = block('exercise', {
      exercise: {
        id: '00000000-0000-4000-8000-000000000061',
        type: 'fill_blank',
        instruction: 'Fill.',
        prompt: 'I ___ coffee.',
        config: {},
        answer_key: {acceptedTexts: ['like']},
      },
    });
    expect(CurriculumLessonBlockSchema.safeParse(raw).success).toBe(false);
    expect(parseCurriculumLessonBlock(raw)).toMatchObject({
      type: 'unsupported',
      blockId: blockId,
    });
  });

  it('degrades a context block that leaks source_metadata to unsupported', () => {
    const raw = block('context', {
      data: {
        phraseEn: 'Daily stand-up',
        phraseVi: 'Họp stand-up',
        explanationVi: 'Giải thích',
        source_metadata: {sourceRefId: 'chunk-1'},
      },
    });
    expect(parseCurriculumLessonBlock(raw)).toMatchObject({
      type: 'unsupported',
      blockId: blockId,
    });
  });

  it('degrades malformed new block types without losing identity', () => {
    expect(
      parseCurriculumLessonBlock(block('grammar', {data: {}})),
    ).toMatchObject({type: 'unsupported', blockId: blockId});
    expect(
      parseCurriculumLessonBlock(
        block('activity', {data: {activityKind: 'nope', titleVi: 'X'}}),
      ),
    ).toMatchObject({type: 'unsupported', blockId: blockId});
    expect(
      parseCurriculumLessonBlock(
        block('context', {
          data: {
            phraseEn: 'Hi',
            phraseVi: 'Chào',
            explanationVi: 'E',
            dialogueTurns: [
              {id: 'dt-1', speaker: 'A', textEn: 'Hi', textVi: 'Chào'},
              {id: 'dt-1', speaker: 'B', textEn: 'Yo', textVi: 'Ê'},
            ],
          },
        }),
      ).type,
    ).toBe('context');
  });

  it('accepts the bounded text answer variant in the check request body', () => {
    expect(
      CurriculumLessonCheckRequestBodySchema.safeParse({answer: {text: 'like'}})
        .success,
    ).toBe(true);
    expect(
      CurriculumLessonCheckRequestBodySchema.safeParse({answer: {text: '  '}})
        .success,
    ).toBe(false);
    expect(
      CurriculumLessonCheckRequestBodySchema.safeParse({
        answer: {text: 'x'.repeat(513)},
      }).success,
    ).toBe(false);
    expect(
      CurriculumLessonCheckRequestBodySchema.safeParse({
        answer: {optionId: 'a', text: 'like'},
      }).success,
    ).toBe(false);
  });
});
