import React, {useCallback, useMemo, useRef} from 'react';
import {useTranslation} from 'react-i18next';
import {
  FlatList,
  type ListRenderItemInfo,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';

import {AppText} from '@ui/components/AppText';
import {type AppTheme, useAppTheme} from '@ui/theme';

import type {LessonSentence} from '@core/schemas/lesson';

import {formatCueLabel} from '../logic/canonicalYouTubeCues';
import {YouTubeSheet} from './YouTubeSheet';

export type YouTubeTranscriptSheetProps = {
  visible: boolean;
  sentences: LessonSentence[];
  activeIndex: number | null;
  currentIndex: number;
  videoAvailable: boolean;
  showTranslation: boolean;
  onClose: () => void;
  onSelectSentence: (index: number, startMs: number | null) => void;
};

export function YouTubeTranscriptSheet({
  visible,
  sentences,
  activeIndex,
  currentIndex,
  videoAvailable,
  showTranslation,
  onClose,
  onSelectSentence,
}: YouTubeTranscriptSheetProps) {
  const highlightIndex = videoAvailable ? activeIndex : currentIndex;
  const {theme} = useAppTheme();
  const {t} = useTranslation();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const listRef = useRef<FlatList<LessonSentence>>(null);

  const initialScrollIndex = useMemo(() => {
    if (sentences.length === 0) return 0;
    const target = highlightIndex ?? currentIndex;
    return Math.max(0, Math.min(target, sentences.length - 1));
  }, [currentIndex, highlightIndex, sentences.length]);

  const handleScrollToIndexFailed = useCallback(
    (info: {index: number; averageItemLength: number}) => {
      const offset = info.averageItemLength * info.index;
      listRef.current?.scrollToOffset({animated: false, offset});
      requestAnimationFrame(() => {
        listRef.current?.scrollToIndex({
          animated: false,
          index: info.index,
        });
      });
    },
    [],
  );

  const renderItem = useCallback(
    ({item, index}: ListRenderItemInfo<LessonSentence>) => {
      const selected = highlightIndex === index;
      return (
        <Pressable
          accessibilityRole="button"
          accessibilityState={{selected}}
          onPress={() => onSelectSentence(index, item.start_ms)}
          style={({pressed}) => [
            styles.row,
            selected ? styles.rowActive : null,
            pressed ? styles.pressed : null,
          ]}
          testID={`youtube-transcript-row-${item.id}`}
        >
          <AppText style={styles.timestamp} variant="label">
            {formatCueLabel(item.start_ms)}
          </AppText>
          <View style={styles.rowText}>
            <AppText variant="bodyLg">{item.text_en}</AppText>
            {showTranslation ? (
              <AppText color="secondary" variant="body">
                {item.text_vi}
              </AppText>
            ) : null}
          </View>
        </Pressable>
      );
    },
    [highlightIndex, onSelectSentence, showTranslation, styles],
  );

  const listHeader =
    sentences.length > 0 ? (
      <AppText color="muted" style={styles.meta} variant="label">
        {t('youtube.study.sheet_transcript_meta', {count: sentences.length})}
      </AppText>
    ) : null;

  return (
    <YouTubeSheet
      accessibilityLabel={t('youtube.study.sheet_transcript_title')}
      onClose={onClose}
      testID="youtube-sheet-transcript"
      title={t('youtube.study.sheet_transcript_title')}
      visible={visible}
    >
      {sentences.length === 0 ? (
        <AppText color="secondary" testID="youtube-transcript-empty">
          {t('youtube.study.sheet_transcript_empty')}
        </AppText>
      ) : (
        <FlatList
          ref={listRef}
          ListHeaderComponent={listHeader}
          data={sentences}
          initialScrollIndex={initialScrollIndex}
          keyExtractor={item => item.id}
          onScrollToIndexFailed={handleScrollToIndexFailed}
          renderItem={renderItem}
          testID="youtube-transcript-list"
        />
      )}
    </YouTubeSheet>
  );
}

function makeStyles(theme: AppTheme) {
  return StyleSheet.create({
    meta: {
      marginBottom: theme.spacing.sm,
    },
    pressed: {
      opacity: theme.states.pressedOpacity,
    },
    row: {
      borderRadius: theme.radius.md,
      flexDirection: 'row',
      gap: theme.spacing.md,
      paddingHorizontal: theme.spacing.sm,
      paddingVertical: theme.spacing.md,
    },
    rowActive: {
      backgroundColor: theme.colors.accentSoft,
    },
    rowText: {
      flex: 1,
      gap: theme.spacing.xs,
    },
    timestamp: {
      color: theme.colors.primary,
      minWidth: 48,
    },
  });
}
