import React from 'react';
import {useTranslation} from 'react-i18next';

import {AppText} from '@ui/components/AppText';

import type {
  ActivityContent,
  FillBlankContent,
  MultipleChoiceContent,
  TranslationContent,
} from '@core/schemas/activityContent';

import type {EntryResult} from '../logic/activityOutcome';
import type {FlowActivity, FlowItems} from '../logic/flowContent';
import {FillBlankActivity} from './activities/FillBlankActivity';
import {MultipleChoiceActivity} from './activities/MultipleChoiceActivity';
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
