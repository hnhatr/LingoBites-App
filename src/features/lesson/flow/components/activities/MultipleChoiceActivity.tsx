import React from 'react';

import {AppText} from '@ui/components/AppText';

import type {MultipleChoiceContent} from '@core/schemas/activityContent';

import type {EntryResult} from '../../logic/activityOutcome';
import {ChoiceEntry} from '../ChoiceEntry';
import {EntrySequence} from '../EntrySequence';

export type MultipleChoiceActivityProps = {
  content: MultipleChoiceContent;
  onComplete: (results: EntryResult[]) => void;
};

/** Each question: the prompt (VI, optional EN) and its options. */
export function MultipleChoiceActivity({
  content,
  onComplete,
}: MultipleChoiceActivityProps) {
  return (
    <EntrySequence
      count={content.questions.length}
      onComplete={onComplete}
      renderEntry={(index, report) => {
        const question = content.questions[index]!;
        return (
          <>
            <AppText testID="lesson-flow-prompt" variant="h3">
              {question.promptVi}
            </AppText>
            {question.promptEn ? (
              <AppText color="secondary">{question.promptEn}</AppText>
            ) : null}
            <ChoiceEntry
              onReport={report}
              options={question.options}
              rightId={question.correctOptionId}
            />
          </>
        );
      }}
    />
  );
}
