import React from 'react';
import {Pressable, StyleSheet, View} from 'react-native';
import {useTranslation} from 'react-i18next';
import {AppText} from '@ui/components/AppText';
import {IconButton} from '@ui/components/IconButton';
import {useAppTheme, type AppTheme} from '@ui/theme/index';
import type {YouTubeSegment} from '@shared/schemas/youtube-transcript-v1';

export type TranscriptLineProps = {
  segment: YouTubeSegment;
  isActive: boolean;
  showVietnamese: boolean;
  showIpa: boolean;
  isSaved?: boolean;
  disabled?: boolean;
  onToggleSave?: (segment: YouTubeSegment) => void;
  onPress: (segment: YouTubeSegment) => void;
  /**
   * SETE-325 (C-2): when set, each English word renders as a tappable
   * span that reports the tapped word (the lesson screen speaks it).
   * SETE-325 (C-3): when set, a mic button opens the Speaking Room with
   * this sentence. Both are opt-in so existing usages are unchanged.
   */
  onPressWord?: (word: string) => void;
  onPracticeSentence?: (segment: YouTubeSegment) => void;
  testID?: string;
};

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    container: {
      flexDirection: 'row',
      alignItems: 'center',
      borderRadius: theme.radius.md,
      gap: theme.spacing.xs,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
    },
    ipaText: {
      fontStyle: 'italic',
    },
  });
}

export function TranscriptLine({
  segment,
  isActive,
  showVietnamese,
  showIpa,
  isSaved,
  disabled = false,
  onToggleSave,
  onPress,
  onPressWord,
  onPracticeSentence,
  testID,
}: TranscriptLineProps) {
  const {theme} = useAppTheme();
  const {t} = useTranslation();
  const styles = React.useMemo(() => createStyles(theme), [theme]);

  // SETE-325 (C-2): tappable words only when a handler is wired and the
  // line is interactive — offline reading stays plain readable text.
  const wordInteractive = onPressWord != null && !disabled;
  const wordParts = React.useMemo(
    () => segment.en.split(/(\s+)/),
    [segment.en],
  );

  return (
    <View
      style={[
        styles.container,
        isActive ? {backgroundColor: theme.colors.primaryContainer} : null,
      ]}
      testID={testID}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('youtube.segment_a11y', {
          index: segment.index + 1,
          text: segment.en,
        })}
        accessibilityHint={t('youtube.segment_a11y_hint')}
        accessibilityState={
          disabled ? {selected: isActive, disabled: true} : {selected: isActive}
        }
        {...(disabled ? {disabled: true} : null)}
        onPress={() => onPress(segment)}
        style={({pressed}) => [
          {flex: 1, gap: theme.spacing.xs},
          pressed && !disabled ? {opacity: theme.states.pressedOpacity} : null,
        ]}
      >
        <AppText
          variant="bodyLg"
          style={isActive ? {color: theme.colors.onPrimaryContainer} : null}
          testID={testID ? `${testID}-en` : undefined}
        >
          {wordInteractive
            ? wordParts.map((part, partIndex) =>
                part === '' || /^\s+$/.test(part) ? (
                  part
                ) : (
                  <AppText
                    accessibilityHint={t('youtube.speak_word_hint', {
                      defaultValue: 'Chạm để nghe phát âm từ này',
                    })}
                    accessibilityLabel={part}
                    accessibilityRole="button"
                    key={`${partIndex}-${part}`}
                    onPress={() => onPressWord?.(part)}
                    testID={testID ? `${testID}-word-${partIndex}` : undefined}
                  >
                    {part}
                  </AppText>
                ),
              )
            : segment.en}
        </AppText>
        {showVietnamese && segment.vi ? (
          <AppText
            color={isActive ? 'primary' : 'secondary'}
            style={isActive ? {color: theme.colors.onPrimaryContainer} : null}
            testID={testID ? `${testID}-vi` : undefined}
          >
            {segment.vi}
          </AppText>
        ) : null}
        {showIpa && segment.ipa ? (
          <AppText
            color={isActive ? undefined : 'muted'}
            variant="caption"
            style={[
              styles.ipaText,
              isActive ? {color: theme.colors.onPrimaryContainer} : null,
            ]}
            testID={testID ? `${testID}-ipa` : undefined}
          >
            {`/${segment.ipa}/`}
          </AppText>
        ) : null}
      </Pressable>
      {onToggleSave && (
        <IconButton
          accessibilityHint={
            isSaved
              ? t('youtube.unsave_sentence_hint', {
                  defaultValue: 'Xóa câu này khỏi thẻ ghi nhớ',
                })
              : t('youtube.save_sentence_hint', {
                  defaultValue: 'Lưu câu này vào thẻ ghi nhớ',
                })
          }
          accessibilityLabel={
            isSaved
              ? t('youtube.unsave_sentence_a11y', {defaultValue: 'Bỏ lưu câu'})
              : t('youtube.save_sentence_a11y', {defaultValue: 'Lưu câu'})
          }
          icon={isSaved ? 'heart' : 'heart_outline'}
          onPress={() => onToggleSave(segment)}
          testID={testID ? `${testID}-save` : undefined}
          tone={isSaved ? 'accent' : 'surface'}
        />
      )}
      {onPracticeSentence && (
        <IconButton
          accessibilityHint={t('youtube.practice_sentence_hint', {
            defaultValue: 'Luyện nói câu này trong Speaking Room',
          })}
          accessibilityLabel={t('youtube.practice_sentence_a11y', {
            defaultValue: 'Luyện nói câu này',
          })}
          icon="mic"
          onPress={() => onPracticeSentence(segment)}
          testID={testID ? `${testID}-practice` : undefined}
          tone="surface"
        />
      )}
    </View>
  );
}
