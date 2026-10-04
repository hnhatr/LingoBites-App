import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import {NavigationContainer} from '@react-navigation/native';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import React, {useEffect} from 'react';

import {
  AccountSwitchGateScreen,
  BootGateScreen,
  OnboardingNameScreen,
  useAccountStore,
} from '@features/account';
import {TtsSpikeScreen} from '@features/audio';
import {HomeScreen} from '@features/home';
import {
  CreateScreen,
  ImageCaptureScreen,
  PasteTextScreen,
} from '@features/input';
import {LessonsHistoryScreen} from '@features/lesson/library';
import {
  CanonicalLessonCatalogScreen,
  CanonicalLessonPlayerScreen,
  LessonCreationScreen,
} from '@features/lesson/player';
import {OCRReviewScreen} from '@features/ocr';
import {
  FeatureStatusScreen,
  PrivacyNoteScreen,
  ProfileScreen,
  ProgressReportScreen,
} from '@features/profile';
import {DailyReviewScreen} from '@features/review';
import {
  ShadowingSessionScreen,
  SpeakingRoomScreen,
} from '@features/speaking/screens/speakingUiPort';
import {TodayScreen} from '@features/today';

import {useFeatureFlags} from '@core/release';

import {accountGateRouteForPhase} from './accountGate';
import {tabBarVisibilityOptions} from './immersiveTabRoutes';
import {isIngestionRouteEnabled} from './ingestionRouteGate';
import {TabBar} from './TabBar';
import type {
  CreateStackParamList,
  HomeStackParamList,
  LessonsStackParamList,
  ProfileStackParamList,
  RootStackParamList,
  RootTabParamList,
} from './types';

const HomeStack = createNativeStackNavigator<HomeStackParamList>();
const CreateStack = createNativeStackNavigator<CreateStackParamList>();
const LessonsStack = createNativeStackNavigator<LessonsStackParamList>();
const ProfileStack = createNativeStackNavigator<ProfileStackParamList>();
const Tab = createBottomTabNavigator<RootTabParamList>();
const RootStack = createNativeStackNavigator<RootStackParamList>();

function HomeStackNavigator() {
  return (
    <HomeStack.Navigator>
      <HomeStack.Screen
        component={HomeScreen}
        name="HomeMain"
        options={{headerShown: false}}
      />
      <HomeStack.Screen
        component={CanonicalLessonCatalogScreen}
        name="CanonicalCatalog"
        options={{headerShown: false}}
      />
      <HomeStack.Screen
        component={CanonicalLessonPlayerScreen}
        name="CanonicalLessonPlayer"
        options={{headerShown: false, gestureEnabled: false}}
      />
      <HomeStack.Screen
        component={DailyReviewScreen}
        name="DailyReview"
        options={{headerShown: false}}
      />
      <HomeStack.Screen
        component={TodayScreen}
        name="Today"
        options={{headerShown: false}}
      />
      <HomeStack.Screen
        component={SpeakingRoomScreen}
        name="SpeakingRoom"
        options={{headerShown: false}}
      />
    </HomeStack.Navigator>
  );
}

function CreateStackNavigator() {
  const {config} = useFeatureFlags();
  const canMount = (route: string) =>
    isIngestionRouteEnabled(route, config.features);

  return (
    <CreateStack.Navigator>
      <CreateStack.Screen
        component={CreateScreen}
        name="CreateMain"
        options={{headerShown: false}}
      />
      {canMount('PasteText') && (
        <CreateStack.Screen
          component={PasteTextScreen}
          name="PasteText"
          options={{headerShown: false}}
        />
      )}
      {canMount('ImageCapture') && (
        <CreateStack.Screen
          component={ImageCaptureScreen}
          name="ImageCapture"
          options={{headerShown: false}}
        />
      )}
      {canMount('OCRReview') && (
        <CreateStack.Screen
          component={OCRReviewScreen}
          name="OCRReview"
          options={{headerShown: false}}
        />
      )}
    </CreateStack.Navigator>
  );
}

function LessonsStackNavigator() {
  return (
    <LessonsStack.Navigator>
      <LessonsStack.Screen
        component={LessonsHistoryScreen}
        name="LessonsList"
        options={{headerShown: false}}
      />
      <LessonsStack.Screen
        component={CanonicalLessonCatalogScreen}
        name="CanonicalCatalog"
        options={{headerShown: false}}
      />
      <LessonsStack.Screen
        component={CanonicalLessonPlayerScreen}
        name="CanonicalLessonPlayer"
        options={{headerShown: false, gestureEnabled: false}}
      />
      <LessonsStack.Screen
        component={LessonCreationScreen}
        name="LessonCreation"
        options={{headerShown: false, gestureEnabled: false}}
      />
      <LessonsStack.Screen
        component={SpeakingRoomScreen}
        name="SpeakingRoom"
        options={{headerShown: false}}
      />
      <LessonsStack.Screen
        component={ShadowingSessionScreen}
        name="ShadowingSession"
        options={{headerShown: false}}
      />
      <LessonsStack.Screen
        component={TodayScreen}
        name="Today"
        options={{headerShown: false}}
      />
      <LessonsStack.Screen
        component={DailyReviewScreen}
        name="DailyReview"
        options={{headerShown: false}}
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
        options={{headerShown: false}}
      />
      <ProfileStack.Screen
        component={PrivacyNoteScreen}
        name="PrivacyNote"
        options={{headerShown: false}}
      />
      <ProfileStack.Screen
        component={ProgressReportScreen}
        name="ProgressReport"
        options={{headerShown: false}}
      />
      {__DEV__ ? (
        <ProfileStack.Screen
          component={FeatureStatusScreen}
          name="FeatureStatus"
          options={{headerShown: false}}
        />
      ) : null}
      {__DEV__ ? (
        <ProfileStack.Screen
          component={TtsSpikeScreen}
          name="TtsSpike"
          options={{headerShown: false}}
        />
      ) : null}
    </ProfileStack.Navigator>
  );
}

function TabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{headerShown: false}}
      tabBar={props => <TabBar {...props} />}
    >
      <Tab.Screen
        component={HomeStackNavigator}
        name="Home"
        options={({route}) => ({
          title: 'Home',
          ...tabBarVisibilityOptions({route}),
        })}
      />
      <Tab.Screen
        component={CreateStackNavigator}
        name="Create"
        options={({route}) => ({
          title: 'Create',
          ...tabBarVisibilityOptions({route}),
        })}
      />
      <Tab.Screen
        component={LessonsStackNavigator}
        name="Lessons"
        options={({route}) => ({
          title: 'Lessons',
          ...tabBarVisibilityOptions({route}),
        })}
      />
      <Tab.Screen
        component={ProfileStackNavigator}
        name="Profile"
        options={({route}) => ({
          title: 'Profile',
          ...tabBarVisibilityOptions({route}),
        })}
      />
    </Tab.Navigator>
  );
}

export function AppNavigator() {
  useFeatureFlags();
  const phase = useAccountStore(state => state.phase);
  const boot = useAccountStore(state => state.boot);
  useEffect(() => {
    boot().catch(() => {});
  }, [boot]);

  const gateRoute = accountGateRouteForPhase(phase);
  if (gateRoute !== 'Tabs') {
    return (
      <NavigationContainer>
        <RootStack.Navigator
          id="RootStack"
          screenOptions={{headerShown: false}}
        >
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
    <NavigationContainer>
      <RootStack.Navigator id="RootStack" screenOptions={{headerShown: false}}>
        <RootStack.Screen component={TabNavigator} name="Tabs" />
      </RootStack.Navigator>
    </NavigationContainer>
  );
}
