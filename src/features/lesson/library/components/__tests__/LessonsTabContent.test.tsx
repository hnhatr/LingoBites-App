import React from 'react';
import {StyleSheet} from 'react-native';
import ReactTestRenderer, {act} from 'react-test-renderer';

import {AppThemeProvider} from '@ui/theme';

import {FeatureFlagProvider} from '@core/release';

import {mockAppNavigation} from '@test/support';

import {CATALOG_PREVIEW_LIMIT, LessonsTabContent} from '../LessonsTabContent';

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

function catalogLesson(index: number, description = `Catalog ${index}`) {
  return {
    id: `catalog-${index}`,
    title: `Catalog lesson ${index}`,
    description,
    origin: 'admin' as const,
    source_type: 'admin_text' as const,
    content_revision: 1,
    sentence_count: index,
    youtube_video_id: null,
    unit: null,
    updated_at: '2026-09-30T04:15:00.000Z',
  };
}

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
    mockAppNavigation.openLesson.mockClear();
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
      <LessonsTabContent packagedLessons={[mockPackagedLesson]} />,
    );

    const sectionList = tree.root.findByProps({testID: 'lessons-section-list'});
    expect(sectionList.props.sections).toHaveLength(1);
    expect(sectionList.props.sections[0].title).toBe('Bài học theo lộ trình');
  });

  it('shows empty state when no lessons', () => {
    const tree = render(<LessonsTabContent packagedLessons={[]} />);

    const emptyState = tree.root.findByProps({
      testID: 'empty-state-message-lessons',
    });
    expect(emptyState).toBeDefined();
  });

  it('displays packaged lesson cards', () => {
    const tree = render(
      <LessonsTabContent packagedLessons={[mockPackagedLesson]} />,
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

  it('opens the lesson player when a packaged lesson is pressed', () => {
    const tree = render(
      <LessonsTabContent packagedLessons={[mockPackagedLesson]} />,
    );

    const pressable = tree.root.findByProps({
      testID: 'lesson-item-packaged-1',
    });

    act(() => {
      pressable.props.onPress();
    });

    expect(mockAppNavigation.openLesson).toHaveBeenCalledWith('packaged-1');
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
      <LessonsTabContent packagedLessons={[mockPackagedLesson]} />,
    );

    const sectionList = tree.root.findByProps({testID: 'lessons-section-list'});
    expect(sectionList.props.stickySectionHeadersEnabled).toBe(true);
  });

  it('gives section headers an opaque background so cards never show through (SETE-210 P0)', () => {
    const tree = render(
      <LessonsTabContent packagedLessons={[mockPackagedLesson]} />,
    );

    const sectionList = tree.root.findByProps({testID: 'lessons-section-list'});
    const header = sectionList.props.renderSectionHeader({
      section: sectionList.props.sections[0],
    });
    const flat = StyleSheet.flatten(header.props.style);
    expect(flat.backgroundColor).toBeTruthy();
    expect(flat.zIndex).toBeGreaterThan(0);
  });
  it('adds a capped "Tất cả bài học" section after the packaged lessons', () => {
    const catalog = [1, 2, 3, 4, 5, 6, 7].map(i => catalogLesson(i));
    const tree = render(
      <LessonsTabContent
        packagedLessons={[mockPackagedLesson]}
        catalogLessons={catalog as never}
        onViewAllCatalog={jest.fn()}
      />,
    );

    const sectionList = tree.root.findByProps({testID: 'lessons-section-list'});
    expect(sectionList.props.sections).toHaveLength(2);
    expect(sectionList.props.sections[1].title).toBe('Tất cả bài học');
    expect(sectionList.props.sections[1].data).toHaveLength(
      CATALOG_PREVIEW_LIMIT,
    );
  });

  it('shows the catalog section alone when nothing is downloaded', () => {
    const tree = render(
      <LessonsTabContent
        packagedLessons={[]}
        catalogLessons={[catalogLesson(4, '')] as never}
      />,
    );

    expect(() =>
      tree.root.findByProps({testID: 'empty-state-message-lessons'}),
    ).toThrow();
    const summary = tree.root.findByProps({
      testID: 'lesson-summary-catalog-4',
    });
    expect(summary.props.children).toBe('4 câu');
  });

  it('renders "Xem tất cả" only on the catalog section header', () => {
    const onViewAll = jest.fn();
    const tree = render(
      <LessonsTabContent
        packagedLessons={[mockPackagedLesson]}
        catalogLessons={[catalogLesson(1)] as never}
        onViewAllCatalog={onViewAll}
      />,
    );

    const sectionList = tree.root.findByProps({testID: 'lessons-section-list'});
    const headerFor = (index: number) =>
      ReactTestRenderer.create(
        <FeatureFlagProvider>
          <AppThemeProvider>
            {sectionList.props.renderSectionHeader({
              section: sectionList.props.sections[index],
            })}
          </AppThemeProvider>
        </FeatureFlagProvider>,
      );
    let packagedHeader!: ReactTestRenderer.ReactTestRenderer;
    let catalogHeader!: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      packagedHeader = headerFor(0);
      catalogHeader = headerFor(1);
    });
    renderedTrees.push(packagedHeader, catalogHeader);

    expect(
      packagedHeader.root.findAllByProps({testID: 'library-catalog-view-all'}),
    ).toHaveLength(0);
    act(() => {
      catalogHeader.root
        .findByProps({testID: 'library-catalog-view-all'})
        .props.onPress();
    });
    expect(onViewAll).toHaveBeenCalledTimes(1);
  });

  describe('practice action', () => {
    const lessons = [
      {...mockPackagedLesson, id: 'ready', practiceReady: true},
      {...mockPackagedLesson, id: 'tiny', practiceReady: false},
    ];
    const practiceButtons = (tree: ReactTestRenderer.ReactTestRenderer) =>
      tree.root.findAll(
        node =>
          typeof node.props.testID === 'string' &&
          node.props.testID.startsWith('lesson-practice-') &&
          typeof node.props.onPress === 'function',
      );

    it('starts practice for a lesson that is ready, as a sibling of the card button', () => {
      const onPracticeLesson = jest.fn();
      const tree = render(
        <LessonsTabContent
          onPracticeLesson={onPracticeLesson}
          packagedLessons={lessons}
        />,
      );
      const buttons = practiceButtons(tree);
      expect(buttons.map(b => b.props.testID)).toEqual([
        'lesson-practice-ready',
      ]);
      expect(buttons[0]!.props.accessibilityLabel).toContain(
        'Tiếng Anh Giao Tiếp',
      );
      const card = tree.root.findByProps({testID: 'lesson-item-ready'});
      expect(
        card.findAllByProps({testID: 'lesson-practice-ready'}),
      ).toHaveLength(0);
      act(() => buttons[0]!.props.onPress());
      expect(onPracticeLesson).toHaveBeenCalledWith('ready');
    });

    it('hides the action when practice is off', () => {
      const tree = render(<LessonsTabContent packagedLessons={lessons} />);
      expect(practiceButtons(tree)).toHaveLength(0);
    });
  });
});
