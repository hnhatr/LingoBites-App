import React, {useMemo} from 'react';
import {useTranslation} from 'react-i18next';
import {Pressable, ScrollView, StyleSheet, View} from 'react-native';

import {AppScreen} from '@ui/components/AppScreen';
import {AppText} from '@ui/components/AppText';
import {MaterialIcon} from '@ui/components/MaterialIcon';
import {ScreenHeader} from '@ui/components/ScreenHeader';
import {StickerButton} from '@ui/components/StickerButton';
import {type AppTheme, useAppTheme} from '@ui/theme';
import {getStickerEdge} from '@ui/theme/hardShadow';

import {useAppNavigation} from '@core/navigation';

import {
  comboOpenedLabel,
  comboWordLabel,
  groupComboHistory,
  splitOnWord,
} from '../logic/comboHistoryGroups';
import {
  listLocalComboSets,
  type LocalComboSetSummary,
} from '../logic/comboSetRepository';

type Props = {
  navigation?: {goBack?: () => void};
  /** Tests pass the sets; the screen reads the device otherwise. */
  sets?: LocalComboSetSummary[];
};

function ComboSetCard({
  set,
  now,
  onPress,
}: {
  set: LocalComboSetSummary;
  now: Date;
  onPress: () => void;
}) {
  const {theme} = useAppTheme();
  const {t} = useTranslation();
  const themedStyles = useMemo(() => makeStyles(theme), [theme]);
  const word = comboWordLabel(set.itemCode) || t('combo.set.title');
  const opened = comboOpenedLabel(set.createdAt, now);
  return (
    <Pressable
      accessibilityHint={t('combo.history.open_hint')}
      accessibilityLabel={t('combo.history.open_a11y', {word})}
      accessibilityRole="button"
      onPress={onPress}
      style={({pressed}) => [
        themedStyles.card,
        pressed ? themedStyles.cardPressed : null,
      ]}
      testID={`combo-history-${set.id}`}
    >
      <View style={styles.top}>
        <View style={themedStyles.tile}>
          <MaterialIcon
            color={theme.colors.onTertiaryContainer}
            name="style"
            size={22}
          />
        </View>
        <View style={styles.word}>
          <AppText numberOfLines={1} variant="h3">
            {word}
          </AppText>
          <AppText color="muted" variant="caption">
            {t('combo.history.subtitle')}
          </AppText>
        </View>
        <MaterialIcon
          color={theme.colors.text.muted}
          name="chevron_right"
          size={22}
        />
      </View>
      {set.preview ? (
        <View style={themedStyles.sample}>
          <AppText numberOfLines={2} variant="body">
            {splitOnWord(set.preview.en, comboWordLabel(set.itemCode)).map(
              (part, index) =>
                index % 2 === 1 ? (
                  <AppText
                    key={index}
                    style={themedStyles.highlight}
                    variant="body"
                  >
                    {part}
                  </AppText>
                ) : (
                  part
                ),
            )}
          </AppText>
          <AppText color="muted" numberOfLines={2} variant="caption">
            {set.preview.vi}
          </AppText>
        </View>
      ) : null}
      <View style={styles.meta}>
        <View style={[themedStyles.chip, themedStyles.chipMint]}>
          <MaterialIcon
            color={theme.colors.primary}
            name="format_quote"
            size={13}
          />
          <AppText style={themedStyles.chipMintText} variant="caption">
            {t('combo.history.count', {count: set.sentenceCount})}
          </AppText>
        </View>
        {opened ? (
          <View style={themedStyles.chip}>
            <MaterialIcon
              color={theme.colors.text.secondary}
              name="schedule"
              size={13}
            />
            <AppText color="secondary" variant="caption">
              {opened}
            </AppText>
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

/**
 * Vocab path P5, library "Bộ câu đã học": the sets kept on this device, newest
 * first, grouped by when they were opened. The list alone, so the Library can
 * show it under its own search field.
 */
export function ComboHistoryList({
  sets: all,
  query = '',
  showPackLink = false,
}: {
  sets: LocalComboSetSummary[];
  query?: string;
  /** Offer "Mở gói từ" when there is no set (the Library list does). */
  showPackLink?: boolean;
}) {
  const {theme} = useAppTheme();
  const {t} = useTranslation();
  const appNavigation = useAppNavigation();
  const themedStyles = useMemo(() => makeStyles(theme), [theme]);
  const needle = query.trim().toLowerCase();
  const sets = needle
    ? all.filter(set =>
        comboWordLabel(set.itemCode).toLowerCase().includes(needle),
      )
    : all;
  const now = new Date();
  const groups = groupComboHistory(sets, now);

  return (
    <ScrollView
      contentContainerStyle={themedStyles.container}
      keyboardShouldPersistTaps="handled"
    >
      {all.length === 0 ? (
        <View style={themedStyles.empty} testID="combo-history-empty">
          <View style={themedStyles.emptyIcon}>
            <MaterialIcon
              color={theme.colors.onTertiaryContainer}
              name="style"
              size={34}
            />
          </View>
          <AppText style={styles.center} variant="h3">
            {t('combo.history.empty_title')}
          </AppText>
          <AppText color="secondary" style={styles.center} variant="body">
            {t('combo.history.empty_body')}
          </AppText>
          {showPackLink ? (
            <View style={styles.emptyCta}>
              <StickerButton
                icon="style"
                label={t('combo.history.empty_cta')}
                onPress={() => appNavigation.openWordPath()}
                testID="combo-history-open-packs"
              />
            </View>
          ) : null}
        </View>
      ) : sets.length === 0 ? (
        <View style={styles.miss} testID="combo-history-no-match">
          <AppText style={styles.center} variant="h3">
            {t('combo.history.no_match_title', {query: query.trim()})}
          </AppText>
          <AppText color="secondary" style={styles.center} variant="body">
            {t('combo.history.no_match_body')}
          </AppText>
        </View>
      ) : needle ? (
        <>
          <AppText color="muted" style={themedStyles.label} variant="caption">
            {t('combo.history.results', {count: sets.length})}
          </AppText>
          {sets.map(set => (
            <ComboSetCard
              key={set.id}
              now={now}
              onPress={() => appNavigation.openComboSet(set.id)}
              set={set}
            />
          ))}
        </>
      ) : (
        groups.map(group => (
          <View key={group.key} style={styles.group}>
            <AppText color="muted" style={themedStyles.label} variant="caption">
              {t(`combo.history.group_${group.key}`)}
            </AppText>
            {group.sets.map(set => (
              <ComboSetCard
                key={set.id}
                now={now}
                onPress={() => appNavigation.openComboSet(set.id)}
                set={set}
              />
            ))}
          </View>
        ))
      )}
    </ScrollView>
  );
}

/**
 * The history as its own screen; the word path links here.
 *
 * IGNORE_TAB_BAR_CLEARANCE: a root-stack screen, drawn above the tab bar.
 */
export function ComboHistoryScreen({navigation, sets: given}: Props) {
  const {t} = useTranslation();
  const sets = useMemo(() => given ?? listLocalComboSets(), [given]);
  return (
    <AppScreen>
      <ScreenHeader
        onBack={() => navigation?.goBack?.()}
        title={t('combo.history.title')}
      />
      <ComboHistoryList sets={sets} />
    </AppScreen>
  );
}

function makeStyles(theme: AppTheme) {
  return StyleSheet.create({
    container: {
      gap: 14,
      paddingBottom: theme.spacing.xl,
      paddingHorizontal: theme.gutter,
      paddingTop: theme.spacing.sm,
    },
    label: {
      fontWeight: '700',
      letterSpacing: 1,
      paddingHorizontal: 4,
      paddingTop: 4,
      textTransform: 'uppercase',
    },
    card: {
      backgroundColor: theme.colors.surface,
      borderRadius: 22,
      gap: 12,
      paddingBottom: 14,
      paddingHorizontal: 16,
      paddingTop: 16,
      ...getStickerEdge(4, theme.colors.surfaceHigh),
    },
    cardPressed: {
      transform: [{translateY: 2}],
      ...getStickerEdge(2, theme.colors.surfaceHigh),
    },
    tile: {
      alignItems: 'center',
      backgroundColor: theme.colors.tertiarySoft,
      borderRadius: 15,
      height: 44,
      justifyContent: 'center',
      width: 44,
    },
    sample: {
      backgroundColor: theme.colors.background,
      borderRadius: 15,
      gap: 3,
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    highlight: {
      color: theme.colors.primary,
      fontWeight: '700',
    },
    chip: {
      alignItems: 'center',
      backgroundColor: theme.colors.surfaceMuted,
      borderRadius: theme.radius.pill,
      flexDirection: 'row',
      gap: 5,
      paddingHorizontal: 9,
      paddingVertical: 4,
    },
    chipMint: {
      backgroundColor: theme.colors.accentSoft,
    },
    chipMintText: {
      color: theme.colors.primary,
    },
    empty: {
      alignItems: 'center',
      backgroundColor: theme.colors.surface,
      borderRadius: 24,
      gap: 10,
      marginTop: 6,
      paddingHorizontal: 20,
      paddingVertical: 28,
      ...getStickerEdge(5, theme.colors.surfaceHigh),
    },
    emptyIcon: {
      alignItems: 'center',
      backgroundColor: theme.colors.tertiarySoft,
      borderRadius: 26,
      height: 76,
      justifyContent: 'center',
      marginBottom: 4,
      width: 76,
    },
  });
}

const styles = StyleSheet.create({
  center: {
    textAlign: 'center',
  },
  emptyCta: {
    alignSelf: 'stretch',
    marginTop: 6,
  },
  group: {
    gap: 14,
  },
  meta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  miss: {
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 28,
  },
  top: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
  },
  word: {
    flex: 1,
    gap: 1,
    minWidth: 0,
  },
});
