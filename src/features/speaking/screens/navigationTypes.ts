export type SpeakingRoomRouteParams = {sentenceText?: string} | undefined;

/** @deprecated TASK-008 replaces entry routes; session uses `ShadowingSession`. */
export type SpeakingShadowingRouteParams = undefined;

export type ShadowingLessonPickerRouteParams = undefined;

export type ShadowingSessionRouteParams = {
  lessonId: string;
  sentenceIndex?: number;
};

export type ShadowingSummaryFailedSentence = {
  sentenceId: string;
  textEn: string;
  recordingId: string;
  localFilePath: string | null;
  serverRecordingId: string | null;
  uploadPending: boolean;
};

export type ShadowingSummaryRouteParams = {
  lessonId: string;
  lessonTitle: string;
  savedCount: number;
  failedCount: number;
  elapsedMs: number;
  failedSentences: ShadowingSummaryFailedSentence[];
};
