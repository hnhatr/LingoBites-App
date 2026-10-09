import {readFileSync} from 'fs';
import {join} from 'path';

import {
  ItemMemoryPayloadSchema,
  LessonOutcomePayloadSchema,
  UnitOutcomePayloadSchema,
} from '../learningOutcomes';
import {UnitSummativeTaskResponseSchema} from '../lesson';
import {SyncPullSuccessResponseSchema} from '../sync';

/** PR 16: the app reads the Server's PR 15–16 fixtures with its own schemas. */
function fixture(name: string): unknown {
  return JSON.parse(
    readFileSync(join(__dirname, 'fixtures', name), 'utf8'),
  ) as unknown;
}

it('parses every learning outcome record the Server sends', () => {
  const response = SyncPullSuccessResponseSchema.parse(
    fixture('valid-sync-learning-outcomes-pull-response.json'),
  );
  const schemas = {
    lesson_outcomes: LessonOutcomePayloadSchema,
    unit_outcomes: UnitOutcomePayloadSchema,
    item_memory: ItemMemoryPayloadSchema,
  } as const;
  expect(response.records.map(record => record.collection)).toEqual([
    'lesson_outcomes',
    'unit_outcomes',
    'item_memory',
  ]);
  for (const record of response.records) {
    expect(
      schemas[record.collection as keyof typeof schemas].safeParse(
        record.payload,
      ).success,
    ).toBe(true);
  }
});

it('parses the unit summative task response', () => {
  const response = UnitSummativeTaskResponseSchema.parse(
    fixture('valid-unit-summative-task-response.json'),
  );
  expect(response.task?.kind).toBe('summative');
  expect(response.task?.response_mode).toBe('speak');
});
