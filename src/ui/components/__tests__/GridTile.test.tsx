import React from 'react';
import ReactTestRenderer, {act} from 'react-test-renderer';

import {FeatureFlagProvider} from '@core/release';

import {AppThemeProvider} from '../../theme';
import {GridTile, gridTileToneAt} from '../GridTile';

describe('GridTile', () => {
  it('shows title, subtitle and meta, and reports presses', () => {
    const onPress = jest.fn();
    let tree!: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      tree = ReactTestRenderer.create(
        <FeatureFlagProvider>
          <AppThemeProvider>
            <GridTile
              icon="menu_book"
              title="Từ vựng"
              subtitle="Từ đã lưu"
              meta="3 từ"
              width={160}
              onPress={onPress}
              testID="tile"
            />
          </AppThemeProvider>
        </FeatureFlagProvider>,
      );
    });
    const tile = tree.root.findByProps({testID: 'tile'});
    ['Từ vựng', 'Từ đã lưu', '3 từ'].forEach(text =>
      expect(tree.root.findAllByProps({children: text}).length).toBeGreaterThan(
        0,
      ),
    );
    act(() => tile.props.onPress());
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('cycles tones so neighbours differ', () => {
    expect(gridTileToneAt(0)).not.toBe(gridTileToneAt(1));
    expect(gridTileToneAt(4)).toBe(gridTileToneAt(0));
  });
});
