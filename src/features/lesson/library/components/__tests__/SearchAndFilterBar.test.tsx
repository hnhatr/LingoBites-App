import React from 'react';
import {Text, TextInput} from 'react-native';
import ReactTestRenderer, {act} from 'react-test-renderer';
import {AppThemeProvider} from '@ui/theme/index';
import {FeatureFlagProvider} from '@/release';
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

    const textInstances = tree.root.findAllByType(Text);
    const labels = textInstances.map(node => node.props.children);
    expect(labels).toContain('Tất cả');
    expect(labels).toContain('Offline');
    expect(labels).toContain('Ảnh / OCR');
    expect(labels).toContain('Dán văn bản');
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
        sourceFilter="offline"
        onSearchChange={jest.fn()}
        onFilterChange={jest.fn()}
      />,
    );

    const offlineChip = tree.root.findByProps({testID: 'filter-chip-offline'});
    expect(offlineChip.props.selected).toBe(true);

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

    const imageOcrChip = tree.root.findByProps({
      testID: 'filter-chip-image_ocr',
    });
    act(() => {
      imageOcrChip.props.onPress();
    });

    expect(onFilterChange).toHaveBeenCalledWith('image_ocr');
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

    const allChip = tree.root.findByProps({testID: 'filter-chip-all'});
    const offlineChip = tree.root.findByProps({testID: 'filter-chip-offline'});
    const imageOcrChip = tree.root.findByProps({
      testID: 'filter-chip-image_ocr',
    });
    const pasteChip = tree.root.findByProps({testID: 'filter-chip-paste'});

    expect(allChip).toBeDefined();
    expect(offlineChip).toBeDefined();
    expect(imageOcrChip).toBeDefined();
    expect(pasteChip).toBeDefined();
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

    let allChip = tree.root.findByProps({testID: 'filter-chip-all'});
    expect(allChip.props.selected).toBe(true);

    act(() => {
      tree.update(
        <FeatureFlagProvider>
          <AppThemeProvider>
            <SearchAndFilterBar
              searchQuery=""
              sourceFilter="image_ocr"
              onSearchChange={jest.fn()}
              onFilterChange={onFilterChange}
            />
          </AppThemeProvider>
        </FeatureFlagProvider>,
      );
    });

    const imageOcrChip = tree.root.findByProps({
      testID: 'filter-chip-image_ocr',
    });
    allChip = tree.root.findByProps({testID: 'filter-chip-all'});

    expect(imageOcrChip.props.selected).toBe(true);
    expect(allChip.props.selected).toBe(false);
  });

  it('handles all filter types correctly', () => {
    const onFilterChange = jest.fn();
    const filterTypes: Array<'all' | 'offline' | 'image_ocr' | 'paste'> = [
      'all',
      'offline',
      'image_ocr',
      'paste',
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
});
