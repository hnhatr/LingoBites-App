import React from 'react';
import {StyleSheet} from 'react-native';
import ReactTestRenderer, {act} from 'react-test-renderer';
import {AppThemeProvider} from '@theme';
import {FeatureFlagProvider} from '@/release';
import {LessonsTabContent} from '../LessonsTabContent';

// Mock navigation
const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    navigate: mockNavigate,
  }),
}));

const renderedTrees: ReactTestRenderer.ReactTestRenderer[] = [];

function render(ui: React.ReactElement) {
  let tree!: ReactTestRenderer.ReactTestRenderer;
  act(() => {
    tree = ReactTestRenderer.create(
      <FeatureFlagProvider>
        <AppThemeProvider>{ui}</AppThemeProvider>
      </FeatureFlagProvider>,
    );
  });
  renderedTrees.push(tree);
  return tree;
}

const mockPackagedLesson = {
  id: 'packaged-1',
  titleVi: 'Tiếng Anh Giao Tiếp',
  blurbVi: 'Khóa học giao tiếp tiếng Anh',
  titleEn: 'English Communication',
  level: 'A1',
  estimatedDurationMinutes: 30,
};

const mockPackagedLesson2 = {
  id: 'packaged-2',
  titleVi: 'Tiếng Anh Kinh Doanh',
  blurbVi: 'Khóa học tiếng Anh kinh doanh',
  titleEn: 'Business English',
  level: 'B1',
  estimatedDurationMinutes: 45,
};

describe('LessonsTabContent', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
  });

  afterEach(() => {
    renderedTrees.splice(0).forEach(tree => {
      act(() => {
        tree.unmount();
      });
    });
  });

  it('renders section title for packaged lessons', () => {
    const tree = render(
      <LessonsTabContent
        packagedLessons={[mockPackagedLesson]}
      />,
    );

    const sectionList = tree.root.findByProps({testID: 'lessons-section-list'});
    expect(sectionList.props.sections).toHaveLength(1);
    expect(sectionList.props.sections[0].title).toBe('Bài học theo lộ trình');
  });

  it('shows empty state when no lessons', () => {
    const tree = render(
      <LessonsTabContent packagedLessons={[]} />,
    );

    const emptyState = tree.root.findByProps({
      testID: 'empty-state-message-lessons',
    });
    expect(emptyState).toBeDefined();
  });

  it('displays packaged lesson cards', () => {
    const tree = render(
      <LessonsTabContent
        packagedLessons={[mockPackagedLesson]}
      />,
    );

    const titleText = tree.root.findByProps({
      testID: 'lesson-title-packaged-1',
    });
    expect(titleText.props.children).toBe('Tiếng Anh Giao Tiếp');

    const summaryText = tree.root.findByProps({
      testID: 'lesson-summary-packaged-1',
    });
    expect(summaryText.props.children).toBe('Khóa học giao tiếp tiếng Anh');
  });

  it('navigates to ContentLessonRuntime when packaged lesson is pressed', () => {
    const tree = render(
      <LessonsTabContent
        packagedLessons={[mockPackagedLesson]}
      />,
    );

    const pressable = tree.root.findByProps({
      testID: 'lesson-item-packaged-1',
    });

    act(() => {
      pressable.props.onPress();
    });

    expect(mockNavigate).toHaveBeenCalledWith('ContentLessonRuntime', {
      lessonId: 'packaged-1',
    });
  });

  it('renders multiple packaged lessons', () => {
    const tree = render(
      <LessonsTabContent
        packagedLessons={[mockPackagedLesson, mockPackagedLesson2]}
      />,
    );

    const sectionList = tree.root.findByProps({testID: 'lessons-section-list'});
    expect(sectionList.props.sections[0].data).toHaveLength(2);
  });

  it('keeps sticky headers enabled so sections stay grouped', () => {
    const tree = render(
      <LessonsTabContent
        packagedLessons={[mockPackagedLesson]}
      />,
    );

    const sectionList = tree.root.findByProps({testID: 'lessons-section-list'});
    expect(sectionList.props.stickySectionHeadersEnabled).toBe(true);
  });

  it('gives section headers an opaque background so cards never show through (SETE-210 P0)', () => {
    const tree = render(
      <LessonsTabContent
        packagedLessons={[mockPackagedLesson]}
      />,
    );

    const sectionList = tree.root.findByProps({testID: 'lessons-section-list'});
    const header = sectionList.props.renderSectionHeader({
      section: sectionList.props.sections[0],
    });
    const flat = StyleSheet.flatten(header.props.style);
    expect(flat.backgroundColor).toBeTruthy();
    expect(flat.zIndex).toBeGreaterThan(0);
  });
});
