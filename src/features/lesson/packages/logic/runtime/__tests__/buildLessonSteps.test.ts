/**
 * Pure unit tests for the step-sequence builder (SETE-108 / M3). No SQLite —
 * `LessonRuntimeData` is built by hand so these tests pin the
 * activity-type -> step-kind contract documented in `buildLessonSteps.ts`.
 */

import {buildLessonSteps} from '../buildLessonSteps';
import type {ContentChunkRow} from '@features/lesson/packages/logic/data/ContentRuntimeRepository';
import type {LessonRuntimeData} from '../types';

function chunk(
  overrides: Partial<ContentChunkRow> & {id: string; order: number},
): ContentChunkRow {
  return {
    lessonId: 'lesson-1',
    packageId: 'pkg-1',
    slug: overrides.id,
    phraseEn: `Phrase ${overrides.order}`,
    phraseVi: `Cụm ${overrides.order}`,
    explanationVi: `Giải thích ${overrides.order}`,
    contextSentenceEn: null,
    contextSentenceVi: null,
    grammarRefIds: [],
    vocabRefIds: [],
    dialogueTurns: [],
    qaItems: [],
    audioRefIds: [],
    srsRefIds: [],
    ...overrides,
  };
}

function baseData(
  overrides: Partial<LessonRuntimeData> = {},
): LessonRuntimeData {
  return {
    lesson: {
      id: 'lesson-1',
      packageId: 'pkg-1',
      slug: 'daily-standup',
      titleEn: 'Daily Stand-up',
      titleVi: 'Họp Đứng Hàng Ngày',
      blurbVi: 'blurb',
      level: 'A2',
      targetSkills: ['speaking', 'listening'],
      estimatedDurationMinutes: 20,
    },
    chunks: [],
    activities: [],
    audioAssets: new Map(),
    srsItems: [],
    ...overrides,
  };
}

describe('buildLessonSteps', () => {
  it('emits one context step per chunk, ordered by chunk.order', () => {
    const data = baseData({
      chunks: [chunk({id: 'c2', order: 1}), chunk({id: 'c1', order: 0})],
    });
    const steps = buildLessonSteps(data);
    const contextSteps = steps.filter(s => s.kind === 'context');
    expect(contextSteps.map(s => s.chunkIds[0])).toEqual(['c1', 'c2']);
  });

  it('always ends with exit_check then feedback', () => {
    const data = baseData({chunks: [chunk({id: 'c1', order: 0})]});
    const steps = buildLessonSteps(data);
    expect(steps[steps.length - 2]!.kind).toBe('exit_check');
    expect(steps[steps.length - 1]!.kind).toBe('feedback');
  });

  it.each([
    ['listen_and_repeat', 'shadowing'],
    ['speaking_drill', 'shadowing'],
    ['role_play', 'role_play'],
    ['fill_blank', 'guided_practice'],
    ['translation', 'guided_practice'],
    ['multiple_choice', 'active_recall'],
  ] as const)(
    'maps activity type %s to step kind %s',
    (activityType, expectedKind) => {
      const c1 = chunk({id: 'c1', order: 0});
      const data = baseData({
        chunks: [c1],
        activities: [
          {
            id: 'act-1',
            lessonId: 'lesson-1',
            packageId: 'pkg-1',
            slug: 'act-1',
            type: activityType,
            titleVi: 'Hoạt động',
            chunkRefIds: ['c1'],
            qaRefIds: [],
            instructionsVi: null,
          },
        ],
      });
      const steps = buildLessonSteps(data);
      const activityStep = steps.find(s => s.id === 'activity:act-1');
      expect(activityStep?.kind).toBe(expectedKind);
    },
  );

  it('role_play step collects dialogue turns from referenced chunks', () => {
    const turn = {
      id: 'dt-1',
      slug: 'turn-1',
      speaker: 'A' as const,
      text_en: 'Hi',
      text_vi: 'Chào',
      grammar_ref_ids: [],
    };
    const c1 = chunk({id: 'c1', order: 0, dialogueTurns: [turn]});
    const data = baseData({
      chunks: [c1],
      activities: [
        {
          id: 'act-role',
          lessonId: 'lesson-1',
          packageId: 'pkg-1',
          slug: 'act-role',
          type: 'role_play',
          titleVi: 'Đóng vai',
          chunkRefIds: ['c1'],
          qaRefIds: [],
          instructionsVi: null,
        },
      ],
    });
    const steps = buildLessonSteps(data);
    const rolePlay = steps.find(s => s.kind === 'role_play');
    expect(rolePlay?.dialogueTurnIds).toEqual(['dt-1']);
  });

  it('guided_practice / active_recall resolve qa_ref_ids across chunks', () => {
    const qa = {
      id: 'qa-1',
      slug: 'qa-1',
      type: 'fill_blank' as const,
      question: 'Q?',
      answer: 'A',
    };
    const c1 = chunk({id: 'c1', order: 0, qaItems: [qa]});
    const data = baseData({
      chunks: [c1],
      activities: [
        {
          id: 'act-fill',
          lessonId: 'lesson-1',
          packageId: 'pkg-1',
          slug: 'act-fill',
          type: 'fill_blank',
          titleVi: 'Điền vào chỗ trống',
          chunkRefIds: ['c1'],
          qaRefIds: ['qa-1'],
          instructionsVi: null,
        },
      ],
    });
    const steps = buildLessonSteps(data);
    const guided = steps.find(s => s.kind === 'guided_practice');
    expect(guided?.qaItemIds).toEqual(['qa-1']);
  });

  it('places an activity immediately after its last referenced chunk context', () => {
    const c1 = chunk({id: 'c1', order: 0});
    const c2 = chunk({id: 'c2', order: 1});
    const data = baseData({
      chunks: [c1, c2],
      activities: [
        {
          id: 'act-1',
          lessonId: 'lesson-1',
          packageId: 'pkg-1',
          slug: 'act-1',
          type: 'listen_and_repeat',
          titleVi: 'Shadowing',
          chunkRefIds: ['c1'],
          qaRefIds: [],
          instructionsVi: null,
        },
      ],
    });
    const kinds = buildLessonSteps(data).map(step => step.kind);
    expect(kinds).toEqual([
      'context',
      'shadowing',
      'context',
      'exit_check',
      'feedback',
    ]);
  });

  it('exit_check samples up to 3 qa items across chunks', () => {
    const qaFor = (id: string) => ({
      id,
      slug: id,
      type: 'translation' as const,
      question: 'Q',
      answer: 'A',
    });
    const chunks = [
      chunk({id: 'c1', order: 0, qaItems: [qaFor('qa-1')]}),
      chunk({id: 'c2', order: 1, qaItems: [qaFor('qa-2')]}),
      chunk({id: 'c3', order: 2, qaItems: [qaFor('qa-3')]}),
      chunk({id: 'c4', order: 3, qaItems: [qaFor('qa-4')]}),
    ];
    const steps = buildLessonSteps(baseData({chunks}));
    const exitCheck = steps.find(s => s.kind === 'exit_check');
    expect(exitCheck?.qaItemIds).toEqual(['qa-1', 'qa-2', 'qa-3']);
  });
});
