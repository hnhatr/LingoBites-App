import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import {NavigationContainer} from '@react-navigation/native';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import React, {useEffect, useMemo} from 'react';

import {
  AccountSwitchGateScreen,
  BootGateScreen,
  OnboardingNameScreen,
  useAccountStore,
} from '@features/account';
import {TtsSpikeScreen} from '@features/audio';
import {
  CourseLevelsScreen,
  CourseListScreen,
  LevelUnitsScreen,
  UnitLessonsScreen,
} from '@features/course';
import {HomeScreen} from '@features/home';
import {
  CreateScreen,
  ImageCaptureScreen,
  PasteTextScreen,
} from '@features/input';
import {
  LessonsHistoryScreen,
  LibraryListScreen,
} from '@features/lesson/library';
import {
  CanonicalLessonCatalogScreen,
  CanonicalLessonPlayerScreen,
  LessonCreationScreen,
} from '@features/lesson/player';
import {OCRReviewScreen} from '@features/ocr';
import {PracticeScreen} from '@features/practice';
import {
  AccountSettingsScreen,
  AppSettingsScreen,
  DataSettingsScreen,
  FeatureStatusScreen,
  PrivacyNoteScreen,
  ProfileScreen,
  ProgressReportScreen,
  SupportAboutScreen,
} from '@features/profile';
import {DailyReviewScreen} from '@features/review';
import {
  ShadowingLessonPickerScreen,
  ShadowingSessionScreen,
  ShadowingSummaryScreen,
  SpeakingRoomScreen,
} from '@features/speaking/screens/speakingUiPort';
import {TodayScreen} from '@features/today';

import {AppNavigationProvider} from '@core/navigation';
import {useFeatureFlags} from '@core/release';

import {accountGateRouteForPhase} from './accountGate';
import {createAppNavigation, navigationRef} from './appNavigationAdapter';
import {isIngestionRouteEnabled} from './ingestionRouteGate';
import {TabBar} from './TabBar';
import type {
  CoursesStackParamList,
  HomeStackParamList,
  LessonsStackParamList,
  ProfileStackParamList,
  RootStackParamList,
  RootTabParamList,
} from './types';

export type {
  CoursesStackParamList,
  HomeStackParamList,
  LessonsStackParamList,
  ProfileStackParamList,
  RootStackParamList,
  RootTabParamList,
} from './types';

const HomeStack = createNativeStackNavigator<HomeStackParamList>();
const CoursesStack = createNativeStackNavigator<CoursesStackParamList>();
const LessonsStack = createNativeStackNavigator<LessonsStackParamList>();
const ProfileStack = createNativeStackNavigator<ProfileStackParamList>();
const Tab = createBottomTabNavigator<RootTabParamList>();
const RootStack = createNativeStackNavigator<RootStackParamList>();

const HIDDEN_HEADER = {headerShown: false} as const;

/*
 * Navigation layout (one registration per screen):
 *
 *   RootStack
 *   ├─ Tabs            each tab holds only its hub screen
 *   │  ├─ Home         HomeMain
 *   │  ├─ Courses      CourseList
 *   │  ├─ Lessons      LessonsList
 *   │  └─ Profile      ProfileMain + settings pages
 *   └─ task flows      cover the tab bar; back returns to the opening tab
 *      CreateHub, PasteText, ImageCapture, OCRReview, LessonCreation,
 *      CanonicalCatalog, CanonicalLessonPlayer, CourseLevels,
 *      LevelUnits, UnitLessons, DailyReview, Practice, Today, SpeakingRoom,
 *      ShadowingLessonPicker, ShadowingSession, ShadowingSummary
 *
 * Features navigate through `useAppNavigation()` (see
 * `appNavigationAdapter.ts`), never by reaching into a parent navigator.
 */

function HomeStackNavigator() {
  return (
    <HomeStack.Navigator>
      <HomeStack.Screen
        component={HomeScreen}
        name="HomeMain"
        options={HIDDEN_HEADER}
      />
    </HomeStack.Navigator>
  );
}

function CoursesStackNavigator() {
  return (
    <CoursesStack.Navigator>
      <CoursesStack.Screen
        component={CourseListScreen}
        name="CourseList"
        options={HIDDEN_HEADER}
      />
    </CoursesStack.Navigator>
  );
}

function LessonsStackNavigator() {
  return (
    <LessonsStack.Navigator>
      <LessonsStack.Screen
        component={LessonsHistoryScreen}
        name="LessonsList"
        options={HIDDEN_HEADER}
      />
      <LessonsStack.Screen
        component={LibraryListScreen}
        name="LibraryList"
        options={HIDDEN_HEADER}
      />
    </LessonsStack.Navigator>
  );
}

