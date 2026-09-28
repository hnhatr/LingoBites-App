import React from 'react';
import {TextInput} from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import {FeatureFlagProvider} from '@/release';
import {AppThemeProvider} from '@ui/theme/index';
import {AccountProfileSection} from '../AccountProfileSection';
import {
  resetAccountStoreForTests,
  useAccountStore,
} from '../../logic/useAccountStore';
import * as accountProfile from '../../logic/accountProfile';
import type {AuthUser} from '@shared/auth';

const user: AuthUser = {
  id: '11111111-1111-4111-8111-111111111111',
  public_code: 'LB-AB12CD34',
  display_name: 'An',
  phone_e164: null,
  status: 'active',
  created_at: '2026-09-14T00:00:00.000Z',
  updated_at: '2026-09-14T00:00:00.000Z',
};

function renderSection() {
  return ReactTestRenderer.create(
    <FeatureFlagProvider>
      <AppThemeProvider>
        <AccountProfileSection />
      </AppThemeProvider>
    </FeatureFlagProvider>,
  );
}

beforeEach(() => {
  resetAccountStoreForTests();
  jest.restoreAllMocks();
});

describe('AccountProfileSection (SETE-303 / T6)', () => {
  it('renders nothing before the account hydrates', async () => {
    let tree!: ReactTestRenderer.ReactTestRenderer;
    await ReactTestRenderer.act(async () => {
      tree = renderSection();
    });
    expect(tree.toJSON()).toBeNull();
  });

  it('shows the immutable public code with unverified-lookup phone copy', async () => {
    useAccountStore.setState({phase: 'authenticated', user});
    let tree!: ReactTestRenderer.ReactTestRenderer;
    await ReactTestRenderer.act(async () => {
      tree = renderSection();
    });
    const text = JSON.stringify(tree.toJSON());
    expect(text).toContain('LB-AB12CD34');
    expect(text).toContain('không bao giờ đổi');
    expect(text).toContain('không gửi mã xác minh');
  });

  it('saves display-name and phone edits through the profile client', async () => {
    useAccountStore.setState({phase: 'authenticated', user});
    const spy = jest
      .spyOn(accountProfile, 'updateAccountProfile')
      .mockResolvedValue({
        ok: true,
        user: {...user, display_name: 'Bình', phone_e164: '+84901234567'},
      });
    let tree!: ReactTestRenderer.ReactTestRenderer;
    await ReactTestRenderer.act(async () => {
      tree = renderSection();
    });
    const inputs = tree.root.findAllByType(TextInput);
    await ReactTestRenderer.act(async () => {
      inputs[0].props.onChangeText('Bình');
      inputs[1].props.onChangeText('+84901234567');
    });
    const save = tree.root.findByProps({title: 'Lưu'});
    await ReactTestRenderer.act(async () => {
      save.props.onPress();
      await Promise.resolve();
    });
    expect(spy).toHaveBeenCalledWith({
      displayName: 'Bình',
      phone: '+84901234567',
    });
    expect(useAccountStore.getState().user?.display_name).toBe('Bình');
  });

  it('blocks invalid phone numbers client-side', async () => {
    useAccountStore.setState({phase: 'authenticated', user});
    const spy = jest.spyOn(accountProfile, 'updateAccountProfile');
    let tree!: ReactTestRenderer.ReactTestRenderer;
    await ReactTestRenderer.act(async () => {
      tree = renderSection();
    });
    const inputs = tree.root.findAllByType(TextInput);
    await ReactTestRenderer.act(async () => {
      inputs[1].props.onChangeText('0901234567');
    });
    const save = tree.root.findByProps({title: 'Lưu'});
    await ReactTestRenderer.act(async () => {
      save.props.onPress();
    });
    expect(spy).not.toHaveBeenCalled();
    expect(JSON.stringify(tree.toJSON())).toContain('mã quốc gia');
  });
});
