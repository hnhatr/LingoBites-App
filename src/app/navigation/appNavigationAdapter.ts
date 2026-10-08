import {
  CommonActions,
  createNavigationContainerRef,
  type NavigationContainerRefWithCurrent,
} from '@react-navigation/native';

import type {AppNavigation, CourseTarget, CreateEntry} from '@core/navigation';

import type {RootStackParamList} from './types';

/**
 * The single place that maps app navigation intents to route names
 * (`AppNavigation` port in `@core/navigation`). Everything goes through the
 * root container ref, so the result never depends on which tab or stack the
 * caller is rendered in.
 */
export const navigationRef = createNavigationContainerRef<RootStackParamList>();

export type RootNavigationRef = Pick<
  NavigationContainerRefWithCurrent<RootStackParamList>,
  'isReady' | 'navigate' | 'dispatch' | 'getRootState' | 'canGoBack' | 'goBack'
>;

type RootRouteName = keyof RootStackParamList;

/** Root routes that belong to the create-lesson flow. */
export const CREATE_FLOW_ROUTES: ReadonlySet<string> = new Set([
  'CreateHub',
  'PasteText',
  'ImageCapture',
  'OCRReview',
  'LessonCreation',
]);

function newSubmissionId(kind: string): string {
  return `create-${kind}-${Date.now()}`;
}

export function createAppNavigation(
  ref: RootNavigationRef = navigationRef,
): AppNavigation {
  const navigate = <RouteName extends RootRouteName>(
    name: RouteName,
    params: RootStackParamList[RouteName],
  ) => {
    if (ref.isReady()) {
      // The container ref's overloads cannot be called with a generic route
      // name; the signature above keeps every call site type-checked.
      (ref.navigate as (route: string, routeParams?: object) => void)(
        name,
        params,
      );
    }
  };

  const startCreate = (entry: CreateEntry) => {
    switch (entry.kind) {
      case 'paste':
        navigate('PasteText', undefined);
        return;
      case 'camera':
      case 'gallery':
        navigate('ImageCapture', {sourceType: entry.kind});
        return;
      case 'youtube':
        navigate('LessonCreation', {
          submissionId: entry.submissionId ?? newSubmissionId('youtube'),
          initialSource: 'youtube',
        });
        return;
      case 'text':
      case 'ocr':
        navigate('LessonCreation', {
          submissionId: entry.submissionId ?? newSubmissionId(entry.kind),
          initialSource: entry.kind,
          initialText: entry.text,
        });
        return;
    }
  };

  const openCourse = (target?: CourseTarget) => {
    if (!target) {
      navigate('Tabs', {screen: 'Courses'});
      return;
    }
    switch (target.kind) {
      case 'course':
        navigate('CourseLevels', {
          courseSlug: target.courseSlug,
          title: target.title,
        });
        return;
      case 'level':
        navigate('LevelUnits', {levelId: target.levelId, title: target.title});
        return;
      case 'unit':
        navigate('UnitLessons', {unitId: target.unitId, title: target.title});
        return;
    }
  };

  const finishCreate = (lessonId: string) => {
    if (!ref.isReady()) {
      return;
    }
    const state = ref.getRootState();
    if (!state) {
      return;
    }
    const firstFlowIndex = state.routes.findIndex(route =>
      CREATE_FLOW_ROUTES.has(route.name),
    );
    const kept =
      firstFlowIndex === -1
        ? state.routes
        : state.routes.slice(0, firstFlowIndex);
    const routes = [
      ...kept,
      {name: 'CanonicalLessonPlayer' as const, params: {lessonId}},
    ];
    ref.dispatch(
      CommonActions.reset({
        ...state,
        routes,
        index: routes.length - 1,
      } as Parameters<typeof CommonActions.reset>[0]),
    );
  };

  return {
    openLesson: lessonId => navigate('CanonicalLessonPlayer', {lessonId}),
    openLessonFlow: lessonId => navigate('LessonFlowPlayer', {lessonId}),
    openCatalog: () => navigate('CanonicalCatalog', undefined),
    openLibrarySection: section => navigate('LibraryList', {section}),
    openVideoHub: () => navigate('VideoHub', undefined),
    openCourse,
    openCreate: () => navigate('CreateHub', undefined),
    startCreate,
    finishCreate,
    openReview: () => navigate('DailyReview', undefined),
    openPractice: lessonId => navigate('Practice', {lessonId}),
    openToday: target => navigate('Today', target),
    openSpeakingRoom: () => navigate('SpeakingRoom', undefined),
    openShadowing: target =>
      target
        ? navigate('ShadowingSession', target)
        : navigate('ShadowingLessonPicker', undefined),
    goToTab: tab => navigate('Tabs', {screen: tab}),
    goBack: () => {
      if (ref.isReady() && ref.canGoBack()) {
        ref.goBack();
      }
    },
  };
}
