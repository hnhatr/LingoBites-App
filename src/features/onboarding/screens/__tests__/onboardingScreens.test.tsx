import React from 'react';
import ReactTestRenderer, {act} from 'react-test-renderer';

import {AppThemeProvider} from '@ui/theme';

import {resetDatabaseForTests} from '@core/db/database';
import {runMigrations} from '@core/db/migrations';
import {FeatureFlagProvider} from '@core/release';

import {openRealSqlite} from '@test/support/adversarial/realSqlite';

import {
  fetchLearnerProfile,
  fetchPlacementTest,
  putLearnerProfile,
  submitPlacement,
} from '../../logic/learnerProfileClient';
import {DEFAULT_PROFILE} from '../../logic/profileOptions';
import {useLearnerProfileStore} from '../../logic/useLearnerProfileStore';
import {LearnerOnboardingScreen} from '../LearnerOnboardingScreen';
import {PlacementResultScreen} from '../PlacementResultScreen';
import {PlacementTestScreen} from '../PlacementTestScreen';

const mockNavigate = jest.fn();
const mockReplace = jest.fn();
const mockGoBack = jest.fn();

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    navigate: mockNavigate,
    replace: mockReplace,
    goBack: mockGoBack,
  }),
}));

jest.mock('@features/audio', () => ({speak: jest.fn(() => Promise.resolve())}));

jest.mock('../../logic/learnerProfileClient', () => ({
  fetchLearnerProfile: jest.fn(),
  putLearnerProfile: jest.fn(),
  fetchPlacementTest: jest.fn(),
  submitPlacement: jest.fn(),
}));

const mocked = <T extends (...args: never[]) => unknown>(fn: T) =>
  fn as unknown as jest.MockedFunction<T>;

const mounted: ReactTestRenderer.ReactTestRenderer[] = [];

async function render(element: React.ReactElement) {
  let renderer!: ReactTestRenderer.ReactTestRenderer;
  await act(async () => {
    renderer = ReactTestRenderer.create(
      <FeatureFlagProvider>
        <AppThemeProvider>{element}</AppThemeProvider>
      </FeatureFlagProvider>,
    );
  });
  mounted.push(renderer);
  return renderer;
}

async function press(
  renderer: ReactTestRenderer.ReactTestRenderer,
  id: string,
) {
  await act(async () => {
    renderer.root.findByProps({testID: id}).props.onPress();
    // Handlers start promises they do not return; let them settle.
    await new Promise(resolve => setTimeout(resolve, 0));
  });
}

beforeEach(async () => {
  const db = openRealSqlite(':memory:');
  runMigrations(db);
  resetDatabaseForTests(db);
  jest.clearAllMocks();
  useLearnerProfileStore.getState().reset();
  mocked(fetchLearnerProfile).mockResolvedValue({ok: true, value: null});
  mocked(putLearnerProfile).mockResolvedValue({
    ok: false,
    kind: 'network-error',
  });
  await useLearnerProfileStore.getState().load('u1');
});

afterEach(() => {
  // Mounted screens listen to the store; later tests must not re-render them.
  act(() => mounted.splice(0).forEach(renderer => renderer.unmount()));
  resetDatabaseForTests(null);
});

describe('LearnerOnboardingScreen', () => {
  it('"Để sau" keeps the defaults and ends onboarding', async () => {
    const screen = await render(<LearnerOnboardingScreen />);
    await press(screen, 'onboarding-later');
    expect(useLearnerProfileStore.getState()).toMatchObject({
      status: 'ready',
      profile: DEFAULT_PROFILE,
    });
  });

  it('walks the steps and skips the test to start at A1', async () => {
    const screen = await render(<LearnerOnboardingScreen />);
    await press(screen, 'onboarding-age-kids');
    await press(screen, 'onboarding-next');
    await press(screen, 'onboarding-goals-school');
    await press(screen, 'onboarding-next');
    await press(screen, 'onboarding-interests-games');
    await press(screen, 'onboarding-next');
    await press(screen, 'onboarding-minutes-5');
    await press(screen, 'onboarding-next');
    await press(screen, 'onboarding-skip-test');
    expect(useLearnerProfileStore.getState()).toMatchObject({
      status: 'ready',
      profile: {
        ageGroup: 'kids',
        levelCode: 'A1',
        goals: ['communication', 'school'],
        interests: ['games'],
        dailyMinutes: 5,
      },
    });
  });

  it('saves the answers, then opens the placement test without leaving onboarding', async () => {
    const screen = await render(<LearnerOnboardingScreen />);
    for (let step = 0; step < 4; step += 1) {
      await press(screen, 'onboarding-next');
    }
    await press(screen, 'onboarding-take-test');
    expect(useLearnerProfileStore.getState().status).toBe('needed');
    expect(useLearnerProfileStore.getState().profile).toEqual(DEFAULT_PROFILE);
    expect(mockNavigate).toHaveBeenCalledWith('PlacementTest', {
      mode: 'onboarding',
    });
  });
});

