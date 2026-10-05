import {useMemo} from 'react';

import {useAppNavigation} from '@core/navigation';

export type CreateFlow = {
  /** Leave the current creation step (back to the previous step or tab). */
  back: () => void;
  /**
   * Show the created lesson. The creation flow is removed from history, so
   * back from the lesson returns to the tab the flow was started from.
   */
  openCreatedLesson: (lessonId: string) => void;
};

/** Navigation of the create-lesson flow (paste / OCR / YouTube). */
export function useCreateFlow(): CreateFlow {
  const navigation = useAppNavigation();
  return useMemo(
    () => ({
      back: navigation.goBack,
      openCreatedLesson: navigation.finishCreate,
    }),
    [navigation],
  );
}
