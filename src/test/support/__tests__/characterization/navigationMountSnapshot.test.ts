import {buildNavigationMountSnapshot} from '../../characterization/navigationMountSnapshot';
import {makeTestReleaseConfig} from '../../makeTestReleaseConfig';
import {CORE_WITH_REVIEW} from '../../testFeatureFlagSets';

describe('buildNavigationMountSnapshot', () => {
  it('includes stable keys for ingestion routes', () => {
    const snapshot = buildNavigationMountSnapshot(
      'authenticated',
      makeTestReleaseConfig(CORE_WITH_REVIEW).features,
    );
    expect(Object.keys(snapshot.ingestionRoutes).sort()).toEqual([
      'ImageCapture',
      'MomentReview',
      'OCRReview',
      'PasteText',
      'SituationInput',
    ]);
  });
});
