import React, {useEffect, useMemo, useState} from 'react';
import {
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import {useTranslation} from 'react-i18next';
import {AppText} from '@ui/components/AppText';
import {IconButton} from '@ui/components/IconButton';
import {MaterialIcon} from '@ui/components/MaterialIcon';
import {useAppTheme, type AppTheme} from '@ui/theme/index';
import type {YouTubeSegment} from '@core/schemas/youtube-transcript-v1';
import {
  formatYouTubePlaybackRate,
  YOUTUBE_PLAYBACK_RATES,
  type YouTubePlaybackRate,
} from '../logic/utils/playbackRate';
import {
  checkDictation,
  formatLoopLabel,
  SENTENCE_LOOP_OPTIONS,
  type SentenceLoopCount,
} from '../logic/utils/toolsLogic';

const MIN_TOUCH_PT = 44;
const SWIPE_DISMISS_THRESHOLD_PT = 50;

export type YouTubeToolsPopupProps = {
  visible: boolean;
  onClose: () => void;
  topOffset?: number;
  segments: readonly YouTubeSegment[];
  activeIndex: number;
  disabled?: boolean;
  onReplay: () => void;
  playbackRate: YouTubePlaybackRate;
  onSelectPlaybackRate: (rate: YouTubePlaybackRate) => void;
  loopCount: SentenceLoopCount;
  onSelectLoopCount: (count: SentenceLoopCount) => void;
  abLoopStartIndex: number | null;
  abLoopEndIndex: number | null;
  abLoopActive: boolean;
  onSetAbLoopPointA: () => void;
  onSetAbLoopPointB: () => void;
  onClearAbLoop: () => void;
  onOpenTranscript: () => void;
};

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    container: {
      backgroundColor: theme.colors.surface,
      borderTopColor: theme.colors.surfaceHigh,
      borderTopLeftRadius: theme.radius.lg,
      borderTopRightRadius: theme.radius.lg,
      borderTopWidth: 1,
      bottom: 0,
      elevation: 12,
      left: 0,
      position: 'absolute',
      right: 0,
      shadowColor: theme.colors.text.primary,
      shadowOffset: {width: 0, height: -3},
      shadowOpacity: 0.15,
      shadowRadius: 8,
      zIndex: 100,
    },
    header: {
      alignItems: 'center',
      borderBottomColor: theme.colors.surfaceHigh,
      borderBottomWidth: 1,
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingHorizontal: theme.gutter,
      paddingVertical: theme.spacing.xs,
    },
    handleBar: {
      alignSelf: 'center',
      backgroundColor: theme.colors.surfaceHigh,
      borderRadius: theme.radius.pill,
      height: 4,
      marginBottom: theme.spacing.xs,
      width: 40,
    },
    title: {
      flex: 1,
    },
    scrollContent: {
      paddingBottom: theme.spacing.xxl,
      paddingHorizontal: theme.gutter,
      paddingTop: theme.spacing.sm,
    },
    section: {
      marginBottom: theme.spacing.md,
    },
    sectionTitle: {
      marginBottom: theme.spacing.xs,
    },
    actionButton: {
      alignItems: 'center',
      borderColor: theme.colors.surfaceHigh,
      borderRadius: theme.radius.pill,
      borderWidth: 1,
      flexDirection: 'row',
      gap: 4,
      justifyContent: 'center',
      minHeight: MIN_TOUCH_PT,
      minWidth: MIN_TOUCH_PT,
      paddingHorizontal: theme.spacing.sm,
    },
    actionButtonActive: {
      borderColor: theme.colors.accent,
    },
    pillsRow: {
      flexDirection: 'row',
      gap: theme.spacing.xs,
      marginTop: theme.spacing.xs,
    },
    pillButton: {
      alignItems: 'center',
      backgroundColor: theme.colors.surfaceHigh,
      borderColor: theme.colors.surfaceHigh,
      borderRadius: theme.radius.pill,
      borderWidth: 1,
      flex: 1,
      justifyContent: 'center',
      minHeight: MIN_TOUCH_PT,
      paddingHorizontal: theme.spacing.xs,
    },
    pillButtonActive: {
      backgroundColor: theme.colors.surface,
      borderColor: theme.colors.accent,
    },
    dictationBox: {
      backgroundColor: theme.colors.surfaceHigh,
      borderRadius: theme.radius.md,
      marginTop: theme.spacing.xs,
      padding: theme.spacing.sm,
    },
    dictationInput: {
      backgroundColor: theme.colors.surface,
      borderColor: theme.colors.surfaceHigh,
      borderRadius: theme.radius.sm,
      borderWidth: 1,
      color: theme.colors.text.primary,
      fontSize: 15,
      minHeight: 44,
      marginTop: theme.spacing.xs,
      paddingHorizontal: theme.spacing.sm,
      paddingVertical: theme.spacing.xs,
    },
    dictationActions: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: theme.spacing.xs,
      justifyContent: 'space-between',
      marginTop: theme.spacing.sm,
    },
    dictationResult: {
      marginTop: theme.spacing.xs,
    },
    transcriptButton: {
      alignItems: 'center',
      backgroundColor: theme.colors.surfaceHigh,
      borderColor: theme.colors.surfaceHigh,
      borderRadius: theme.radius.pill,
      borderWidth: 1,
      flexDirection: 'row',
      gap: theme.spacing.sm,
      justifyContent: 'center',
      minHeight: MIN_TOUCH_PT,
      paddingHorizontal: theme.spacing.md,
    },
  });
}

