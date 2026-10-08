// COPY of the Server's `src/modules/curriculum/lessonBlocks/model/activityContent.ts`
// (keep both in sync); the app adds `parseActivityContent`.
import {z} from 'zod';

/**
 * PR 8: what the learner does in an `activity` block, one shape per
 * `activityKind` (`data.content`). Items are referenced by catalog id;
 * accepted answers are never stored here, they come from the pattern frame
 * and its variants (`@core/learning/acceptedAnswers`).
 */

export const ActivityKindValues = [
  'listen_and_repeat',
  'speaking_drill',
  'role_play',
  'fill_blank',
  'multiple_choice',
  'translation',
] as const;

export type ActivityKind = (typeof ActivityKindValues)[number];

export const ACTIVITY_CONTENT_ENTRIES_MAX = 20;
export const ACTIVITY_OPTIONS_MIN = 2;
export const ACTIVITY_OPTIONS_MAX = 6;

const TEXT_MAX = 10_000;
const ENTRY_ID_MAX = 128;

const entryId = z.string().trim().min(1).max(ENTRY_ID_MAX);
const textEn = z.string().trim().min(1).max(TEXT_MAX);
const textVi = z.string().trim().min(1).max(TEXT_MAX);
/** The text around a blank may be empty (a blank at the start or the end). */
const textAround = z.string().max(TEXT_MAX);
const slotName = z.string().regex(/^[a-z][a-z_]{0,23}$/);

function entries<T extends z.ZodTypeAny>(
  entry: T,
  min = 1,
  max = ACTIVITY_CONTENT_ENTRIES_MAX,
) {
  return z
    .array(entry)
    .min(min)
    .max(max)
    .superRefine((list, ctx) => {
      const seen = new Set<string>();
      list.forEach((item, index) => {
        const id = (item as {id: string}).id;
        if (seen.has(id)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'duplicate id',
            path: [index, 'id'],
          });
        }
        seen.add(id);
      });
    });
}

export const ListenAndRepeatContentSchema = z
  .object({
    prompts: entries(
      z
        .object({
          id: entryId,
          textEn,
          textVi,
          itemId: z.string().uuid().optional(),
        })
        .strict(),
    ),
  })
  .strict();

export const SpeakingDrillContentSchema = z
  .object({
    patternItemId: z.string().uuid(),
    combos: entries(
      z
        .object({
          id: entryId,
          values: z
            .record(slotName, textEn)
            .refine(values => Object.keys(values).length > 0, {
              message: 'a combo needs at least one slot value',
            }),
        })
        .strict(),
    ),
  })
  .strict();

export const FillBlankContentSchema = z
  .object({
    questions: entries(
      z
        .object({
          id: entryId,
          beforeEn: textAround,
          afterEn: textAround,
          answer: textEn,
          options: z
            .array(textEn)
            .min(ACTIVITY_OPTIONS_MIN)
            .max(ACTIVITY_OPTIONS_MAX)
            .optional(),
          textVi,
          patternItemId: z.string().uuid().optional(),
          slot: slotName.optional(),
        })
        .strict()
        .superRefine((question, ctx) => {
          if (question.options && !question.options.includes(question.answer)) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: 'options must include the answer',
              path: ['options'],
            });
          }
          if (
            question.options &&
            new Set(question.options).size !== question.options.length
          ) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: 'options must be unique',
              path: ['options'],
            });
          }
        }),
    ),
  })
  .strict();

export const MultipleChoiceContentSchema = z
  .object({
    questions: entries(
      z
        .object({
          id: entryId,
          promptVi: textVi,
          promptEn: textEn.optional(),
          options: entries(
            z.object({id: entryId, text: textEn}).strict(),
            ACTIVITY_OPTIONS_MIN,
            ACTIVITY_OPTIONS_MAX,
          ),
          correctOptionId: entryId,
        })
        .strict()
        .superRefine((question, ctx) => {
          if (!question.options.some(o => o.id === question.correctOptionId)) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: 'correctOptionId must name one of the options',
              path: ['correctOptionId'],
            });
          }
        }),
    ),
  })
  .strict();

export const TranslationContentSchema = z
  .object({
    sentences: entries(
      z
        .object({
          id: entryId,
          textVi,
          modelEn: textEn,
          patternItemId: z.string().uuid().optional(),
        })
        .strict(),
    ),
  })
  .strict();

export const RolePlayContentSchema = z
  .object({
    learnerSpeaker: z.enum(['A', 'B']),
    turns: entries(
      z
        .object({
          id: entryId,
          speaker: z.enum(['A', 'B']),
          textEn,
          textVi,
          patternItemId: z.string().uuid().optional(),
        })
        .strict(),
      2,
    ),
  })
  .strict()
  .superRefine((content, ctx) => {
    if (!content.turns.some(turn => turn.speaker === content.learnerSpeaker)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'the learner needs at least one turn',
        path: ['turns'],
      });
    }
  });

export const ActivityContentSchemas = {
  listen_and_repeat: ListenAndRepeatContentSchema,
  speaking_drill: SpeakingDrillContentSchema,
  fill_blank: FillBlankContentSchema,
  multiple_choice: MultipleChoiceContentSchema,
  translation: TranslationContentSchema,
  role_play: RolePlayContentSchema,
} as const;

export type ActivityContentByKind = {
  [K in ActivityKind]: z.infer<(typeof ActivityContentSchemas)[K]>;
};

export type ActivityContent = ActivityContentByKind[ActivityKind];

export type ListenAndRepeatContent = ActivityContentByKind['listen_and_repeat'];
export type SpeakingDrillContent = ActivityContentByKind['speaking_drill'];
export type FillBlankContent = ActivityContentByKind['fill_blank'];
export type MultipleChoiceContent = ActivityContentByKind['multiple_choice'];
export type TranslationContent = ActivityContentByKind['translation'];
export type RolePlayContent = ActivityContentByKind['role_play'];

export function isActivityKind(value: unknown): value is ActivityKind {
  return (
    typeof value === 'string' &&
    (ActivityKindValues as readonly string[]).includes(value)
  );
}

/**
 * App-only: the typed content of an activity block's `data`, or `null` when
 * the kind is unknown or the content is missing or malformed (the player then
 * says the activity has no content instead of failing).
 */
export function parseActivityContent<K extends ActivityKind>(
  kind: K,
  raw: unknown,
): ActivityContentByKind[K] | null {
  const parsed = ActivityContentSchemas[kind].safeParse(raw);
  return parsed.success ? (parsed.data as ActivityContentByKind[K]) : null;
}
