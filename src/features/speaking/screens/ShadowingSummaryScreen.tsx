import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {Pressable, ScrollView, StyleSheet, View} from 'react-native';

import {AppScreen} from '@ui/components/AppScreen';
import {AppText} from '@ui/components/AppText';
import {Chip} from '@ui/components/Chip';
import {IconButton} from '@ui/components/IconButton';
import {useFloatingTabBarClearance} from '@ui/components/layout';
import {ScreenHeader} from '@ui/components/ScreenHeader';
import {useAppTheme} from '@ui/theme';

import {formatShadowingElapsed} from '../logic/shadowing/useShadowingSession';
import {
  playSummarySentenceRecording,
  resolveSummaryPlayVisible,
  shouldShowSummaryPlayButton,
} from '../logic/upload/remoteRecordingPlayback';
import type {ShadowingSummaryRouteParams} from './navigationTypes';

export type ShadowingSummaryScreenProps = {
  navigation: {
    goBack: () => void;
    navigate: (screen: 'ShadowingLessonPicker') => void;
  };
  route: {
    params: ShadowingSummaryRouteParams;
  };
};

export function ShadowingSummaryScreen({
  navigation,
  route,
}: ShadowingSummaryScreenProps) {
  const {theme} = useAppTheme();
  const floatingClearance = useFloatingTabBarClearance();
  const {lessonTitle, savedCount, failedCount, elapsedMs, failedSentences} =
    route.params;

  const handleDone = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  const handleAnotherLesson = useCallback(() => {
    navigation.navigate('ShadowingLessonPicker');
  }, [navigation]);

  const showFailedList = failedSentences.length > 0;

  const initialPlayVisible = useMemo(() => {
    const map: Record<string, boolean> = {};
    for (const row of failedSentences) {
      map[row.sentenceId] = shouldShowSummaryPlayButton({
        recordingId: row.recordingId,
        localFilePath: row.localFilePath,
        serverRecordingId: row.serverRecordingId,
      });
    }
    return map;
  }, [failedSentences]);

  const [playVisibleBySentenceId, setPlayVisibleBySentenceId] =
    useState(initialPlayVisible);

  useEffect(() => {
    setPlayVisibleBySentenceId(initialPlayVisible);
    let cancelled = false;
    const refreshPlayVisibility = async () => {
      const next: Record<string, boolean> = {};
      for (const row of failedSentences) {
        next[row.sentenceId] = await resolveSummaryPlayVisible({
          recordingId: row.recordingId,
          localFilePath: row.localFilePath,
          serverRecordingId: row.serverRecordingId,
        });
      }
      if (!cancelled) {
        setPlayVisibleBySentenceId(next);
      }
    };
    refreshPlayVisibility().catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [failedSentences, initialPlayVisible]);

  return (
    <AppScreen testID="shadowing-summary-screen">
      <ScreenHeader
        rightAction={
          <IconButton
            accessibilityLabel="Đóng"
            icon="close"
            onPress={handleDone}
            testID="shadowing-summary-close"
            tone="bare"
          />
        }
        title="Hoàn thành bài"
      />
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          {paddingBottom: floatingClearance, gap: theme.spacing.md},
        ]}
      >
        <AppText testID="shadowing-summary-lesson-title" variant="h2">
          {lessonTitle}
        </AppText>
        <AppText color="secondary">
          Chúc mừng! Bạn đã hoàn thành buổi luyện.
        </AppText>

        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <AppText testID="shadowing-summary-saved-count" variant="h2">
              {savedCount}
            </AppText>
            <AppText color="secondary">Câu đã lưu</AppText>
          </View>
          <View style={styles.statCard}>
            <AppText testID="shadowing-summary-failed-count" variant="h2">
              {failedCount}
            </AppText>
            <AppText color="secondary">Câu cần ôn</AppText>
          </View>
          <View style={styles.statCard}>
            <AppText testID="shadowing-summary-elapsed" variant="h2">
              {formatShadowingElapsed(elapsedMs)}
            </AppText>
            <AppText color="secondary">Thời gian</AppText>
          </View>
        </View>

        {showFailedList ? (
          <View testID="shadowing-summary-failed-list">
            <AppText variant="h3">Câu cần ôn</AppText>
            {failedSentences.map(row => {
              const showPlay = playVisibleBySentenceId[row.sentenceId] ?? false;
              return (
                <View
                  key={row.sentenceId}
                  style={[styles.failedRow, {borderColor: theme.colors.border}]}
                  testID={`shadowing-summary-failed-row-${row.sentenceId}`}
                >
                  <AppText style={styles.flex1}>{row.textEn}</AppText>
                  <Chip label="Đã thêm vào Ôn tập" tone="accentSoft" />
                  {row.uploadPending ? (
                    <AppText color="secondary" variant="caption">
                      Chưa tải lên
                    </AppText>
                  ) : null}
                  {showPlay ? (
                    <IconButton
                      accessibilityLabel={`Nghe lại ${row.textEn}`}
                      icon="play_arrow"
                      onPress={() => {
                        const playRow = async () => {
                          const result = await playSummarySentenceRecording({
                            recordingId: row.recordingId,
                            localFilePath: row.localFilePath,
                            serverRecordingId: row.serverRecordingId,
                          });
                          if (!result.ok) {
                            setPlayVisibleBySentenceId(prev => ({
                              ...prev,
                              [row.sentenceId]: false,
                            }));
                          }
                        };
                        playRow().catch(() => undefined);
                      }}
                      testID={`shadowing-summary-play-${row.sentenceId}`}
                    />
                  ) : null}
                </View>
              );
            })}
          </View>
        ) : null}

        <Pressable
          accessibilityRole="button"
          onPress={handleDone}
          style={({pressed}) => ({
            alignItems: 'center',
            backgroundColor: theme.colors.accent,
            borderRadius: theme.radius.lg,
            minHeight: 48,
            justifyContent: 'center',
            opacity: pressed ? theme.states.pressedOpacity : 1,
          })}
          testID="shadowing-summary-done"
        >
          <AppText style={{color: theme.colors.accentInk, fontWeight: '700'}}>
            Xong
          </AppText>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={handleAnotherLesson}
          style={({pressed}) => ({
            alignItems: 'center',
            borderColor: theme.colors.border,
            borderRadius: theme.radius.lg,
            borderWidth: 1,
            minHeight: 48,
            justifyContent: 'center',
            opacity: pressed ? theme.states.pressedOpacity : 1,
          })}
          testID="shadowing-summary-another-lesson"
        >
          <AppText style={{fontWeight: '600'}}>Luyện bài khác</AppText>
        </Pressable>
      </ScrollView>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  flex1: {
    flex: 1,
  },
  scroll: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  statCard: {
    alignItems: 'center',
    flex: 1,
    gap: 4,
  },
  failedRow: {
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 12,
  },
});
