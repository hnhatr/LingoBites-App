import React, {useMemo} from 'react';
import {Pressable, SectionList, StyleSheet, View} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import type {LessonsStackParamList} from '@/app/navigation/types';
import {AppCard} from '@components/AppCard';
import {AppText} from '@components/AppText';
import {useAppTheme} from '@theme';
import {useFloatingTabBarClearance} from '@/app/navigation/tabBarMetrics';
import type {AppTheme} from '@theme/types';
import {LibraryEmptyState} from './LibraryEmptyState';
import {SectionHeader} from '@components/SectionHeader';

export interface LessonsTabContentProps {
  personalLessons?: any[];
  packagedLessons: any[];
}

interface LessonItem {
  id: string;
  title: string;
  summary: string | null;
  type: 'packaged';
}

interface LessonSection {
  title: string;
  data: LessonItem[];
  type: 'packaged';
}

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    container: {
      flex: 1,
    },
    contentContainer: {
      gap: theme.spacing.md,
      padding: theme.gutter,
    },
    pressable: {
      flex: 1,
    },
    cardContent: {
      gap: theme.spacing.xs,
    },
    lessonTitle: {
      marginBottom: theme.spacing.xs,
    },
    sectionHeader: {
      paddingHorizontal: 0,
      marginTop: theme.spacing.md,
      marginBottom: theme.spacing.sm,
      backgroundColor: theme.colors.background,
      zIndex: 1,
    },
  });
}

export function LessonsTabContent({
  packagedLessons,
}: LessonsTabContentProps) {
  const {theme} = useAppTheme();
  const feedClearance = useFloatingTabBarClearance();
  const navigation =
    useNavigation<NativeStackNavigationProp<LessonsStackParamList>>();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const sections = useMemo((): LessonSection[] => {
    const result: LessonSection[] = [];

    if (packagedLessons && packagedLessons.length > 0) {
      const packagedItems: LessonItem[] = packagedLessons.map(lesson => ({
        id: lesson.id,
        title: lesson.titleVi || lesson.title,
        summary: lesson.blurbVi || lesson.summary || null,
        type: 'packaged' as const,
      }));

      result.push({
        title: 'Bài học theo lộ trình',
        data: packagedItems,
        type: 'packaged',
      });
    }

    return result;
  }, [packagedLessons]);

  const handleLessonPress = (item: LessonItem) => {
    navigation.navigate('ContentLessonRuntime', {lessonId: item.id});
  };

  const renderLessonItem = ({item}: {item: LessonItem}) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={item.title}
      accessibilityHint="Bài học theo lộ trình. Chạm để xem chi tiết."
      onPress={() => handleLessonPress(item)}
      testID={`lesson-item-${item.id}`}
      style={styles.pressable}
    >
      <AppCard>
        <View style={styles.cardContent}>
          <AppText
            variant="h3"
            style={styles.lessonTitle}
            testID={`lesson-title-${item.id}`}
          >
            {item.title}
          </AppText>
          {item.summary && (
            <AppText
              variant="label"
              color="secondary"
              numberOfLines={2}
              ellipsizeMode="tail"
              testID={`lesson-summary-${item.id}`}
            >
              {item.summary}
            </AppText>
          )}
        </View>
      </AppCard>
    </Pressable>
  );

  const renderSectionHeader = ({section}: {section: LessonSection}) => (
    <View style={styles.sectionHeader}>
      <SectionHeader title={section.title} />
    </View>
  );

  if (sections.length === 0) {
    return <LibraryEmptyState type="lessons" />;
  }

  return (
    <View style={styles.container}>
      <SectionList
        sections={sections}
        keyExtractor={(item, index) => `${item.id}-${index}`}
        renderItem={renderLessonItem}
        renderSectionHeader={renderSectionHeader}
        stickySectionHeadersEnabled
        contentContainerStyle={[styles.contentContainer, {paddingBottom: feedClearance}]}
        testID="lessons-section-list"
      />
    </View>
  );
}
