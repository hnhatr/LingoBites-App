import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import React, {useMemo, useState} from 'react';
import {StyleSheet, View} from 'react-native';

import {AppScreen} from '@ui/components/AppScreen';
import {AppText} from '@ui/components/AppText';
import {ScreenHeader} from '@ui/components/ScreenHeader';
import {type AppTheme, useAppTheme} from '@ui/theme';

import {LibraryTabBar} from '../components/LibraryTabBar';
import {CreatedTab} from '../components/tabs/CreatedTab';
import {MomentsTab} from '../components/tabs/MomentsTab';
import {SectionTilesTab} from '../components/tabs/SectionTilesTab';
import {LIBRARY_TABS, type LibraryTab} from '../logic/librarySections';
import type {LessonsStackParamList} from './navigationTypes';

type Props = NativeStackScreenProps<LessonsStackParamList, 'LessonsList'>;

export type LessonsHistoryScreenProps = Props;

/**
 * The Library hub: icon tabs for what LingoBites provides, the learner's
 * saved items, the lessons they made and their moments. A tab is mounted on
 * its first visit and kept, so switching back does not reload it.
 */
export function LessonsHistoryScreen(_props: Props) {
  const {theme} = useAppTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const [selected, setSelected] = useState<LibraryTab>(LIBRARY_TABS[0].id);
  const [visited, setVisited] = useState<ReadonlySet<LibraryTab>>(
    () => new Set([LIBRARY_TABS[0].id]),
  );
  const selectedTab = LIBRARY_TABS.find(tab => tab.id === selected)!;

  const select = (tab: LibraryTab) => {
    setSelected(tab);
    setVisited(previous =>
      previous.has(tab) ? previous : new Set(previous).add(tab),
    );
  };

  return (
    <AppScreen>
      <ScreenHeader title="Thư viện" />
      <LibraryTabBar
        onSelect={select}
        selected={selected}
        tabs={LIBRARY_TABS}
      />
      <AppText style={styles.tabTitle} testID="library-tab-title" variant="h3">
        {selectedTab.title}
      </AppText>
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
    case 'created':
      return <CreatedTab />;
    case 'moments':
      return <MomentsTab />;
    default:
      return <SectionTilesTab tab={tab} />;
  }
}

function makeStyles(theme: AppTheme) {
  return StyleSheet.create({
    tabTitle: {
      color: theme.colors.text.primary,
      paddingHorizontal: theme.gutter,
      paddingTop: theme.spacing.md,
    },
    panel: {
      flex: 1,
    },
    hidden: {
      display: 'none',
    },
  });
}
