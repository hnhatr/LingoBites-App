import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import React, {useEffect, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {Pressable, ScrollView, StyleSheet, View} from 'react-native';

import {fetchComposeQuota} from '@features/lesson/player';
import {useLearnerProfileStore} from '@features/onboarding';

import {AppScreen} from '@ui/components/AppScreen';
import {AppText} from '@ui/components/AppText';
import {ErrorCard} from '@ui/components/ErrorCard';
import {useFloatingTabBarClearance} from '@ui/components/layout';
import {MaterialIcon} from '@ui/components/MaterialIcon';
import {PrimaryActionButton} from '@ui/components/PrimaryActionButton';
import {ScreenHeader} from '@ui/components/ScreenHeader';
import {TextField} from '@ui/components/TextField';
import {useAppTheme} from '@ui/theme';

import {useIsOffline} from '@core/api/connectivity';
import {createRequestId} from '@core/api/requestId';
import {useAppNavigation} from '@core/navigation';

import {
  confirmMoment,
  fetchActiveMoments,
  fetchSituations,
  type Situation,
  submitMoment,
} from '../logic/momentClient';
import {momentFailureMessage} from '../logic/momentMessages';
import {useMomentProgress} from '../logic/useMomentProgress';
import type {CreateFlowParamList} from './navigationTypes';

type Props = NativeStackScreenProps<CreateFlowParamList, 'SituationInput'>;

/**
 * E3 (P2–P6): pick a situation or describe one, then follow the moment on this
 * screen. A typed situation shows what the AI understood and waits for "Đúng"
 * before the lesson is built (plan A). Also restores a moment still running.
 */
export function SituationInputScreen({navigation, route}: Props) {
  const {t} = useTranslation();
  const {theme} = useAppTheme();
  const appNavigation = useAppNavigation();
  const offline = useIsOffline();
  const floatingClearance = useFloatingTabBarClearance();
  const profile = useLearnerProfileStore(state => state.profile);
  const kids = profile?.ageGroup === 'kids';
  const level = profile?.levelCode === 'A2' ? 'A2' : 'A1';
  const imageText = route.params?.imageText;

  const [situations, setSituations] = useState<Situation[]>([]);
  const [typed, setTyped] = useState('');
  const [requestId, setRequestId] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [quota, setQuota] = useState<number | null>(null);
  const progress = useMomentProgress(requestId);
  const status = progress.status;

  useEffect(() => {
    if (kids) return;
    fetchSituations(level).then(result => {
      if (result.ok) setSituations(result.value);
    });
    fetchComposeQuota().then(result => {
      if (result.ok) setQuota(result.value.remaining);
    });
    fetchActiveMoments().then(result => {
      if (result.ok && result.value[0]) setRequestId(result.value[0].id);
    });
  }, [kids, level]);

  async function start(body: {situation_id?: string; situation_note?: string}) {
    if (offline) return;
    setSubmitError(null);
    const result = await submitMoment(
      {
        intent: 'use',
        level,
        ...body,
        ...(imageText ? {image_text: imageText} : {}),
      },
      createRequestId(),
    );
    if (!result.ok) {
      setSubmitError(momentFailureMessage(result.errorCode, t));
      return;
    }
    setRequestId(result.value.moment_request_id);
  }

  async function answer(accept: boolean) {
    if (!requestId) return;
    const result = await confirmMoment(requestId, accept);
    if (!result.ok) {
      setSubmitError(momentFailureMessage(result.errorCode, t));
      return;
    }
    if (!accept) {
      setRequestId(null);
      return;
    }
    progress.resume();
  }

  const titleKey = 'moment.title';
  return (
    <AppScreen>
      <ScreenHeader onBack={() => navigation.goBack()} title={t(titleKey)} />
      <ScrollView
        contentContainerStyle={[
          styles.content,
          {paddingBottom: floatingClearance},
        ]}
        keyboardShouldPersistTaps="handled"
      >
        {kids ? (
          <AppText color="secondary">{t('moment.kids_blocked')}</AppText>
        ) : null}

        {!kids && status?.status === 'awaiting_confirmation' ? (
          <View style={styles.card} testID="moment-confirm">
            <AppText variant="label">{t('moment.understood_title')}</AppText>
            <AppText variant="h3">{status.situation_vi ?? ''}</AppText>
            <PrimaryActionButton
              accessibilityLabel={t('moment.confirm_yes')}
              label={t('moment.confirm_yes')}
              onPress={() => answer(true)}
            />
            <Pressable
              accessibilityLabel={t('moment.confirm_edit')}
              accessibilityRole="button"
              onPress={() => answer(false)}
              style={styles.linkRow}
            >
              <AppText style={{color: theme.colors.primary, fontWeight: '600'}}>
                {t('moment.confirm_edit')}
              </AppText>
            </Pressable>
          </View>
        ) : null}

        {!kids &&
        progress.polling &&
        status &&
        !['succeeded', 'failed', 'awaiting_confirmation'].includes(
          status.status,
        ) ? (
          <AppText color="secondary" testID="moment-building">
            {t('moment.building')}
          </AppText>
        ) : null}

        {!kids && status?.status === 'succeeded' && status.lesson_id ? (
          <PrimaryActionButton
            accessibilityLabel={t('moment.open_lesson')}
            label={t('moment.open_lesson')}
            onPress={() => appNavigation.finishCreate(status.lesson_id!)}
          />
        ) : null}

        {!kids && status?.status === 'failed' ? (
          <ErrorCard
            message={momentFailureMessage(status.error?.code, t)}
            onRetry={() => setRequestId(null)}
            retryLabel={t('moment.confirm_edit')}
          />
        ) : null}

        {!kids && !status?.status && !requestId ? (
          <>
            {quota !== null ? (
              <AppText color="secondary" variant="caption">
                {t('moment.quota', {count: quota})}
              </AppText>
            ) : null}
            <AppText variant="h3">{t('moment.choose_situation')}</AppText>
            {situations.length === 0 ? (
              <AppText color="secondary">
                {t('moment.situations_empty')}
              </AppText>
            ) : null}
            {situations.map(situation => (
              <Pressable
                key={situation.id}
                accessibilityLabel={situation.title_vi}
                accessibilityRole="button"
                disabled={offline}
                onPress={() => start({situation_id: situation.id})}
                style={styles.situation}
                testID={`situation-${situation.code}`}
              >
                <MaterialIcon
                  color={theme.colors.primary}
                  name="record_voice_over"
                  size={22}
                />
                <AppText style={styles.grow}>{situation.title_vi}</AppText>
              </Pressable>
            ))}

            <AppText variant="label">{t('moment.typed_label')}</AppText>
            <TextField
              multiline
              onChangeText={setTyped}
              placeholder={t('moment.typed_placeholder')}
              style={styles.input}
              value={typed}
            />
            <PrimaryActionButton
              accessibilityLabel={t('moment.send')}
              disabled={offline || typed.trim().length < 3}
              label={t('moment.send')}
              onPress={() => start({situation_note: typed.trim()})}
            />
          </>
        ) : null}

        {submitError ? <ErrorCard message={submitError} /> : null}
        {offline ? (
          <AppText color="secondary">{t('moment.offline')}</AppText>
        ) : null}
      </ScrollView>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  content: {gap: 14, padding: 16},
  card: {gap: 12, padding: 16, borderRadius: 18, borderWidth: 2},
  linkRow: {alignItems: 'center', minHeight: 44, justifyContent: 'center'},
  situation: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 16,
    borderWidth: 2,
  },
  grow: {flex: 1},
  input: {minHeight: 110, textAlignVertical: 'top'},
});
