import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import React, {useEffect, useMemo, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {Image, Pressable, ScrollView, StyleSheet, View} from 'react-native';

import {getTextLengthBucket, trackEvent} from '@features/analytics';
import {
  startLessonFromConfirmedText,
  trackMoment,
} from '@features/lesson/player';
import {useLearnerProfileStore} from '@features/onboarding';

import {AppScreen} from '@ui/components/AppScreen';
import {AppText} from '@ui/components/AppText';
import {Chip} from '@ui/components/Chip';
import {ErrorCard} from '@ui/components/ErrorCard';
import {useFloatingTabBarClearance} from '@ui/components/layout';
import {MaterialIcon} from '@ui/components/MaterialIcon';
import {ScreenHeader} from '@ui/components/ScreenHeader';
import {TextField} from '@ui/components/TextField';
import {useAppTheme} from '@ui/theme';

import {useIsOffline} from '@core/api/connectivity';
import {createRequestId} from '@core/api/requestId';
import {useAppNavigation} from '@core/navigation';
import {validateConfirmedText} from '@core/utils/textValidation';

import {fetchDescribeCapability, submitMoment} from '../logic/momentClient';
import {detectPiiLines} from '../logic/piiDetect';
import type {CreateFlowParamList} from './navigationTypes';

type Props = NativeStackScreenProps<CreateFlowParamList, 'MomentReview'>;

/**
 * E3 (P7, P1): the photo's text, as the server read it. The learner edits it,
 * hides lines that hold personal information, then picks what to do: understand
 * the text (the existing lesson path) or practise speaking in that situation
 * (SituationInput with the confirmed text). "Describe" lands with E4.
 */
export function MomentReviewScreen({navigation, route}: Props) {
  const {t} = useTranslation();
  const {theme} = useAppTheme();
  const appNavigation = useAppNavigation();
  const offline = useIsOffline();
  const floatingClearance = useFloatingTabBarClearance();
  const {image, analysis, sourceType} = route.params;
  const [text, setText] = useState(analysis.text);
  const [hidden, setHidden] = useState<Set<number>>(() => new Set());
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [describeEnabled, setDescribeEnabled] = useState(false);
  const profile = useLearnerProfileStore(state => state.profile);
  const kids = profile?.ageGroup === 'kids';
  const canDescribe =
    describeEnabled &&
    !kids &&
    analysis.image_id !== null &&
    analysis.kind !== 'text';

  useEffect(() => {
    fetchDescribeCapability().then(setDescribeEnabled);
  }, []);

  const piiLines = useMemo(
    () => new Set(detectPiiLines(text).map(line => line.line)),
    [text],
  );

  /** The text that will be used: edited lines minus the hidden ones. */
  const confirmed = useMemo(
    () =>
      text
        .split(/\r?\n/)
        .filter((_, index) => !hidden.has(index + 1))
        .join('\n')
        .trim(),
    [text, hidden],
  );

  const lines = text.split(/\r?\n/);
  const hasText = confirmed.length > 0;

  function toggleHidden(line: number) {
    setHidden(previous => {
      const next = new Set(previous);
      if (next.has(line)) next.delete(line);
      else next.add(line);
      return next;
    });
    trackEvent('pii_line_hidden', {});
  }

  async function understand() {
    const validation = validateConfirmedText(confirmed);
    if (!validation.valid) {
      setError(validation.message);
      return;
    }
    setBusy(true);
    trackEvent('text_confirmed', {
      source_type: sourceType,
      text_length_bucket: getTextLengthBucket(validation.value.length),
      edited_after_ocr: validation.value !== analysis.text.trim(),
    });
    const result = await startLessonFromConfirmedText({
      confirmedText: validation.value,
      sourceType,
      origin: 'OCRReview',
      navigate: (_screen, params) =>
        appNavigation.startCreate({
          kind: params.initialSource,
          text: params.initialText,
          submissionId: params.submissionId,
        }),
    });
    setBusy(false);
    if (!result.ok) setError(result.message);
  }

  /** E4 (Tả): the server reads the photo and writes sentences about what it shows. */
  async function describe() {
    if (!analysis.image_id) return;
    setBusy(true);
    trackEvent('moment_intent_chosen', {
      intent: 'describe',
      suggested: analysis.suggested_intent === 'describe',
    });
    const result = await submitMoment(
      {
        intent: 'describe',
        level: profile?.levelCode === 'A2' ? 'A2' : 'A1',
        image_id: analysis.image_id,
      },
      createRequestId(),
    );
    setBusy(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    trackMoment({requestId: result.value.moment_request_id, situationVi: null});
    navigation.replace('SituationInput', {
      requestId: result.value.moment_request_id,
    });
  }

  function practise() {
    trackEvent('moment_intent_chosen', {intent: 'use', suggested: false});
    navigation.replace('SituationInput', {
      imageText: confirmed,
      imageId: analysis.image_id ?? undefined,
    });
  }

  return (
    <AppScreen>
      <ScreenHeader
        onBack={() => navigation.goBack()}
        title={t('moment.review_title')}
      />
      <ScrollView
        contentContainerStyle={[
          styles.content,
          {paddingBottom: floatingClearance},
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <Image
          accessibilityIgnoresInvertColors
          resizeMode="cover"
          source={{uri: image.uri}}
          style={styles.photo}
        />
        <View style={styles.chipRow}>
          <Chip
            label={t('moment.level_chip', {
              level: profile?.levelCode === 'A2' ? 'A2' : 'A1',
            })}
            tone="gold"
          />
        </View>
        <AppText color="secondary">{t('moment.review_intro')}</AppText>

        <TextField
          multiline
          onChangeText={value => setText(value)}
          placeholder={t('ocr.placeholder')}
          style={styles.input}
          value={text}
        />

        {lines.map((line, index) => {
          const number = index + 1;
          if (!piiLines.has(number)) return null;
          const isHidden = hidden.has(number);
          return (
            <View
              key={`pii-${number}`}
              style={styles.piiRow}
              testID={`pii-line-${number}`}
            >
              <MaterialIcon
                color={theme.colors.primary}
                name="rule"
                size={18}
              />
              <AppText style={styles.grow} variant="caption">
                {isHidden ? t('moment.hidden_line') : t('moment.pii_warning')}
              </AppText>
              <Pressable
                accessibilityLabel={t('moment.hide_line')}
                accessibilityRole="button"
                onPress={() => toggleHidden(number)}
                style={styles.linkRow}
              >
                <AppText
                  style={{color: theme.colors.primary, fontWeight: '600'}}
                >
                  {isHidden ? t('moment.hide_line') : t('moment.hide_line')}
                </AppText>
              </Pressable>
            </View>
          );
        })}

        {!hasText && !canDescribe ? (
          <AppText color="secondary">{t('moment.no_text')}</AppText>
        ) : null}

        {canDescribe ? (
          <Pressable
            accessibilityLabel={t('moment.intent_describe')}
            accessibilityRole="button"
            disabled={busy || offline}
            onPress={describe}
            style={styles.intent}
            testID="intent-describe"
          >
            <AppText variant="label">{t('moment.intent_describe')}</AppText>
            <AppText color="secondary" variant="caption">
              {t('moment.intent_describe_desc')}
            </AppText>
          </Pressable>
        ) : null}

        {hasText ? (
          <Pressable
            accessibilityLabel={t('moment.intent_understand')}
            accessibilityRole="button"
            disabled={busy || offline}
            onPress={understand}
            style={styles.intent}
            testID="intent-understand"
          >
            <AppText variant="label">{t('moment.intent_understand')}</AppText>
            <AppText color="secondary" variant="caption">
              {t('moment.intent_understand_desc')}
            </AppText>
          </Pressable>
        ) : null}

        <Pressable
          accessibilityLabel={t('moment.intent_use')}
          accessibilityRole="button"
          disabled={!hasText || offline}
          onPress={practise}
          style={styles.intent}
          testID="intent-use"
        >
          <AppText variant="label">{t('moment.intent_use')}</AppText>
          <AppText color="secondary" variant="caption">
            {t('moment.intent_use_desc')}
          </AppText>
        </Pressable>

        {error ? <ErrorCard message={error} /> : null}
      </ScrollView>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  content: {gap: 14, padding: 16},
  photo: {height: 180, width: '100%', borderRadius: 16},
  input: {minHeight: 150, textAlignVertical: 'top'},
  chipRow: {flexDirection: 'row'},
  piiRow: {flexDirection: 'row', alignItems: 'center', gap: 8},
  grow: {flex: 1},
  linkRow: {minHeight: 44, justifyContent: 'center'},
  intent: {gap: 4, padding: 14, borderRadius: 16, borderWidth: 2},
});
