import React, {useMemo} from 'react';
import {useTranslation} from 'react-i18next';
import {Pressable, StyleSheet, View} from 'react-native';

import {AppText} from '@ui/components/AppText';
import {MaterialIcon} from '@ui/components/MaterialIcon';
import {type AppTheme, useAppTheme} from '@ui/theme';
import {getStickerEdge} from '@ui/theme/hardShadow';
import {HERO_PALETTE} from '@ui/theme/heroPalette';

import {
  analysisOf,
  type AnalysisPartTone,
  noteSegments,
  partTone,
} from '../logic/comboAnalysis';
import type {ComboReportReason, ComboSentence} from '../logic/comboClient';
import {comboEdges} from './comboEdges';

export const REPORT_REASONS: ComboReportReason[] = [
  'wrong_meaning',
  'unnatural',
  'wrong_tense',
  'wrong_subject',
  'other',
];

export type ReportState = 'idle' | 'open' | 'done';

type Props = {
  sentence: ComboSentence;
  number: number;
  showVi: boolean;
  /** The word whose IPA is shown, by its index in the tokens. */
  tappedIndex: number | null;
  onTapToken: (index: number) => void;
  onSayWord: (word: string) => void;
  grammarOpen: boolean;
  onToggleGrammar: () => void;
  playing: boolean;
  onPlay: () => void;
  saved: boolean;
  onToggleSave: () => void;
  report: ReportState;
  onOpenReport: () => void;
  onReport: (reason: ComboReportReason) => void;
  busy: boolean;
};

/**
 * Vocab path P5: one sentence of a combo set. Tap a word for its IPA and to
 * hear it; open the grammar breakdown; the bar at the bottom reads the
 * sentence, saves it and reports it.
 */