/**
 * SETE-332 (TASK-5) / SETE-346 (Option A + Option C): Tools popup sheet under
 * the video player. The single home for practice settings: loop (1,3,5,inf),
 * A–B range (set A / set B / clear), speed (0.5-1.25x), dictation
 * on-the-spot check, and transcript trigger. Transport (seek + prev/replay/
 * play/next) lives only in the compact bar above — the sheet never duplicates
 * it, so it stays short and never covers the video. Never darkens the video
 * above, video remains playing.
 */
export function YouTubeToolsPopup({
  visible,
  onClose,
  topOffset = 220,
  segments,
  activeIndex,
  disabled = false,
  onReplay,
  playbackRate,
  onSelectPlaybackRate,
  loopCount,
  onSelectLoopCount,
  abLoopStartIndex,
  abLoopEndIndex,
  abLoopActive,
  onSetAbLoopPointA,
  onSetAbLoopPointB,
  onClearAbLoop,
  onOpenTranscript,
}: YouTubeToolsPopupProps) {
  const {theme} = useAppTheme();
  const {t} = useTranslation();
  const styles = useMemo(() => createStyles(theme), [theme]);

  // Dictation state (D-2)
  const [dictationOpen, setDictationOpen] = useState(false);
  const [dictationText, setDictationText] = useState('');
  const [dictationFeedback, setDictationFeedback] = useState<{
    correct: boolean;
    message: string;
  } | null>(null);

  // Reset dictation feedback when sentence changes
  useEffect(() => {
    setDictationFeedback(null);
    setDictationText('');
  }, [activeIndex]);

  // Swipe-down to close pan responder on the header
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onPanResponderRelease: (_, gestureState) => {
          if (gestureState.dy > SWIPE_DISMISS_THRESHOLD_PT) {
            onClose();
          }
        },
      }),
    [onClose],
  );

  if (!visible) {
    return null;
  }

  const handleCheckDictation = () => {
    const currentSegment = segments[activeIndex];
    if (!currentSegment) {
      return;
    }
    const result = checkDictation(dictationText, currentSegment.en);
    setDictationFeedback(result);
  };

  const handleReplayForDictation = () => {
    onReplay();
  };

  return (
    <View
      accessibilityLabel="Bảng công cụ"
      accessibilityRole="none"
      style={[styles.container, {top: topOffset}]}
      testID="youtube-tools-popup"
    >
      <View {...panResponder.panHandlers} style={styles.header}>
        <View style={{flex: 1}}>
          <View style={styles.handleBar} />
          <AppText
            style={styles.title}
            testID="youtube-tools-title"
            variant="title"
          >
            {t('youtube.tools_title', {defaultValue: 'Công cụ'})}
          </AppText>
        </View>
        <IconButton
          accessibilityHint="Đóng bảng công cụ"
          accessibilityLabel="Đóng công cụ"
          icon="close"
          onPress={onClose}
          testID="youtube-tools-close"
          tone="surface"
        />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Lặp câu (Sentence Repeat Options: 1, 3, 5, inf) */}
        <View style={styles.section}>
          <AppText style={styles.sectionTitle} variant="label">
            {t('youtube.loop_section_title', {defaultValue: 'Lặp câu'})}
          </AppText>
          <View style={styles.pillsRow}>
            {SENTENCE_LOOP_OPTIONS.map(opt => {
              const active = loopCount === opt;
              const testIdSuffix = opt === Infinity ? 'inf' : String(opt);
              return (
                <Pressable
                  accessibilityLabel={`Lặp ${formatLoopLabel(opt)} lần`}
                  accessibilityRole="button"
                  accessibilityState={{selected: active, disabled}}
                  aria-pressed={active}
                  disabled={disabled}
                  key={String(opt)}
                  onPress={() => onSelectLoopCount(opt)}
                  style={[
                    styles.pillButton,
                    active && styles.pillButtonActive,
                    disabled && {opacity: theme.states.disabledOpacity},
                  ]}
                  testID={`youtube-tools-loop-${testIdSuffix}`}
                >
                  <AppText
                    style={active ? {color: theme.colors.accent} : undefined}
                    variant="label"
                  >
                    {formatLoopLabel(opt)}
                  </AppText>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Lặp đoạn A–B (SETE-346 Option A: full range semantics) */}
        <View style={styles.section}>
          <AppText style={styles.sectionTitle} variant="label">
            {t('youtube.ab_loop_section_title', {
              defaultValue: 'Lặp đoạn A–B',
            })}
          </AppText>
          <View style={styles.pillsRow}>
            <Pressable
              accessibilityHint={t('youtube.ab_loop_a_hint', {
                defaultValue: 'Đánh dấu điểm A tại câu đang phát',
              })}
              accessibilityLabel={t('youtube.ab_loop_a_a11y', {
                defaultValue: `Đặt điểm A, hiện tại câu ${activeIndex + 1}`,
                index:
                  abLoopStartIndex != null
                    ? abLoopStartIndex + 1
                    : activeIndex + 1,
              })}
              accessibilityRole="button"
              accessibilityState={{
                selected: abLoopStartIndex != null,
                disabled,
              }}
              aria-pressed={abLoopStartIndex != null}
              disabled={disabled}
              onPress={onSetAbLoopPointA}
              style={[
                styles.pillButton,
                abLoopStartIndex != null && styles.pillButtonActive,
                disabled && {opacity: theme.states.disabledOpacity},
              ]}
              testID="youtube-tools-ab-a"
            >
              <MaterialIcon name="flag" size={18} />
              <AppText
                style={
                  abLoopStartIndex != null
                    ? {color: theme.colors.accent}
                    : undefined
                }
                variant="label"
              >
                {abLoopStartIndex != null
                  ? t('youtube.overflow_ab_loop_a', {
                      defaultValue: `A · câu ${abLoopStartIndex + 1}`,
                    })
                  : t('youtube.overflow_ab_loop_a', {
                      defaultValue: 'Đặt A',
                    })}
              </AppText>
            </Pressable>

            <Pressable
              accessibilityHint={t('youtube.ab_loop_b_hint', {
                defaultValue: 'Đánh dấu điểm B tại câu đang phát',
              })}
              accessibilityLabel={t('youtube.ab_loop_b_a11y', {
                defaultValue: `Đặt điểm B, hiện tại câu ${activeIndex + 1}`,
                index:
                  abLoopEndIndex != null ? abLoopEndIndex + 1 : activeIndex + 1,
              })}
              accessibilityRole="button"
              accessibilityState={{selected: abLoopActive, disabled}}
              aria-pressed={abLoopActive}
              disabled={disabled}
              onPress={onSetAbLoopPointB}
              style={[
                styles.pillButton,
                abLoopActive && styles.pillButtonActive,
                disabled && {opacity: theme.states.disabledOpacity},
              ]}
              testID="youtube-tools-ab-b"
            >
              <MaterialIcon name="compare" size={18} />
              <AppText
                style={abLoopActive ? {color: theme.colors.accent} : undefined}
                variant="label"
              >
                {abLoopEndIndex != null
                  ? t('youtube.overflow_ab_loop_b', {
                      defaultValue: `B · câu ${abLoopEndIndex + 1}`,
                    })
                  : t('youtube.overflow_ab_loop_b', {
                      defaultValue: 'Đặt B',
                    })}
              </AppText>
            </Pressable>

            {abLoopStartIndex != null || abLoopEndIndex != null ? (
              <Pressable
                accessibilityHint={t('youtube.ab_loop_clear_hint', {
                  defaultValue: 'Tắt lặp đoạn A–B',
                })}
                accessibilityLabel={t('youtube.ab_loop_clear_a11y', {
                  defaultValue: 'Xóa lặp A–B',
                })}
                accessibilityRole="button"
                accessibilityState={{disabled}}
                disabled={disabled}
                onPress={onClearAbLoop}
                style={[
                  styles.pillButton,
                  disabled && {opacity: theme.states.disabledOpacity},
                ]}
                testID="youtube-tools-ab-clear"
              >
                <MaterialIcon name="close" size={18} />
                <AppText variant="label">
                  {t('youtube.overflow_ab_loop_clear', {
                    defaultValue: 'Xóa',
                  })}
                </AppText>
              </Pressable>
            ) : null}
          </View>
        </View>

        {/* Tốc độ (Playback Speed Options: 0.5, 0.75, 1.0, 1.25) */}
        <View style={styles.section}>
          <AppText style={styles.sectionTitle} variant="label">
            {t('youtube.speed_section_title', {defaultValue: 'Tốc độ'})}
          </AppText>
          <View style={styles.pillsRow}>
            {YOUTUBE_PLAYBACK_RATES.map(rate => {
              const active = playbackRate === rate;
              return (
                <Pressable
                  accessibilityLabel={`Tốc độ ${formatYouTubePlaybackRate(
                    rate,
                  )}`}
                  accessibilityRole="button"
                  accessibilityState={{selected: active, disabled}}
                  disabled={disabled}
                  key={String(rate)}
                  onPress={() => onSelectPlaybackRate(rate)}
                  style={[
                    styles.pillButton,
                    active && styles.pillButtonActive,
                    disabled && {opacity: theme.states.disabledOpacity},
                  ]}
                  testID={`youtube-tools-speed-${rate}`}
                >
                  <AppText
                    style={active ? {color: theme.colors.accent} : undefined}
                    variant="label"
                  >
                    {formatYouTubePlaybackRate(rate)}
                  </AppText>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Chép chính tả (Dictation - D-2 Bản tối thiểu) */}
        <View style={styles.section}>
          <Pressable
            accessibilityHint="Mở hoặc thu gọn phần chép chính tả"
            accessibilityLabel="Chép chính tả"
            accessibilityRole="button"
            onPress={() => setDictationOpen(o => !o)}
            style={[
              styles.actionButton,
              {width: '100%', justifyContent: 'space-between'},
            ]}
            testID="youtube-tools-dictation-toggle"
          >
            <View style={{flexDirection: 'row', alignItems: 'center', gap: 8}}>
              <MaterialIcon name="edit" size={20} />
              <AppText variant="label">
                {t('youtube.dictation_title', {
                  defaultValue: 'Chép chính tả',
                })}
              </AppText>
            </View>
            <MaterialIcon
              name={dictationOpen ? 'chevron_left' : 'chevron_right'}
              size={22}
            />
          </Pressable>

          {dictationOpen ? (
            <View
              style={styles.dictationBox}
              testID="youtube-tools-dictation-box"
            >
              <AppText color="secondary" variant="caption">
                {t('youtube.dictation_hint', {
                  defaultValue: 'Nghe câu hiện tại và gõ lại tiếng Anh:',
                })}
              </AppText>
              <TextInput
                accessibilityLabel="Ô nhập chép chính tả"
                autoCapitalize="none"
                autoCorrect={false}
                onChangeText={setDictationText}
                placeholder="Gõ lại câu tiếng Anh..."
                placeholderTextColor={theme.colors.text.muted}
                style={styles.dictationInput}
                testID="youtube-tools-dictation-input"
                value={dictationText}
              />
              <View style={styles.dictationActions}>
                <Pressable
                  accessibilityHint="Nghe lại câu hiện tại"
                  accessibilityLabel="Nghe lại"
                  accessibilityRole="button"
                  onPress={handleReplayForDictation}
                  style={styles.actionButton}
                  testID="youtube-tools-dictation-replay"
                >
                  <MaterialIcon name="volume_up" size={18} />
                  <AppText variant="caption">Nghe</AppText>
                </Pressable>
                <Pressable
                  accessibilityHint="Kiểm tra nội dung đã gõ"
                  accessibilityLabel="Kiểm tra"
                  accessibilityRole="button"
                  onPress={handleCheckDictation}
                  style={[
                    styles.actionButton,
                    {backgroundColor: theme.colors.accent},
                  ]}
                  testID="youtube-tools-dictation-check"
                >
                  <AppText
                    style={{color: theme.colors.accentInk}}
                    variant="label"
                  >
                    Kiểm tra
                  </AppText>
                </Pressable>
              </View>
              {dictationFeedback ? (
                <AppText
                  style={[
                    styles.dictationResult,
                    {
                      color: dictationFeedback.correct
                        ? theme.colors.accent
                        : theme.colors.danger,
                    },
                  ]}
                  testID="youtube-tools-dictation-result"
                  variant="label"
                >
                  {dictationFeedback.message}
                </AppText>
              ) : null}
            </View>
          ) : null}
        </View>

        {/* Xem transcript (Transcript button) */}
        <View style={styles.section}>
          <Pressable
            accessibilityHint="Mở danh sách transcript đầy đủ"
            accessibilityLabel="Xem transcript"
            accessibilityRole="button"
            onPress={onOpenTranscript}
            style={styles.transcriptButton}
            testID="youtube-tools-open-transcript"
          >
            <MaterialIcon name="subtitles" size={20} />
            <AppText variant="label">
              {t('youtube.overflow_transcript', {
                defaultValue: 'Xem transcript',
              })}
            </AppText>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}
