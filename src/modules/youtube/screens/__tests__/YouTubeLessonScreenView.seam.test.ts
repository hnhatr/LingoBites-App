import fs from 'fs';
import path from 'path';

describe('YouTubeLessonScreenView UI seam (LING-113)', () => {
  const viewSource = fs.readFileSync(
    path.join(__dirname, '../YouTubeLessonScreenView.tsx'),
    'utf8',
  );

  it('does not import youtube query ports or review persistence directly', () => {
    expect(viewSource).not.toMatch(/youtubeQueryPort/);
    expect(viewSource).not.toMatch(/@modules\/review/);
    expect(viewSource).not.toMatch(/@modules\/audio/);
  });

  it('does not call progress or lesson repository helpers', () => {
    expect(viewSource).not.toMatch(/getYouTubeProgress/);
    expect(viewSource).not.toMatch(/saveYouTubeProgress/);
    expect(viewSource).not.toMatch(/clearYouTubeProgress/);
    expect(viewSource).not.toMatch(/listFlashcards/);
  });
});
