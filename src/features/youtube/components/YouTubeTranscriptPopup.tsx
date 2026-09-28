import React, {useMemo} from 'react';
import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  View,
  type ListRenderItemInfo,
} from 'react-native';
import {useTranslation} from 'react-i18next';
import {AppText} from '@ui/components/AppText';
import {IconButton} from '@ui/components/IconButton';
import {useAppTheme, type AppTheme} from '@ui/theme/index';
import type {YouTubeSegment} from '@core/schemas/youtube-transcript-v1';
import {TranscriptLine} from './TranscriptLine';

export type YouTubeTranscriptPopupProps = {
  visible: boolean;
  onClose: () => void;
  segments: readonly YouTubeSegment[];
  activeIndex: number;
  showVietnamese: boolean;
  showIpa: boolean;
  /**
   * Offline reading mode: lines stay readable but not interactive, mirroring
   * the main list. Seeking and word taps are disabled; the popup itself
   * stays openable so the transcript remains readable.
   */
  disabled?: boolean;
  /**
   * SETE-325 (C-4): tapping a line seeks the video and keeps the popup
   * open so users can hop between sentences without reopening it.
   */
  onSeekSegment: (segment: YouTubeSegment) => void;
  onPressWord?: (word: string) => void;
  onPracticeSentence?: (segment: YouTubeSegment) => void;
};

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    backdrop: {
      backgroundColor: theme.colors.overlay,
      flex: 1,
      justifyContent: 'flex-end',
    },
    sheet: {
      backgroundColor: theme.colors.surface,
      borderTopLeftRadius: theme.radius.lg,
      borderTopRightRadius: theme.radius.lg,
      maxHeight: '80%',
      paddingBottom: theme.spacing.md,
    },
    header: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: theme.spacing.sm,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
    },
    title: {
      flex: 1,
    },
    list: {
      paddingHorizontal: theme.spacing.sm,
    },
  });
}

/**
 * SETE-325 (C-4): "Xem transcript" popup. Not a new screen — a `Modal`
 * reusing `TranscriptLine` (with its active-sentence highlight) over the
 * lesson screen. Native `Text` only, no WebView, so text stays selectable
 * (C-5 has nothing to strip).
 */
export function YouTubeTranscriptPopup({
  visible,
  onClose,
  segments,
  activeIndex,
  showVietnamese,
  showIpa,
  disabled = false,
  onSeekSegment,
  onPressWord,
  onPracticeSentence,
}: YouTubeTranscriptPopupProps) {
  const {theme} = useAppTheme();
  const {t} = useTranslation();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const renderItem = React.useCallback(
    ({item}: ListRenderItemInfo<YouTubeSegment>) => (
      <TranscriptLine
        disabled={disabled}
        isActive={item.index === activeIndex}
        onPracticeSentence={onPracticeSentence}
        onPress={onSeekSegment}
        onPressWord={onPressWord}
        segment={item}
        showIpa={showIpa}
        showVietnamese={showVietnamese}
        testID={`youtube-popup-line-${item.id}`}
      />
    ),
    [
      activeIndex,
      disabled,
      onPracticeSentence,
      onPressWord,
      onSeekSegment,
      showIpa,
      showVietnamese,
    ],
  );

  return (
    <Modal
      animationType="slide"
      onRequestClose={onClose}
      transparent
      visible={visible}
    >
      <Pressable
        accessibilityHint={t('youtube.transcript_popup_close_hint', {
          defaultValue: 'Đóng cửa sổ transcript',
        })}
        accessibilityLabel={t('youtube.transcript_popup_close_a11y', {
          defaultValue: 'Đóng transcript',
        })}
        accessibilityRole="button"
        onPress={onClose}
        style={styles.backdrop}
        testID="youtube-transcript-popup-backdrop"
      >
        <View style={styles.sheet} testID="youtube-transcript-popup">
          <View style={styles.header}>
            <AppText style={styles.title} variant="title">
              {t('youtube.transcript_popup_title', {
                defaultValue: 'Transcript',
              })}
            </AppText>
            <IconButton
              accessibilityHint={t('youtube.transcript_popup_close_hint', {
                defaultValue: 'Đóng cửa sổ transcript',
              })}
              accessibilityLabel={t('youtube.transcript_popup_close_a11y', {
                defaultValue: 'Đóng transcript',
              })}
              icon="close"
              onPress={onClose}
              testID="youtube-transcript-popup-close"
              tone="surface"
            />
          </View>
          <FlatList
            contentContainerStyle={styles.list}
            data={segments}
            keyExtractor={item => item.id}
            renderItem={renderItem}
            testID="youtube-transcript-popup-list"
          />
        </View>
      </Pressable>
    </Modal>
  );
}
