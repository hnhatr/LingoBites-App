import {useFocusEffect} from '@react-navigation/native';
import React from 'react';
import {Pressable, ScrollView, StyleSheet, View} from 'react-native';

import {hasDownloadedLessons} from '@features/lesson/player';

import {AppCard} from '@ui/components/AppCard';
import {AppScreen} from '@ui/components/AppScreen';
import {AppText} from '@ui/components/AppText';
import {Chip} from '@ui/components/Chip';
import {useFloatingTabBarClearance} from '@ui/components/layout';
import {MaterialIcon} from '@ui/components/MaterialIcon';
import {ScreenHeader} from '@ui/components/ScreenHeader';
import {useAppTheme} from '@ui/theme';

import {findMostRecentInProgressShadowingLesson} from '../logic/shadowing/shadowingProgress';
import type {SpeakingModeInfo} from '../logic/speakingModes';
import {listSpeakingRoomModes} from '../logic/speakingModes';
import type {SpeakingRoomRouteParams} from './navigationTypes';

export interface SpeakingRoomScreenProps {
  navigation: {
    navigate: (
      screen: 'ShadowingLessonPicker' | 'ShadowingSession',
      params?: {lessonId: string; sentenceIndex: number},
    ) => void;
    goBack: () => void;
  };
  route?: {
    params?: SpeakingRoomRouteParams;
  };
}

/**
 * Speaking Room mode list (REQ-23, VC-17). All six required modes are always
 * shown; a mode without installed content shows the "not available yet"
 * state instead of a broken/empty screen.
 */
export function SpeakingRoomScreen({navigation}: SpeakingRoomScreenProps) {
  const {theme} = useAppTheme();
  const floatingClearance = useFloatingTabBarClearance();
  const [modes, setModes] = React.useState<SpeakingModeInfo[]>(() =>
    listSpeakingRoomModes(),
  );
  const [showDownloadHint, setShowDownloadHint] = React.useState(
    () => !hasDownloadedLessons(),
  );
  const [shadowingContinue, setShadowingContinue] = React.useState(() =>
    findMostRecentInProgressShadowingLesson(),
  );

  useFocusEffect(
    React.useCallback(() => {
      setModes(listSpeakingRoomModes());
      setShowDownloadHint(!hasDownloadedLessons());
      setShadowingContinue(findMostRecentInProgressShadowingLesson());
    }, []),
  );

  function handlePressMode(mode: SpeakingModeInfo) {
    if (!mode.available) {
      return;
    }
    if (mode.mode === 'shadowing') {
      navigation.navigate('ShadowingLessonPicker');
    }
  }

  function handleShadowingContinue() {
    if (!shadowingContinue) {
      return;
    }
    navigation.navigate('ShadowingSession', {
      lessonId: shadowingContinue.lessonId,
      sentenceIndex: shadowingContinue.resumeSentenceIndex,
    });
  }

  return (
    <AppScreen>
      <ScreenHeader
        title="Phòng luyện nói"
        onBack={() => navigation.goBack()}
      />
      <ScrollView
        contentContainerStyle={{
          gap: theme.spacing.md,
          paddingBottom: floatingClearance,
          paddingHorizontal: theme.gutter,
          paddingTop: theme.spacing.sm,
        }}
        showsVerticalScrollIndicator={false}
      >
        {showDownloadHint ? (
          <AppCard testID="speaking-empty-downloads">
            <AppText variant="h3">Chưa có bài học trên máy</AppText>
            <AppText color="secondary" variant="body">
              Các chế độ luyện nói cần câu EN + VI từ bài đã tải. Tải một bài
              trong thư viện để bắt đầu.
            </AppText>
          </AppCard>
        ) : null}
        {shadowingContinue ? (
          <Pressable
            accessibilityRole="button"
            onPress={handleShadowingContinue}
            testID="shadowing-continue-row"
          >
            <AppCard style={{gap: theme.spacing.xs}}>
              <View
                style={{
                  alignItems: 'center',
                  flexDirection: 'row',
                  gap: theme.spacing.sm,
                }}
              >
                <Chip label="Đang dở" tone="gold" />
                <AppText variant="h3">Tiếp tục</AppText>
              </View>
              <AppText testID="shadowing-continue-detail" variant="body">
                {shadowingContinue.titleVi} · câu{' '}
                {shadowingContinue.resumeSentenceNumber}/
                {shadowingContinue.sentenceCount}
              </AppText>
            </AppCard>
          </Pressable>
        ) : null}
        {modes.map(mode => (
          <Pressable
            key={mode.mode}
            accessibilityLabel={`${mode.titleVi}, ${mode.level}, ~${
              mode.durationMin
            } phút${mode.recommended ? ', Gợi ý hôm nay' : ''}${
              mode.available ? '' : ', Chưa có sẵn'
            }`}
            accessibilityRole="button"
            disabled={!mode.available}
            onPress={() => handlePressMode(mode)}
            testID={`speaking-mode-${mode.mode}`}
            style={({pressed}) => ({
              opacity: !mode.available
                ? 0.6
                : pressed
                ? theme.states.pressedOpacity
                : 1,
            })}
          >
            <AppCard style={{gap: theme.spacing.xs}}>
              <View
                style={{
                  alignItems: 'center',
                  flexDirection: 'row',
                  gap: theme.spacing.md,
                }}
              >
                <View
                  style={{
                    alignItems: 'center',
                    backgroundColor: theme.colors.accentSoft,
                    borderRadius: 14,
                    height: 46,
                    justifyContent: 'center',
                    width: 46,
                  }}
                >
                  <MaterialIcon
                    color={theme.colors.primary}
                    name={mode.icon}
                    size={22}
                  />
                </View>
                <View style={styles.cardContent}>
                  <AppText variant="h3">{mode.titleVi}</AppText>
                  <AppText color="secondary">{mode.descriptionVi}</AppText>
                  <View
                    style={{
                      alignItems: 'center',
                      flexDirection: 'row',
                      flexWrap: 'wrap',
                      gap: theme.spacing.xs,
                      marginTop: theme.spacing.xs,
                    }}
                  >
                    <Chip label={mode.level} tone="default" />
                    <View style={styles.durationRow}>
                      <MaterialIcon
                        color={theme.colors.text.secondary}
                        name="schedule"
                        size={16}
                      />
                      <AppText color="muted" variant="caption">
                        ~{mode.durationMin} phút
                      </AppText>
                    </View>
                    {mode.recommended ? (
                      <Chip label="Gợi ý hôm nay" tone="gold" />
                    ) : null}
                    {mode.available ? null : (
                      <Chip label="Chưa có sẵn" tone="neutral" />
                    )}
                  </View>
                </View>
                <View style={{opacity: mode.available ? 1 : 0.4}}>
                  <MaterialIcon
                    color={theme.colors.text.secondary}
                    name="chevron_right"
                    size={22}
                  />
                </View>
              </View>
            </AppCard>
          </Pressable>
        ))}
      </ScrollView>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  cardContent: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  durationRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 4,
  },
});
