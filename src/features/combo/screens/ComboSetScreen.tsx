import React, {useEffect, useMemo, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {Pressable, ScrollView, StyleSheet, View} from 'react-native';

import {AppButton} from '@ui/components/AppButton';
import {AppCard} from '@ui/components/AppCard';
import {AppScreen} from '@ui/components/AppScreen';
import {AppText} from '@ui/components/AppText';
import {ScreenHeader} from '@ui/components/ScreenHeader';
import {type AppTheme, useAppTheme} from '@ui/theme';

import {useAppNavigation} from '@core/navigation';

import {
  addToComboSet,
  type ComboReportReason,
  type ComboSentence,
  type ComboToken,
  fetchComboSet,
  reportComboSentence,
} from '../logic/comboClient';
import {
  type LocalComboSet,
  readLocalComboSet,
  saveComboSet,
} from '../logic/comboSetRepository';
import type {ComboSetRouteParams} from './navigationTypes';

type Props = {
  navigation?: {goBack?: () => void};
  route?: {params: ComboSetRouteParams};
};

const REASONS: ComboReportReason[] = [
  'wrong_meaning',
  'unnatural',
  'wrong_tense',
  'wrong_subject',
  'other',
];

/** How a word is shown: the item and the verb stand out, the subject is plain. */
function toneOf(token: ComboToken): 'item' | 'verb' | 'plain' {
  if (token.role === 'item') return 'item';
  if (token.role === 'verb') return 'verb';
  return 'plain';
}

/**
 * Vocab path P5: a combo set. Sentences with their words coloured by role; tap a
 * word for its IPA; show or hide the Vietnamese; add a batch; report a sentence.
 * The set is read from the device when it is there, so it works offline.
 *
 * IGNORE_TAB_BAR_CLEARANCE: a root-stack screen, drawn above the tab bar.
 */
export function ComboSetScreen({navigation, route}: Props) {
  const {theme} = useAppTheme();
  const {t} = useTranslation();
  const appNavigation = useAppNavigation();
  const themedStyles = useMemo(() => makeStyles(theme), [theme]);
  const setId = route?.params.setId ?? '';
  const [set, setSet] = useState<LocalComboSet | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [showVi, setShowVi] = useState(true);
  const [tapped, setTapped] = useState<{
    sentence: string;
    index: number;
  } | null>(null);
  const [reporting, setReporting] = useState<string | null>(null);
  const [reported, setReported] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

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
      setNotice(t('combo.set.add_failed'));
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

  if (loadFailed) {
    return (
      <AppScreen>
        <ScreenHeader
          onBack={() => navigation?.goBack?.()}
          title={t('combo.set.title')}
        />
        <AppCard testID="combo-set-failed">
          <AppText color="secondary">{t('combo.set.load_failed')}</AppText>
        </AppCard>
      </AppScreen>
    );
  }

  return (
    <AppScreen>
      <ScreenHeader
        onBack={() => navigation?.goBack?.()}
        title={t('combo.set.title')}
      />
      <ScrollView contentContainerStyle={themedStyles.container}>
        <AppButton
          onPress={() => setShowVi(value => !value)}
          testID="combo-set-toggle-vi"
          title={showVi ? t('combo.set.hide_vi') : t('combo.set.show_vi')}
          variant="outline"
        />
        {set === null ? (
          <AppText color="secondary">{t('combo.set.loading')}</AppText>
        ) : null}
        {set?.sentences.map(sentence => (
          <AppCard key={sentence.id} testID={`combo-sentence-${sentence.id}`}>
            <View style={themedStyles.words}>
              {sentence.tokens.map((token, index) => (
                <Pressable
                  key={`${sentence.id}-${index}`}
                  accessibilityRole="button"
                  onPress={() =>
                    setTapped(current =>
                      current?.sentence === sentence.id &&
                      current.index === index
                        ? null
                        : {sentence: sentence.id, index},
                    )
                  }
                  testID={`combo-token-${sentence.id}-${index}`}
                >
                  <AppText
                    color={
                      toneOf(token) === 'item'
                        ? 'primary'
                        : toneOf(token) === 'verb'
                        ? 'secondary'
                        : 'muted'
                    }
                    variant="h3"
                  >
                    {token.t}
                  </AppText>
                </Pressable>
              ))}
            </View>
            {tapped?.sentence === sentence.id &&
            sentence.tokens[tapped.index] ? (
              <AppText color="secondary" testID={`combo-ipa-${sentence.id}`}>
                {sentence.tokens[tapped.index]!.ipa ?? t('combo.set.no_ipa')}
              </AppText>
            ) : null}
            {showVi ? (
              <AppText color="secondary">{sentence.text_vi}</AppText>
            ) : null}
            {reported.has(sentence.id) ? (
              <AppText color="muted">{t('combo.set.already_reported')}</AppText>
            ) : reporting === sentence.id ? (
              REASONS.map(reason => (
                <AppButton
                  key={reason}
                  disabled={busy}
                  onPress={() => report(sentence, reason)}
                  testID={`combo-report-${sentence.id}-${reason}`}
                  title={t(`combo.report.${reason}`)}
                  variant="outline"
                />
              ))
            ) : (
              <AppButton
                onPress={() => setReporting(sentence.id)}
                testID={`combo-report-open-${sentence.id}`}
                title={t('combo.set.report')}
                variant="outline"
              />
            )}
          </AppCard>
        ))}
        {set && set.sentences.length === 0 ? (
          <AppCard testID="combo-set-empty">
            <AppText color="secondary">{t('combo.set.empty')}</AppText>
          </AppCard>
        ) : null}
        {set && lastBatch > 0 ? (
          <AppButton
            disabled={busy || batchSize === 0}
            onPress={addBatch}
            testID="combo-set-more"
            title={t('combo.set.more')}
            variant="secondary"
          />
        ) : null}
        {notice ? (
          <AppText color="secondary" testID="combo-set-notice">
            {notice}
          </AppText>
        ) : null}
        <AppButton
          onPress={() => appNavigation.goBack()}
          testID="combo-set-back"
          title={t('combo.set.back')}
          variant="outline"
        />
      </ScrollView>
    </AppScreen>
  );
}

function makeStyles(theme: AppTheme) {
  return StyleSheet.create({
    container: {
      gap: theme.spacing.md,
      padding: theme.spacing.md,
    },
    words: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: theme.spacing.xs,
    },
  });
}
