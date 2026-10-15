import React from 'react';
import {TextInput} from 'react-native';
import ReactTestRenderer, {act} from 'react-test-renderer';

import {AppThemeProvider} from '@ui/theme';

import {FeatureFlagProvider} from '@core/release';

import {fetchSituations, submitMoment} from '../../logic/momentClient';
import {SituationInputScreen} from '../SituationInputScreen';

jest.mock('@features/analytics', () => ({trackEvent: jest.fn()}));

jest.mock('@features/lesson/player', () => ({
  dismissCompose: jest.fn(),
  fetchComposeQuota: jest.fn(() =>
    Promise.resolve({ok: true, value: {limit: 1, remaining: 1}}),
  ),
  resumeTrackedMoment: jest.fn(),
  trackMoment: jest.fn(),
}));

jest.mock('../../logic/momentClient', () => ({
  confirmMoment: jest.fn(),
  fetchActiveMoments: jest.fn(() => Promise.resolve({ok: true, value: []})),
  fetchSituations: jest.fn(),
  submitMoment: jest.fn(() =>
    Promise.resolve({ok: true, value: {moment_request_id: 'req-1'}}),
  ),
}));

jest.mock('../../logic/useMomentProgress', () => ({
  useMomentProgress: () => ({status: null, polling: false, resume: jest.fn()}),
}));

const drink = {
  id: '11111111-1111-4111-8111-111111111111',
  code: 'order_drink',
  title_vi: 'Gọi đồ uống',
  title_en: 'Order a drink',
  level_code: 'A1',
  goals: ['travel'],
  interests: ['food'],
};

async function renderScreen() {
  let tree!: ReactTestRenderer.ReactTestRenderer;
  await act(async () => {
    tree = ReactTestRenderer.create(
      <FeatureFlagProvider>
        <AppThemeProvider>
          <SituationInputScreen
            navigation={{goBack: jest.fn()} as never}
            route={{key: 'SituationInput', name: 'SituationInput'} as never}
          />
        </AppThemeProvider>
      </FeatureFlagProvider>,
    );
  });
  return tree;
}

function sendButton(tree: ReactTestRenderer.ReactTestRenderer) {
  return tree.root.find(
    node =>
      node.props.testID === 'moment-send' &&
      typeof node.props.style === 'function',
  );
}

describe('SituationInputScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest
      .mocked(fetchSituations)
      .mockResolvedValue({ok: true, value: [drink]} as never);
  });

  it('fills the box with a tapped suggestion instead of creating at once', async () => {
    const tree = await renderScreen();
    expect(sendButton(tree).props.disabled).toBe(true);

    await act(async () => {
      tree.root
        .find(
          node =>
            node.props.testID === 'situation-order_drink' &&
            typeof node.props.onPress === 'function',
        )
        .props.onPress();
    });

    expect(tree.root.findByType(TextInput).props.value).toBe('Gọi đồ uống');
    expect(submitMoment).not.toHaveBeenCalled();
    expect(sendButton(tree).props.disabled).toBe(false);

    await act(async () => {
      sendButton(tree).props.onPress();
    });
    expect(jest.mocked(submitMoment).mock.calls[0][0]).toMatchObject({
      situation_id: drink.id,
    });
  });

  it('sends the edited text as a typed situation', async () => {
    const tree = await renderScreen();
    await act(async () => {
      tree.root
        .find(
          node =>
            node.props.testID === 'situation-order_drink' &&
            typeof node.props.onPress === 'function',
        )
        .props.onPress();
    });
    await act(async () => {
      tree.root
        .findByType(TextInput)
        .props.onChangeText('Gọi đồ uống ít đường, mang đi');
    });
    await act(async () => {
      sendButton(tree).props.onPress();
    });

    const body = jest.mocked(submitMoment).mock.calls[0][0];
    expect(body).toMatchObject({
      situation_note: 'Gọi đồ uống ít đường, mang đi',
    });
    expect(body).not.toHaveProperty('situation_id');
  });
});
