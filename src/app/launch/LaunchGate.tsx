import React, {useCallback, useEffect, useRef, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import {useAccountStore} from '@features/account';
import {useLaunchUpdate} from '@features/appUpdate';
import {useLearnerProfileStore} from '@features/onboarding';

import {LaunchSplash} from '@ui/components/LaunchSplash';

import {isLearnerProfilePending} from '../navigation/accountGate';
import {
  type LaunchGateMessage,
  type LaunchGateState,
  launchGateStateFor,
} from './launchGateState';

// Brand-world colours on the splash gradient (see LaunchSplash.tsx).
const WHITE = '#ffffff';
const PEACH = '#FFC9A3';
const TEAL_DARK = '#0A5E5A';
const SOFT_WHITE = 'rgba(255, 255, 255, 0.88)';
const TRACK = 'rgba(4, 60, 56, 0.35)';
const BUTTON_SHADOW = '#04403b';

/** How long the gate waits on "loading" before it admits the network is slow (ms). */
export const LAUNCH_GATE_SLOW_HINT_MS = 4000;

type NotReadyState = Exclude<LaunchGateState, {kind: 'ready'}>;

/**
 * One cover for everything between the native launch screen and the app:
 * the animated splash, account boot, learner-profile load, OTA download and
 * the boot failure / signed-out actions. It stays on the splash background
 * the whole time and fades into the app once nothing is left to wait for.
 * After launch it comes back (without the intro) whenever the app needs the
 * gate again, e.g. after signing out or when an update starts downloading.
 */
export function LaunchGate() {
  const {phase: updatePhase, progress} = useLaunchUpdate();
  const accountPhase = useAccountStore(state => state.phase);
  const userId = useAccountStore(state => state.user?.id ?? null);
  const profileStatus = useLearnerProfileStore(state => state.status);
  const state = launchGateStateFor({
    accountPhase,
    profilePending: isLearnerProfilePending(profileStatus, userId),
    updatePhase,
    updateProgress: progress,
  });
  const ready = state.kind === 'ready';

  // Keep showing the last waiting state while the gate fades out.
  const lastWaiting = useRef<NotReadyState>({kind: 'loading'});
  if (state.kind !== 'ready') {
    lastWaiting.current = state;
  }

  const [mounted, setMounted] = useState(true);
  const [introDone, setIntroDone] = useState(false);
  useEffect(() => {
    if (!mounted && !ready) {
      setMounted(true);
    }
  }, [mounted, ready]);
  const handleFinish = useCallback(() => {
    setMounted(false);
    setIntroDone(true);
  }, []);

  if (!mounted) {
    return null;
  }
  const shown = lastWaiting.current;
  return (
    <LaunchSplash
      busy={shown.kind !== 'message'}
      onFinish={handleFinish}
      ready={ready}
      skipIntro={introDone}
      status={<LaunchGateStatus state={shown} />}
      testID="launch-gate"
    />
  );
}

function LaunchGateStatus({state}: {state: NotReadyState}) {
  if (state.kind === 'loading') {
    return <LoadingStatus />;
  }
  if (state.kind === 'message') {
    return <MessageStatus message={state.message} />;
  }
  return (
    <UpdateStatus
      progress={state.kind === 'reloading' ? 1 : state.progress}
      reloading={state.kind === 'reloading'}
    />
  );
}

function LoadingStatus() {
  const {t} = useTranslation();
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setSlow(true), LAUNCH_GATE_SLOW_HINT_MS);
    return () => clearTimeout(timer);
  }, []);
  const label = slow ? t('launch_gate.loading_slow') : t('launch_gate.loading');

  return (
    <View
      accessibilityLiveRegion="polite"
      accessibilityRole="progressbar"
      style={styles.block}
      testID="launch-gate-loading"
    >
      <View style={styles.dots}>
        {[0, 1, 2].map(index => (
          <Dot index={index} key={index} />
        ))}
      </View>
      <Text style={styles.hint}>{label}</Text>
    </View>
  );
}

function Dot({index}: {index: number}) {
  const reducedMotion = useReducedMotion();
  const pulse = useSharedValue(0);
  useEffect(() => {
    if (reducedMotion) {
      return;
    }
    pulse.value = withDelay(
      index * 150,
      withRepeat(
        withSequence(
          withTiming(1, {duration: 320, easing: Easing.out(Easing.quad)}),
          withTiming(0, {duration: 320, easing: Easing.in(Easing.quad)}),
          withTiming(0, {duration: 410}),
        ),
        -1,
        false,
      ),
    );
  }, [index, pulse, reducedMotion]);
  const style = useAnimatedStyle(() => ({
    opacity: 0.35 + pulse.value * 0.65,
    transform: [{translateY: pulse.value * -4}],
  }));
  return <Animated.View style={[styles.dot, style]} />;
}

