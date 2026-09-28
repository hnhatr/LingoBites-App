import {describe, it, expect, beforeEach} from '@jest/globals';
import {open} from 'react-native-quick-sqlite';
import {DB_NAME} from '@shared/db/constants';
import {__resetMockDatabases} from '../../../../../test-utils/sqliteMock';
import {getDatabase, resetDatabaseForTests} from '@shared/db/database';
import {runMigrations} from '@shared/db/migrations';
import {
  getGrammarBookmark,
  saveGrammarBookmark,
  unsaveGrammarBookmark,
  listBookmarkedGrammar,
  listAllBookmarkedGrammar,
} from '../GrammarBookmarkRepository';

describe('GrammarBookmarkRepository', () => {
  beforeEach(() => {
    __resetMockDatabases();
    resetDatabaseForTests(open({name: DB_NAME}));
    runMigrations(getDatabase());
  });

  describe('saveGrammarBookmark', () => {
    it('should create a new grammar bookmark', () => {
      const result = saveGrammarBookmark({
        lessonId: 'lesson-1',
        grammarId: 'grammar-1',
        packageId: 'package-1',
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.duplicate).toBe(false);
      }

      const bookmark = getGrammarBookmark('lesson-1', 'grammar-1');
      expect(bookmark).toMatchObject({
        lessonId: 'lesson-1',
        grammarId: 'grammar-1',
        packageId: 'package-1',
      });
      expect(bookmark?.reactivatedAt).toBeTruthy();
    });

    it('should be idempotent when saving the same bookmark twice', () => {
      const result1 = saveGrammarBookmark({
        lessonId: 'lesson-1',
        grammarId: 'grammar-1',
        packageId: 'package-1',
      });
      const result2 = saveGrammarBookmark({
        lessonId: 'lesson-1',
        grammarId: 'grammar-1',
        packageId: 'package-1',
      });

      expect(result1.ok).toBe(true);
      if (result1.ok) {
        expect(result1.duplicate).toBe(false);
      }
      expect(result2.ok).toBe(true);
      if (result2.ok) {
        expect(result2.duplicate).toBe(true);
      }
    });

    it('should update reactivated_at when re-saving an unsaved bookmark', () => {
      const now1 = new Date().toISOString();
      saveGrammarBookmark({
        lessonId: 'lesson-1',
        grammarId: 'grammar-1',
        packageId: 'package-1',
        now: now1,
      });

      unsaveGrammarBookmark('lesson-1', 'grammar-1');

      const now2 = new Date(Date.parse(now1) + 1000).toISOString();
      saveGrammarBookmark({
        lessonId: 'lesson-1',
        grammarId: 'grammar-1',
        packageId: 'package-1',
        now: now2,
      });

      const bookmark = getGrammarBookmark('lesson-1', 'grammar-1');
      expect(bookmark?.reactivatedAt).toBe(now2);
    });

    it('should allow saving different grammar items in the same lesson', () => {
      saveGrammarBookmark({
        lessonId: 'lesson-1',
        grammarId: 'grammar-1',
        packageId: 'package-1',
      });
      saveGrammarBookmark({
        lessonId: 'lesson-1',
        grammarId: 'grammar-2',
        packageId: 'package-1',
      });

      const bookmark1 = getGrammarBookmark('lesson-1', 'grammar-1');
      const bookmark2 = getGrammarBookmark('lesson-1', 'grammar-2');

      expect(bookmark1).toBeTruthy();
      expect(bookmark2).toBeTruthy();
      expect(bookmark1?.grammarId).toBe('grammar-1');
      expect(bookmark2?.grammarId).toBe('grammar-2');
    });

    it('should allow saving the same grammar item in different lessons', () => {
      saveGrammarBookmark({
        lessonId: 'lesson-1',
        grammarId: 'grammar-1',
        packageId: 'package-1',
      });
      saveGrammarBookmark({
        lessonId: 'lesson-2',
        grammarId: 'grammar-1',
        packageId: 'package-1',
      });

      const bookmark1 = getGrammarBookmark('lesson-1', 'grammar-1');
      const bookmark2 = getGrammarBookmark('lesson-2', 'grammar-1');

      expect(bookmark1).toBeTruthy();
      expect(bookmark2).toBeTruthy();
      expect(bookmark1?.lessonId).toBe('lesson-1');
      expect(bookmark2?.lessonId).toBe('lesson-2');
    });
  });

  describe('unsaveGrammarBookmark', () => {
    it('should unsave a bookmarked grammar item', () => {
      const now = new Date().toISOString();
      saveGrammarBookmark({
        lessonId: 'lesson-1',
        grammarId: 'grammar-1',
        packageId: 'package-1',
        now,
      });

      const result = unsaveGrammarBookmark('lesson-1', 'grammar-1');
      expect(result).toBe(true);

      const bookmark = getGrammarBookmark('lesson-1', 'grammar-1');
      expect(bookmark?.reactivatedAt).toBeNull();
    });

    it('should be idempotent when unsaving an already-unsaved bookmark', () => {
      saveGrammarBookmark({
        lessonId: 'lesson-1',
        grammarId: 'grammar-1',
        packageId: 'package-1',
      });
      unsaveGrammarBookmark('lesson-1', 'grammar-1');

      const result = unsaveGrammarBookmark('lesson-1', 'grammar-1');
      expect(result).toBe(true);

      const bookmark = getGrammarBookmark('lesson-1', 'grammar-1');
      expect(bookmark?.reactivatedAt).toBeNull();
    });

    it('should return false when unsaving a non-existent bookmark', () => {
      const result = unsaveGrammarBookmark('lesson-1', 'grammar-1');
      expect(result).toBe(false);
    });

    it('should update updated_at timestamp on unsave', () => {
      const now1 = new Date().toISOString();
      saveGrammarBookmark({
        lessonId: 'lesson-1',
        grammarId: 'grammar-1',
        packageId: 'package-1',
        now: now1,
      });

      const now2 = new Date(Date.parse(now1) + 1000).toISOString();
      unsaveGrammarBookmark('lesson-1', 'grammar-1', now2);

      const bookmark = getGrammarBookmark('lesson-1', 'grammar-1');
      expect(bookmark?.updatedAt).toBe(now2);
    });
  });

  describe('listBookmarkedGrammar', () => {
    it('should return empty list when no grammar is bookmarked', () => {
      const bookmarks = listBookmarkedGrammar('lesson-1');
      expect(bookmarks).toEqual([]);
    });

    it('should list all active bookmarks for a lesson', () => {
      const now = new Date().toISOString();
      saveGrammarBookmark({
        lessonId: 'lesson-1',
        grammarId: 'grammar-1',
        packageId: 'package-1',
        now,
      });
      saveGrammarBookmark({
        lessonId: 'lesson-1',
        grammarId: 'grammar-2',
        packageId: 'package-1',
        now: new Date(Date.parse(now) + 1000).toISOString(),
      });

      const bookmarks = listBookmarkedGrammar('lesson-1');
      expect(bookmarks).toHaveLength(2);
      expect(bookmarks[0].grammarId).toBe('grammar-2');
      expect(bookmarks[1].grammarId).toBe('grammar-1');
    });

    it('should not include unsaved bookmarks', () => {
      saveGrammarBookmark({
        lessonId: 'lesson-1',
        grammarId: 'grammar-1',
        packageId: 'package-1',
      });
      saveGrammarBookmark({
        lessonId: 'lesson-1',
        grammarId: 'grammar-2',
        packageId: 'package-1',
      });

      unsaveGrammarBookmark('lesson-1', 'grammar-1');

      const bookmarks = listBookmarkedGrammar('lesson-1');
      expect(bookmarks).toHaveLength(1);
      expect(bookmarks[0].grammarId).toBe('grammar-2');
    });

    it('should not include bookmarks from other lessons', () => {
      saveGrammarBookmark({
        lessonId: 'lesson-1',
        grammarId: 'grammar-1',
        packageId: 'package-1',
      });
      saveGrammarBookmark({
        lessonId: 'lesson-2',
        grammarId: 'grammar-1',
        packageId: 'package-1',
      });

      const bookmarks = listBookmarkedGrammar('lesson-1');
      expect(bookmarks).toHaveLength(1);
      expect(bookmarks[0].lessonId).toBe('lesson-1');
    });
  });

  describe('listAllBookmarkedGrammar', () => {
    it('should return empty list when no grammar is bookmarked', () => {
      const bookmarks = listAllBookmarkedGrammar();
      expect(bookmarks).toEqual([]);
    });

    it('should list all active bookmarks across all lessons', () => {
      const now = new Date().toISOString();
      saveGrammarBookmark({
        lessonId: 'lesson-1',
        grammarId: 'grammar-1',
        packageId: 'package-1',
        now,
      });
      saveGrammarBookmark({
        lessonId: 'lesson-2',
        grammarId: 'grammar-2',
        packageId: 'package-1',
        now: new Date(Date.parse(now) + 1000).toISOString(),
      });

      const bookmarks = listAllBookmarkedGrammar();
      expect(bookmarks).toHaveLength(2);
    });

    it('should not include unsaved bookmarks', () => {
      saveGrammarBookmark({
        lessonId: 'lesson-1',
        grammarId: 'grammar-1',
        packageId: 'package-1',
      });
      saveGrammarBookmark({
        lessonId: 'lesson-2',
        grammarId: 'grammar-2',
        packageId: 'package-1',
      });

      unsaveGrammarBookmark('lesson-1', 'grammar-1');

      const bookmarks = listAllBookmarkedGrammar();
      expect(bookmarks).toHaveLength(1);
      expect(bookmarks[0].grammarId).toBe('grammar-2');
    });

    it('should be sorted by updated_at in reverse chronological order', () => {
      const now = new Date().toISOString();
      saveGrammarBookmark({
        lessonId: 'lesson-1',
        grammarId: 'grammar-1',
        packageId: 'package-1',
        now,
      });
      const now2 = new Date(Date.parse(now) + 1000).toISOString();
      saveGrammarBookmark({
        lessonId: 'lesson-2',
        grammarId: 'grammar-2',
        packageId: 'package-1',
        now: now2,
      });
      const now3 = new Date(Date.parse(now2) + 1000).toISOString();
      saveGrammarBookmark({
        lessonId: 'lesson-1',
        grammarId: 'grammar-3',
        packageId: 'package-1',
        now: now3,
      });

      const bookmarks = listAllBookmarkedGrammar();
      expect(bookmarks[0].grammarId).toBe('grammar-3');
      expect(bookmarks[1].grammarId).toBe('grammar-2');
      expect(bookmarks[2].grammarId).toBe('grammar-1');
    });
  });
});
