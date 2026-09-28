import React from 'react';
import ReactTestRenderer, {act} from 'react-test-renderer';
import {FeatureFlagProvider} from '@/release';
import {AppThemeProvider} from '@ui/theme/index';
import {CurriculumLessonsEntry} from '../CurriculumLessonsEntry';
import type {CurriculumLessonSelectionItem} from '../curriculumLessonSelection';

const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    navigate: mockNavigate,
  }),
}));

jest.mock('../curriculumLessonSelection', () => ({
  fetchPublishedCurriculumLessons: jest.fn(),
}));

const {fetchPublishedCurriculumLessons} = jest.requireMock(
  '../curriculumLessonSelection',
) as {fetchPublishedCurriculumLessons: jest.Mock};

const items: CurriculumLessonSelectionItem[] = [
  {
    id: '00000000-0000-4000-8000-000000000010',
    title: 'Greetings 101',
    description: 'Say hello',
    estimatedMinutes: 7,
    courseTitle: 'English Basics',
    levelTitle: 'Beginner',
    unitTitle: 'Greetings',
  },
];

async function renderEntry() {
  let tree!: ReactTestRenderer.ReactTestRenderer;
  await act(async () => {
    tree = ReactTestRenderer.create(
      <FeatureFlagProvider>
        <AppThemeProvider>
          <CurriculumLessonsEntry />
        </AppThemeProvider>
      </FeatureFlagProvider>,
    );
  });
  return tree;
}

function hostExists(
  tree: ReactTestRenderer.ReactTestRenderer,
  testID: string,
): boolean {
  return (
    tree.root
      .findAllByProps({testID})
      .filter(node => typeof node.type === 'string').length > 0
  );
}

describe('CurriculumLessonsEntry', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders nothing while loading and when the catalog is empty', async () => {
    let resolveLoad!: (value: {ok: true; lessons: []}) => void;
    fetchPublishedCurriculumLessons.mockReturnValue(
      new Promise(resolve => {
        resolveLoad = resolve;
      }),
    );
    const tree = await renderEntry();
    expect(hostExists(tree, 'curriculum-entry-section')).toBe(false);
    await act(async () => {
      resolveLoad({ok: true, lessons: []});
    });
    expect(hostExists(tree, 'curriculum-entry-section')).toBe(false);
    await act(async () => {
      tree.unmount();
    });
  });

  it('renders nothing when metadata is unreachable', async () => {
    fetchPublishedCurriculumLessons.mockResolvedValue({
      ok: false,
      reason: 'cancelled',
    });
    const tree = await renderEntry();
    expect(hostExists(tree, 'curriculum-entry-section')).toBe(false);
    await act(async () => {
      tree.unmount();
    });
  });

  it('surfaces published lessons and navigates to the distinct route', async () => {
    fetchPublishedCurriculumLessons.mockResolvedValue({
      ok: true,
      lessons: items,
    });
    const tree = await renderEntry();

    expect(hostExists(tree, 'curriculum-entry-section')).toBe(true);
    expect(
      hostExists(
        tree,
        'curriculum-entry-item-00000000-0000-4000-8000-000000000010',
      ),
    ).toBe(true);
    await act(async () => {
      tree.root
        .findByProps({
          testID: 'curriculum-entry-item-00000000-0000-4000-8000-000000000010',
        })
        .props.onPress();
    });
    expect(mockNavigate).toHaveBeenCalledWith('CurriculumLesson', {
      lessonId: '00000000-0000-4000-8000-000000000010',
    });
    await act(async () => {
      tree.unmount();
    });
  });
});
