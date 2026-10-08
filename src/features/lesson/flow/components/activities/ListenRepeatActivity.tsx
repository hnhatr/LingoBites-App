import React from 'react';

import {AppText} from '@ui/components/AppText';

import type {ListenAndRepeatContent} from '@core/schemas/activityContent';

import type {EntryReport} from '../../logic/activityOutcome';
import {EntrySequence} from '../EntrySequence';
import {SpeakSelfCheck} from '../SpeakSelfCheck';

export type ListenRepeatActivityProps = {
  content: ListenAndRepeatContent;
  onComplete: (reports: EntryReport[]) => void;
};

/** Hear each sentence, say it back, judge yourself. */
export function ListenRepeatActivity({
  content,
  onComplete,
}: ListenRepeatActivityProps) {
  return (
    <EntrySequence
      count={content.prompts.length}
      onComplete={onComplete}
      renderEntry={(index, report) => {
        const prompt = content.prompts[index]!;
        return (
          <>
            <AppText color="secondary" testID="lesson-flow-prompt">
              {prompt.textVi}
            </AppText>
            <SpeakSelfCheck
              hints={null}
              model={prompt.textEn}
              onReport={report}
            />
          </>
        );
      }}
    />
  );
}