export function ComboSentenceCard({
  sentence,
  number,
  showVi,
  tappedIndex,
  onTapToken,
  onSayWord,
  grammarOpen,
  onToggleGrammar,
  playing,
  onPlay,
  saved,
  onToggleSave,
  report,
  onOpenReport,
  onReport,
  busy,
}: Props) {
  const {theme} = useAppTheme();
  const {t} = useTranslation();
  const themedStyles = useMemo(() => makeStyles(theme), [theme]);
  const tapped = tappedIndex !== null ? sentence.tokens[tappedIndex] : null;
  const analysis = grammarOpen ? analysisOf(sentence) : null;
  const partStyle: Record<AnalysisPartTone, [object, object]> = {
    subject: [themedStyles.partSubject, themedStyles.inkSun],
    verb: [themedStyles.partVerb, themedStyles.inkCoral],
    item: [themedStyles.partItem, themedStyles.inkTeal],
    other: [themedStyles.partOther, themedStyles.inkPlain],
  };

  return (
    <View style={themedStyles.card} testID={`combo-sentence-${sentence.id}`}>
      <View style={styles.row}>
        <View style={themedStyles.num}>
          <AppText color="muted" variant="caption">
            {number}
          </AppText>
        </View>
        <View style={styles.words}>
          {sentence.tokens.map((token, index) => {
            const on = index === tappedIndex;
            return (
              <Pressable
                accessibilityHint={t('combo.set.token_hint')}
                accessibilityRole="button"
                accessibilityState={{selected: on}}
                key={`${sentence.id}-${index}`}
                onPress={() => onTapToken(index)}
                style={[themedStyles.token, on ? themedStyles.tokenOn : null]}
                testID={`combo-token-${sentence.id}-${index}`}
              >
                <AppText
                  style={[
                    themedStyles.tokenText,
                    token.role === 'subject' ? themedStyles.tokenSubject : null,
                    token.role === 'item' ? themedStyles.tokenItem : null,
                    on ? themedStyles.inkTeal : null,
                  ]}
                >
                  {token.t}
                </AppText>
              </Pressable>
            );
          })}
        </View>
      </View>
      {tapped ? (
        <View style={themedStyles.ipa}>
          <Pressable
            accessibilityHint={t('combo.set.say_word_hint')}
            accessibilityLabel={t('combo.set.say_word', {word: tapped.t})}
            accessibilityRole="button"
            onPress={() => onSayWord(tapped.t)}
            style={themedStyles.say}
            testID={`combo-say-${sentence.id}`}
          >
            <MaterialIcon
              color={theme.colors.primary}
              name="volume_up"
              size={14}
            />
          </Pressable>
          <AppText style={themedStyles.inkTeal} variant="label">
            {tapped.t}
          </AppText>
          <AppText
            color="secondary"
            testID={`combo-ipa-${sentence.id}`}
            variant="label"
          >
            {tapped.ipa ?? t('combo.set.no_ipa')}
          </AppText>
        </View>
      ) : null}
      {showVi ? (
        <AppText color="secondary" variant="body">
          {sentence.text_vi}
        </AppText>
      ) : null}
      <Pressable
        accessibilityRole="button"
        accessibilityState={{expanded: grammarOpen}}
        onPress={onToggleGrammar}
        style={styles.grammarRow}
        testID={`combo-grammar-open-${sentence.id}`}
      >
        <MaterialIcon color={theme.colors.primary} name="rule" size={16} />
        <AppText style={[styles.grow, themedStyles.inkTeal]} variant="label">
          {t('combo.set.grammar')}
        </AppText>
        <View style={grammarOpen ? styles.chevOpen : null}>
          <MaterialIcon
            color={theme.colors.primary}
            name="chevron_right"
            size={18}
          />
        </View>
      </Pressable>
      {analysis ? (
        <View
          style={themedStyles.grammar}
          testID={`combo-grammar-${sentence.id}`}
        >
          {analysis.tense ? (
            <View style={styles.tenseRow}>
              <AppText style={styles.grow} variant="label">
                {`${analysis.tense.name_vi} · ${analysis.tense.polarity_vi}`}
              </AppText>
              <View style={themedStyles.formula}>
                <AppText color="secondary" variant="caption">
                  {analysis.tense.formula}
                </AppText>
              </View>
            </View>
          ) : null}
          <View style={styles.parts}>
            {analysis.parts.map((part, index) => {
              const [face, ink] = partStyle[partTone(part.role)];
              return (
                <View
                  key={`${index}-${part.text}`}
                  style={[themedStyles.part, face]}
                >
                  <AppText style={[themedStyles.partText, ink]}>
                    {part.text}
                  </AppText>
                  {part.label_vi ? (
                    <AppText style={[themedStyles.partLabel, ink]}>
                      {part.label_vi}
                    </AppText>
                  ) : null}
                </View>
              );
            })}
          </View>
          {analysis.notes.map((note, index) => (
            <AppText color="secondary" key={index} variant="caption">
              {noteSegments(note).map((segment, k) =>
                segment.bold ? (
                  <AppText key={k} style={themedStyles.bold} variant="caption">
                    {segment.text}
                  </AppText>
                ) : (
                  segment.text
                ),
              )}
            </AppText>
          ))}
        </View>
      ) : null}
      {report === 'open' ? (
        <View style={themedStyles.report}>
          <AppText style={themedStyles.inkCoral} variant="caption">
            {t('combo.set.report_question')}
          </AppText>
          <View style={styles.parts}>
            {REPORT_REASONS.map(reason => (
              <Pressable
                accessibilityRole="button"
                disabled={busy}
                key={reason}
                onPress={() => onReport(reason)}
                style={themedStyles.reason}
                testID={`combo-report-${sentence.id}-${reason}`}
              >
                <AppText style={themedStyles.inkCoral} variant="caption">
                  {t(`combo.report.${reason}`)}
                </AppText>
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}
      <View style={themedStyles.bar}>
        <Pressable
          accessibilityHint={t('combo.set.listen_hint')}
          accessibilityRole="button"
          onPress={onPlay}
          style={[
            themedStyles.action,
            themedStyles.listen,
            playing ? themedStyles.listenOn : null,
          ]}
          testID={`combo-listen-${sentence.id}`}
        >
          <MaterialIcon
            color={playing ? theme.colors.text.inverse : theme.colors.primary}
            name="volume_up"
            size={16}
          />
          <AppText
            numberOfLines={1}
            style={playing ? themedStyles.inkWhite : themedStyles.inkTeal}
            variant="caption"
          >
            {playing ? t('combo.set.listening') : t('combo.set.listen')}
          </AppText>
        </Pressable>
        <Pressable
          accessibilityHint={t('combo.set.save_hint')}
          accessibilityRole="button"
          accessibilityState={{selected: saved}}
          onPress={onToggleSave}
          style={[
            themedStyles.action,
            themedStyles.save,
            saved ? themedStyles.saveOn : null,
          ]}
          testID={`combo-save-${sentence.id}`}
        >
          <MaterialIcon
            color={saved ? HERO_PALETTE.ink : theme.colors.onTertiaryContainer}
            name={saved ? 'bookmark' : 'bookmark_add'}
            size={16}
          />
          <AppText
            numberOfLines={1}
            style={saved ? themedStyles.inkInk : themedStyles.inkSun}
            variant="caption"
          >
            {saved ? t('combo.set.saved') : t('combo.set.save')}
          </AppText>
        </Pressable>
        <Pressable
          accessibilityHint={t('combo.set.report_hint')}
          accessibilityRole="button"
          accessibilityState={{
            disabled: report === 'done',
            expanded: report === 'open',
          }}
          disabled={report === 'done'}
          onPress={onOpenReport}
          style={[
            themedStyles.action,
            report === 'done'
              ? themedStyles.reported
              : report === 'open'
                ? themedStyles.flagOn
                : themedStyles.flag,
          ]}
          testID={`combo-report-open-${sentence.id}`}
        >
          <MaterialIcon
            color={
              report === 'done'
                ? theme.colors.text.muted
                : report === 'open'
                  ? theme.colors.text.inverse
                  : theme.colors.secondary
            }
            name={report === 'done' ? 'check_circle' : 'flag'}
            size={16}
          />
          <AppText
            numberOfLines={1}
            style={
              report === 'done'
                ? themedStyles.inkMuted
                : report === 'open'
                  ? themedStyles.inkWhite
                  : themedStyles.inkCoral
            }
            variant="caption"
          >
            {report === 'done'
              ? t('combo.set.already_reported')
              : t('combo.set.report')}
          </AppText>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  chevOpen: {
    transform: [{rotate: '90deg'}],
  },
  grammarRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 7,
    paddingVertical: 2,
  },
  grow: {
    flex: 1,
    minWidth: 0,
  },
  parts: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  row: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 10,
  },
  tenseRow: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  words: {
    columnGap: 4,
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    minWidth: 0,
    rowGap: 2,
  },
});

function makeStyles(theme: AppTheme) {
  const line = theme.colors.surfaceHigh;
  return StyleSheet.create({
    card: {
      backgroundColor: theme.colors.surface,
      borderRadius: 22,
      gap: 10,
      padding: 14,
      ...getStickerEdge(4, line),
    },
    num: {
      alignItems: 'center',
      backgroundColor: theme.colors.surfaceMuted,
      borderRadius: 9,
      height: 26,
      justifyContent: 'center',
      marginTop: 2,
      width: 26,
    },
    token: {
      borderRadius: 7,
      paddingHorizontal: 2,
    },
    tokenOn: {
      backgroundColor: theme.colors.accentSoft,
    },
    tokenText: {
      color: theme.colors.text.secondary,
      fontSize: 19,
      fontWeight: '600',
      lineHeight: 26,
    },
    tokenSubject: {
      color: theme.colors.text.muted,
    },
    tokenItem: {
      color: theme.colors.primary,
      fontWeight: '800',
    },
    ipa: {
      alignItems: 'center',
      alignSelf: 'flex-start',
      backgroundColor: theme.colors.accentSoft,
      borderRadius: 12,
      flexDirection: 'row',
      gap: 8,
      paddingHorizontal: 10,
      paddingVertical: 5,
    },
    say: {
      alignItems: 'center',
      backgroundColor: theme.colors.surface,
      borderRadius: 7,
      height: 24,
      justifyContent: 'center',
      width: 24,
    },
    grammar: {
      backgroundColor: theme.colors.background,
      borderRadius: 16,
      gap: 9,
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    formula: {
      backgroundColor: theme.colors.surface,
      borderRadius: 8,
      paddingHorizontal: 8,
      paddingVertical: 3,
    },
    part: {
      borderRadius: 12,
      gap: 2,
      paddingHorizontal: 9,
      paddingVertical: 6,
    },
    partSubject: {
      backgroundColor: theme.colors.tertiarySoft,
    },
    partVerb: {
      backgroundColor: theme.colors.secondarySoft,
    },
    partItem: {
      backgroundColor: theme.colors.accentSoft,
    },
    partOther: {
      backgroundColor: theme.colors.surface,
    },
    partText: {
      fontSize: 14.5,
      fontWeight: '700',
    },
    partLabel: {
      fontSize: 10.5,
      fontWeight: '700',
      letterSpacing: 0.4,
      textTransform: 'uppercase',
    },
    bold: {
      color: theme.colors.text.primary,
      fontWeight: '800',
    },
    report: {
      backgroundColor: theme.colors.secondarySoft,
      borderRadius: 16,
      gap: 8,
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    reason: {
      backgroundColor: theme.colors.surface,
      borderRadius: theme.radius.pill,
      paddingHorizontal: 10,
      paddingVertical: 6,
      ...getStickerEdge(2, comboEdges(theme).coral),
    },
    bar: {
      borderTopColor: line,
      borderTopWidth: 1,
      flexDirection: 'row',
      gap: 6,
      paddingTop: 10,
    },
    action: {
      alignItems: 'center',
      borderRadius: 12,
      flex: 1,
      flexDirection: 'row',
      gap: 6,
      height: 38,
      justifyContent: 'center',
      minWidth: 0,
      paddingHorizontal: 4,
    },
    listen: {
      backgroundColor: theme.colors.accentSoft,
      ...getStickerEdge(2, comboEdges(theme).mint),
    },
    listenOn: {
      backgroundColor: theme.colors.primary,
      ...getStickerEdge(2, comboEdges(theme).teal),
    },
    save: {
      backgroundColor: theme.colors.tertiarySoft,
      ...getStickerEdge(2, comboEdges(theme).sun),
    },
    saveOn: {
      backgroundColor: HERO_PALETTE.sun,
      ...getStickerEdge(2, HERO_PALETTE.sunShelf),
    },
    flag: {
      backgroundColor: theme.colors.secondarySoft,
      ...getStickerEdge(2, comboEdges(theme).coral),
    },
    flagOn: {
      backgroundColor: HERO_PALETTE.coral,
      ...getStickerEdge(2, HERO_PALETTE.coralShelf),
    },
    reported: {
      backgroundColor: theme.colors.surfaceMuted,
    },
    inkTeal: {
      color: theme.colors.primary,
    },
    inkSun: {
      color: theme.colors.onTertiaryContainer,
    },
    inkCoral: {
      color: theme.colors.secondary,
    },
    inkPlain: {
      color: theme.colors.text.secondary,
    },
    inkMuted: {
      color: theme.colors.text.muted,
    },
    inkWhite: {
      color: theme.colors.text.inverse,
    },
    inkInk: {
      color: HERO_PALETTE.ink,
    },
  });
}
