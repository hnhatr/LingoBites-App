import React from 'react';

import {AppText} from '@ui/components/AppText';

import {normalizeAnswer} from '@core/learning';
import type {FillBlankContent} from '@core/schemas/activityContent';
import type {LessonTask} from '@core/schemas/lesson';

import type {EntryReport} from '../../logic/activityOutcome';
import {hintLadder} from '../../logic/hints';
import {ChoiceEntry} from '../ChoiceEntry';
import {EntrySequence} from '../EntrySequence';
import {TypedEntry} from '../TypedEntry';

export type FillBlankActivityProps = {
  content: FillBlankContent;
  task: LessonTask | null;
  onComplete: (reports: EntryReport[]) => void;
};

const BLANK = '_____';

/** A sentence with one blank: pick from the choices, or type the words. */
export function FillBlankActivity({
  content,
  task,
  onComplete,
}: FillBlankActivityProps) {
  return (
    <EntrySequence
      count={content.questions.length}
      onComplete={onComplete}
      renderEntry={(index, report) => {
        const question = content.questions[index]!;
        return (
          <>
            <AppText testID="lesson-flow-prompt" variant="h3">
              {`${question.beforeEn}${BLANK}${question.afterEn}`}
            </AppText>
            <AppText color="secondary">{question.textVi}</AppText>
            {question.options ? (
              <ChoiceEntry
                onReport={report}
                options={question.options.map(text => ({id: text, text}))}
                rightId={question.answer}
              />
            ) : (
              <TypedEntry
                accepted={[normalizeAnswer(question.answer)]}
                hints={hintLadder({task, model: question.answer})}
                modelAnswer={question.answer}
                onReport={report}
              />
            )}
          </>
        );
      }}
    />
  );
}
