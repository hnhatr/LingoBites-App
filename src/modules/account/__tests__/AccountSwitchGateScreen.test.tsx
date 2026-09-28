import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import {open} from 'react-native-quick-sqlite';
import {FeatureFlagProvider} from '@/release';
import {AppThemeProvider} from '@theme';
import {__resetMockDatabases} from '../../../../test-utils/sqliteMock';
import {DB_NAME} from '../../../shared/db/constants';
import {getDatabase, resetDatabaseForTests} from '../../../shared/db/database';
import {resetBootStateForTests} from '../../../shared/auth/accountBootstrap';
import {resetRefreshStateForTests} from '../../../shared/auth/authSession';
import {installKeychainVault} from '../../../test-support/keychainVault';
import type {AuthUser} from '../../../shared/auth/authTypes';
import {AccountSwitchGateScreen} from '../AccountSwitchGateScreen';
import {resetAccountStoreForTests, useAccountStore} from '../useAccountStore';

const userA: AuthUser = {
  id: '11111111-1111-4111-8111-111111111111',
  public_code: 'LB-AAAA',
  display_name: 'User A',
  phone_e164: null,
  status: 'active',
  created_at: '2026-09-27T00:00:00.000Z',
  updated_at: '2026-09-27T00:00:00.000Z',
};

const userB: AuthUser = {
  id: '22222222-2222-4222-8222-222222222222',
  public_code: 'LB-BBBB',
  display_name: 'User B',
  phone_e164: null,
  status: 'active',
  created_at: '2026-09-27T00:00:00.000Z',
  updated_at: '2026-09-27T00:00:00.000Z',
};

function renderScreen() {
  return ReactTestRenderer.create(
    <FeatureFlagProvider>
      <AppThemeProvider>
        <AccountSwitchGateScreen />
      </AppThemeProvider>
    </FeatureFlagProvider>,
  );
}

beforeEach(() => {
  __resetMockDatabases();
  resetDatabaseForTests(open({name: DB_NAME}));
  getDatabase();
  installKeychainVault();
  resetBootStateForTests();
  resetRefreshStateForTests();
  resetAccountStoreForTests();
});

describe('AccountSwitchGateScreen (FR-011 / i18n + a11y)', () => {
  it('renders loss warning with confirm/cancel labels and hints', async () => {
    let tree!: ReactTestRenderer.ReactTestRenderer;
    await ReactTestRenderer.act(async () => {
      useAccountStore.setState({
        phase: 'switch-confirmation',
        switchContext: {
          attemptId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
          sourceAccountId: userA.id,
          targetAccountId: userB.id,
          sourceUser: userA,
          targetUser: userB,
          needsRetry: false,
        },
      });
      tree = renderScreen();
    });

    const json = JSON.stringify(tree.toJSON());
    expect(json).toContain('Đổi tài khoản?');
    expect(json).toContain('User B');
    tree.root.findByProps({accessibilityLabel: 'Đổi tài khoản'});
    tree.root.findByProps({accessibilityLabel: 'Giữ tài khoản hiện tại'});
    tree.root.findByProps({
      accessibilityHint:
        'Xác nhận đổi sang tài khoản mới và xóa dữ liệu trên máy',
    });
  });

  it('renders switching spinner copy', async () => {
    let tree!: ReactTestRenderer.ReactTestRenderer;
    await ReactTestRenderer.act(async () => {
      useAccountStore.setState({phase: 'switching', switchContext: null});
      tree = renderScreen();
    });
    expect(JSON.stringify(tree.toJSON())).toContain('Đang đổi tài khoản');
  });
});
