import React, {useEffect} from 'react';
import {NavigationContainer} from '@react-navigation/native';
import {
  BootGateScreen,
  OnboardingNameScreen,
  useAccountStore,
} from '@modules/account';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import type {
  CreateStackParamList,
  HomeStackParamList,
  LessonsStackParamList,
  ProfileStackParamList,
  RootStackParamList,
  RootTabParamList,
} from './types';
import {
  CreateScreen,
  HomeScreen,
  PasteTextScreen,
  ImageCaptureScreen,
} from '@modules/input';
import {OCRReviewScreen} from '@modules/ocr';
import {LessonsHistoryScreen} from '@modules/lesson';
import {PracticeScreen} from '@modules/practice';
import {
  CurriculumLessonScreen,
  UnifiedLessonGenerationScreen,
  UnifiedLessonsPreviewScreen,
} from '@modules/curriculumLesson';
import {DailyReviewScreen} from '@modules/review';
import {TodayScreen} from '@modules/today';
import {
  ContentLessonListScreen,
  ContentLessonDetailScreen,
  ContentLessonRuntimeScreen,
} from '@modules/content';
import {SpeakingRoomScreen, SpeakingShadowingActivity} from '@modules/speaking';
import {
  PrivacyNoteScreen,
  ProgressReportScreen,
  ProfileScreen,
  FeatureStatusScreen,
} from '@modules/settings';
import {TtsSpikeScreen} from '@modules/tts';
import {useFeatureFlags} from '@/release';
import {TabBar} from './TabBar';
import {accountGateRouteForPhase} from './accountGate';
import {getRootStackRouteNames} from './rootStackRoutes';
import {tabBarVisibilityOptions} from './immersiveTabRoutes';
import {isIngestionRouteEnabled} from './ingestionRouteGate';
import {
  YouTubeInputScreen,
  YouTubeHistoryScreen,
  YouTubeProcessingScreen,
  YouTubeLessonRouteScreen,
} from '@modules/youtube';

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
        component={ContentLessonRuntimeScreen}
        name="ContentLessonRuntime"
        options={{headerShown: false, gestureEnabled: false}}
      />
      <HomeStack.Screen
        component={CurriculumLessonScreen}
        name="CurriculumLesson"
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
        component={PracticeScreen}
        name="Practice"
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
      {config.features.youtubeLearning && (
        <>
          <CreateStack.Screen
            component={YouTubeInputScreen}
            name="YouTubeInput"
            options={{headerShown: false, gestureEnabled: false}}
          />
          <CreateStack.Screen
            component={YouTubeProcessingScreen}
            name="YouTubeProcessing"
            options={{headerShown: false, gestureEnabled: false}}
          />
          <CreateStack.Screen
            component={YouTubeLessonRouteScreen}
            name="YouTubeLesson"
            options={{headerShown: false, orientation: 'portrait'}}
          />
        </>
      )}
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
      <CreateStack.Screen
        component={PracticeScreen}
        name="Practice"
        options={{headerShown: false}}
      />
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
        component={CurriculumLessonScreen}
        name="CurriculumLesson"
        options={{headerShown: false, gestureEnabled: false}}
      />
      <LessonsStack.Screen
        component={UnifiedLessonGenerationScreen}
        name="UnifiedLessonGeneration"
        options={{headerShown: false, gestureEnabled: false}}
      />
      <LessonsStack.Screen
        component={ContentLessonListScreen}
        name="ContentLessonList"
        options={{headerShown: false}}
      />
      <LessonsStack.Screen
        component={ContentLessonDetailScreen}
        name="ContentLessonDetail"
        options={{headerShown: false}}
      />
      <LessonsStack.Screen
        component={ContentLessonRuntimeScreen}
        name="ContentLessonRuntime"
        options={{headerShown: false, gestureEnabled: false}}
      />
      <LessonsStack.Screen
        component={SpeakingRoomScreen}
        name="SpeakingRoom"
        options={{headerShown: false}}
      />
      <LessonsStack.Screen
        component={SpeakingShadowingActivity}
        name="SpeakingShadowing"
        options={{headerShown: false}}
      />
      <LessonsStack.Screen
        component={TodayScreen}
        name="Today"
        options={{headerShown: false}}
      />
      <LessonsStack.Screen
        component={PracticeScreen}
        name="Practice"
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
      {__DEV__ ? (
        <ProfileStack.Screen
          component={UnifiedLessonsPreviewScreen}
          name="UnifiedLessonsPreview"
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
  const {config} = useFeatureFlags();
  const rootRouteNames = getRootStackRouteNames(config.features);
  const phase = useAccountStore(state => state.phase);
  const boot = useAccountStore(state => state.boot);
  useEffect(() => {
    void boot();
  }, [boot]);

  if (accountGateRouteForPhase(phase) !== 'Tabs') {
    return (
      <NavigationContainer>
        <RootStack.Navigator
          id="RootStack"
          screenOptions={{headerShown: false}}
        >
          {accountGateRouteForPhase(phase) === 'Onboarding' ? (
            <RootStack.Screen
              component={OnboardingNameScreen}
              name="Onboarding"
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
        {rootRouteNames.includes('YouTubeHistory') && (
          <RootStack.Screen
            component={YouTubeHistoryScreen}
            name="YouTubeHistory"
          />
        )}
        {rootRouteNames.includes('YouTubeLesson') && (
          <RootStack.Screen
            component={YouTubeLessonRouteScreen}
            name="YouTubeLesson"
            options={{headerShown: false, orientation: 'portrait'}}
          />
        )}
        {rootRouteNames.includes('Practice') && (
          <RootStack.Screen component={PracticeScreen} name="Practice" />
        )}
      </RootStack.Navigator>
    </NavigationContainer>
  );
}
