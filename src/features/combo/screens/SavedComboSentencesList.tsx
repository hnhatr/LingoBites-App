import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {Pressable, ScrollView, StyleSheet, View} from 'react-native';

import {useSpeak} from '@features/audio';

import {AppText} from '@ui/components/AppText';
import {MaterialIcon} from '@ui/components/MaterialIcon';
import {type AppTheme, useAppTheme} from '@ui/theme';
import {getStickerEdge} from '@ui/theme/hardShadow';

import {useAppNavigation} from '@core/navigation';

import {comboWordLabel, splitOnWord} from '../logic/comboHistoryGroups';
import {
  loadSavedComboSentences,
  type SavedComboSentence,
  toggleSavedComboSentence,
} from '../logic/savedComboSentences';

/**
 * Library "Câu đã lưu": the combo sentences the learner saved with "Lưu",
 * newest first. A card reads the sentence aloud, opens its set, or is unsaved.
 *
 * IGNORE_TAB_BAR_CLEARANCE: shown in the Library list, a root-stack screen.
 */
export function SavedComboSentencesList({query = ''}: {query?: string}) {
  const {theme} = useAppTheme();
  const {t} = useTranslation();
  const appNavigation = useAppNavigation();
  const {speak} = useSpeak();
  const themedStyles = useMemo(() => makeStyles(theme), [theme]);
  const [sentences, setSentences] = useState<SavedComboSentence[] | null>(null);

  const read = useCallback(() => {
    loadSavedComboSentences().then(setSentences);
  }, []);
  useEffect(read, [read]);

  const needle = query.trim().toLowerCase();
  const shown = (sentences ?? []).filter(
    entry =>
      !needle ||
      entry.textEn.toLowerCase().includes(needle) ||
      entry.textVi.toLowerCase().includes(needle),
  );

  const unsave = async (entry: SavedComboSentence) => {
    setSentences(await toggleSavedComboSentence(entry, new Date()));
  };

  return (
    <ScrollView contentContainerStyle={themedStyles.container}>
      {sentences !== null && sentences.length === 0 ? (
        <View style={themedStyles.empty} testID="saved-sentences-empty">
          <MaterialIcon
            color={theme.colors.onTertiaryContainer}
            name="bookmark_add"
            size={30}
          />
          <AppText style={styles.center} variant="h3">
            {t('combo.saved.empty_title')}
          </AppText>
          <AppText color="secondary" style={styles.center} variant="body">
            {t('combo.saved.empty_body')}
          </AppText>
        </View>
      ) : null}
      {sentences !== null && sentences.length > 0 && shown.length === 0 ? (
        <AppText
          color="secondary"
          style={styles.center}
          testID="saved-sentences-no-match"
        >
          {t('combo.saved.no_match', {query: query.trim()})}
        </AppText>
      ) : null}
      {shown.map(entry => {
        const word = comboWordLabel(entry.itemCode);
        return (
          <View
            key={entry.id}
            style={themedStyles.card}
            testID={`saved-sentence-${entry.id}`}
          >
            <Pressable
              accessibilityHint={t('combo.saved.open_hint')}
              accessibilityRole="button"
              onPress={() => appNavigation.openComboSet(entry.setId)}
              style={styles.text}
            >
              <AppText variant="body">
                {splitOnWord(entry.textEn, word).map((part, index) =>
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
              <AppText color="muted" variant="caption">
                {entry.textVi}
              </AppText>
            </Pressable>
            <View style={styles.actions}>
              <Pressable
                accessibilityHint={t('combo.set.listen_hint')}
                accessibilityLabel={t('combo.set.listen')}
                accessibilityRole="button"
                onPress={() => speak(entry.textEn)}
                style={[themedStyles.icon, themedStyles.listen]}
                testID={`saved-sentence-listen-${entry.id}`}
              >
                <MaterialIcon
                  color={theme.colors.primary}
                  name="volume_up"
                  size={17}
                />
              </Pressable>
              <Pressable
                accessibilityHint={t('combo.saved.unsave_hint')}
                accessibilityLabel={t('combo.saved.unsave')}
                accessibilityRole="button"
                onPress={() => unsave(entry)}
                style={[themedStyles.icon, themedStyles.saved]}
                testID={`saved-sentence-unsave-${entry.id}`}
              >
                <MaterialIcon
                  color={theme.colors.onTertiaryContainer}
                  name="bookmark"
                  size={17}
                />
              </Pressable>
            </View>
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  actions: {
    gap: 6,
  },
  center: {
    textAlign: 'center',
  },
  text: {
    flex: 1,
    gap: 3,
    minWidth: 0,
  },
});

function makeStyles(theme: AppTheme) {
  return StyleSheet.create({
    container: {
      gap: 12,
      paddingBottom: theme.spacing.xl,
      paddingHorizontal: theme.gutter,
      paddingTop: theme.spacing.sm,
    },
    card: {
      alignItems: 'flex-start',
      backgroundColor: theme.colors.surface,
      borderRadius: 20,
      flexDirection: 'row',
      gap: 10,
      padding: 14,
      ...getStickerEdge(4, theme.colors.surfaceHigh),
    },
    highlight: {
      color: theme.colors.primary,
      fontWeight: '700',
    },
    icon: {
      alignItems: 'center',
      borderRadius: 12,
      height: 34,
      justifyContent: 'center',
      width: 34,
    },
    listen: {
      backgroundColor: theme.colors.accentSoft,
    },
    saved: {
      backgroundColor: theme.colors.tertiarySoft,
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
  });
}
