import {open} from 'react-native-quick-sqlite';
import {__resetMockDatabases} from '../../../../../test-utils/sqliteMock';
import {DB_NAME} from '@shared/db/constants';
import {resetDatabaseForTests} from '@shared/db/database';
import {runMigrations} from '@shared/db/migrations';
import {
  captureErrorEvent,
  insertSpeakingRecording,
} from '@features/speaking/logic/data/SpeakingRepository';
import {
  getLearnerProfileData,
  getLearnerStateSnapshot,
  saveLearnerProfileData,
} from '../todayAdapter';

const NOW = '2026-09-06T12:00:00.000Z';

function setupDb() {
  __resetMockDatabases();
  const db = open({name: DB_NAME});
  resetDatabaseForTests(db);
  runMigrations(db);
  return db;
}

describe('todayAdapter & profile storage', () => {
  beforeEach(() => {
    setupDb();
  });

  it('saves and reads learner profile data safely', () => {
    expect(getLearnerProfileData()).toBeNull();

    saveLearnerProfileData({
      hasInterviewTarget: true,
      careerGoal: 'Software Engineer',
      portfolioProjects: ['LingoBites Mobile App'],
    });

    const profile = getLearnerProfileData();
    expect(profile).toEqual({
      hasInterviewTarget: true,
      careerGoal: 'Software Engineer',
      portfolioProjects: ['LingoBites Mobile App'],
    });
  });

  it('derives learner state snapshot from SQLite repositories (M1-M5)', () => {
    // Seed error event
    captureErrorEvent({
      id: 'err-adapter-1',
      source: 'speaking_room',
      category: 'listening',
      lessonId: 'lesson-1',
      createdAt: NOW,
    });

    // Seed recording
    insertSpeakingRecording({
      id: 'rec-adapter-1',
      mode: 'shadowing',
      filePath: '/docs/rec.m4a',
      durationMs: 3000,
      createdAt: NOW,
    });

    const snapshot = getLearnerStateSnapshot(NOW);

    expect(snapshot.recentErrors).toHaveLength(1);
    expect(snapshot.recentErrors[0].category).toBe('listening');
    expect(snapshot.speakingRecordings).toHaveLength(1);
    expect(snapshot.lastSpeakingAtIso).toBe(NOW);
  });

  it('degrades gracefully when optional profile data is missing', () => {
    const snapshot = getLearnerStateSnapshot(NOW);

    expect(snapshot.profileData).toBeNull();
    expect(snapshot.dueReviewCount).toBe(0);
    expect(snapshot.estimatedReviewMinutes).toBe(0);
  });
});
