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
  'valid-lesson-catalog-response.json':
    '68b2b9a8978c00e38c3b42896b2b4d8d841eaee73b49a8b3ee4e4532a3a569dd',
  'valid-sync-lesson-progress-push-request.json':
    '8be623e3a3eab755fc23924416316c6597d7ee8fd810d91cdb311e2290da4b8d',
  'valid-sync-lesson-progress-pull-response.json':
    '6057a83c3606caed16b54973ad684958849ce72de017b2e3ee626cdad04d40a1',
  /** PR 8: lesson player attempts; the app sends these from PR 10. */
  'valid-sync-activity-attempt-lesson-push-request.json':
    '9f2ae916990aadcd386e3192eac203173b6fa8ecea980bc073701d5b914c13ed',
} as const;

export type LessonContractFixtureFile =
  keyof typeof LESSON_CONTRACT_FIXTURE_SHA256;
