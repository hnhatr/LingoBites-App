import * as fs from 'node:fs';
import * as path from 'node:path';

/**
 * TASK-018: the render layer must not import repositories, API clients, or
 * local-data deletion services — orchestration lives in useProfileScreen.
 */
describe('ProfileScreen UI seam (TASK-018)', () => {
  const viewPath = path.join(__dirname, '..', 'ProfileScreenView.tsx');
  const source = fs.readFileSync(viewPath, 'utf8');

  it('ProfileScreenView does not import repository or client modules', () => {
    const forbidden = [
      '@shared/api/',
      'Repository',
      'LocalDataDeletionService',
      'getGamificationSnapshot',
      'playReadyChapterAudio',
      'useAudioLibrary',
      'useProgressReport',
      'clearAllLocalData',
      'clearSpeakingLocalData',
    ];
    for (const fragment of forbidden) {
      expect(source).not.toContain(fragment);
    }
  });
});
