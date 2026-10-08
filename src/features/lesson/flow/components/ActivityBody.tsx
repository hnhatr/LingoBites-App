import React from 'react';
import {useTranslation} from 'react-i18next';

import {AppText} from '@ui/components/AppText';

import type {ActivityContent} from '@core/schemas/activityContent';

import type {EntryResult} from '../logic/activityOutcome';
import type {FlowActivity, FlowItems} from '../logic/flowContent';

export type ActivityBodyProps = {
  activity: FlowActivity;
  content: ActivityContent;
  items: FlowItems;
  onComplete: (results: EntryResult[]) => void;
};

/** The interactive part of an activity, chosen by its kind. */
export function ActivityBody({activity}: ActivityBodyProps) {
  const {t} = useTranslation();
  switch (activity.kind) {
    default:
      return (
        <AppText color="secondary" testID="lesson-flow-activity-unsupported">
          {t('lessonFlow.activity_unsupported')}
        </AppText>
      );
  }
}
