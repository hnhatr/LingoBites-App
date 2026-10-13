import React from 'react';

import {getLibrarySection} from '../../logic/librarySections';
import {MomentLibraryList} from '../MomentLibraryList';

/** "Khoảnh khắc": the lessons made from situations and photos. */
export function MomentsTab() {
  return (
    <MomentLibraryList emptyHint={getLibrarySection('moments').emptyHint} />
  );
}
