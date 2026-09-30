import type {TtsSpikeRouteParams} from '@features/audio';
import type {UnifiedLessonsPreviewRouteParams} from '@features/lesson/player';

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
