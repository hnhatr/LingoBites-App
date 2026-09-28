import type {UnifiedLessonsPreviewRouteParams} from '@features/lesson/player';
import type {TtsSpikeRouteParams} from '@features/audio';

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