describe('PlacementTestScreen', () => {
  const questions = [
    {
      id: 'q1',
      level: 'A1',
      prompt_vi: 'Chọn câu trả lời',
      prompt_en: 'Where are you from?',
      options: [
        {id: 'a', text: "I'm from Vietnam."},
        {id: 'b', text: "I'm fine."},
      ],
    },
    {
      id: 'q2',
      level: 'A2',
      prompt_vi: 'Chọn câu trả lời',
      prompt_en: 'Are you free on Saturday?',
      options: [
        {id: 'a', text: 'Yes, I am.'},
        {id: 'b', text: 'Yes, it is free.'},
      ],
    },
  ];

  it('asks every question, sends the answers and shows the suggestion', async () => {
    mocked(fetchPlacementTest).mockResolvedValue({ok: true, value: questions});
    mocked(submitPlacement).mockResolvedValue({
      ok: true,
      value: {
        suggested_level: 'A1',
        score: {a1: 1, a2: 0, total: 1, max: 2},
        saved: true,
      },
    });
    const screen = await render(
      <PlacementTestScreen route={{params: {mode: 'onboarding'}}} />,
    );
    expect(
      screen.root.findByProps({testID: 'placement-next'}).props.disabled,
    ).toBe(true);
    await press(screen, 'placement-option-a');
    await press(screen, 'placement-next');
    await press(screen, 'placement-option-b');
    await press(screen, 'placement-next');
    expect(submitPlacement).toHaveBeenCalledWith([
      {questionId: 'q1', optionId: 'a'},
      {questionId: 'q2', optionId: 'b'},
    ]);
    expect(mockReplace).toHaveBeenCalledWith('PlacementResult', {
      mode: 'onboarding',
      suggestedLevel: 'A1',
      total: 1,
      max: 2,
    });
  });

  it('without the test, onboarding starts at A1', async () => {
    mocked(fetchPlacementTest).mockResolvedValue({
      ok: false,
      kind: 'network-error',
    });
    await useLearnerProfileStore
      .getState()
      .save({...DEFAULT_PROFILE, ageGroup: 'kids'});
    const screen = await render(
      <PlacementTestScreen route={{params: {mode: 'onboarding'}}} />,
    );
    await press(screen, 'placement-leave');
    expect(useLearnerProfileStore.getState()).toMatchObject({
      status: 'ready',
      profile: {ageGroup: 'kids', levelCode: 'A1'},
    });
  });
});

describe('PlacementResultScreen', () => {
  it('starts the suggested level, or the other one', async () => {
    await useLearnerProfileStore.getState().save(DEFAULT_PROFILE);
    const params = {
      mode: 'onboarding' as const,
      suggestedLevel: 'A2' as const,
      total: 11,
      max: 12,
    };
    const screen = await render(<PlacementResultScreen route={{params}} />);
    await press(screen, 'placement-accept');
    expect(useLearnerProfileStore.getState()).toMatchObject({
      status: 'ready',
      profile: {levelCode: 'A2'},
    });

    const again = await render(
      <PlacementResultScreen route={{params: {...params, mode: 'settings'}}} />,
    );
    await press(again, 'placement-other');
    expect(useLearnerProfileStore.getState().profile?.levelCode).toBe('A1');
    expect(mockGoBack).toHaveBeenCalled();
  });
});
