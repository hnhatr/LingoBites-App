export type SpeakingRoomRouteParams = {sentenceText?: string} | undefined;

/** @deprecated TASK-008 replaces entry routes; session uses `ShadowingSession`. */
export type SpeakingShadowingRouteParams = undefined;

export type ShadowingLessonPickerRouteParams = undefined;

export type ShadowingSessionRouteParams = {
  lessonId: string;
  sentenceIndex?: number;
};
