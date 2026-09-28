import {generateStudyBlock, REASON_CODE_VI_LABELS} from '../adaptationEngine';
import type {LearnerStateSnapshot, TodayMode} from '../types';

function createMockSnapshot(
  overrides: Partial<LearnerStateSnapshot> = {},
): LearnerStateSnapshot {
  return {
    dueReviewCount: 0,
    dueReviewItems: [],
    estimatedReviewMinutes: 0,
    recentErrors: [],
    speakingRecordings: [],
    lastSpeakingAtIso: new Date().toISOString(),
    lessonProgression: {
      completedLessonIds: [],
      nextLessonId: 'lesson-1',
      nextLessonTitle: 'Bài 1: Giao tiếp văn phòng',
      nextLessonEstimatedMinutes: 15,
      prerequisiteGapLessonId: null,
      prerequisiteGapTitle: null,
      oldLessonId: null,
      oldLessonTitle: null,
    },
    fastMasteryItemIds: [],
    recognitionOnlyItemIds: [],
    profileData: null,
    ...overrides,
  };
}

describe('adaptationEngine', () => {
  const mockNow = '2026-09-06T12:00:00.000Z';

  describe('Modes & Time Budgets (REQ-12, REQ-13)', () => {
    it.each<[TodayMode, number]>([
      ['5-minute', 5],
      ['normal', 20],
      ['deep-practice', 45],
    ])(
      'respects time budget for mode %s (target <= %dp)',
      (mode, maxBudget) => {
        const snapshot = createMockSnapshot({
          dueReviewCount: 5,
          estimatedReviewMinutes: 3,
          lessonProgression: {
            completedLessonIds: ['lesson-0'],
            nextLessonId: 'lesson-1',
            nextLessonTitle: 'Bài 1',
            nextLessonEstimatedMinutes: 15,
            oldLessonId: 'lesson-0',
            oldLessonTitle: 'Bài 0',
            prerequisiteGapLessonId: null,
            prerequisiteGapTitle: null,
          },
        });

        const plan = generateStudyBlock(snapshot, mode, mockNow);

        expect(plan.mode).toBe(mode);
        expect(plan.activities.length).toBeGreaterThan(0);
        expect(plan.totalEstimatedMinutes).toBeLessThanOrEqual(maxBudget + 5);
      },
    );
  });

  describe('Backlog Control Threshold Boundaries (REQ-14)', () => {
    it.each([
      // [dueCount, estMinutes, expectedConsolidation, label]
      [20, 10, false, 'due_count=20 & est=10m => normal'],
      [21, 10, true, 'due_count=21 & est=10m => consolidation'],
      [15, 11, true, 'due_count=15 & est=11m => consolidation'],
      [20, 11, true, 'due_count=20 & est=11m => consolidation'],
      [5, 5, false, 'due_count=5 & est=5m => normal'],
    ])(
      'evaluates backlog threshold: %s',
      (dueCount, estMins, expectedConsolidation) => {
        const snapshot = createMockSnapshot({
          dueReviewCount: dueCount,
          estimatedReviewMinutes: estMins,
        });

        const plan = generateStudyBlock(snapshot, 'normal', mockNow);

        expect(plan.isConsolidation).toBe(expectedConsolidation);
        if (expectedConsolidation) {
          expect(plan.reasonCodes).toContain('BACKLOG_CONSOLIDATION');
          expect(plan.explanationVi).toContain('Lượng bài cần ôn tập đang cao');
          // New content should be stopped/reduced during consolidation
          expect(plan.activities.some(a => a.type === 'next_lesson')).toBe(
            false,
          );
        } else {
          expect(plan.reasonCodes).not.toContain('BACKLOG_CONSOLIDATION');
        }
      },
    );
  });

  describe('Individual Adaptation Rules (REQ-30 to REQ-33)', () => {
    it('activates REMEDIATE_RECENT_ERRORS when recent errors exist', () => {
      const snapshot = createMockSnapshot({
        recentErrors: [
          {
            id: 'err-1',
            source: 'speaking_room',
            category: 'vocabulary',
            activityId: 'act-1',
            lessonId: 'les-1',
            reviewItemId: 'rev-1',
            createdAt: mockNow,
          },
        ],
      });

      const plan = generateStudyBlock(snapshot, 'normal', mockNow);

      expect(plan.reasonCodes).toContain('REMEDIATE_RECENT_ERRORS');
      expect(plan.activities.some(a => a.type === 'error_remediation')).toBe(
        true,
      );
      expect(plan.explanationVi).toContain('lỗi sai');
    });

    it('activates LISTENING_REMEDIATION when listening error category exists', () => {
      const snapshot = createMockSnapshot({
        recentErrors: [
          {
            id: 'err-list-1',
            source: 'lesson_runtime',
            category: 'listening',
            activityId: 'act-listen',
            lessonId: 'les-1',
            reviewItemId: 'rev-list',
            createdAt: mockNow,
          },
        ],
      });

      const plan = generateStudyBlock(snapshot, 'normal', mockNow);

      expect(plan.reasonCodes).toContain('LISTENING_REMEDIATION');
      expect(
        plan.activities.some(a => a.type === 'listening_remediation'),
      ).toBe(true);
      expect(plan.explanationVi).toContain('luyện nghe không kịch bản');
    });

    it('activates ACTIVE_RECALL_WEAKNESS for recognition-only weakness', () => {
      const snapshot = createMockSnapshot({
        recognitionOnlyItemIds: ['rec-1', 'rec-2'],
      });

      const plan = generateStudyBlock(snapshot, 'normal', mockNow);

      expect(plan.reasonCodes).toContain('ACTIVE_RECALL_WEAKNESS');
      expect(plan.activities.some(a => a.type === 'active_recall')).toBe(true);
    });

    it('activates PREREQUISITE_NEEDED when prerequisite gap exists', () => {
      const snapshot = createMockSnapshot({
        lessonProgression: {
          completedLessonIds: [],
          nextLessonId: 'lesson-2',
          nextLessonTitle: 'Bài 2: Họp hành',
          nextLessonEstimatedMinutes: 15,
          prerequisiteGapLessonId: 'lesson-1',
          prerequisiteGapTitle: 'Bài 1: Từ vựng văn phòng',
        },
      });

      const plan = generateStudyBlock(snapshot, 'normal', mockNow);

      expect(plan.reasonCodes).toContain('PREREQUISITE_NEEDED');
      expect(plan.activities.some(a => a.type === 'prerequisite_lesson')).toBe(
        true,
      );
      expect(plan.explanationVi).toContain('tiền đề');
    });

    it('activates FAST_MASTERY_VARIATION for fast mastery items', () => {
      const snapshot = createMockSnapshot({
        fastMasteryItemIds: ['fast-1', 'fast-2'],
        lessonProgression: {
          completedLessonIds: ['lesson-0'],
          nextLessonId: 'lesson-1',
          nextLessonTitle: 'Bài 1',
          oldLessonId: 'lesson-0',
          oldLessonTitle: 'Bài 0',
        },
      });

      const plan = generateStudyBlock(snapshot, 'normal', mockNow);

      expect(plan.reasonCodes).toContain('FAST_MASTERY_VARIATION');
      expect(
        plan.activities.some(a => a.type === 'old_situation_practice'),
      ).toBe(true);
    });

    it('activates SPEAKING_GAP_PRIORITY when speaking history is empty or old', () => {
      const snapshot = createMockSnapshot({
        speakingRecordings: [],
        lastSpeakingAtIso: '2026-08-01T00:00:00.000Z', // > 3 days ago
      });

      const plan = generateStudyBlock(snapshot, 'normal', mockNow);

      expect(plan.reasonCodes).toContain('SPEAKING_GAP_PRIORITY');
      expect(plan.activities.some(a => a.type === 'speaking_practice')).toBe(
        true,
      );
      expect(plan.explanationVi).toContain('luyện phát âm');
    });

    it('activates INTERVIEW_PORTFOLIO_PRIORITY when profile has interview target', () => {
      const snapshot = createMockSnapshot({
        profileData: {
          hasInterviewTarget: true,
          careerGoal: 'Software Engineer Interview',
        },
      });

      const plan = generateStudyBlock(snapshot, 'normal', mockNow);

      expect(plan.reasonCodes).toContain('INTERVIEW_PORTFOLIO_PRIORITY');
      expect(plan.activities.some(a => a.type === 'interview_practice')).toBe(
        true,
      );
    });

    it('degrades safely without activating interview rule when profileData is null/missing', () => {
      const snapshot = createMockSnapshot({
        profileData: null,
      });

      const plan = generateStudyBlock(snapshot, 'normal', mockNow);

      expect(plan.reasonCodes).not.toContain('INTERVIEW_PORTFOLIO_PRIORITY');
      expect(plan.activities.some(a => a.type === 'interview_practice')).toBe(
        false,
      );
    });
  });

  describe('Multi-Signal Precedence & Composition (3+ Cases)', () => {
    it('Case 1: Heavy Backlog + Recent Errors + Speaking Gap => Consolidation with errors & speaking', () => {
      const snapshot = createMockSnapshot({
        dueReviewCount: 25,
        estimatedReviewMinutes: 13,
        recentErrors: [
          {
            id: 'err-1',
            source: 'speaking_room',
            category: 'vocabulary',
            activityId: null,
            lessonId: null,
            reviewItemId: null,
            createdAt: mockNow,
          },
        ],
        speakingRecordings: [],
      });

      const plan = generateStudyBlock(snapshot, 'normal', mockNow);

      expect(plan.isConsolidation).toBe(true);
      expect(plan.reasonCodes).toEqual(
        expect.arrayContaining([
          'BACKLOG_CONSOLIDATION',
          'REMEDIATE_RECENT_ERRORS',
          'SPEAKING_GAP_PRIORITY',
        ]),
      );
      // New content is omitted
      expect(plan.activities.some(a => a.type === 'next_lesson')).toBe(false);
    });

    it('Case 2: Listening Error + Interview Target + Normal Backlog => Listening & Interview precedence', () => {
      const snapshot = createMockSnapshot({
        dueReviewCount: 3,
        estimatedReviewMinutes: 2,
        speakingRecordings: [
          {
            id: 'rec-1',
            activityId: 'act-1',
            lessonId: 'lesson-1',
            mode: 'shadowing',
            filePath: '/docs/rec.m4a',
            durationMs: 100,
            createdAt: mockNow,
          },
        ],
        lastSpeakingAtIso: mockNow,
        recentErrors: [
          {
            id: 'err-listen',
            source: 'lesson_runtime',
            category: 'listening',
            activityId: null,
            lessonId: null,
            reviewItemId: null,
            createdAt: mockNow,
          },
        ],
        profileData: {hasInterviewTarget: true},
      });

      const plan = generateStudyBlock(snapshot, 'normal', mockNow);

      expect(plan.isConsolidation).toBe(false);
      expect(plan.reasonCodes).toContain('LISTENING_REMEDIATION');
      expect(plan.reasonCodes).toContain('INTERVIEW_PORTFOLIO_PRIORITY');
      expect(
        plan.activities.some(a => a.type === 'listening_remediation'),
      ).toBe(true);
      expect(plan.activities.some(a => a.type === 'interview_practice')).toBe(
        true,
      );
    });

    it('Case 3: Prerequisite Gap + Fast Mastery + Normal Backlog => Prerequisite before next lesson', () => {
      const snapshot = createMockSnapshot({
        dueReviewCount: 2,
        estimatedReviewMinutes: 1,
        fastMasteryItemIds: ['item-mastered'],
        lessonProgression: {
          completedLessonIds: ['lesson-0'],
          nextLessonId: 'lesson-2',
          nextLessonTitle: 'Bài 2',
          nextLessonEstimatedMinutes: 15,
          prerequisiteGapLessonId: 'lesson-1',
          prerequisiteGapTitle: 'Bài 1',
          oldLessonId: 'lesson-0',
          oldLessonTitle: 'Bài 0',
        },
      });

      const plan = generateStudyBlock(snapshot, 'normal', mockNow);

      expect(plan.isConsolidation).toBe(false);
      expect(plan.reasonCodes).toContain('PREREQUISITE_NEEDED');
      expect(plan.reasonCodes).toContain('FAST_MASTERY_VARIATION');

      const prereqIndex = plan.activities.findIndex(
        a => a.type === 'prerequisite_lesson',
      );
      const nextIndex = plan.activities.findIndex(
        a => a.type === 'next_lesson',
      );

      expect(prereqIndex).toBeGreaterThan(-1);
      if (nextIndex > -1) {
        expect(prereqIndex).toBeLessThan(nextIndex);
      }
    });
  });

  describe('REASON_CODE_VI_LABELS (SETE-257)', () => {
    it('covers every reason code with a Vietnamese label (no raw enums)', () => {
      const codes: Array<keyof typeof REASON_CODE_VI_LABELS> = [
        'BACKLOG_CONSOLIDATION',
        'REMEDIATE_RECENT_ERRORS',
        'LISTENING_REMEDIATION',
        'ACTIVE_RECALL_WEAKNESS',
        'PREREQUISITE_NEEDED',
        'FAST_MASTERY_VARIATION',
        'SPEAKING_GAP_PRIORITY',
        'INTERVIEW_PORTFOLIO_PRIORITY',
        'STANDARD_PROGRESSION',
      ];
      for (const code of codes) {
        const label = REASON_CODE_VI_LABELS[code];
        expect(typeof label).toBe('string');
        expect(label.length).toBeGreaterThan(0);
        expect(label).not.toContain(code);
        expect(label).not.toMatch(/^[A-Z_#]+$/);
      }
      expect(Object.keys(REASON_CODE_VI_LABELS).sort()).toEqual(
        [...codes].sort(),
      );
    });
  });
});
