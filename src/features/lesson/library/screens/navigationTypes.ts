import type {LibrarySectionId} from '../logic/librarySections';

export type LessonsListRouteParams = undefined;

export type LibraryListRouteParams = {section: LibrarySectionId};

/**
 * The Library tab: a hub of section cards, and one list screen per section.
 * Task flows live on the root stack.
 */
export type LessonsStackParamList = {
  LessonsList: LessonsListRouteParams;
  LibraryList: LibraryListRouteParams;
};
