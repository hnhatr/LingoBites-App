import {useFocusEffect} from '@react-navigation/native';
import React from 'react';
import {ScrollView} from 'react-native';

import {hasDownloadedLessons} from '@features/lesson/player';

import {AppCard} from '@ui/components/AppCard';
import {AppScreen} from '@ui/components/AppScreen';
import {AppText} from '@ui/components/AppText';
import {HeroResumeCard} from '@ui/components/HeroResumeCard';
import {useFloatingTabBarClearance} from '@ui/components/layout';
import {type CoverGlyph} from '@ui/components/LibraryCover';
import {ScreenHeader} from '@ui/components/ScreenHeader';
import {cardToneAt, ToneCard} from '@ui/components/ToneCard';
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
          <HeroResumeCard
            accessibilityHint="Mở lại bài đang luyện nói dở"
            chip={`Đang dở · câu ${shadowingContinue.resumeSentenceNumber}/${shadowingContinue.sentenceCount}`}
            chipTestID="shadowing-continue-detail"
            cta="Nói tiếp"
            onPress={handleShadowingContinue}
            testID="shadowing-continue-row"
            title={shadowingContinue.titleVi}
          />
        ) : null}
        {modes.map((mode, index) => (
          <ToneCard
            accessibilityHint={
              mode.available
                ? 'Mở chế độ luyện nói này'
                : 'Chế độ này chưa có sẵn'
            }
            action={
              mode.available
                ? {label: 'Bắt đầu', glyph: 'play', solid: true}
                : {label: 'Sắp có', solid: false}
            }
            cover={{imageUrl: null, glyph: MODE_GLYPHS[mode.mode]}}
            description={mode.descriptionVi}
            disabled={!mode.available}
            eyebrow={[
              mode.level,
              `~${mode.durationMin} phút`,
              mode.recommended ? 'Gợi ý hôm nay' : null,
            ]
              .filter(Boolean)
              .join(' · ')}
            gutter={theme.gutter}
            key={mode.mode}
            onPress={() => handlePressMode(mode)}
            testID={`speaking-mode-${mode.mode}`}
            title={mode.titleVi}
            tone={cardToneAt(index)}
          />
        ))}
      </ScrollView>
    </AppScreen>
  );
}

/** The picture on each mode's card, for modes without their own art. */
const MODE_GLYPHS: Record<SpeakingModeInfo['mode'], CoverGlyph> = {
  shadowing: 'chat',
  quick_answer: 'chat',
  standup: 'work',
  app_description: 'work',
  bug_report: 'work',
  mock_interview: 'school',
};
