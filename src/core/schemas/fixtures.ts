/**
 * SHA-256 pins of the Server contract fixtures this build is written against
 * (Server `src/modules/canonicalLesson/model/fixtures.ts`). The copies under
 * `__tests__/fixtures` must keep these exact bytes; a drift on either side is
 * a contract change that updates both pins in the same change.
 */
export const LESSON_CONTRACT_FIXTURE_SHA256 = {
  'valid-lesson-snapshot-response.json':
    '2205bfa1a64c1d3558ca4fe8be16f612f5be8dd1d50e73d90681944827bb29b8',
  /** Lesson A1-DRINKS-L01 of the Server's sample unit "Gọi đồ uống". */
  'valid-lesson-snapshot-with-spec-response.json':
    'e1743120817bcdd24e2482c40b984365225414e0589299d140e1d212445c44fd',
  /** S4.3: a learner's six-step lesson composed from picked sentences. */
  'valid-lesson-snapshot-composed-response.json':
    '5a20fcc8279c3b5851e744f2012009693823e116b5b377e8207597b47911c353',
  'valid-lesson-catalog-response.json':
    '68b2b9a8978c00e38c3b42896b2b4d8d841eaee73b49a8b3ee4e4532a3a569dd',
  'valid-sync-lesson-progress-push-request.json':
    '8be623e3a3eab755fc23924416316c6597d7ee8fd810d91cdb311e2290da4b8d',
  'valid-sync-lesson-progress-pull-response.json':
    '6057a83c3606caed16b54973ad684958849ce72de017b2e3ee626cdad04d40a1',
  /** PR 8: lesson player attempts; the app sends these from PR 10. */
  'valid-sync-activity-attempt-lesson-push-request.json':
    '9f2ae916990aadcd386e3192eac203173b6fa8ecea980bc073701d5b914c13ed',
  /** PR 12: step-5 attempts handed to the server's scorer (app sends from PR 14). */
  'valid-sync-activity-attempt-lesson-pending-push-request.json':
    '8096e20123f02547832969abb91f5c168faf56cfad4207e74681aa2bce18bfb0',
  /** PR 12: evaluation results pulled from the read-only collection (PR 14). */
  'valid-sync-evaluation-pull-response.json':
    '4771d6ebecb41004b72d4bca7d69f92f597c2e0000fb8e01c655bfd8e16355a3',
  /** PR 15: lesson pass, unit outcome and item review schedule (app reads from PR 16). */
  'valid-sync-learning-outcomes-pull-response.json':
    '3d9d3da86de6702a23161ee67c77ee470a970988be1c7068d08dce1878ce1096',
  /** PR 13: upload of a spoken step-5 answer (app sends it from PR 14). */
  'valid-recording-lesson-task-create-request.json':
    '2765231d238f89e16c912d6e204ed6b99973a47d34932b4dc87f8a1ae7074b51',
  /** PR 16: a unit's summative task as `GET /v1/units/:unitId/summative-task` sends it. */
  'valid-unit-summative-task-response.json':
    '159250d7ca9b777d33539e3e24a4f5b4355e3d264d902bd37cc3fdd95a16db10',
  /**
   * PR 10: accepted answers of a pattern; a copy of the Server's
   * `test/fixtures/accepted-answers.json` (read by `@core/learning` tests).
   */
  'accepted-answers.json':
    '80fcb648d9994c76d7a16fbd29e7d238e0c3c20dc3e873ae16132dea4287faef',
} as const;

export type LessonContractFixtureFile =
  keyof typeof LESSON_CONTRACT_FIXTURE_SHA256;
