import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import React, {useState} from 'react';
import {StyleSheet, View} from 'react-native';

import {AppScreen} from '@ui/components/AppScreen';

import {LibraryTabBar} from '../components/LibraryTabBar';
import {CreatedTab} from '../components/tabs/CreatedTab';
import {ExploreTab} from '../components/tabs/ExploreTab';
import {MomentsTab} from '../components/tabs/MomentsTab';
import {SavedTab} from '../components/tabs/SavedTab';
import {LIBRARY_TABS, type LibraryTab} from '../logic/librarySections';
import type {LessonsStackParamList} from './navigationTypes';

type Props = NativeStackScreenProps<LessonsStackParamList, 'LessonsList'>;

export type LessonsHistoryScreenProps = Props;

/**
 * The Library hub: tabs for what LingoBites provides, the learner's
 * saved items, the lessons they made and their moments. A tab is mounted on
 * its first visit and kept, so switching back does not reload it.
 */
export function LessonsHistoryScreen(_props: Props) {
  const [selected, setSelected] = useState<LibraryTab>(LIBRARY_TABS[0].id);
  const [visited, setVisited] = useState<ReadonlySet<LibraryTab>>(
    () => new Set([LIBRARY_TABS[0].id]),
  );

  const select = (tab: LibraryTab) => {
    setSelected(tab);
    setVisited(previous =>
      previous.has(tab) ? previous : new Set(previous).add(tab),
    );
  };

  return (
    <AppScreen>
      <LibraryTabBar
        onSelect={select}
        selected={selected}
        tabs={LIBRARY_TABS}
      />
      {LIBRARY_TABS.filter(tab => visited.has(tab.id)).map(tab => (
        <View
          key={tab.id}
          style={[styles.panel, tab.id !== selected && styles.hidden]}
          testID={`library-panel-${tab.id}`}
        >
          {renderTab(tab.id)}
        </View>
      ))}
    </AppScreen>
  );
}

function renderTab(tab: LibraryTab) {
  switch (tab) {
    case 'explore':
      return <ExploreTab />;
    case 'saved':
      return <SavedTab />;
    case 'created':
      return <CreatedTab />;
    case 'moments':
      return <MomentsTab />;
  }
}

const styles = StyleSheet.create({
  panel: {
    flex: 1,
    // Keeps scrolled content from drawing over the tabs.
    overflow: 'hidden',
  },
  hidden: {
    display: 'none',
  },
});
