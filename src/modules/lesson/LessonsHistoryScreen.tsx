import {useFocusEffect} from '@react-navigation/native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import React, {useCallback, useMemo, useState} from 'react';
import {Pressable, StyleSheet, View} from 'react-native';
import {useTranslation} from 'react-i18next';
import type {LessonsStackParamList} from '@/app/navigation/types';
import {AppScreen} from '@components/AppScreen';
import {AppText} from '@components/AppText';
import {MaterialIcon} from '@components/MaterialIcon';
import {useAppTheme, type AppTheme} from '@theme';
import {UnifiedLessonsScreen} from '@modules/curriculumLesson';
import {GrammarTabContent} from './components/GrammarTabContent';
import {SearchAndFilterBar} from './components/SearchAndFilterBar';
import {SegmentedTabBar} from './components/SegmentedTabBar';
import {VocabularyTabContent} from './components/VocabularyTabContent';
import {useFlashcardLibrary} from './useFlashcardLibrary';
import {useLibrarySegments} from './useLibrarySegments';

type Props = NativeStackScreenProps<LessonsStackParamList, 'LessonsList'>;

type PracticeChip = {
  icon: 'refresh' | 'mic' | 'bolt';
  value: string;
  labelKey: string;
  backgroundKey: 'accentSoft' | 'tertiarySoft' | 'secondarySoft';
  inkKey: 'primary' | 'onTertiaryContainer' | 'secondary';
  onPress: () => void;
  testID: string;
};

export function LessonsHistoryScreen({navigation}: Props) {
  const {theme} = useAppTheme();
  const themedStyles = useMemo(() => makeStyles(theme), [theme]);
  const {t} = useTranslation();
  const {getDueFlashcards} = useFlashcardLibrary();
  const [dueCount, setDueCount] = useState(0);

  const [activeTab, setActiveTab] = useState<
    'lessons' | 'vocabulary' | 'grammar'
  >('lessons');

  const {
    vocabulary,
    grammar,
    vocabularyFilter,
    grammarFilter,
    setVocabularyFilter,
    setGrammarFilter,
    refresh,
  } = useLibrarySegments();

  useFocusEffect(
    useCallback(() => {
      refresh();
      setDueCount(getDueFlashcards().length);
    }, [refresh, getDueFlashcards]),
  );

  const practiceChips: PracticeChip[] = useMemo(() => {
    return [
      {
        icon: 'refresh',
        value: t('home.shortcut_review_meta', {count: dueCount}),
        labelKey: 'home.shortcut_review',
        backgroundKey: 'accentSoft',
        inkKey: 'primary',
        onPress: () => navigation.navigate('DailyReview'),
        testID: 'library-practice-review',
      },
      {
        icon: 'mic',
        value: t('home.shortcut_speaking_meta'),
        labelKey: 'home.shortcut_speaking',
        backgroundKey: 'tertiarySoft',
        inkKey: 'onTertiaryContainer',
        onPress: () => navigation.navigate('SpeakingRoom'),
        testID: 'library-practice-speaking',
      },
    ];
  }, [dueCount, navigation, t]);

  const currentFilter =
    activeTab === 'vocabulary' ? vocabularyFilter : grammarFilter;

  const setCurrentFilter =
    activeTab === 'vocabulary' ? setVocabularyFilter : setGrammarFilter;

  return (
    <AppScreen>
      <View style={themedStyles.header}>
        <AppText style={themedStyles.title}>Thư viện</AppText>
      </View>

      <View style={themedStyles.practiceRow} testID="library-practice-row">
        {practiceChips.map(chip => (
          <Pressable
            accessibilityLabel={`${t(chip.labelKey)}. ${chip.value}`}
            accessibilityRole="button"
            key={chip.testID}
            onPress={chip.onPress}
            style={({pressed}) => [
              themedStyles.practiceChip,
              {backgroundColor: theme.colors[chip.backgroundKey]},
              pressed && themedStyles.pressed,
            ]}
            testID={chip.testID}
          >
            <MaterialIcon
              color={theme.colors[chip.inkKey]}
              name={chip.icon}
              size={20}
            />
            <View style={themedStyles.practiceCopy}>
              <AppText
                variant="label"
                style={{color: theme.colors[chip.inkKey]}}
                numberOfLines={1}
              >
                {t(chip.labelKey)}
              </AppText>
              <AppText
                variant="caption"
                style={{color: theme.colors[chip.inkKey]}}
                numberOfLines={1}
              >
                {chip.value}
              </AppText>
            </View>
          </Pressable>
        ))}
      </View>

      <SegmentedTabBar activeTab={activeTab} onTabChange={setActiveTab} />

      {activeTab !== 'lessons' && (
        <SearchAndFilterBar
          searchQuery={currentFilter.searchQuery}
          sourceFilter={currentFilter.sourceFilter}
          onSearchChange={query =>
            setCurrentFilter({...currentFilter, searchQuery: query})
          }
          onFilterChange={filter =>
            setCurrentFilter({...currentFilter, sourceFilter: filter})
          }
        />
      )}

      {activeTab === 'lessons' && (
        <View style={themedStyles.tabContent} testID="lessons-tab-content">
          <UnifiedLessonsScreen
            onOpenLesson={lessonId =>
              navigation.navigate('CurriculumLesson', {lessonId})
            }
          />
        </View>
      )}
      {activeTab === 'vocabulary' && (
        <View style={themedStyles.tabContent} testID="vocabulary-tab-content">
          <VocabularyTabContent vocabulary={vocabulary} />
        </View>
      )}
      {activeTab === 'grammar' && (
        <View style={themedStyles.tabContent} testID="grammar-tab-content">
          <GrammarTabContent grammar={grammar} />
        </View>
      )}
    </AppScreen>
  );
}

function makeStyles(theme: AppTheme) {
  return StyleSheet.create({
    header: {
      paddingHorizontal: theme.gutter,
      paddingVertical: theme.spacing.md,
    },
    title: {
      fontSize: theme.typography.size.lg,
      fontWeight: '700',
      color: theme.colors.primary,
    },
    practiceRow: {
      flexDirection: 'row',
      gap: theme.spacing.sm,
      paddingHorizontal: theme.gutter,
    },
    practiceChip: {
      alignItems: 'center',
      borderRadius: theme.radius.lg,
      flex: 1,
      flexDirection: 'row',
      gap: theme.spacing.sm,
      minHeight: 56,
      minWidth: 0,
      paddingHorizontal: theme.spacing.sm,
      paddingVertical: theme.spacing.sm,
    },
    practiceCopy: {flex: 1, gap: 0, minWidth: 0},
    pressed: {opacity: theme.states.pressedOpacity},
    tabContent: {
      flex: 1,
    },
  });
}
