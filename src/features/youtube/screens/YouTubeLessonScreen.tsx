import type {NavigationProp} from '@react-navigation/native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import React, {useCallback, useEffect, useMemo} from 'react';
import {useTranslation} from 'react-i18next';
import {View} from 'react-native';

import type {RootStackParamList, RootTabParamList} from '@features/home';
import type {CreateStackParamList} from '@features/input';

import {AppScreen} from '@ui/components/AppScreen';
import {AppText} from '@ui/components/AppText';
import {ScreenHeader} from '@ui/components/ScreenHeader';
import {useAppTheme} from '@ui/theme';

import {useYouTubeLessonScreenController} from '../logic/useYouTubeLessonScreenController';
import {mapTranscriptToPractice} from '../logic/utils/practiceMapper';
import {getYouTubeLesson} from '../logic/youtubeQueryPort';
import type {YouTubeSegment} from '../logic/youtubeTranscriptPort';
import {createYouTubeLessonScreenStyles} from './youtubeLessonScreenStyles';
import type {YouTubeLessonScreenProps} from './youtubeLessonScreenTypes';
import {YouTubeLessonScreenView} from './YouTubeLessonScreenView';

export type {YouTubeLessonScreenProps} from './youtubeLessonScreenTypes';

export function YouTubeLessonScreen(props: YouTubeLessonScreenProps) {
  const viewModel = useYouTubeLessonScreenController(props);
  return <YouTubeLessonScreenView {...props} {...viewModel} />;
}

/**
 * SETE-289: registered on both the Create stack (fresh-create flow:
 * `YouTubeProcessing.replace('YouTubeLesson')`) and the RootStack
 * (opening a saved lesson from `YouTubeHistory` above the tabs).
 */
type YouTubeLessonRouteProps =
  | NativeStackScreenProps<CreateStackParamList, 'YouTubeLesson'>
  | NativeStackScreenProps<RootStackParamList, 'YouTubeLesson'>;

export function YouTubeLessonRouteScreen({
  navigation,
  route,
}: YouTubeLessonRouteProps) {
  const nav = navigation as NativeStackScreenProps<
    CreateStackParamList,
    'YouTubeLesson'
  >['navigation'];
  const {t} = useTranslation();
  const {theme} = useAppTheme();
  const fallbackStyles = useMemo(
    () => createYouTubeLessonScreenStyles(theme),
    [theme],
  );
  const params = route.params;
  const lesson =
    'lesson' in params && params.lesson
      ? params.lesson
      : getYouTubeLesson('lessonId' in params ? params.lessonId : '');
  // SETE-283 (HVB-07): the lesson opened even though the local save failed —
  // warn instead of presenting it as saved. Nothing was written, so History
  // gains no phantom row.
  const saveFailed =
    'lesson' in params && params.lesson && params.saveFailed === true;

  // SETE-290 (DEV-4): a freshly created lesson ends at Home — every Back
  // path (header, Android system, gesture) leaves the entry flow instead of
  // returning to the URL input. Saved lessons (lessonId, either stack) keep
  // the plain goBack contract owned by SETE-289.
  const isFreshLesson = 'lesson' in params && params.lesson != null;
  const exitToHome = useCallback(() => {
    const createNav = navigation as NativeStackScreenProps<
      CreateStackParamList,
      'YouTubeLesson'
    >['navigation'];
    createNav.reset({
      index: 0,
      routes: [{name: 'CreateMain'}],
    });
    createNav.getParent<NavigationProp<RootTabParamList>>()?.navigate('Home');
  }, [navigation]);

  useEffect(() => {
    // SETE-330 (mục 6) & SETE-333 (mục 13): disable iOS back-swipe gesture and lock portrait orientation
    navigation.setOptions?.({gestureEnabled: false, orientation: 'portrait'});
    if (!isFreshLesson) {
      return undefined;
    }
    return navigation.addListener('beforeRemove', e => {
      if (e.data.action.type !== 'POP') {
        return;
      }
      e.preventDefault();
      exitToHome();
    });
  }, [navigation, isFreshLesson, exitToHome]);

  const handleBack = useCallback(() => {
    if (isFreshLesson) {
      exitToHome();
      return;
    }
    navigation.goBack();
  }, [navigation, isFreshLesson, exitToHome]);

  const handleStartPractice = useCallback(() => {
    if (!lesson) return;
    const questions = mapTranscriptToPractice(lesson.segments, 10);
    if (questions.length > 0) {
      nav.navigate('Practice', {
        questions,
        title: t('youtube.practice_title', {defaultValue: 'Luyện tập'}),
      });
    }
  }, [lesson, nav, t]);

  // SETE-325 (C-3): "Luyện nói câu này" opens the Speaking Room with the
  // tapped sentence. Fresh lessons sit on the Create stack under the tabs,
  // so the room is reached through the tab parent; lessons opened from
  // History sit on the RootStack above the tabs and go through
  // Tabs > Lessons instead. The tab navigator is identified by its route
  // names (only the RootStack carries a navigator id), so a parent without
  // 'Lessons' among its routes is the RootStack navigator itself.
  // (A parent without getState only happens in test doubles, which stand
  // in for the tab parent.)
  const handlePracticeSentence = useCallback(
    (segment: YouTubeSegment) => {
      const sentenceText = segment.en;
      const tabParent = nav.getParent<NavigationProp<RootTabParamList>>();
      const tabRoutes = tabParent?.getState?.()?.routeNames;
      if (tabParent && (tabRoutes == null || tabRoutes.includes('Lessons'))) {
        tabParent.navigate('Lessons', {
          screen: 'SpeakingRoom',
          params: {sentenceText},
        });
        return;
      }
      const rootNav = tabParent as unknown as
        | NavigationProp<RootStackParamList>
        | undefined;
      rootNav?.navigate('Tabs', {
        screen: 'Lessons',
        params: {screen: 'SpeakingRoom', params: {sentenceText}},
      });
    },
    [nav],
  );

  if (!lesson) {
    return (
      <AppScreen>
        <ScreenHeader
          onBack={() => navigation.goBack()}
          title={t('youtube.lesson_not_found_title')}
        />
        <View style={fallbackStyles.notFoundWrap}>
          <AppText
            color="danger"
            testID="youtube-lesson-not-found"
            variant="h2"
          >
            {t('youtube.lesson_not_found_body')}
          </AppText>
        </View>
      </AppScreen>
    );
  }

  return (
    <YouTubeLessonScreen
      lesson={lesson}
      onBack={handleBack}
      onPracticeSentence={handlePracticeSentence}
      onStartPractice={handleStartPractice}
      saveWarning={saveFailed === true}
    />
  );
}
