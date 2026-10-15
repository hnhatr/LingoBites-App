import React, {useEffect, useMemo, useRef, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {Pressable, ScrollView, StyleSheet, View} from 'react-native';

import {useSpeak} from '@features/audio';

import {AppCard} from '@ui/components/AppCard';
import {AppScreen} from '@ui/components/AppScreen';
import {AppText} from '@ui/components/AppText';
import {MaterialIcon} from '@ui/components/MaterialIcon';
import {ScreenHeader} from '@ui/components/ScreenHeader';
import {StickerButton} from '@ui/components/StickerButton';
import {StickerFooter} from '@ui/components/StickerFooter';
import {type AppTheme, useAppTheme} from '@ui/theme';
import {getStickerEdge} from '@ui/theme/hardShadow';

import {comboEdges} from '../components/comboEdges';
import {
  ComboSentenceCard,
  type ReportState,
} from '../components/ComboSentenceCard';
import {
  addToComboSet,
  type ComboReportReason,
  type ComboSentence,
  fetchComboSet,
  reportComboSentence,
} from '../logic/comboClient';
import {comboFailureNotice} from '../logic/comboErrors';
import {comboWordLabel} from '../logic/comboHistoryGroups';
import {
  type LocalComboSet,
  readLocalComboSet,
  saveComboSet,
} from '../logic/comboSetRepository';
import {
  loadSavedComboSentences,
  toggleSavedComboSentence,
} from '../logic/savedComboSentences';
import type {ComboSetRouteParams} from './navigationTypes';

type Props = {
  navigation?: {goBack?: () => void};
  route?: {params: ComboSetRouteParams};
};

/** How long "Đang đọc" stays on: about the time the sentence takes to read. */
function readingMs(text: string): number {
  return Math.max(1500, text.split(/\s+/).length * 450);
}

/**
 * Vocab path P5: a combo set. Each sentence card shows its words (tap one for
 * its IPA and to hear it), the Vietnamese, the grammar breakdown, and a bar to
 * read it aloud, save it ("Câu đã lưu" in the Library) or report it. The set is
 * read from the device when it is there, so it works offline.
 *
 * IGNORE_TAB_BAR_CLEARANCE: a root-stack screen, drawn above the tab bar.
 */
export function ComboSetScreen({navigation, route}: Props) {
  const {theme} = useAppTheme();
  const {t} = useTranslation();
  const themedStyles = useMemo(() => makeStyles(theme), [theme]);
  const {speak} = useSpeak();
  const setId = route?.params.setId ?? '';
  const [set, setSet] = useState<LocalComboSet | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [showVi, setShowVi] = useState(true);
  const [tapped, setTapped] = useState<{
    sentence: string;
    index: number;
  } | null>(null);
  const [grammarOpen, setGrammarOpen] = useState<Set<string>>(new Set());
  const [playing, setPlaying] = useState<string | null>(null);
  const playingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [saved, setSaved] = useState<Set<string>>(new Set());
  const [reporting, setReporting] = useState<string | null>(null);
  const [reported, setReported] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    loadSavedComboSentences().then(list => {
      if (active) setSaved(new Set(list.map(entry => entry.id)));
    });
    return () => {
      active = false;
      if (playingTimer.current) clearTimeout(playingTimer.current);
    };
  }, []);

  useEffect(() => {
    let active = true;
    const local = readLocalComboSet(setId);
    if (local) {
      setSet(local);
      return () => {
        active = false;
      };
    }
    fetchComboSet(setId)
      .then(result => {
        if (!active) return;
        if (!result.ok) {
          setLoadFailed(true);
          return;
        }
        const loaded = {
          id: setId,
          itemCode: '',
          grammarCode: '',
          situationCode: '',
          sentences: result.value.sentences,
          createdAt: new Date().toISOString(),
        };
        saveComboSet(loaded, new Date());
        setSet(loaded);
      })
      .catch(() => {
        if (active) setLoadFailed(true);
      });
    return () => {
      active = false;
    };
  }, [setId]);

  const lastBatch = set
    ? Math.max(0, ...set.sentences.map(sentence => sentence.batch))
    : 0;
  const batchSize = set
    ? set.sentences.filter(sentence => sentence.batch === 1).length
    : 0;

  const addBatch = async () => {
    if (!set || batchSize === 0) return;
    setBusy(true);
    setNotice(null);
    const result = await addToComboSet(setId);
    setBusy(false);
    if (!result.ok) {
      const failure = comboFailureNotice(result, 'more');
      const message = t(
        failure.key === 'combo.errors.unknown'
          ? 'combo.set.add_failed'
          : failure.key,
      );
      setNotice(
        failure.requestId
          ? `${message}\n${t('combo.errors.request_id', {id: failure.requestId})}`
          : message,
      );
      return;
    }
    const merged = {
      ...set,
      sentences: [...set.sentences, ...result.value.sentences],
    };
    saveComboSet(merged, new Date());
    setSet(merged);
    if (result.value.sentences.length < batchSize) {
      setNotice(t('combo.set.short_batch'));
    }
  };

  const report = async (sentence: ComboSentence, reason: ComboReportReason) => {
    setBusy(true);
    const result = await reportComboSentence(sentence.id, reason);
    setBusy(false);
    setReporting(null);
    if (result.ok) {
      setReported(current => new Set(current).add(sentence.id));
      setNotice(t('combo.set.reported'));
    } else {
      setNotice(t('combo.set.report_failed'));
    }
  };

  const play = (sentence: ComboSentence) => {
    if (playingTimer.current) clearTimeout(playingTimer.current);
    setPlaying(sentence.id);
    speak(sentence.text_en);
    playingTimer.current = setTimeout(
      () => setPlaying(null),
      readingMs(sentence.text_en),
    );
  };

  const toggleSave = async (sentence: ComboSentence) => {
    const list = await toggleSavedComboSentence(
      {
        id: sentence.id,
        setId,
        itemCode: set?.itemCode ?? '',
        textEn: sentence.text_en,
        textVi: sentence.text_vi,
      },
      new Date(),
    );
    setSaved(new Set(list.map(entry => entry.id)));
  };

  const toggleIn = (
    update: React.Dispatch<React.SetStateAction<Set<string>>>,
    id: string,
  ) =>
    update(current => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const reportState = (id: string): ReportState =>
    reported.has(id) ? 'done' : reporting === id ? 'open' : 'idle';

  const header = (
    <ScreenHeader
      onBack={() => navigation?.goBack?.()}
      rightAction={
        set ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => setShowVi(value => !value)}
            style={themedStyles.pill}
            testID="combo-set-toggle-vi"
          >
            <MaterialIcon
              color={theme.colors.primary}
              name="visibility"
              size={15}
            />
            <AppText style={themedStyles.teal} variant="caption">
              {showVi ? t('combo.set.hide_vi') : t('combo.set.show_vi')}
            </AppText>
          </Pressable>
        ) : undefined
      }
      title={t('combo.set.title')}
    />
  );

  if (loadFailed) {
    return (
      <AppScreen>
        {header}
        <AppCard testID="combo-set-failed">
          <AppText color="secondary">{t('combo.set.load_failed')}</AppText>
        </AppCard>
      </AppScreen>
    );
  }

  const word = set ? comboWordLabel(set.itemCode) : '';
  const tenseName = set?.sentences.find(sentence => sentence.analysis?.tense)
    ?.analysis?.tense?.name_vi;
  const subline = set
    ? [t('combo.set.count', {count: set.sentences.length}), tenseName]
        .filter(Boolean)
        .join(' · ')
    : '';

  return (
    <AppScreen>
      {header}
      <ScrollView contentContainerStyle={themedStyles.container}>
        {set === null ? (
          <AppText color="secondary">{t('combo.set.loading')}</AppText>
        ) : (
          <>
            <View style={styles.hero}>
              <View style={themedStyles.tile}>
                <MaterialIcon
                  color={theme.colors.onTertiaryContainer}
                  name="style"
                  size={24}
                />
              </View>
              <View style={styles.heroText}>
                <AppText numberOfLines={1} variant="h1">
                  {word || t('combo.set.title')}
                </AppText>
                <AppText color="muted" variant="caption">
                  {subline}
                </AppText>
              </View>
            </View>
            {set.sentences.length > 0 ? (
              <View style={themedStyles.tip}>
                <MaterialIcon
                  color={theme.colors.onTertiaryContainer}
                  name="lightbulb"
                  size={16}
                />
                <AppText style={themedStyles.sunInk} variant="caption">
                  {t('combo.set.tip')}
                </AppText>
              </View>
            ) : null}
          </>
        )}
        {set?.sentences.map((sentence, number) => (
          <ComboSentenceCard
            busy={busy}
            grammarOpen={grammarOpen.has(sentence.id)}
            key={sentence.id}
            number={number + 1}
            onOpenReport={() =>
              setReporting(current =>
                current === sentence.id ? null : sentence.id,
              )
            }
            onPlay={() => play(sentence)}
            onReport={reason => report(sentence, reason)}
            onSayWord={speak}
            onTapToken={index =>
              setTapped(current =>
                current?.sentence === sentence.id && current.index === index
                  ? null
                  : {sentence: sentence.id, index},
              )
            }
            onToggleGrammar={() => toggleIn(setGrammarOpen, sentence.id)}
            onToggleSave={() => toggleSave(sentence)}
            playing={playing === sentence.id}
            report={reportState(sentence.id)}
            saved={saved.has(sentence.id)}
            sentence={sentence}
            showVi={showVi}
            tappedIndex={tapped?.sentence === sentence.id ? tapped.index : null}
          />
        ))}
        {set && set.sentences.length === 0 ? (
          <AppCard testID="combo-set-empty">
            <AppText color="secondary">{t('combo.set.empty')}</AppText>
          </AppCard>
        ) : null}
        {notice ? (
          <AppText color="secondary" testID="combo-set-notice">
            {notice}
          </AppText>
        ) : null}
      </ScrollView>
      {set && lastBatch > 0 ? (
        <StickerFooter>
          <StickerButton
            disabled={busy || batchSize === 0}
            icon="add"
            label={t('combo.set.more', {count: batchSize})}
            onPress={addBatch}
            testID="combo-set-more"
          />
        </StickerFooter>
      ) : null}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  hero: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 4,
  },
  heroText: {
    flex: 1,
    gap: 1,
    minWidth: 0,
  },
});

function makeStyles(theme: AppTheme) {
  return StyleSheet.create({
    container: {
      gap: 14,
      paddingBottom: theme.spacing.xl,
      paddingHorizontal: theme.gutter,
      paddingTop: theme.spacing.xs,
    },
    pill: {
      alignItems: 'center',
      backgroundColor: theme.colors.surface,
      borderRadius: theme.radius.pill,
      flexDirection: 'row',
      gap: 6,
      paddingHorizontal: 11,
      paddingVertical: 7,
      ...getStickerEdge(2, theme.colors.surfaceHigh),
    },
    teal: {
      color: theme.colors.primary,
    },
    tile: {
      alignItems: 'center',
      backgroundColor: theme.colors.tertiarySoft,
      borderRadius: 16,
      height: 48,
      justifyContent: 'center',
      width: 48,
      ...getStickerEdge(3, comboEdges(theme).sun),
    },
    tip: {
      alignItems: 'center',
      backgroundColor: theme.colors.tertiarySoft,
      borderRadius: 14,
      flexDirection: 'row',
      gap: 8,
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    sunInk: {
      color: theme.colors.onTertiaryContainer,
      flex: 1,
    },
  });
}
