import type {LibrarySectionId} from '../logic/librarySections';

export type LessonsListRouteParams = undefined;

export type LibraryListRouteParams = {section: LibrarySectionId};

export type VideoHubRouteParams = undefined;

/** The Library tab holds only its hub of section cards. */
export type LessonsStackParamList = {
  LessonsList: LessonsListRouteParams;
};

/**
 * Library task screens on the root stack: one list per section (opened from
 * the Library hub or the video hub) and the "Học qua video" hub.
 */
export type LibraryFlowParamList = {
  LibraryList: LibraryListRouteParams;
  VideoHub: VideoHubRouteParams;
};
