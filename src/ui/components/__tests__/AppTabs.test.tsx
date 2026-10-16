import React from 'react';
import ReactTestRenderer, {act} from 'react-test-renderer';

import {AppTabs} from '@ui/components/AppTabs';
import {AppThemeProvider} from '@ui/theme';

import {FeatureFlagProvider} from '@core/release';

const TABS = [
  {id: 'all', label: 'Tất cả', count: 12},
  {id: 'new', label: 'Chưa học', count: 1},
] as const;

function render(value: 'all' | 'new') {
  const onChange = jest.fn();
  let tree!: ReactTestRenderer.ReactTestRenderer;
  act(() => {
    tree = ReactTestRenderer.create(
      <FeatureFlagProvider>
        <AppThemeProvider>
          <AppTabs
            onChange={onChange}
            tabs={TABS}
            testID="filter"
            value={value}
          />
        </AppThemeProvider>
      </FeatureFlagProvider>,
    );
  });
  const tab = (id: string) =>
    tree.root.find(
      node =>
        node.props.testID === `filter-${id}` &&
        node.props.accessibilityRole === 'tab' &&
        typeof node.type !== 'string',
    );
  return {onChange, tab};
}

describe('AppTabs', () => {
  it('marks the open tab and reads each count', () => {
    const {tab} = render('new');
    expect(tab('new').props.accessibilityState).toEqual({selected: true});
    expect(tab('all').props.accessibilityState).toEqual({selected: false});
    expect(tab('all').props.accessibilityLabel).toBe('Tất cả, 12');
  });

  it('reports the tab pressed', () => {
    const {tab, onChange} = render('all');
    act(() => tab('new').props.onPress());
    expect(onChange).toHaveBeenCalledWith('new');
  });
});
