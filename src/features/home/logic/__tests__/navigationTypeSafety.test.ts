import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import type {HomeStackParamList} from '../../screens/navigationTypes';
import type {ProfileStackParamList} from '@features/profile';

type HomeNav = NativeStackNavigationProp<HomeStackParamList, 'HomeMain'>;
type ProfileNav = NativeStackNavigationProp<
  ProfileStackParamList,
  'ProfileMain'
>;

function assertHomeNavigationTypeSafety(nav: HomeNav) {
  nav.navigate('ContentLessonRuntime', {lessonId: 'lesson-1'});
  nav.navigate('CurriculumLesson', {lessonId: 'lesson-2'});
  // @ts-expect-error invalid route name must fail typecheck (ADV-F01 / CR-001)
  nav.navigate('ProfileZ');
  // @ts-expect-error invalid payload shape must fail typecheck
  nav.navigate('CurriculumLesson', {lessonId: 123});
}

function assertProfileNavigationTypeSafety(nav: ProfileNav) {
  nav.navigate('ProgressReport');
  nav.navigate('PrivacyNote');
  // @ts-expect-error invalid route name must fail typecheck
  nav.navigate('ProgressReportZ');
}

describe('navigation type safety regression', () => {
  it('documents compile-time guards via @ts-expect-error probes', () => {
    expect(assertHomeNavigationTypeSafety).toBeDefined();
    expect(assertProfileNavigationTypeSafety).toBeDefined();
  });
});
