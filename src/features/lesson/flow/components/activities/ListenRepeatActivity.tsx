import React from 'react';

import type {ListenAndRepeatContent} from '@core/schemas/activityContent';

import type {EntryReport} from '../../logic/activityOutcome';
import {sourceClipOf} from '../../logic/sourceClip';
import {EntrySequence} from '../EntrySequence';
import {ListenWriteEntry} from '../ListenWriteEntry';
import {SourceClipPlayer} from '../SourceClipPlayer';

export type ListenRepeatActivityProps = {
  content: ListenAndRepeatContent;
  /** The lesson's video, when it has one: prompts with times play its clip. */
  youtubeVideoId?: string | null;
  onComplete: (reports: EntryReport[]) => void;
};

/**
 * Hear each sentence, say it back, judge yourself — or write what you hear
 * with the tile keyboard instead.
 */
export function ListenRepeatActivity({
  content,
  youtubeVideoId,
  onComplete,
}: ListenRepeatActivityProps) {
  return (
    <EntrySequence
      count={content.prompts.length}
      onComplete={onComplete}
      renderEntry={(index, report) => {
        const prompt = content.prompts[index]!;
        const clip = sourceClipOf(prompt, youtubeVideoId);
        return (
          <>
            {clip ? <SourceClipPlayer key={prompt.id} clip={clip} /> : null}
            <ListenWriteEntry
              key={prompt.id}
              meaning={prompt.textVi}
              model={prompt.textEn}
              onReport={report}
            />
          </>
        );
      }}
    />
  );
}
