import {parseYouTubeVideoId} from '../youtubeUrl';

describe('parseYouTubeVideoId', () => {
  it.each([
    ['https://www.youtube.com/watch?v=arj7oStGLkU', 'arj7oStGLkU'],
    ['https://youtu.be/arj7oStGLkU?t=42', 'arj7oStGLkU'],
    ['youtube.com/shorts/arj7oStGLkU', 'arj7oStGLkU'],
    ['https://m.youtube.com/watch?v=arj7oStGLkU&list=x', 'arj7oStGLkU'],
    ['https://www.youtube.com/embed/arj7oStGLkU', 'arj7oStGLkU'],
  ])('reads the id of %s', (input, id) => {
    expect(parseYouTubeVideoId(input)).toBe(id);
  });

  it.each([
    '',
    'hello',
    'https://youtu.be/x',
    'https://vimeo.com/arj7oStGLkU',
    'https://www.youtube.com/channel/arj7oStGLkU',
  ])('returns null for %s', input => {
    expect(parseYouTubeVideoId(input)).toBeNull();
  });
});