function ProfileStackNavigator() {
  return (
    <ProfileStack.Navigator>
      <ProfileStack.Screen
        component={ProfileScreen}
        name="ProfileMain"
        options={HIDDEN_HEADER}
      />
      <ProfileStack.Screen
        component={AccountSettingsScreen}
        name="AccountSettings"
        options={HIDDEN_HEADER}
      />
      <ProfileStack.Screen
        component={DataSettingsScreen}
        name="DataSettings"
        options={HIDDEN_HEADER}
      />
      <ProfileStack.Screen
        component={AppSettingsScreen}
        name="AppSettings"
        options={HIDDEN_HEADER}
      />
      <ProfileStack.Screen
        component={SupportAboutScreen}
        name="SupportAbout"
        options={HIDDEN_HEADER}
      />
      <ProfileStack.Screen
        component={PrivacyNoteScreen}
        name="PrivacyNote"
        options={HIDDEN_HEADER}
      />
      <ProfileStack.Screen
        component={ProgressReportScreen}
        name="ProgressReport"
        options={HIDDEN_HEADER}
      />
      {__DEV__ ? (
        <ProfileStack.Screen
          component={FeatureStatusScreen}
          name="FeatureStatus"
          options={HIDDEN_HEADER}
        />
      ) : null}
      {__DEV__ ? (
        <ProfileStack.Screen
          component={TtsSpikeScreen}
          name="TtsSpike"
          options={HIDDEN_HEADER}
        />
      ) : null}
    </ProfileStack.Navigator>
  );
}

function TabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={HIDDEN_HEADER}
      tabBar={props => <TabBar {...props} />}
    >
      <Tab.Screen
        component={HomeStackNavigator}
        name="Home"
        options={{title: 'Home'}}
      />
      <Tab.Screen
        component={CoursesStackNavigator}
        name="Courses"
        options={{title: 'Courses'}}
      />
      <Tab.Screen
        component={LessonsStackNavigator}
        name="Lessons"
        options={{title: 'Lessons'}}
      />
      <Tab.Screen
        component={ProfileStackNavigator}
        name="Profile"
        options={{title: 'Profile'}}
      />
    </Tab.Navigator>
  );
}

function AuthenticatedRootStack() {
  const {config} = useFeatureFlags();
  const canMount = (route: string) =>
    isIngestionRouteEnabled(route, config.features);

  return (
    <RootStack.Navigator id="RootStack" screenOptions={HIDDEN_HEADER}>
      <RootStack.Screen component={TabNavigator} name="Tabs" />
      {/* Create-lesson flow */}
      <RootStack.Screen component={CreateScreen} name="CreateHub" />
      {canMount('PasteText') && (
        <RootStack.Screen component={PasteTextScreen} name="PasteText" />
      )}
      {canMount('ImageCapture') && (
        <RootStack.Screen component={ImageCaptureScreen} name="ImageCapture" />
      )}
      {canMount('OCRReview') && (
        <RootStack.Screen component={OCRReviewScreen} name="OCRReview" />
      )}
      <RootStack.Screen
        component={LessonCreationScreen}
        name="LessonCreation"
        options={{gestureEnabled: false}}
      />
      {/* Lessons */}
      <RootStack.Screen
        component={CanonicalLessonCatalogScreen}
        name="CanonicalCatalog"
      />
      <RootStack.Screen
        component={CanonicalLessonPlayerScreen}
        name="CanonicalLessonPlayer"
        options={{gestureEnabled: false}}
      />
      {/* Structured curriculum */}
      <RootStack.Screen component={CourseLevelsScreen} name="CourseLevels" />
      <RootStack.Screen component={LevelUnitsScreen} name="LevelUnits" />
      <RootStack.Screen component={UnitLessonsScreen} name="UnitLessons" />
      {/* Practice */}
      <RootStack.Screen component={DailyReviewScreen} name="DailyReview" />
      <RootStack.Screen component={PracticeScreen} name="Practice" />
      <RootStack.Screen component={TodayScreen} name="Today" />
      <RootStack.Screen component={SpeakingRoomScreen} name="SpeakingRoom" />
      <RootStack.Screen
        component={ShadowingLessonPickerScreen}
        name="ShadowingLessonPicker"
      />
      <RootStack.Screen
        component={ShadowingSessionScreen}
        name="ShadowingSession"
      />
      <RootStack.Screen
        component={ShadowingSummaryScreen}
        name="ShadowingSummary"
      />
    </RootStack.Navigator>
  );
}

export function AppNavigator() {
  useFeatureFlags();
  const phase = useAccountStore(state => state.phase);
  const boot = useAccountStore(state => state.boot);
  const appNavigation = useMemo(() => createAppNavigation(navigationRef), []);
  useEffect(() => {
    boot().catch(() => {});
  }, [boot]);

  const gateRoute = accountGateRouteForPhase(phase);
  if (gateRoute !== 'Tabs') {
    return (
      <NavigationContainer>
        <RootStack.Navigator id="RootStack" screenOptions={HIDDEN_HEADER}>
          {gateRoute === 'Onboarding' ? (
            <RootStack.Screen
              component={OnboardingNameScreen}
              name="Onboarding"
            />
          ) : gateRoute === 'AccountSwitch' ? (
            <RootStack.Screen
              component={AccountSwitchGateScreen}
              name="AccountSwitch"
            />
          ) : (
            <RootStack.Screen component={BootGateScreen} name="BootGate" />
          )}
        </RootStack.Navigator>
      </NavigationContainer>
    );
  }
  return (
    <AppNavigationProvider value={appNavigation}>
      <NavigationContainer ref={navigationRef}>
        <AuthenticatedRootStack />
      </NavigationContainer>
    </AppNavigationProvider>
  );
}
