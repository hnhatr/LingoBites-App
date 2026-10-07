import React, {useMemo, useState} from 'react';
import {Pressable, StyleSheet, View} from 'react-native';

import type {LessonSourceType, LessonUnit} from '@core/schemas/lesson';

import type {HandoffIconName} from '../icons/iconRegistry';
import {type AppTheme, useAppTheme} from '../theme';
import {getStickerFace} from '../theme/hardShadow';
import {AppText} from './AppText';
import {MaterialIcon} from './MaterialIcon';
import {ShelfSurface} from './ShelfSurface';

/**
 * One lesson card for every lesson list (Home rail, Library, public catalog,
 * course unit, shadowing picker). Same anatomy everywhere:
 *
 *   [type icon]  context line                         [bookmark]
 *                title (2 lines) / Vietnamese subtitle (1 line)
 *                duration · sentence count
 *                status chips (offline → progress → practice)   ›
 *                progress bar (only while in progress)
 *
 * `compact` is the 250pt-wide Home rail size; chips shrink to icons there.
 */

export type LessonCardKind = 'text' | 'video' | 'image';

export type LessonCardProgress =
  | {state: 'in_progress'; done?: number; total?: number; label?: string}
  | {state: 'completed'; label?: string};

export type LessonCardProps = {
  kind: LessonCardKind;
  title: string;
  subtitle?: string | null;
  /** Bold lead of the context line, e.g. "Bài 1". */
  contextLead?: string | null;
  /** Rest of the context line, e.g. "Getting Started · A1". */
  context?: string | null;
  /** Pre-formatted duration, e.g. "12 phút" or "4:32". */
  durationLabel?: string | null;
  sentenceCount?: number | null;
  downloaded?: boolean;
  progress?: LessonCardProgress | null;
  /** Exercise count; 0 or absent hides the chip. */
  exerciseCount?: number | null;
  /** Sentences due for review; shown before the exercise chip. */
  reviewDueCount?: number | null;
  /** Shows a bookmark toggle when set. */
  bookmarked?: boolean;
  onToggleBookmark?: () => void;
  onPress?: () => void;
  variant?: 'full' | 'compact';
  /** Extra row under the card body, e.g. a "Luyện tập" action. */
  footer?: React.ReactNode;
  accessibilityHint?: string;
  testID?: string;
};

/** Card kind for a lesson source: YouTube is video, OCR is image, else text. */
export function lessonCardKind(sourceType: LessonSourceType): LessonCardKind {
  if (sourceType === 'youtube') {
    return 'video';
  }
  if (sourceType === 'learner_ocr') {
    return 'image';
  }
  return 'text';
}

/**
 * Splits a bilingual title "English · Tiếng Việt" into title and subtitle at
 * the first " · ". A title without the separator stays whole.
 */
export function splitLessonTitle(raw: string): {
  title: string;
  subtitle: string | null;
} {
  const trimmed = raw.trim();
  const index = trimmed.indexOf(' · ');
  if (index <= 0) {
    return {title: trimmed, subtitle: null};
  }
  const title = trimmed.slice(0, index).trim();
  const subtitle = trimmed.slice(index + 3).trim();
  return subtitle.length > 0
    ? {title, subtitle}
    : {title: trimmed, subtitle: null};
}

/** "Getting Started · A1"-style placement line, or null for own lessons. */
export function lessonContextLabel(unit: LessonUnit | null): string | null {
  if (!unit) {
    return null;
  }
  const label = unit.level_title.trim() || unit.course_title.trim();
  return label.length > 0 ? label : null;
}

