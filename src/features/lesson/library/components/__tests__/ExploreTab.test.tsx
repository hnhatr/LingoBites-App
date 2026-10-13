import React from 'react';
import ReactTestRenderer, {act} from 'react-test-renderer';

import {AppThemeProvider} from '@ui/theme';

import {FeatureFlagProvider} from '@core/release';

import {mockAppNavigation} from '@test/support';

import {ExploreTab, shelfPacks} from '../tabs/ExploreTab';

const mockReload = jest.fn();
const mockRefresh = jest.fn();
let mockPacks: {rows: unknown[] | null; offline: boolean} = {
  rows: null,
  offline: false,
};
let mockCatalog: Record<string, unknown> = {status: 'idle'};

jest.mock('@react-navigation/native', () => {
  const ReactModule = require('react');
  return {
    useFocusEffect: (callback: () => void) =>
      ReactModule.useEffect(callback, [callback]),
  };
});

jest.mock('@features/wordPath', () => ({
  useWordPathRows: () => ({...mockPacks, reload: mockReload}),
  packTitle: (_t: unknown, row: {topic: string | null; position: number}) =>
    row.topic ?? `Gói ${row.position}`,
}));

jest.mock('@features/lesson/player', () => ({
  useCanonicalCatalog: () => ({
    state: mockCatalog,
    refresh: mockRefresh,
    loadMore: jest.fn(),
  }),
}));

const pack = (packId: string, status: string, downloaded = true) => ({
  packId,
  titleVi: packId,
  level: 'A1',
  position: 1,
  topic: `Topic ${packId}`,
  topicCode: 'topic:food',
  coverUrl: packId === 'going' ? 'https://cdn.example/going.png' : null,
  total: 10,
  learned: status === 'learning' ? 4 : 0,
  downloaded,
  kind: 'word',
  kindCounts: {word: 10, phrase: 0, pattern: 0, grammar: 0},
  preview: [],
  status,
});

const lesson = (id: string, overrides: Record<string, unknown> = {}) => ({
  id,
  title: `Lesson ${id}`,
  description: '',
  origin: 'admin',
  source_type: 'admin_text',
  content_revision: 1,
  sentence_count: 8,
  youtube_video_id: null,
  unit: null,
  updated_at: '2026-10-06T00:00:00.000Z',
  ...overrides,
});

function render() {
  let tree!: ReactTestRenderer.ReactTestRenderer;
  act(() => {
    tree = ReactTestRenderer.create(
      <FeatureFlagProvider>
        <AppThemeProvider>
          <ExploreTab />
        </AppThemeProvider>
      </FeatureFlagProvider>,
    );
  });
  return tree;
}

const press = (tree: ReactTestRenderer.ReactTestRenderer, id: string) =>
  act(() => {
    tree.root.findByProps({testID: id}).props.onPress();
  });

describe('ExploreTab', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPacks = {
      rows: [pack('new', 'not_downloaded', false), pack('going', 'learning')],
      offline: false,
    };
    mockCatalog = {
      status: 'ready',
      lessons: [lesson('one'), lesson('two')],
      nextCursor: null,
      loadingMore: false,
    };
  });

  it('puts packs being learned first', () => {
    expect(shelfPacks(mockPacks.rows as never).map(row => row.packId)).toEqual([
      'going',
      'new',
    ]);
  });

  it('shows the packs, video and lesson shelves', () => {
    const tree = render();
    expect(
      tree.root.findAllByProps({testID: 'library-pack-going'}),
    ).not.toHaveLength(0);
    expect(
      tree.root.findAllByProps({testID: 'library-shelf-videos-one'}),
    ).not.toHaveLength(0);
    expect(
      tree.root.findAllByProps({testID: 'library-shelf-lessons-two'}),
    ).not.toHaveLength(0);
    expect(mockRefresh).toHaveBeenCalled();
  });

  it('opens a downloaded pack, and the pack list for one to download', () => {
    const tree = render();
    press(tree, 'library-pack-going');
    expect(mockAppNavigation.openWordPack).toHaveBeenCalledWith('going');
    press(tree, 'library-pack-new');
    expect(mockAppNavigation.openLibrarySection).toHaveBeenCalledWith(
      'wordPath',
    );
  });

  it('opens a public lesson and the full lists', () => {
    const tree = render();
    press(tree, 'library-shelf-lessons-one');
    expect(mockAppNavigation.openLesson).toHaveBeenCalledWith('one');
    press(tree, 'library-shelf-videos-all');
    expect(mockAppNavigation.openLibrarySection).toHaveBeenCalledWith(
      'publicVideo',
    );
  });

  it('asks for a connection when the catalog cannot load', () => {
    mockCatalog = {status: 'error', error: {kind: 'network-error'}};
    const tree = render();
    expect(
      tree.root.findByProps({testID: 'library-shelf-lessons-message'}).props
        .children,
    ).toBe('Cần mạng để xem');
    press(tree, 'library-shelf-lessons-retry');
    expect(mockRefresh).toHaveBeenCalled();
  });

  it('says it is offline and keeps the packs on the phone', () => {
    mockPacks = {rows: [pack('going', 'learning')], offline: true};
    const tree = render();
    expect(
      tree.root.findAllByProps({testID: 'library-explore-offline'}),
    ).not.toHaveLength(0);
    expect(
      tree.root.findAllByProps({testID: 'library-pack-going'}),
    ).not.toHaveLength(0);
  });

  it('shows a spinner while the packs load', () => {
    mockPacks = {rows: null, offline: false};
    const tree = render();
    expect(
      tree.root.findAllByProps({testID: 'library-shelf-packs-loading'}),
    ).not.toHaveLength(0);
  });

  it('draws covers: the pack picture, else its default, and level chips', () => {
    const tree = render();
    const image = tree.root.findByProps({
      testID: 'library-pack-going-cover-image',
    });
    expect(image.props.source).toEqual({uri: 'https://cdn.example/going.png'});
    expect(
      tree.root.findAllByProps({testID: 'library-pack-new-cover-default'}),
    ).not.toHaveLength(0);
    expect(
      tree.root.findAllByProps({testID: 'library-pack-new-cover-level'}),
    ).not.toHaveLength(0);
    expect(
      tree.root.findAllByProps({
        testID: 'library-pack-new-cover-badge-download',
      }),
    ).not.toHaveLength(0);
  });

  it('shows the YouTube thumbnail of a video without a cover', () => {
    mockCatalog = {
      status: 'ready',
      lessons: [
        lesson('vid', {youtube_video_id: 'abc123', cefr_level: 'A2'}),
        lesson('own', {
          youtube_video_id: 'abc123',
          cover_url: 'https://cdn.example/own.png',
        }),
      ],
      nextCursor: null,
      loadingMore: false,
    };
    const tree = render();
    const thumb = tree.root.findByProps({
      testID: 'library-shelf-videos-vid-cover-image',
    });
    expect(thumb.props.source).toEqual({
      uri: 'https://i.ytimg.com/vi/abc123/hqdefault.jpg',
    });
    const own = tree.root.findByProps({
      testID: 'library-shelf-lessons-own-cover-image',
    });
    expect(own.props.source).toEqual({uri: 'https://cdn.example/own.png'});
    expect(
      tree.root.findAllByProps({
        testID: 'library-shelf-videos-vid-cover-level',
      }),
    ).not.toHaveLength(0);
  });
});
