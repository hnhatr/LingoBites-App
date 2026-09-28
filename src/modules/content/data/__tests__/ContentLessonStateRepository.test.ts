import {describe, it, expect, beforeEach} from '@jest/globals';
import {open} from 'react-native-quick-sqlite';
import {DB_NAME} from '@shared/db/constants';
import {__resetMockDatabases} from '../../../../../test-utils/sqliteMock';
import {getDatabase, resetDatabaseForTests} from '@shared/db/database';
import {runMigrations} from '@shared/db/migrations';
import {
  getContentLessonState,
  saveContentLesson,
  unsaveContentLesson,
  startContentLesson,
  unstartContentLesson,
  listSavedLessons,
  listStartedLessons,
} from '../ContentLessonStateRepository';

describe('ContentLessonStateRepository', () => {
  beforeEach(() => {
    __resetMockDatabases();
    resetDatabaseForTests(open({name: DB_NAME}));
    runMigrations(getDatabase());
  });

  describe('saveContentLesson', () => {
    it('should create a new saved lesson state', () => {
      const result = saveContentLesson({lessonId: 'lesson-1'});

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.duplicate).toBe(false);
      }

      const state = getContentLessonState('lesson-1');
      expect(state).toMatchObject({
        lessonId: 'lesson-1',
        isSaved: true,
        isStarted: false,
      });
    });

    it('should be idempotent when saving the same lesson twice', () => {
      const result1 = saveContentLesson({lessonId: 'lesson-1'});
      const result2 = saveContentLesson({lessonId: 'lesson-1'});

      expect(result1.ok).toBe(true);
      if (result1.ok) {
        expect(result1.duplicate).toBe(false);
      }
      expect(result2.ok).toBe(true);
      if (result2.ok) {
        expect(result2.duplicate).toBe(true);
      }

      const state = getContentLessonState('lesson-1');
      expect(state?.isSaved).toBe(true);
    });

    it('should update updated_at timestamp on duplicate save', () => {
      const now1 = new Date().toISOString();
      saveContentLesson({lessonId: 'lesson-1', now: now1});

      const state1 = getContentLessonState('lesson-1');
      expect(state1?.updatedAt).toBe(now1);

      const now2 = new Date(Date.now() + 1000).toISOString();
      const result = saveContentLesson({lessonId: 'lesson-1', now: now2});
      expect(result.ok).toBe(true);

      const state2 = getContentLessonState('lesson-1');
      expect(state2?.updatedAt).toBe(now2);
    });

    it('should preserve is_started when saving an already-started lesson', () => {
      const startResult = startContentLesson({lessonId: 'lesson-1'});
      expect(startResult.ok).toBe(true);

      const state1 = getContentLessonState('lesson-1');
      expect(state1?.isStarted).toBe(true);
      expect(state1?.isSaved).toBe(false);

      const saveResult = saveContentLesson({lessonId: 'lesson-1'});
      expect(saveResult.ok).toBe(true);

      const state2 = getContentLessonState('lesson-1');
      expect(state2?.isStarted).toBe(true);
      expect(state2?.isSaved).toBe(true);
    });
  });

  describe('unsaveContentLesson', () => {
    it('should unsave a saved lesson', () => {
      saveContentLesson({lessonId: 'lesson-1'});
      const result = unsaveContentLesson('lesson-1');

      expect(result).toBe(true);

      const state = getContentLessonState('lesson-1');
      expect(state?.isSaved).toBe(false);
    });

    it('should be idempotent when unsaving an already-unsaved lesson', () => {
      saveContentLesson({lessonId: 'lesson-1'});
      unsaveContentLesson('lesson-1');

      const result = unsaveContentLesson('lesson-1');
      expect(result).toBe(true);

      const state = getContentLessonState('lesson-1');
      expect(state?.isSaved).toBe(false);
    });

    it('should return false when unsaving a non-existent lesson', () => {
      const result = unsaveContentLesson('non-existent');
      expect(result).toBe(false);
    });

    it('should preserve is_started when unsaving', () => {
      saveContentLesson({lessonId: 'lesson-1'});
      startContentLesson({lessonId: 'lesson-1'});

      unsaveContentLesson('lesson-1');

      const state = getContentLessonState('lesson-1');
      expect(state?.isSaved).toBe(false);
      expect(state?.isStarted).toBe(true);
    });
  });

  describe('startContentLesson', () => {
    it('should create a new started lesson state', () => {
      const result = startContentLesson({lessonId: 'lesson-1'});

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.duplicate).toBe(false);
      }

      const state = getContentLessonState('lesson-1');
      expect(state).toMatchObject({
        lessonId: 'lesson-1',
        isStarted: true,
        isSaved: false,
      });
    });

    it('should be idempotent when starting the same lesson twice', () => {
      const result1 = startContentLesson({lessonId: 'lesson-1'});
      const result2 = startContentLesson({lessonId: 'lesson-1'});

      expect(result1.ok).toBe(true);
      if (result1.ok) {
        expect(result1.duplicate).toBe(false);
      }
      expect(result2.ok).toBe(true);
      if (result2.ok) {
        expect(result2.duplicate).toBe(true);
      }

      const state = getContentLessonState('lesson-1');
      expect(state?.isStarted).toBe(true);
    });

    it('should preserve is_saved when starting an already-saved lesson', () => {
      const saveResult = saveContentLesson({lessonId: 'lesson-1'});
      expect(saveResult.ok).toBe(true);

      const state1 = getContentLessonState('lesson-1');
      expect(state1?.isSaved).toBe(true);
      expect(state1?.isStarted).toBe(false);

      const startResult = startContentLesson({lessonId: 'lesson-1'});
      expect(startResult.ok).toBe(true);

      const state2 = getContentLessonState('lesson-1');
      expect(state2?.isSaved).toBe(true);
      expect(state2?.isStarted).toBe(true);
    });
  });

  describe('unstartContentLesson', () => {
    it('should unstart a started lesson', () => {
      startContentLesson({lessonId: 'lesson-1'});
      const result = unstartContentLesson('lesson-1');

      expect(result).toBe(true);

      const state = getContentLessonState('lesson-1');
      expect(state?.isStarted).toBe(false);
    });

    it('should be idempotent when unstarting an already-unstarted lesson', () => {
      startContentLesson({lessonId: 'lesson-1'});
      unstartContentLesson('lesson-1');

      const result = unstartContentLesson('lesson-1');
      expect(result).toBe(true);

      const state = getContentLessonState('lesson-1');
      expect(state?.isStarted).toBe(false);
    });

    it('should preserve is_saved when unstarting', () => {
      saveContentLesson({lessonId: 'lesson-1'});
      startContentLesson({lessonId: 'lesson-1'});

      unstartContentLesson('lesson-1');

      const state = getContentLessonState('lesson-1');
      expect(state?.isSaved).toBe(true);
      expect(state?.isStarted).toBe(false);
    });
  });

  describe('listSavedLessons', () => {
    it('should return empty list when no lessons are saved', () => {
      const lessons = listSavedLessons();
      expect(lessons).toEqual([]);
    });

    it('should list all saved lessons in reverse chronological order', () => {
      const now = new Date().toISOString();
      saveContentLesson({lessonId: 'lesson-1', now});
      saveContentLesson({
        lessonId: 'lesson-2',
        now: new Date(Date.parse(now) + 1000).toISOString(),
      });
      startContentLesson({lessonId: 'lesson-3', now});

      const lessons = listSavedLessons();
      expect(lessons).toHaveLength(2);
      expect(lessons[0].lessonId).toBe('lesson-2');
      expect(lessons[1].lessonId).toBe('lesson-1');
    });

    it('should not include unsaved lessons', () => {
      saveContentLesson({lessonId: 'lesson-1'});
      unsaveContentLesson('lesson-1');

      const lessons = listSavedLessons();
      expect(lessons).toEqual([]);
    });

    it('should not include started-only lessons', () => {
      startContentLesson({lessonId: 'lesson-1'});

      const lessons = listSavedLessons();
      expect(lessons).toEqual([]);
    });
  });

  describe('listStartedLessons', () => {
    it('should return empty list when no lessons are started', () => {
      const lessons = listStartedLessons();
      expect(lessons).toEqual([]);
    });

    it('should list all started lessons in reverse chronological order', () => {
      const now = new Date().toISOString();
      startContentLesson({lessonId: 'lesson-1', now});
      startContentLesson({
        lessonId: 'lesson-2',
        now: new Date(Date.parse(now) + 1000).toISOString(),
      });
      saveContentLesson({lessonId: 'lesson-3', now});

      const lessons = listStartedLessons();
      expect(lessons).toHaveLength(2);
      expect(lessons[0].lessonId).toBe('lesson-2');
      expect(lessons[1].lessonId).toBe('lesson-1');
    });

    it('should include saved-and-started lessons', () => {
      saveContentLesson({lessonId: 'lesson-1'});
      startContentLesson({lessonId: 'lesson-1'});

      const lessons = listStartedLessons();
      expect(lessons).toHaveLength(1);
      expect(lessons[0]).toMatchObject({
        lessonId: 'lesson-1',
        isSaved: true,
        isStarted: true,
      });
    });

    it('should not include saved-only lessons', () => {
      saveContentLesson({lessonId: 'lesson-1'});

      const lessons = listStartedLessons();
      expect(lessons).toEqual([]);
    });
  });
});
