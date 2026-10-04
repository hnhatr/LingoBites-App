import React, {useEffect, useMemo, useState} from 'react';
import {
  Alert,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';

import {speak} from '@features/audio';

import {AppCard} from '@ui/components/AppCard';
import {AppScreen} from '@ui/components/AppScreen';
import {AppText} from '@ui/components/AppText';
import {IconButton} from '@ui/components/IconButton';
import {useFloatingTabBarClearance} from '@ui/components/layout';
import {ScreenHeader} from '@ui/components/ScreenHeader';
import {useAppTheme} from '@ui/theme';

import {
  playRecording,
  requestMicrophonePermission,
  startRecording,
  stopRecording,
} from '../../logic/recordingService';
import {getShadowingContent} from '../../logic/speakingModes';
import {useSpeakingRepository} from '../../logic/useSpeakingRepository';

export interface SpeakingShadowingActivityProps {
  navigation: {
    goBack: () => void;
  };
}

type RecordingPhase = 'idle' | 'recording' | 'recorded';

/**
 * Speaking Room shadowing mode: play reference audio, record, play back the
 * recording, self-check (REQ-21/22, VC-7). No numeric accent/pronunciation
 * score anywhere in this screen's copy — feedback is limited to the
 * checklist below, matching the acceptance criteria.
 */
export function SpeakingShadowingActivity({
  navigation,
}: SpeakingShadowingActivityProps) {
  const {theme} = useAppTheme();
  const floatingClearance = useFloatingTabBarClearance();
  const {insertSpeakingRecording} = useSpeakingRepository();
  const content = useMemo(() => getShadowingContent(), []);
  const lesson = content[0] ?? null;
  const line = lesson?.lines[0] ?? null;

  const [phase, setPhase] = useState<RecordingPhase>('idle');
  const [filePath, setFilePath] = useState<string | null>(null);
  const [durationMs, setDurationMs] = useState(0);
  const [startedAtMs, setStartedAtMs] = useState(0);
  const [taskCompleted, setTaskCompleted] = useState(false);
  const [keyPhraseUsed, setKeyPhraseUsed] = useState(false);
  const [respondedQuickly, setRespondedQuickly] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // Unsaved work that would be lost on exit: an in-progress or finished
  // recording, or self-check answers that were never submitted. A pristine
  // screen (or an already-submitted one) has nothing at stake.
  const hasUnsavedProgress =
    !submitted &&
    (phase !== 'idle' || taskCompleted || keyPhraseUsed || respondedQuickly);

  function exitActivity() {
    // Never leave the microphone running after the activity is dismissed.
    if (phase === 'recording' && filePath) {
      stopRecording(filePath, startedAtMs).catch(() => undefined);
    }
    navigation.goBack();
  }

  function requestExit() {
    if (!hasUnsavedProgress) {
      navigation.goBack();
      return;
    }
    Alert.alert(
      'Thoát buổi luyện nói?',
      'Bản ghi âm và tiến độ tự kiểm tra sẽ không được lưu.',
      [
        {text: 'Huỷ', style: 'cancel'},
        {text: 'Thoát', style: 'destructive', onPress: exitActivity},
      ],
    );
  }

  const closeAction = (
    <IconButton
      accessibilityLabel="Đóng buổi luyện nói"
      icon="close"
      onPress={requestExit}
      tone="bare"
      testID="shadowing-close"
    />
  );

  function handlePlayReference() {
    if (!line?.textEn) {
      Alert.alert('Âm thanh mẫu', 'Không có câu mẫu cho bài này.');
      return;
    }
    speak(line.textEn).catch(() => {
      Alert.alert('Âm thanh mẫu', 'Không thể phát âm thanh mẫu.');
    });
  }

  useEffect(() => {
    // Pre-flight check: request/verify microphone permission when the speaking activity opens
    requestMicrophonePermission();
  }, []);

  async function handleToggleRecording() {
    if (phase === 'idle') {
      const start = await startRecording('shadowing', `shadow-${Date.now()}`);
      if (!start.ok) {
        if (start.errorCode === 'PERMISSION_DENIED') {
          Alert.alert('Cần quyền truy cập micro', start.message, [
            {text: 'Huỷ', style: 'cancel'},
            {text: 'Mở Cài đặt', onPress: () => Linking.openSettings()},
          ]);
        } else if (start.errorCode === 'NO_INPUT_DEVICE') {
          Alert.alert('Ghi âm', start.message, [{text: 'OK'}]);
        } else if (start.errorCode === 'TRANSIENT_FAILURE') {
          Alert.alert('Ghi âm', start.message, [
            {text: 'Huỷ', style: 'cancel'},
            {text: 'Thử lại', onPress: () => handleToggleRecording()},
          ]);
        } else {
          Alert.alert('Ghi âm', start.message);
        }
        return;
      }
      setFilePath(start.filePath);
      setStartedAtMs(Date.now());
      setPhase('recording');
      return;
    }
    if (phase === 'recording' && filePath) {
      const stop = await stopRecording(filePath, startedAtMs);
      if (!stop.ok) {
        Alert.alert('Ghi âm', stop.message);
        return;
      }
      setFilePath(stop.filePath);
      setDurationMs(stop.durationMs);
      setPhase('recorded');
    }
  }

  async function handlePlayMyRecording() {
    if (!filePath) {
      return;
    }
    const result = await playRecording(filePath);
    if (!result.ok) {
      Alert.alert('Nghe lại', result.message);
    }
  }

  function handleFinishSelfCheck() {
    if (!filePath || !lesson) {
      return;
    }
    const recordingId = `shadow-rec-${Date.now()}`;
    insertSpeakingRecording({
      id: recordingId,
      lessonId: lesson.lessonId,
      mode: 'shadowing',
      filePath,
      durationMs,
    });

    // Background upload (T5)
    import('../../logic/recordingUploadWorker')
      .then(({uploadRecordingBackground}) => {
        uploadRecordingBackground(
          filePath,
          lesson.lessonId,
          'shadowing',
          durationMs,
        );
      })
      .catch(() => {});

    setSubmitted(true);
  }

  if (!lesson || !line) {
    return (
      <AppScreen>
        <ScreenHeader title="Lặp lại theo mẫu" rightAction={closeAction} />
        <View style={{padding: theme.gutter}}>
          <AppText color="secondary">
            Chưa có nội dung lặp lại theo mẫu nào được cài đặt.
          </AppText>
        </View>
      </AppScreen>
    );
  }

  return (
    <AppScreen>
      <ScreenHeader title="Lặp lại theo mẫu" rightAction={closeAction} />
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
        <AppCard style={{gap: theme.spacing.sm}}>
          <View
            style={{
              alignItems: 'center',
              flexDirection: 'row',
              gap: theme.spacing.sm,
            }}
            testID="shadowing-prompt-row"
          >
            <AppText
              style={styles.lineText}
              testID="shadowing-prompt-en"
              variant="h3"
            >
              {line.textEn}
            </AppText>
            <IconButton
              accessibilityLabel="Nghe câu mẫu"
              icon="volume_up"
              onPress={handlePlayReference}
              style={styles.audioButton}
              tone="ghost"
            />
          </View>
          <AppText color="secondary">{line.textVi}</AppText>
        </AppCard>

        {/* Flexible spacer: on tall screens this pushes the repeated record
            control into the bottom thumb zone instead of leaving dead space
            below it. Collapses when content overflows so the view scrolls. */}
        <View style={{flex: 1, minHeight: theme.spacing.xxl}} />

        <AppCard
          style={{alignItems: 'center', gap: theme.spacing.sm}}
          testID="shadowing-record-card"
        >
          <IconButton
            accessibilityLabel={
              phase === 'recording' ? 'Dừng ghi âm' : 'Bắt đầu ghi âm'
            }
            icon={phase === 'recording' ? 'circle' : 'mic'}
            onPress={handleToggleRecording}
            size={64}
            tone={phase === 'recording' ? 'danger' : 'accent'}
          />
          <AppText color="secondary" testID="recording-phase-label">
            {phase === 'idle' && 'Bấm để bắt đầu ghi âm'}
            {phase === 'recording' && 'Đang ghi âm — bấm để dừng'}
            {phase === 'recorded' && 'Đã ghi âm xong'}
          </AppText>
          {phase === 'recorded' ? (
            <IconButton
              accessibilityLabel="Nghe lại bản ghi âm của tôi"
              icon="play_circle"
              onPress={handlePlayMyRecording}
              tone="surface"
            />
          ) : null}
        </AppCard>

        {phase === 'recorded' && !submitted ? (
          <AppCard style={{gap: theme.spacing.sm}}>
            <AppText variant="h3">Tự kiểm tra</AppText>
            <ChecklistRow
              checked={taskCompleted}
              label="Tôi đã hoàn thành nhiệm vụ nói"
              onToggle={() => setTaskCompleted(v => !v)}
            />
            <ChecklistRow
              checked={keyPhraseUsed}
              label="Tôi đã dùng đúng cụm từ khóa"
              onToggle={() => setKeyPhraseUsed(v => !v)}
            />
            <ChecklistRow
              checked={respondedQuickly}
              label="Tôi trả lời nhanh, không ngập ngừng"
              onToggle={() => setRespondedQuickly(v => !v)}
            />
            <Pressable
              accessibilityLabel="Hoàn thành tự kiểm tra"
              accessibilityRole="button"
              onPress={handleFinishSelfCheck}
              style={({pressed}) => ({
                alignItems: 'center',
                backgroundColor: theme.colors.accent,
                borderRadius: theme.radius.lg,
                marginTop: theme.spacing.sm,
                minHeight: 48,
                justifyContent: 'center',
                opacity: pressed ? theme.states.pressedOpacity : 1,
              })}
            >
              <AppText
                style={{color: theme.colors.accentInk, fontWeight: '700'}}
              >
                Hoàn thành
              </AppText>
            </Pressable>
          </AppCard>
        ) : null}

        {submitted ? (
          <AppText color="secondary" testID="shadowing-submitted">
            Đã lưu bản ghi âm và kết quả tự kiểm tra.
          </AppText>
        ) : null}
      </ScrollView>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  audioButton: {
    flexShrink: 0,
  },
  lineText: {
    flex: 1,
    flexShrink: 1,
  },
  flex1: {
    flex: 1,
  },
});

function ChecklistRow({
  label,
  checked,
  onToggle,
}: {
  label: string;
  checked: boolean;
  onToggle: () => void;
}) {
  const {theme} = useAppTheme();
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="checkbox"
      accessibilityState={{checked}}
      onPress={onToggle}
      style={{
        alignItems: 'center',
        flexDirection: 'row',
        gap: theme.spacing.sm,
      }}
    >
      <IconButton
        accessibilityLabel={label}
        icon="check_circle"
        onPress={onToggle}
        tone={checked ? 'accent' : 'ghost'}
      />
      <AppText>{label}</AppText>
    </Pressable>
  );
}
