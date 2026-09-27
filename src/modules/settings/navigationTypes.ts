import type {UnifiedLessonsPreviewRouteParams} from '@modules/curriculumLesson';
import type {TtsSpikeRouteParams} from '@modules/tts';

export type ProfileMainRouteParams = undefined;
export type PrivacyNoteRouteParams = undefined;
export type ProgressReportRouteParams = undefined;
export type FeatureStatusRouteParams = undefined;

export type ProfileStackParamList = {
  ProfileMain: ProfileMainRouteParams;
  PrivacyNote: PrivacyNoteRouteParams;
  ProgressReport: ProgressReportRouteParams;
  FeatureStatus: FeatureStatusRouteParams;
  TtsSpike: TtsSpikeRouteParams;
  UnifiedLessonsPreview: UnifiedLessonsPreviewRouteParams;
};