/** "4:32" for a video length in milliseconds. */
export function formatVideoDuration(durationMs: number): string {
  const totalSeconds = Math.max(0, Math.round(durationMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

/**
 * The duration shown on a card: the author's estimate, else the video length,
 * else half a minute per sentence (the estimate used for downloaded lessons).
 */
export function lessonCardDurationLabel(input: {
  estimatedMinutes?: number | null;
  youtubeDurationMs?: number | null;
  sentenceCount?: number | null;
}): string | null {
  if (input.estimatedMinutes != null && input.estimatedMinutes > 0) {
    return `${input.estimatedMinutes} phút`;
  }
  if (input.youtubeDurationMs != null && input.youtubeDurationMs > 0) {
    return formatVideoDuration(input.youtubeDurationMs);
  }
  if (input.sentenceCount != null && input.sentenceCount > 0) {
    return `${Math.max(1, Math.ceil(input.sentenceCount * 0.5))} phút`;
  }
  return null;
}

const KIND_ICON: Record<LessonCardKind, HandoffIconName> = {
  text: 'article',
  video: 'play_circle',
  image: 'photo_camera',
};

const KIND_LABEL: Record<LessonCardKind, string> = {
  text: 'Bài đọc',
  video: 'Bài video',
  image: 'Bài từ ảnh',
};

type Tone = 'ok' | 'gold' | 'coral';

type StatusChip = {
  key: string;
  icon: HandoffIconName;
  label: string;
  /** Shorter label for the compact card; null shows the icon only. */
  compactLabel: string | null;
  tone: Tone;
};

function progressLabel(progress: LessonCardProgress): string {
  if (progress.label) {
    return progress.label;
  }
  if (progress.state === 'completed') {
    return 'Đã học';
  }
  if (progress.done != null && progress.total != null && progress.total > 0) {
    return `Đang học ${progress.done}/${progress.total}`;
  }
  return 'Đang học';
}

function buildStatusChips(props: LessonCardProps): StatusChip[] {
  const chips: StatusChip[] = [];
  if (props.downloaded) {
    chips.push({
      key: 'downloaded',
      icon: 'smartphone',
      label: 'Đã tải',
      compactLabel: null,
      tone: 'ok',
    });
  }
  if (props.progress) {
    const label = progressLabel(props.progress);
    const fraction =
      props.progress.state === 'in_progress' &&
      props.progress.done != null &&
      props.progress.total
        ? `${props.progress.done}/${props.progress.total}`
        : null;
    chips.push({
      key: 'progress',
      icon: props.progress.state === 'completed' ? 'check_circle' : 'timer',
      label,
      compactLabel: props.progress.state === 'completed' ? label : fraction,
      tone: props.progress.state === 'completed' ? 'ok' : 'gold',
    });
  }
  if (props.reviewDueCount != null && props.reviewDueCount > 0) {
    chips.push({
      key: 'review',
      icon: 'replay',
      label: `${props.reviewDueCount} câu cần ôn`,
      compactLabel: null,
      tone: 'coral',
    });
  }
  if (props.exerciseCount != null && props.exerciseCount > 0) {
    chips.push({
      key: 'exercises',
      icon: 'rule',
      label: `${props.exerciseCount} bài tập`,
      compactLabel: null,
      tone: 'coral',
    });
  }
  return chips;
}

function progressRatio(progress: LessonCardProgress | null | undefined) {
  if (
    !progress ||
    progress.state !== 'in_progress' ||
    progress.done == null ||
    !progress.total
  ) {
    return null;
  }
  return Math.min(1, Math.max(0, progress.done / progress.total));
}

/** One spoken sentence for the whole card (the bookmark is its own button). */
export function lessonCardAccessibilityLabel(props: LessonCardProps): string {
  const parts: string[] = [props.title];
  if (props.subtitle) parts.push(props.subtitle);
  const context = [props.contextLead, props.context].filter(Boolean).join(', ');
  if (context) parts.push(context);
  const meta = [KIND_LABEL[props.kind]];
  if (props.durationLabel) meta.push(props.durationLabel);
  if (props.sentenceCount != null) meta.push(`${props.sentenceCount} câu`);
  parts.push(meta.join(', '));
  for (const chip of buildStatusChips(props)) {
    parts.push(chip.label);
  }
  if (props.bookmarked) parts.push('Đã lưu');
  return parts.join('. ');
}

export function LessonCard(props: LessonCardProps) {
  const {
    kind,
    title,
    subtitle,
    contextLead,
    context,
    durationLabel,
    sentenceCount,
    bookmarked = false,
    onToggleBookmark,
    onPress,
    variant = 'full',
    footer,
    accessibilityHint,
    testID,
  } = props;
  const {theme} = useAppTheme();
  const compact = variant === 'compact';
  const styles = useMemo(() => makeStyles(theme, compact), [theme, compact]);
  const [pressed, setPressed] = useState(false);
  const chips = buildStatusChips(props);
  const ratio = progressRatio(props.progress);
  const kindColors = kindTone(theme, kind);
  const shelf = theme.shelf?.surface;
  const hasContext = Boolean(contextLead || context);

  const body = (
    <>
      <View style={styles.head}>
        <View style={[styles.thumb, {backgroundColor: kindColors.bg}]}>
          <MaterialIcon
            color={kindColors.fg}
            name={KIND_ICON[kind]}
            size={compact ? 22 : 24}
          />
        </View>
        <View style={styles.copy}>
          {hasContext ? (
            <AppText numberOfLines={1} style={styles.context}>
              {contextLead ? (
                <AppText style={styles.contextLead}>{contextLead}</AppText>
              ) : null}
              {contextLead && context ? ' · ' : null}
              {context}
            </AppText>
          ) : null}
          <AppText numberOfLines={2} style={styles.title}>
            {title}
          </AppText>
          {subtitle && !compact ? (
            <AppText numberOfLines={1} style={styles.subtitle}>
              {subtitle}
            </AppText>
          ) : null}
        </View>
      </View>
      {subtitle && compact ? (
        <AppText numberOfLines={1} style={styles.subtitle}>
          {subtitle}
        </AppText>
      ) : null}
      {durationLabel || sentenceCount != null ? (
        <View style={styles.meta}>
          {durationLabel ? (
            <View style={styles.metaItem}>
              <MaterialIcon
                color={theme.colors.text.muted}
                name="schedule"
                size={15}
              />
              <AppText style={styles.metaText}>{durationLabel}</AppText>
            </View>
          ) : null}
          {sentenceCount != null ? (
            <View style={styles.metaItem}>
              <MaterialIcon
                color={theme.colors.text.muted}
                name="subtitles"
                size={15}
              />
              <AppText style={styles.metaText}>{sentenceCount} câu</AppText>
            </View>
          ) : null}
        </View>
      ) : null}
      {chips.length > 0 || (onPress && !compact) ? (
        <View style={styles.status}>
          {chips.map(chip => {
            const tone = chipTone(theme, chip.tone);
            const label = compact ? chip.compactLabel : chip.label;
            return (
              <View
                key={chip.key}
                style={[
                  label ? styles.chip : styles.iconChip,
                  {backgroundColor: tone.bg},
                ]}
                testID={testID ? `${testID}-chip-${chip.key}` : undefined}
              >
                <MaterialIcon color={tone.fg} name={chip.icon} size={14} />
                {label ? (
                  <AppText style={[styles.chipText, {color: tone.fg}]}>
                    {label}
                  </AppText>
                ) : null}
              </View>
            );
          })}
          {onPress && !compact ? (
            <View style={styles.chevron}>
              <MaterialIcon
                color={theme.colors.text.muted}
                name="chevron_right"
                size={20}
              />
            </View>
          ) : null}
        </View>
      ) : null}
      {ratio != null ? (
        <View style={styles.bar}>
          <View style={[styles.barFill, {width: `${ratio * 100}%`}]} />
        </View>
      ) : null}
    </>
  );

  return (
    <ShelfSurface
      borderRadius={20}
      containerTestID={testID ? `${testID}-card` : undefined}
      faceStyle={styles.face}
      isPressed={pressed}
      shelfColor={shelf?.color}
      shelfHeight={shelf?.height}
    >
      {onPress ? (
        <Pressable
          accessibilityHint={accessibilityHint}
          accessibilityLabel={lessonCardAccessibilityLabel(props)}
          accessibilityRole="button"
          onPress={onPress}
          onPressIn={() => setPressed(true)}
          onPressOut={() => setPressed(false)}
          style={styles.body}
          testID={testID}
        >
          {body}
        </Pressable>
      ) : (
        <View
          accessibilityLabel={lessonCardAccessibilityLabel(props)}
          accessible
          style={styles.body}
          testID={testID}
        >
          {body}
        </View>
      )}
      {footer ? <View style={styles.footer}>{footer}</View> : null}
      {onToggleBookmark ? (
        <Pressable
          accessibilityHint={
            bookmarked
              ? 'Bỏ bài khỏi danh sách đã lưu'
              : 'Thêm bài vào danh sách đã lưu'
          }
          accessibilityLabel={bookmarked ? 'Bỏ lưu bài' : 'Lưu bài'}
          accessibilityRole="button"
          accessibilityState={{selected: bookmarked}}
          hitSlop={4}
          onPress={onToggleBookmark}
          style={[styles.bookmark, bookmarked && styles.bookmarkOn]}
          testID={testID ? `${testID}-bookmark` : undefined}
        >
          <MaterialIcon
            color={
              bookmarked
                ? theme.colors.onTertiaryContainer
                : theme.colors.text.muted
            }
            name={bookmarked ? 'bookmark' : 'bookmark_add'}
            size={22}
          />
        </Pressable>
      ) : null}
    </ShelfSurface>
  );
}

function kindTone(theme: AppTheme, kind: LessonCardKind) {
  switch (kind) {
    case 'video':
      return {bg: theme.colors.secondarySoft, fg: theme.colors.secondary};
    case 'image':
      return {
        bg: theme.colors.tertiarySoft,
        fg: theme.colors.onTertiaryContainer,
      };
    default:
      return {bg: theme.colors.accentSoft, fg: theme.colors.primary};
  }
}

function chipTone(theme: AppTheme, tone: Tone) {
  switch (tone) {
    case 'gold':
      return {
        bg: theme.colors.tertiarySoft,
        fg: theme.colors.onTertiaryContainer,
      };
    case 'coral':
      return {bg: theme.colors.secondarySoft, fg: theme.colors.secondary};
    default:
      return {bg: theme.colors.accentSoft, fg: theme.colors.primary};
  }
}

function makeStyles(theme: AppTheme, compact: boolean) {
  const thumbSize = compact ? 44 : 48;
  // Full cards indent the rows under the copy column; compact ones do not.
  const indent = compact ? 0 : thumbSize + 12;
  return StyleSheet.create({
    face: {
      backgroundColor: theme.colors.surface,
      ...getStickerFace(theme, 4),
    },
    body: {
      gap: compact ? 8 : 10,
      padding: compact ? 12 : 14,
    },
    head: {
      alignItems: 'flex-start',
      flexDirection: 'row',
      gap: compact ? 10 : 12,
      // Room for the bookmark button in the top-right corner.
      paddingRight: 36,
    },
    thumb: {
      alignItems: 'center',
      borderRadius: 14,
      height: thumbSize,
      justifyContent: 'center',
      width: thumbSize,
    },
    copy: {
      flex: 1,
      gap: 3,
      minWidth: 0,
    },
    context: {
      color: theme.colors.text.muted,
      fontSize: 12,
      fontWeight: '700',
    },
    contextLead: {
      color: theme.colors.primary,
      fontSize: 12,
      fontWeight: '800',
    },
    title: {
      color: theme.colors.text.primary,
      fontSize: compact ? 15 : 16,
      fontWeight: '700',
      lineHeight: compact ? 20 : 22,
    },
    subtitle: {
      color: theme.colors.text.secondary,
      fontSize: 14,
      fontWeight: '500',
      lineHeight: 19,
    },
    meta: {
      columnGap: 12,
      flexDirection: 'row',
      flexWrap: 'wrap',
      paddingLeft: indent,
      rowGap: 4,
    },
    metaItem: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 4,
    },
    metaText: {
      color: theme.colors.text.muted,
      fontSize: 13,
      fontWeight: '600',
    },
    status: {
      alignItems: 'center',
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
      paddingLeft: indent,
    },
    chip: {
      alignItems: 'center',
      borderRadius: 9,
      flexDirection: 'row',
      gap: 4,
      minHeight: 26,
      paddingHorizontal: 9,
    },
    iconChip: {
      alignItems: 'center',
      borderRadius: 9,
      height: 26,
      justifyContent: 'center',
      width: 26,
    },
    chipText: {
      fontSize: 12,
      fontWeight: '700',
      lineHeight: 16,
    },
    chevron: {
      marginLeft: 'auto',
    },
    bar: {
      backgroundColor: theme.colors.surfaceHigh,
      borderRadius: 99,
      height: 6,
      marginLeft: indent,
      overflow: 'hidden',
    },
    barFill: {
      backgroundColor: theme.colors.tertiaryFixed,
      borderRadius: 99,
      height: '100%',
    },
    footer: {
      paddingBottom: compact ? 12 : 14,
      paddingHorizontal: compact ? 12 : 14,
    },
    bookmark: {
      alignItems: 'center',
      borderRadius: 12,
      height: 40,
      justifyContent: 'center',
      position: 'absolute',
      right: compact ? 6 : 8,
      top: compact ? 6 : 8,
      width: 40,
    },
    bookmarkOn: {
      backgroundColor: theme.colors.tertiarySoft,
    },
  });
}