type UpdateStatusProps = {
  progress: number;
  reloading: boolean;
};

function UpdateStatus({progress, reloading}: UpdateStatusProps) {
  const {t} = useTranslation();
  const percent = Math.round(Math.min(Math.max(progress, 0), 1) * 100);

  return (
    <View
      accessibilityLiveRegion="polite"
      accessibilityRole="progressbar"
      accessibilityValue={{min: 0, max: 100, now: percent}}
      style={styles.block}
      testID="launch-gate-update"
    >
      <Text style={styles.hint}>
        {reloading ? t('app_update.reloading_title') : t('app_update.title')}
      </Text>
      <View style={styles.track}>
        <View style={[styles.fill, {width: `${percent}%`}]} />
      </View>
      <View style={styles.progressRow}>
        <Text style={styles.small}>
          {reloading
            ? t('app_update.reloading_message')
            : t('app_update.message')}
        </Text>
        <Text style={styles.small}>{t('app_update.percent', {percent})}</Text>
      </View>
    </View>
  );
}

function MessageStatus({message}: {message: LaunchGateMessage}) {
  const {t} = useTranslation();
  const failureMessage = useAccountStore(state => state.failureMessage);
  const retry = useAccountStore(state => state.retry);

  const signedOut = message === 'signed-out';
  const title =
    message === 'offline'
      ? t('account.offline_title')
      : signedOut
      ? t('account.signed_out_title')
      : null;
  const body =
    message === 'offline'
      ? t('errors.network_lost')
      : message === 'merge-in-progress'
      ? t('account.merge_in_progress')
      : signedOut
      ? t('account.signed_out_message')
      : failureMessage ?? t('account.boot_failed');
  const action = signedOut
    ? t('account.signed_out_continue')
    : t('common.retry');

  return (
    <View
      accessibilityLiveRegion="polite"
      style={styles.block}
      testID="launch-gate-message"
    >
      {title ? (
        <Text accessibilityRole="header" style={styles.title}>
          {title}
        </Text>
      ) : null}
      <Text style={styles.body}>{body}</Text>
      <Pressable
        accessibilityHint={
          signedOut
            ? t('account.signed_out_continue_hint')
            : t('account.retry_hint')
        }
        accessibilityLabel={action}
        accessibilityRole="button"
        onPress={() => {
          retry();
        }}
        style={({pressed}) => [styles.button, pressed && styles.buttonPressed]}
        testID="launch-gate-action"
      >
        <Text style={styles.buttonText}>{action}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  block: {
    alignItems: 'center',
    gap: 14,
    width: '100%',
  },
  body: {
    color: SOFT_WHITE,
    fontSize: 16,
    lineHeight: 23,
    textAlign: 'center',
  },
  button: {
    alignItems: 'center',
    backgroundColor: WHITE,
    borderRadius: 24,
    height: 52,
    justifyContent: 'center',
    marginTop: 6,
    shadowColor: BUTTON_SHADOW,
    shadowOffset: {height: 4, width: 0},
    shadowOpacity: 0.35,
    shadowRadius: 0,
    width: 220,
  },
  buttonPressed: {
    shadowOffset: {height: 2, width: 0},
    transform: [{translateY: 2}],
  },
  buttonText: {
    color: TEAL_DARK,
    fontSize: 17,
    fontWeight: '800',
  },
  dot: {
    backgroundColor: WHITE,
    borderRadius: 5,
    height: 9,
    width: 9,
  },
  dots: {
    flexDirection: 'row',
    gap: 8,
  },
  fill: {
    backgroundColor: PEACH,
    borderRadius: 999,
    height: '100%',
  },
  hint: {
    color: SOFT_WHITE,
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  progressRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
  },
  small: {
    color: SOFT_WHITE,
    fontSize: 14,
    fontVariant: ['tabular-nums'],
    fontWeight: '600',
  },
  title: {
    color: WHITE,
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
  },
  track: {
    backgroundColor: TRACK,
    borderRadius: 999,
    height: 10,
    overflow: 'hidden',
    width: '100%',
  },
});
