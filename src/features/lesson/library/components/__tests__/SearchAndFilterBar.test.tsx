import React from 'react';
import {Text, TextInput} from 'react-native';
import ReactTestRenderer, {act} from 'react-test-renderer';

import {AppThemeProvider} from '@ui/theme';

import {FeatureFlagProvider} from '@core/release';

import type {LibrarySourceFilter} from '../../logic/lesson';
import {SearchAndFilterBar} from '../SearchAndFilterBar';

function render(ui: React.ReactElement) {
  let tree!: ReactTestRenderer.ReactTestRenderer;
  act(() => {
    tree = ReactTestRenderer.create(
      <FeatureFlagProvider>
        <AppThemeProvider>{ui}</AppThemeProvider>
      </FeatureFlagProvider>,
    );
  });
  return tree;
}

function openFilters(tree: ReactTestRenderer.ReactTestRenderer) {
  act(() => {
    tree.root.findByProps({testID: 'filter-toggle'}).props.onPress();
  });
}

describe('SearchAndFilterBar', () => {
  it('renders search input field', () => {
    const tree = render(
      <SearchAndFilterBar
        searchQuery=""
        sourceFilter="all"
        onSearchChange={jest.fn()}
        onFilterChange={jest.fn()}
      />,
    );

    const searchInput = tree.root.findByType(TextInput);
    expect(searchInput).toBeDefined();
  });

  it('renders all filter chip labels', () => {
    const tree = render(
      <SearchAndFilterBar
        searchQuery=""
        sourceFilter="all"
        onSearchChange={jest.fn()}
        onFilterChange={jest.fn()}
      />,
    );
    openFilters(tree);

    const textInstances = tree.root.findAllByType(Text);
    const labels = textInstances.map(node => node.props.children);
    expect(labels).toContain('Tất cả');
    expect(labels).toContain('Bài mẫu');
    expect(labels).toContain('Văn bản');
    expect(labels).toContain('Ảnh / OCR');
    expect(labels).toContain('YouTube');
  });

  it('calls onSearchChange when search text is entered', () => {
    const onSearchChange = jest.fn();
    const tree = render(
      <SearchAndFilterBar
        searchQuery=""
        sourceFilter="all"
        onSearchChange={onSearchChange}
        onFilterChange={jest.fn()}
      />,
    );

    const searchInput = tree.root.findByType(TextInput);
    act(() => {
      searchInput.props.onChangeText('test query');
    });

    expect(onSearchChange).toHaveBeenCalledWith('test query');
  });

  it('displays search query in input field', () => {
    const tree = render(
      <SearchAndFilterBar
        searchQuery="hello"
        sourceFilter="all"
        onSearchChange={jest.fn()}
        onFilterChange={jest.fn()}
      />,
    );

    const searchInput = tree.root.findByType(TextInput);
    expect(searchInput.props.value).toBe('hello');
  });

  it('marks the active filter chip as selected', () => {
    const tree = render(
      <SearchAndFilterBar
        searchQuery=""
        sourceFilter="youtube"
        onSearchChange={jest.fn()}
        onFilterChange={jest.fn()}
      />,
    );
    openFilters(tree);

    const youtubeChip = tree.root.findByProps({testID: 'filter-chip-youtube'});
    expect(youtubeChip.props.selected).toBe(true);

    const allChip = tree.root.findByProps({testID: 'filter-chip-all'});
    expect(allChip.props.selected).toBe(false);
  });

  it('calls onFilterChange when filter chip is pressed', () => {
    const onFilterChange = jest.fn();
    const tree = render(
      <SearchAndFilterBar
        searchQuery=""
        sourceFilter="all"
        onSearchChange={jest.fn()}
        onFilterChange={onFilterChange}
      />,
    );
    openFilters(tree);

    const imageOcrChip = tree.root.findByProps({
      testID: 'filter-chip-learner_ocr',
    });
    act(() => {
      imageOcrChip.props.onPress();
    });

    expect(onFilterChange).toHaveBeenCalledWith('learner_ocr');
  });

  it('renders filter chips for all options', () => {
    const tree = render(
      <SearchAndFilterBar
        searchQuery=""
        sourceFilter="all"
        onSearchChange={jest.fn()}
        onFilterChange={jest.fn()}
      />,
    );

    openFilters(tree);
    ['all', 'admin_text', 'learner_text', 'learner_ocr', 'youtube'].forEach(
      key => {
        expect(
          tree.root.findByProps({testID: `filter-chip-${key}`}),
        ).toBeDefined();
      },
    );
  });

  it('updates active filter when sourceFilter prop changes', () => {
    const onFilterChange = jest.fn();
    const tree = render(
      <SearchAndFilterBar
        searchQuery=""
        sourceFilter="all"
        onSearchChange={jest.fn()}
        onFilterChange={onFilterChange}
      />,
    );

    openFilters(tree);
    let allChip = tree.root.findByProps({testID: 'filter-chip-all'});
    expect(allChip.props.selected).toBe(true);

    act(() => {
      tree.update(
        <FeatureFlagProvider>
          <AppThemeProvider>
            <SearchAndFilterBar
              searchQuery=""
              sourceFilter="learner_ocr"
              onSearchChange={jest.fn()}
              onFilterChange={onFilterChange}
            />
          </AppThemeProvider>
        </FeatureFlagProvider>,
      );
    });

    const imageOcrChip = tree.root.findByProps({
      testID: 'filter-chip-learner_ocr',
    });
    allChip = tree.root.findByProps({testID: 'filter-chip-all'});

    expect(imageOcrChip.props.selected).toBe(true);
    expect(allChip.props.selected).toBe(false);
  });

  it('handles all filter types correctly', () => {
    const onFilterChange = jest.fn();
    const filterTypes: LibrarySourceFilter[] = [
      'all',
      'admin_text',
      'learner_text',
      'learner_ocr',
      'youtube',
    ];

    filterTypes.forEach(filter => {
      const tree = render(
        <SearchAndFilterBar
          searchQuery=""
          sourceFilter={filter}
          onSearchChange={jest.fn()}
          onFilterChange={onFilterChange}
        />,
      );

      openFilters(tree);
      const chip = tree.root.findByProps({testID: `filter-chip-${filter}`});
      expect(chip.props.selected).toBe(true);
    });
  });

  it('renders search input with search placeholder', () => {
    const tree = render(
      <SearchAndFilterBar
        searchQuery=""
        sourceFilter="all"
        onSearchChange={jest.fn()}
        onFilterChange={jest.fn()}
      />,
    );

    const searchInput = tree.root.findByType(TextInput);
    expect(searchInput.props.placeholder).toBe('Tìm kiếm...');
  });

  it('labels the search field for screen readers (SETE-210 P1)', () => {
    const tree = render(
      <SearchAndFilterBar
        searchQuery=""
        sourceFilter="all"
        onSearchChange={jest.fn()}
        onFilterChange={jest.fn()}
      />,
    );

    const searchInput = tree.root.findByType(TextInput);
    expect(searchInput.props.accessibilityLabel).toBe(
      'Tìm kiếm trong Thư viện',
    );
  });

  it('keeps source chips folded until the toggle is pressed', () => {
    const tree = render(
      <SearchAndFilterBar
        searchQuery=""
        sourceFilter="youtube"
        onSearchChange={jest.fn()}
        onFilterChange={jest.fn()}
      />,
    );

    expect(
      tree.root.findAllByProps({testID: 'filter-chip-youtube'}),
    ).toHaveLength(0);
    const toggle = tree.root.findByProps({testID: 'filter-toggle'});
    expect(toggle.props.label).toContain('YouTube');
    openFilters(tree);
    expect(
      tree.root.findAllByProps({testID: 'filter-chip-youtube'}).length,
    ).toBeGreaterThan(0);
  });
});
