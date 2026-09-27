import type {AccountPhase} from '@modules/account';
import {
  buildNavigationMountSnapshot,
  CHARACTERIZATION_INVARIANTS,
} from '@/test-support/characterization';
import {
  CORE_BETA_WITHOUT_REVIEW,
  CORE_WITH_REVIEW,
  ALL_IMPLEMENTED_FEATURES,
  makeTestReleaseConfig,
} from '@/test-support';

const PHASES: AccountPhase[] = [
  'authenticated',
  'needs-onboarding',
  'signed-out',
  'bootstrapping',
  'offline',
  'failed',
];

describe(`${CHARACTERIZATION_INVARIANTS.INV_004} navigation mount matrix`, () => {
  it('pins account gate routes for every account phase', () => {
    const gates = PHASES.map(
      phase =>
        buildNavigationMountSnapshot(
          phase,
          makeTestReleaseConfig(CORE_WITH_REVIEW).features,
        ).accountGateRoute,
    );
    expect(gates).toEqual([
      'Tabs',
      'Onboarding',
      'BootGate',
      'BootGate',
      'BootGate',
      'BootGate',
    ]);
  });

  it('pins root stack and ingestion routes for representative release presets', () => {
    const beta = buildNavigationMountSnapshot(
      'authenticated',
      makeTestReleaseConfig(CORE_BETA_WITHOUT_REVIEW).features,
    );
    expect(beta.rootStackRoutes).toEqual(['Tabs']);
    expect(beta.ingestionRoutes).toMatchObject({
      PasteText: true,
      ImageCapture: true,
      OCRReview: true,
    });

    const withYoutube = buildNavigationMountSnapshot(
      'authenticated',
      makeTestReleaseConfig(ALL_IMPLEMENTED_FEATURES).features,
    );
    expect(withYoutube.rootStackRoutes).toEqual(
      expect.arrayContaining(['YouTubeHistory', 'YouTubeLesson', 'Practice']),
    );
  });
});
