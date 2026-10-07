import type {TtsSpikeRouteParams} from '@features/audio';

export type ProfileMainRouteParams = undefined;
export type PrivacyNoteRouteParams = undefined;
export type ProgressReportRouteParams = undefined;
export type FeatureStatusRouteParams = undefined;
export type AccountSettingsRouteParams = undefined;
export type DataSettingsRouteParams = undefined;
export type AppSettingsRouteParams = undefined;
export type SupportAboutRouteParams = undefined;

export type ProfileStackParamList = {
  ProfileMain: ProfileMainRouteParams;
  PrivacyNote: PrivacyNoteRouteParams;
  ProgressReport: ProgressReportRouteParams;
  FeatureStatus: FeatureStatusRouteParams;
  AccountSettings: AccountSettingsRouteParams;
  DataSettings: DataSettingsRouteParams;
  AppSettings: AppSettingsRouteParams;
  SupportAbout: SupportAboutRouteParams;
  TtsSpike: TtsSpikeRouteParams;
};
