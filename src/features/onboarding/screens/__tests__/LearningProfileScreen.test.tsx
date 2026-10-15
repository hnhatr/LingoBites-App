import React from 'react';
import ReactTestRenderer, {act} from 'react-test-renderer';

import {AppThemeProvider} from '@ui/theme';

import {FeatureFlagProvider} from '@core/release';

import {DEFAULT_PROFILE} from '../../logic/profileOptions';
import {useLearnerProfileStore} from '../../logic/useLearnerProfileStore';
import {LearningProfileScreen} from '../LearningProfileScreen';

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({navigate: mockNavigate, goBack: mockGoBack}),
}));

const mounted: ReactTestRenderer.ReactTestRenderer[] = [];

async function render() {
  let renderer!: ReactTestRenderer.ReactTestRenderer;
  await act(async () => {
    renderer = ReactTestRenderer.create(
      <FeatureFlagProvider>
        <AppThemeProvider>
          <LearningProfileScreen />
        </AppThemeProvider>
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
  });
}

function saveButton(renderer: ReactTestRenderer.ReactTestRenderer) {
  return renderer.root.findByProps({testID: 'profile-save'});
}

beforeEach(() => {
  jest.clearAllMocks();
  useLearnerProfileStore.getState().reset();
  useLearnerProfileStore.setState({profile: {...DEFAULT_PROFILE}});
});

afterEach(() => {
  act(() => mounted.splice(0).forEach(renderer => renderer.unmount()));
});

describe('LearningProfileScreen', () => {
  it('does not ask who will learn', async () => {
    const screen = await render();
    const text = JSON.stringify(screen.toJSON());
    expect(text).toContain('Trình độ');
    expect(text).not.toContain('Ai sẽ học?');
  });

  it('enables saving only after a change', async () => {
    const screen = await render();
    expect(saveButton(screen).props.disabled).toBe(true);
    expect(JSON.stringify(screen.toJSON())).toContain('Đã lưu');

    await press(screen, 'profile-minutes-15');

    expect(saveButton(screen).props.disabled).toBe(false);
    expect(JSON.stringify(screen.toJSON())).toContain('Lưu thay đổi');
  });

  it('counts interests and explains the limit of three', async () => {
    const screen = await render();
    await press(screen, 'profile-interests-music');
    await press(screen, 'profile-interests-movies');
    await press(screen, 'profile-interests-games');
    await press(screen, 'profile-interests-reading');

    const text = JSON.stringify(screen.toJSON());
    expect(text).toContain('3/3');
    expect(text).toContain('Đã đủ 3 sở thích');
    expect(useLearnerProfileStore.getState().profile?.interests).toEqual([]);
  });
});
