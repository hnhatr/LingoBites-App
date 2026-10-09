import fs from 'node:fs';
import path from 'node:path';

import React from 'react';

import {
  type LessonSnapshot,
  LessonSnapshotResponseSchema,
} from '@core/schemas/lesson';

import {byTestId, has, press, renderWithTheme} from '@test/support/lessonFlow';

import {CanonicalLessonHub} from '../CanonicalLessonHub';

function fixture(name: string): LessonSnapshot {
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

describe('CanonicalLessonHub (S4.3 compose)', () => {
  it('marks a composed lesson and links its source lesson', () => {
    const composed = fixture('valid-lesson-snapshot-composed-response.json');
    const onOpenLesson = jest.fn();
    const tree = renderWithTheme(
      <CanonicalLessonHub
        analyses={{}}
        onOpenLesson={onOpenLesson}
        onOpenSection={jest.fn()}
        snapshot={composed}
      />,
    );
    expect(byTestId(tree, 'canonical-hub-generated')[0]!.props.label).toBe(
      'AI tạo',
    );
    expect(has(tree, 'canonical-hub-inferred')).toBe(false);
    press(tree, 'canonical-hub-source-lesson');
    expect(onOpenLesson).toHaveBeenCalledWith(composed.derived_from_lesson_id);
    // Items ride in the snapshot, so the hub lists them like a curriculum one.
    expect(has(tree, 'canonical-hub-explore-patterns')).toBe(true);
    expect(has(tree, 'canonical-hub-compose')).toBe(false);

    const inferred = renderWithTheme(
      <CanonicalLessonHub
        analyses={{}}
        onOpenSection={jest.fn()}
        snapshot={{...composed, situation_source: 'inferred'}}
      />,
    );
    expect(byTestId(inferred, 'canonical-hub-inferred')[0]!.props.label).toBe(
      'Tình huống do AI gợi ý',
    );
  });

  it('offers "Học theo 6 bước" when the screen allows it', () => {
    const plain = fixture('valid-lesson-snapshot-response.json');
    const onOpenCompose = jest.fn();
    const tree = renderWithTheme(
      <CanonicalLessonHub
        analyses={{}}
        onOpenCompose={onOpenCompose}
        onOpenSection={jest.fn()}
        snapshot={plain}
      />,
    );
    expect(has(tree, 'canonical-hub-generated')).toBe(false);
    press(tree, 'canonical-hub-compose');
    expect(onOpenCompose).toHaveBeenCalled();
  });
});
