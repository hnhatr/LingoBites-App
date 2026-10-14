import React from 'react';

import {AppScreen} from '@ui/components/AppScreen';

import {CourseListContent} from '../components/CourseListContent';

/**
 * Published courses (F14); the Courses tab's root, so it has no header or
 * back button: the tab bar already names it.
 */
export function CourseListScreen() {
  return (
    <AppScreen>
      <CourseListContent />
    </AppScreen>
  );
}
