import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import React, {useCallback, useMemo, useState} from 'react';
import {ScrollView, StyleSheet, View} from 'react-native';

import {
  useYouTubeLessonCreation,
  type YouTubeLessonCreationStatus,
} from '@features/input';

import {AppButton} from '@ui/components/AppButton';
import {AppScreen} from '@ui/components/AppScreen';
import {AppText} from '@ui/components/AppText';
import {
  GRID_TILE_GAP,
  GridTile,
  useGridTileWidth,
} from '@ui/components/GridTile';
import {
  LessonCard,
  lessonCardDurationLabel,
  splitLessonTitle,
} from '@ui/components/LessonCard';
import {ScreenHeader} from '@ui/components/ScreenHeader';
import {type AppTheme, useAppTheme} from '@ui/theme';

import {useAppNavigation} from '@core/navigation';

import {getLibrarySection} from '../logic/librarySections';
import {useLibraryCounts} from '../logic/useLibraryCounts';
import {useRefreshOnRefocus} from '../logic/useLibrarySegments';
import {findVideoInProgress} from '../logic/videoHub';
import type {LibraryFlowParamList} from './navigationTypes';

type Props = NativeStackScreenProps<LibraryFlowParamList, 'VideoHub'>;

export type VideoHubScreenProps = Props;

const CREATE_NOTE: Record<YouTubeLessonCreationStatus, string | null> = {
  available: null,
  checking: 'Đang kiểm tra kết nối…',
  unavailable: 'Tính năng tạo bài từ video đang chưa khả dụng',
  limit_reached: 'Bạn đã dùng hết lượt tạo bài từ video',
};

/**
 * "Học qua video" hub, pushed from the Home shortcut: the video in
 * progress, the learner's own and the public videos, and creating a lesson
 * from a YouTube link (gated by `useYouTubeLessonCreation`).
 *
 * IGNORE_TAB_BAR_CLEARANCE: a root-stack screen, drawn above the tab bar.
 */
export function VideoHubScreen(_props: Props) {
  const {theme} = useAppTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const navigation = useAppNavigation();
  const tileWidth = useGridTileWidth();
  const youtubeCreation = useYouTubeLessonCreation();
  const {counts, refresh: refreshCounts} = useLibraryCounts();
  const [inProgress, setInProgress] = useState(findVideoInProgress);

  const refresh = useCallback(() => {
    refreshCounts();
    setInProgress(findVideoInProgress());
  }, [refreshCounts]);
  useRefreshOnRefocus(refresh);

  const mine = getLibrarySection('video');
  const publicVideo = getLibrarySection('publicVideo');
  const mineMeta =
    counts.video > 0 ? `${counts.video} ${mine.unit}` : mine.emptyHint;
  const createNote = CREATE_NOTE[youtubeCreation.status];
  const continueTitle = inProgress ? splitLessonTitle(inProgress.title) : null;

  return (
    <AppScreen>
      <ScreenHeader title="Học qua video" onBack={navigation.goBack} />
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        testID="video-hub"
      >
        {inProgress && continueTitle ? (
          <View style={styles.section} testID="video-hub-continue">
            <AppText variant="h3" style={styles.sectionTitle}>
              Đang học dở
            </AppText>
            <LessonCard
              accessibilityHint="Mở lại video đang học dở"
              durationLabel={lessonCardDurationLabel({
                youtubeDurationMs: inProgress.youtubeDurationMs,
                sentenceCount: inProgress.sentenceCount,
              })}
              kind="video"
              onPress={() => navigation.openLesson(inProgress.lessonId)}
              progress={{state: 'in_progress'}}
              sentenceCount={inProgress.sentenceCount}
              subtitle={continueTitle.subtitle}
              testID="video-hub-continue-card"
              title={continueTitle.title}
            />
          </View>
        ) : null}

        <View style={styles.section}>
          <AppText variant="h3" style={styles.sectionTitle}>
            Thư viện video
          </AppText>
          <View style={styles.cards}>
            <GridTile
              accessibilityHint={mine.description}
              accessibilityLabel={`${mine.title}. ${mineMeta}`}
              icon={mine.icon}
              meta={mineMeta}
              metaTestID="video-hub-mine-count"
              onPress={() => navigation.openLibrarySection('video')}
              subtitle={mine.description}
              testID="video-hub-mine"
              title={mine.title}
              tone="accent"
              width={tileWidth}
            />
            <GridTile
              accessibilityHint={publicVideo.description}
              accessibilityLabel={publicVideo.title}
              icon={publicVideo.icon}
              onPress={() => navigation.openLibrarySection('publicVideo')}
              subtitle={publicVideo.description}
              testID="video-hub-public"
              title={publicVideo.title}
              tone="tertiary"
              width={tileWidth}
            />
          </View>
        </View>

        <View style={styles.section}>
          <AppText variant="h3" style={styles.sectionTitle}>
            Tạo bài mới
          </AppText>
          <AppText color="secondary">
            Dán link YouTube có phụ đề để tạo bài học của riêng bạn.
          </AppText>
          <AppButton
            accessibilityHint="Mở trang dán link YouTube"
            disabled={youtubeCreation.status !== 'available'}
            iconLeft="add"
            loading={youtubeCreation.status === 'checking'}
            onPress={youtubeCreation.start}
            testID="video-hub-create"
            title="Tạo bài từ link YouTube"
          />
          {createNote ? (
            <AppText
              color="secondary"
              style={styles.note}
              testID="video-hub-create-note"
              variant="caption"
            >
              {createNote}
            </AppText>
          ) : null}
        </View>
      </ScrollView>
    </AppScreen>
  );
}

function makeStyles(theme: AppTheme) {
  return StyleSheet.create({
    content: {
      gap: theme.spacing.md,
      padding: theme.gutter,
      paddingBottom: theme.spacing.xl,
    },
    section: {
      gap: theme.spacing.sm,
    },
    sectionTitle: {
      color: theme.colors.text.primary,
    },
    cards: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: GRID_TILE_GAP,
    },
    note: {
      textAlign: 'center',
    },
  });
}
