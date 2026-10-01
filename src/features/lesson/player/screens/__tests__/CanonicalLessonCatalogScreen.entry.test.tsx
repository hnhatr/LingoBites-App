import React from 'react';
import ReactTestRenderer, {act} from 'react-test-renderer';

import {AppThemeProvider} from '@ui/theme';

import {FeatureFlagProvider} from '@core/release';

import {CanonicalLessonCatalogScreen} from '../CanonicalLessonCatalogScreen';

const CATALOG_LESSON_ID = '33333333-3333-4333-8333-333333333301';

jest.mock('../../logic/useCanonicalCatalog', () => ({
  useCanonicalCatalog: () => ({
    state: {
      status: 'ready',
      lessons: [
        {
          id: CATALOG_LESSON_ID,
          title: 'Morning routine',
          description: 'Three sentences about a weekday morning.',
          origin: 'admin',
          source_type: 'admin_text',
          content_revision: 3,
          sentence_count: 3,
          youtube_video_id: null,
          unit: null,
          updated_at: '2026-09-30T04:15:00.000Z',
        },
      ],
      nextCursor: null,
      loadingMore: false,
    },
    refresh: jest.fn(),
    loadMore: jest.fn(),
  }),
}));

function renderCatalog(navigation: {navigate: jest.Mock; goBack: jest.Mock}) {
  let tree!: ReactTestRenderer.ReactTestRenderer;
  act(() => {
    tree = ReactTestRenderer.create(
      <FeatureFlagProvider releaseConfig={{releaseName: 'test', features: {}}}>
        <AppThemeProvider>
          <CanonicalLessonCatalogScreen
            navigation={navigation as never}
            route={{} as never}
          />
        </AppThemeProvider>
      </FeatureFlagProvider>,
    );
  });
  return tree;
}

describe('CanonicalLessonCatalogScreen entry point (LING-179 TASK-001)', () => {
  it('opens the player with the same lessonId from a catalog row', () => {
    const navigation = {navigate: jest.fn(), goBack: jest.fn()};
    const tree = renderCatalog(navigation);

    const target = tree.root
      .findAll(
        node =>
          node.props.testID === `canonical-catalog-row-${CATALOG_LESSON_ID}`,
      )
      .find(node => typeof node.props.onPress === 'function');
    if (!target) throw new Error('No pressable found for catalog row');
    act(() => {
      target.props.onPress();
    });

    expect(navigation.navigate).toHaveBeenCalledWith('CanonicalLessonPlayer', {
      lessonId: CATALOG_LESSON_ID,
    });
  });
});
