import React, {useMemo} from 'react';
import {useTranslation} from 'react-i18next';
import {StyleSheet, View} from 'react-native';

import {AppText} from '@ui/components/AppText';
import {MaterialIcon} from '@ui/components/MaterialIcon';
import type {HandoffIconName} from '@ui/icons/iconRegistry';
import {type AppTheme, useAppTheme} from '@ui/theme';

import type {LessonBlock} from '@core/schemas/lesson';

function blockTestId(type: string): string {
  return `canonical-block-${type}`;
}

const BLOCK_ICONS: Record<LessonBlock['type'], HandoffIconName> = {
  text: 'article',
  example: 'format_quote',
  context: 'lightbulb',
  vocabulary: 'style',
  grammar: 'rule',
  activity: 'bolt',
  media: 'auto_stories',
};

function textOf(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

/** Readable body for a block, never the raw JSON of its data. */
function blockBody(block: LessonBlock): string {
  const data = block.data as Record<string, unknown>;
  switch (block.type) {
    case 'text':
    case 'example':
    case 'context':
      return textOf(data.content ?? data.text ?? data.body);
    case 'activity':
      // The card header already shows `block.title`; avoid repeating it.
      return [
        block.title ? '' : textOf(data.titleVi),
        textOf(data.instructionsVi),
      ]
        .filter(part => part.length > 0)
        .join('\n');
    case 'grammar':
      return [
        textOf(data.nameEn ?? data.name),
        textOf(data.nameVi),
        textOf(data.pattern),
        textOf(data.explanationVi ?? data.description),
      ]
        .filter(part => part.length > 0)
        .join('\n');
    default:
      return textOf(
        data.nameEn ??
          data.name ??
          data.description ??
          data.content ??
          data.url ??
          data.caption,
      );
  }
}

type ActivityLine = {id: string; en: string; vi: string};

/** Practice lines of an `activity` block (`lines`, else `dialogueTurns`). */
function activityLines(block: LessonBlock): ActivityLine[] {
  if (block.type !== 'activity') return [];
  const data = block.data as Record<string, unknown>;
  const raw = Array.isArray(data.lines)
    ? data.lines
    : Array.isArray(data.dialogueTurns)
    ? data.dialogueTurns
    : [];
  return raw.flatMap((item, index) => {
    if (item === null || typeof item !== 'object') return [];
    const turn = item as Record<string, unknown>;
    const en = textOf(turn.textEn);
    if (en.length === 0) return [];
    return [
      {id: textOf(turn.id) || String(index), en, vi: textOf(turn.textVi)},
    ];
  });
}

/**
 * Canonical lesson-level block renderer (7 kept types; `exercise` was
 * removed by FR-014). Unknown types render the unsupported fallback instead
 * of crashing the player. `activity` blocks are read-only: the App has no
 * interaction for them yet and never submits attempts.
 */
export function CanonicalBlockView({block}: {block: LessonBlock}) {
  const {theme} = useAppTheme();
  const {t} = useTranslation();
  const themedStyles = useMemo(() => makeStyles(theme), [theme]);
  const icon = BLOCK_ICONS[block.type];
  if (!icon) {
    return (
      <View testID="canonical-block-unsupported" style={themedStyles.fallback}>
        <AppText color="secondary">
          {t('lessonPlayer.block_unsupported')}
        </AppText>
      </View>
    );
  }
  const body = blockBody(block);
  const lines = activityLines(block);
  return (
    <View testID={blockTestId(block.type)} style={themedStyles.card}>
      <View style={styles.titleRow}>
        <View style={themedStyles.medallion}>
          <MaterialIcon color={theme.colors.primary} name={icon} size={18} />
        </View>
        {block.title ? (
          <AppText
            testID={`${blockTestId(block.type)}-title`}
            style={styles.flex1}
            variant="h3"
          >
            {block.title}
          </AppText>
        ) : null}
      </View>
      {body.length > 0 ? (
        <AppText
          testID={`${blockTestId(block.type)}-content`}
          color="secondary"
          variant="bodyLg"
        >
          {body}
        </AppText>
      ) : null}
      {lines.map(line => (
        <View
          key={line.id}
          testID={`${blockTestId(block.type)}-line-${line.id}`}
          style={themedStyles.line}
        >
          <AppText variant="bodyLg">{line.en}</AppText>
          {line.vi.length > 0 ? (
            <AppText color="secondary">{line.vi}</AppText>
          ) : null}
        </View>
      ))}
      {block.type === 'activity' ? (
        <AppText
          testID={`${blockTestId(block.type)}-read-only`}
          color="muted"
          variant="caption"
        >
          {t('lessonPlayer.activity_read_only')}
        </AppText>
      ) : null}
    </View>
  );
}

function makeStyles(theme: AppTheme) {
  return StyleSheet.create({
    card: {
      backgroundColor: theme.colors.surface,
      borderBottomColor: theme.colors.accentSoft,
      borderBottomWidth: 4,
      borderRadius: theme.radius.xl,
      gap: theme.spacing.sm,
      padding: theme.spacing.lg,
    },
    fallback: {
      backgroundColor: theme.colors.surfaceMuted,
      borderRadius: theme.radius.lg,
      padding: theme.spacing.md,
    },
    line: {
      backgroundColor: theme.colors.surfaceMuted,
      borderRadius: theme.radius.md,
      gap: 2,
      padding: theme.spacing.sm,
    },
    medallion: {
      alignItems: 'center',
      backgroundColor: theme.colors.accentSoft,
      borderRadius: theme.radius.md,
      height: 32,
      justifyContent: 'center',
      width: 32,
    },
  });
}

const styles = StyleSheet.create({
  flex1: {
    flex: 1,
  },
  titleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
  },
});
