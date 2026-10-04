import React, {useCallback, useEffect, useState} from 'react';
import {Alert, Pressable, ScrollView, StyleSheet, View} from 'react-native';

import {AppScreen} from '@ui/components/AppScreen';
import {AppText} from '@ui/components/AppText';
import {IconButton} from '@ui/components/IconButton';
import {useFloatingTabBarClearance} from '@ui/components/layout';
import {ScreenHeader} from '@ui/components/ScreenHeader';
import {useAppTheme} from '@ui/theme';

import {applyRecordingUploadConsent} from '../components/SpeakingRecordingsSettingsRow';
import {ConsentSheet} from '../components/shadowing/ConsentSheet';
import {RecorderPanel} from '../components/shadowing/RecorderPanel';
import {SelfCheckList} from '../components/shadowing/SelfCheckList';
import {SentenceCard} from '../components/shadowing/SentenceCard';
import {requestMicrophonePermission} from '../logic/recordingService';
import {
  formatShadowingElapsed,
  useShadowingSession,
} from '../logic/shadowing/useShadowingSession';
import {
  isRecordingUploadConsentOn,
  readRecordingUploadConsent,
} from '../logic/upload/recordingConsent';
import type {
  ShadowingSessionRouteParams,
  ShadowingSummaryRouteParams,
} from './navigationTypes';

export type ShadowingSessionScreenProps = {
  navigation: {
    goBack: () => void;
    navigate: (
      screen: 'ShadowingSummary',
      params: ShadowingSummaryRouteParams,
    ) => void;
  };
  route: {
    params: ShadowingSessionRouteParams;
  };
};

export function ShadowingSessionScreen({
  navigation,
  route,
}: ShadowingSessionScreenProps) {
  const {theme} = useAppTheme();
  const floatingClearance = useFloatingTabBarClearance();
  const lessonId = route.params.lessonId;
  const initialSentenceIndex = route.params.sentenceIndex ?? 0;

  const [consentVisible, setConsentVisible] = useState(false);

  const session = useShadowingSession({
    lessonId,
    initialSentenceIndex,
    onSessionComplete: summary => {
      navigation.navigate('ShadowingSummary', summary);
    },
  });

  const runSave = useCallback(() => {
    session.saveAndContinue().catch(() => undefined);
  }, [session]);

  const handleSavePress = useCallback(() => {
    if (readRecordingUploadConsent() === 'undecided') {
      setConsentVisible(true);
      return;
    }
    runSave();
  }, [runSave]);

  const handleConsentUploadOn = useCallback(() => {
    applyRecordingUploadConsent('on');
    setConsentVisible(false);
    runSave();
  }, [runSave]);

  const handleConsentLocalOnly = useCallback(() => {
    applyRecordingUploadConsent('off');
    setConsentVisible(false);
    runSave();
  }, [runSave]);

  useEffect(() => {
    requestMicrophonePermission();
  }, []);

  const exitWithoutConfirm = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  const handleClose = useCallback(() => {
    if (!session.hasUnsavedProgress) {
      exitWithoutConfirm();
      return;
    }
    Alert.alert(
      'Thoát buổi luyện nói?',
      'Bản ghi chưa lưu sẽ bị xóa. Các câu đã lưu vẫn được giữ.',
      [
        {text: 'Huỷ', style: 'cancel'},
        {
          text: 'Thoát',
          style: 'destructive',
          onPress: () => {
            session
              .discardUnsavedTake()
              .finally(exitWithoutConfirm)
              .catch(() => undefined);
          },
        },
      ],
    );
  }, [exitWithoutConfirm, session]);

  const closeAction = (
    <IconButton
      accessibilityLabel="Đóng buổi luyện nói"
      icon="close"
      onPress={handleClose}
      testID="shadowing-close"
      tone="bare"
    />
  );

  if (!session.lesson || !session.sentence) {
    return (
      <AppScreen>
        <ScreenHeader rightAction={closeAction} title="Lặp lại theo mẫu" />
        <View style={{padding: theme.gutter}}>
          <AppText color="secondary">
            Chưa có nội dung lặp lại theo mẫu cho bài này.
          </AppText>
        </View>
      </AppScreen>
    );
  }

  const showRecorder =
    session.sessionState === 'idle' || session.sessionState === 'recording';
  const showReview =
    session.sessionState === 'recorded' || session.sessionState === 'saving';
  const myTakeLabel = session.take
    ? formatShadowingElapsed(session.take.durationMs)
    : '0:00';

  return (
    <AppScreen>
      <ScreenHeader rightAction={closeAction} title="Lặp lại theo mẫu" />
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          gap: theme.spacing.lg,
          paddingBottom: floatingClearance,
          paddingHorizontal: theme.gutter,
          paddingTop: theme.spacing.sm,
        }}
        showsVerticalScrollIndicator={false}
        style={styles.flex1}
      >
        <SentenceCard
          compact={showReview}
          onPlayNormal={() => {
            session.playNormalSample().catch(() => {
              Alert.alert('Âm thanh mẫu', 'Không thể phát âm thanh mẫu.');
            });
          }}
          onPlaySlow={() => {
            session.playSlowSample().catch(() => {
              Alert.alert('Âm thanh mẫu', 'Không thể phát âm thanh mẫu.');
            });
          }}
          sentence={session.sentence}
          sentenceCount={session.sentenceCount}
          sentenceIndex={session.sentenceIndex}
          showSampleButtons={session.sessionState !== 'recording'}
        />

        {showRecorder ? (
          <>
            <View style={{flex: 1, minHeight: theme.spacing.xxl}} />
            <RecorderPanel
              elapsedMs={session.elapsedMs}
              onStart={() => {
                session.startRecordingTake().catch(() => undefined);
              }}
              onStop={() => {
                session.stopRecordingTake().catch(() => undefined);
              }}
              sessionState={session.sessionState}
            />
            {session.sessionState === 'idle' ? (
              <Pressable
                accessibilityRole="button"
                onPress={session.skipSentence}
                testID="shadowing-skip-sentence"
              >
                <AppText
                  style={{
                    color: theme.colors.accent,
                    textAlign: 'center',
                    textDecorationLine: 'underline',
                  }}
                >
                  Bỏ qua câu này
                </AppText>
              </Pressable>
            ) : null}
          </>
        ) : null}

        {showReview ? (
          <SelfCheckList
            isLastSentence={session.sentenceIndex >= session.sentenceCount - 1}
            myTakeLabel={myTakeLabel}
            onPlayMyTake={() => {
              session.playMyTake().catch(() => undefined);
            }}
            onPlaySample={() => {
              session.playNormalSample().catch(() => undefined);
            }}
            onReRecord={() => {
              session.reRecord().catch(() => undefined);
            }}
            onSave={handleSavePress}
            onToggle={key => {
              session.setSelfCheckItem(key, !session.selfCheck[key]);
            }}
            saving={session.sessionState === 'saving'}
            showUploadHint={isRecordingUploadConsentOn()}
            values={session.selfCheck}
          />
        ) : null}
      </ScrollView>
      <ConsentSheet
        onChooseLocalOnly={handleConsentLocalOnly}
        onChooseUploadOn={handleConsentUploadOn}
        onDismiss={() => setConsentVisible(false)}
        visible={consentVisible}
      />
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  flex1: {
    flex: 1,
  },
});
