import React from 'react';
import {useTranslation} from 'react-i18next';

import {AppText} from '@ui/components/AppText';

import type {
  ActivityContent,
  FillBlankContent,
  ListenAndRepeatContent,
  MultipleChoiceContent,
  RolePlayContent,
  SpeakingDrillContent,
  TranslationContent,
} from '@core/schemas/activityContent';

import type {EntryResult} from '../logic/activityOutcome';
import type {FlowActivity, FlowItems} from '../logic/flowContent';
import {FillBlankActivity} from './activities/FillBlankActivity';
import {ListenRepeatActivity} from './activities/ListenRepeatActivity';
import {MultipleChoiceActivity} from './activities/MultipleChoiceActivity';
import {RolePlayActivity} from './activities/RolePlayActivity';
import {SpeakingDrillActivity} from './activities/SpeakingDrillActivity';
import {TranslationActivity} from './activities/TranslationActivity';

export type ActivityBodyProps = {
  activity: FlowActivity;
  content: ActivityContent;
  items: FlowItems;
  onComplete: (results: EntryResult[]) => void;
};

/** The interactive part of an activity, chosen by its kind. */
export function ActivityBody({
  activity,
  content,
  items,
  onComplete,
}: ActivityBodyProps) {
  const {t} = useTranslation();
  switch (activity.kind) {
    case 'listen_and_repeat':
      return (
        <ListenRepeatActivity
          content={content as ListenAndRepeatContent}
          onComplete={onComplete}
        />
      );
    case 'speaking_drill':
      return (
        <SpeakingDrillActivity
          content={content as SpeakingDrillContent}
          items={items}
          onComplete={onComplete}
        />
      );
    case 'role_play':
      return (
        <RolePlayActivity
          content={content as RolePlayContent}
          onComplete={onComplete}
        />
      );
    case 'multiple_choice':
      return (
        <MultipleChoiceActivity
          content={content as MultipleChoiceContent}
          onComplete={onComplete}
        />
      );
    case 'fill_blank':
      return (
        <FillBlankActivity
          content={content as FillBlankContent}
          onComplete={onComplete}
        />
      );
    case 'translation':
      return (
        <TranslationActivity
          content={content as TranslationContent}
          items={items}
          onComplete={onComplete}
        />
      );
    default:
      return (
        <AppText color="secondary" testID="lesson-flow-activity-unsupported">
          {t('lessonFlow.activity_unsupported')}
        </AppText>
      );
  }
}
