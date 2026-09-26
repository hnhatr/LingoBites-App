import React from 'react';
import {Text} from 'react-native';
import ReactTestRenderer, {act} from 'react-test-renderer';
import {AppThemeProvider} from '@theme';
import {FeatureFlagProvider} from '@/release';
import {LibraryEmptyState} from '../LibraryEmptyState';
import {Medallion} from '@components/Medallion';

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

describe('LibraryEmptyState', () => {
  it('shows correct message for empty lessons', () => {
    const tree = render(<LibraryEmptyState type="lessons" />);

    const messageText = tree.root.findByProps({
      testID: 'empty-state-message-lessons',
    });
    expect(messageText.props.children).toBe('Chưa có bài học nào');
  });

  it('shows correct message for empty vocabulary', () => {
    const tree = render(<LibraryEmptyState type="vocabulary" />);

    const messageText = tree.root.findByProps({
      testID: 'empty-state-message-vocabulary',
    });
    expect(messageText.props.children).toBe('Chưa lưu từ vựng nào');
  });

  it('shows correct message for empty grammar', () => {
    const tree = render(<LibraryEmptyState type="grammar" />);

    const messageText = tree.root.findByProps({
      testID: 'empty-state-message-grammar',
    });
    expect(messageText.props.children).toBe('Chưa lưu ngữ pháp nào');
  });

  it('shows no-results message for search with no matches', () => {
    const tree = render(<LibraryEmptyState type="no-results" />);

    const messageText = tree.root.findByProps({
      testID: 'empty-state-message-no-results',
    });
    expect(messageText.props.children).toBe('Không tìm thấy kết quả');
  });

  it('displays correct icon for lessons', () => {
    const tree = render(<LibraryEmptyState type="lessons" />);

    const medallions = tree.root.findAllByType(Medallion);
    expect(medallions.length).toBeGreaterThan(0);
    expect(medallions[0].props.label).toBe('📖');
  });

  it('displays correct icon for vocabulary', () => {
    const tree = render(<LibraryEmptyState type="vocabulary" />);

    const medallions = tree.root.findAllByType(Medallion);
    expect(medallions.length).toBeGreaterThan(0);
    expect(medallions[0].props.label).toBe('📚');
  });

  it('displays correct icon for grammar', () => {
    const tree = render(<LibraryEmptyState type="grammar" />);

    const medallions = tree.root.findAllByType(Medallion);
    expect(medallions.length).toBeGreaterThan(0);
    expect(medallions[0].props.label).toBe('✏️');
  });

  it('displays correct icon for no-results', () => {
    const tree = render(<LibraryEmptyState type="no-results" />);

    const medallions = tree.root.findAllByType(Medallion);
    expect(medallions.length).toBeGreaterThan(0);
    expect(medallions[0].props.label).toBe('🔍');
  });

  it('renders Medallion component', () => {
    const tree = render(<LibraryEmptyState type="lessons" />);

    const medallion = tree.root.findByType(Medallion);
    expect(medallion).toBeDefined();
  });

  it('renders AppText component with message text', () => {
    const tree = render(<LibraryEmptyState type="lessons" />);

    const textElements = tree.root.findAllByType(Text);
    const appText = textElements.find(
      el => el.props.testID === 'empty-state-message-lessons',
    );
    expect(appText).toBeDefined();
    expect(appText?.props.children).toBe('Chưa có bài học nào');
  });

  it('handles all empty state types', () => {
    const types: Array<'lessons' | 'vocabulary' | 'grammar' | 'no-results'> = [
      'lessons',
      'vocabulary',
      'grammar',
      'no-results',
    ];

    const expectedMessages: Record<(typeof types)[number], string> = {
      lessons: 'Chưa có bài học nào',
      vocabulary: 'Chưa lưu từ vựng nào',
      grammar: 'Chưa lưu ngữ pháp nào',
      'no-results': 'Không tìm thấy kết quả',
    };

    types.forEach(type => {
      const tree = render(<LibraryEmptyState type={type} />);
      const messageText = tree.root.findByProps({
        testID: `empty-state-message-${type}`,
      });
      expect(messageText.props.children).toBe(expectedMessages[type]);
    });
  });
});
