import {getAppConfig} from '@core/api/appConfig';

import {activityCategory} from '../activityCategory';
import {generateStudyBlock} from '../adaptationEngine';
import {
  DEFAULT_TODAY_FEATURES,
  readTodayFeatures,
  refreshTodayFeatures,
  resolveTodayFeatures,
} from '../todayFeatures';
import type {LearnerStateSnapshot} from '../types';

jest.mock('@core/api/appConfig', () => ({
  getAppConfig: jest.fn(),
}));

const mockSettings = new Map<string, string>();

jest.mock('@core/db/database', () => ({
  getDatabase: () => ({
    execute: (sql: string, params: string[] = []) => {
      if (sql.startsWith('SELECT')) {
        const value = mockSettings.get(params[0]);
        return {rows: {item: () => (value ? {value} : undefined)}};
      }
      mockSettings.set(params[0], params[1]);
      return {rows: {item: () => undefined}};
    },
  }),
}));

function jsonResponse(status: number, body: unknown): Response {
  return {status, ok: status < 300, json: async () => body} as Response;
}

function snapshot(): LearnerStateSnapshot {
  return {
    dueReviewCount: 3,
    estimatedReviewMinutes: 2,
    hasDownloadedLessons: true,
    recentErrors: [],
    speakingRecordings: [],
    lastSpeakingAtIso: null,
    lessonProgression: {
      completedLessonIds: ['old'],
      inProgressLessonId: 'current',
      inProgressLessonTitle: 'Chào hỏi',
      nextLessonId: 'next',
      nextLessonTitle: 'Hỏi đường',
      nextLessonEstimatedMinutes: 5,
      oldLessonId: 'old',
      oldLessonTitle: 'Gọi món',
    },
  };
}

beforeEach(() => {
  mockSettings.clear();
  (getAppConfig as jest.Mock).mockReturnValue({
    apiBaseUrl: 'https://api.example',
  });
});

describe('Today features (admin switches)', () => {
  it('uses the defaults before the Server has answered', () => {
    expect(readTodayFeatures()).toEqual(DEFAULT_TODAY_FEATURES);
    expect(DEFAULT_TODAY_FEATURES.listening_remediation).toBe(false);
  });

  it('keeps locked features on and ignores unknown keys', () => {
    const features = resolveTodayFeatures({
      due_review: false,
      next_lesson: false,
      some_future_feature: true,
    });
    expect(features.due_review).toBe(true);
    expect(features.next_lesson).toBe(false);
    expect('some_future_feature' in features).toBe(false);
  });

  it('keeps the Server answer for offline use', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(
      jsonResponse(200, {
        capabilities: {
          today: {features: {next_lesson: false, 'add_lesson.course': false}},
        },
      }),
    );
    const fresh = await refreshTodayFeatures({fetchImpl});
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://api.example/v1/capabilities',
      expect.anything(),
    );
    expect(fresh.next_lesson).toBe(false);
    expect(readTodayFeatures()['add_lesson.course']).toBe(false);

    const offline = jest.fn().mockRejectedValue(new Error('offline'));
    expect((await refreshTodayFeatures({fetchImpl: offline})).next_lesson).toBe(
      false,
    );
  });

  it('keeps what it has when an older Server sends no features', async () => {
    const fetchImpl = jest
      .fn()
      .mockResolvedValue(jsonResponse(200, {capabilities: {}}));
    expect(await refreshTodayFeatures({fetchImpl})).toEqual(
      DEFAULT_TODAY_FEATURES,
    );
  });
});

describe('the plan follows the features', () => {
  it('never plans an activity whose feature is off', () => {
    const all = generateStudyBlock(snapshot(), 'deep-practice', undefined);
    expect(all.activities.map(a => a.type)).toEqual(
      expect.arrayContaining(['next_lesson', 'old_situation_practice']),
    );

    const plan = generateStudyBlock(snapshot(), 'deep-practice', undefined, {
      ...DEFAULT_TODAY_FEATURES,
      next_lesson: false,
      speaking_practice: false,
    });
    const types = plan.activities.map(a => a.type);
    expect(types).not.toContain('next_lesson');
    expect(types).not.toContain('speaking_practice');
    expect(plan.reasonCodes).not.toContain('SPEAKING_GAP_PRIORITY');
    expect(types).toContain('due_review');
  });
});

describe('activity groups', () => {
  it('groups each activity type, unknown types under lessons', () => {
    expect(activityCategory('due_review')).toBe('review');
    expect(activityCategory('error_remediation')).toBe('review');
    expect(activityCategory('continue_lesson')).toBe('lesson');
    expect(activityCategory('speaking_practice')).toBe('skill');
    expect(activityCategory('catalog')).toBe('lesson');
  });
});
