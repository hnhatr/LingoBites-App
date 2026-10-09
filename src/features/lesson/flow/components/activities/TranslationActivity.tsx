import React from 'react';

import {AppText} from '@ui/components/AppText';

import type {TranslationContent} from '@core/schemas/activityContent';
import type {LessonTask} from '@core/schemas/lesson';

import type {EntryReport} from '../../logic/activityOutcome';
import {acceptedFor, type FlowItems} from '../../logic/flowContent';
import {hintLadder} from '../../logic/hints';
import {EntrySequence} from '../EntrySequence';
import {TypedEntry} from '../TypedEntry';

export type TranslationActivityProps = {
  content: TranslationContent;
  items: FlowItems;
  task: LessonTask | null;
  onComplete: (reports: EntryReport[]) => void;
};

/**
 * Write the Vietnamese sentence in English: the model answer and, with a
 * pattern, every sentence of the pattern are accepted.
 */
export function TranslationActivity({
  content,
  items,
  task,
  onComplete,
}: TranslationActivityProps) {
  return (
    <EntrySequence
      count={content.sentences.length}
      onComplete={onComplete}
      renderEntry={(index, report) => {
        const sentence = content.sentences[index]!;
        const frame = sentence.patternItemId
          ? items.get(sentence.patternItemId)?.text
          : null;
        return (
          <>
            <AppText testID="lesson-flow-prompt" variant="h3">
              {sentence.textVi}
            </AppText>
            <TypedEntry
              accepted={acceptedFor(
                items,
                sentence.modelEn,
                sentence.patternItemId,
              )}
              hints={hintLadder({task, model: sentence.modelEn, frame})}
              modelAnswer={sentence.modelEn}
              onReport={report}
            />
          </>
        );
      }}
    />
  );
}
