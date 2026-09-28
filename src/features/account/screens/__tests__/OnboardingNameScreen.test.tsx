import React from 'react';
import {TextInput} from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import {open} from 'react-native-quick-sqlite';
import {FeatureFlagProvider} from '@core/release/index';
import {AppThemeProvider} from '@ui/theme/index';
import {__resetMockDatabases} from '../../../../../test-utils/sqliteMock';
import {DB_NAME} from '@core/db/constants';
import {getDatabase, resetDatabaseForTests} from '@core/db/database';
import {installKeychainVault} from '../../../../test-support/keychainVault';
import {resetBootStateForTests} from '../../logic/accountBootstrap';
import {resetRefreshStateForTests} from '@core/auth/authSession';
import {OnboardingNameScreen} from '../OnboardingNameScreen';
import {
  resetAccountStoreForTests,
  useAccountStore,
} from '../../logic/useAccountStore';

const mockFetch = jest.fn();
global.fetch = mockFetch as unknown as typeof fetch;

function jsonResponse(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: jest.fn().mockResolvedValue(body),
  };
}

function renderScreen() {
  return ReactTestRenderer.create(
    <FeatureFlagProvider>
      <AppThemeProvider>
        <OnboardingNameScreen />
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
  mockFetch.mockReset();
  useAccountStore.setState({
    phase: 'needs-onboarding',
    user: null,
    bootstrapTicket: 'bt_ticket_1',
    bootstrapTicketExpiresAt: new Date(Date.now() + 900_000).toISOString(),
    failureCode: null,
    failureMessage: null,
  });
});

describe('OnboardingNameScreen (SETE-303 / T6)', () => {
  it('asks how to address the user and blocks empty submission', async () => {
    let tree!: ReactTestRenderer.ReactTestRenderer;
    await ReactTestRenderer.act(async () => {
      tree = renderScreen();
    });
    expect(JSON.stringify(tree.toJSON())).toContain('Mình nên gọi bạn là gì?');

    const input = tree.root.findByType(TextInput);
    await ReactTestRenderer.act(async () => {
      input.props.onChangeText('   ');
    });
    const save = tree.root.findByProps({title: 'Tiếp tục'});
    await ReactTestRenderer.act(async () => {
      save.props.onPress();
    });
    expect(mockFetch).not.toHaveBeenCalled();
    expect(JSON.stringify(tree.toJSON())).toContain('Vui lòng nhập tên');
  });

  it('submits the trimmed name through the real signup path', async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse(201, {
        request_id: 'c1',
        status: 'created',
        user: {
          id: '11111111-1111-4111-8111-111111111111',
          public_code: 'LB-AB12CD34',
          display_name: 'Bình',
          phone_e164: null,
          status: 'active',
          created_at: '2026-09-14T00:00:00.000Z',
          updated_at: '2026-09-14T00:00:00.000Z',
        },
        session: {
          session_id: '22222222-2222-4222-8222-222222222222',
          access_token: 'lb_at_access',
          refresh_token: 'lb_rt_refresh',
          access_expires_at: new Date(Date.now() + 3600_000).toISOString(),
          refresh_expires_at: new Date(
            Date.now() + 7 * 86400_000,
          ).toISOString(),
        },
      }),
    );
    let tree!: ReactTestRenderer.ReactTestRenderer;
    await ReactTestRenderer.act(async () => {
      tree = renderScreen();
    });
    const input = tree.root.findByType(TextInput);
    await ReactTestRenderer.act(async () => {
      input.props.onChangeText('  Bình  ');
    });
    const save = tree.root.findByProps({title: 'Tiếp tục'});
    await ReactTestRenderer.act(async () => {
      save.props.onPress();
    });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(init.body as string).display_name).toBe('Bình');
    expect(useAccountStore.getState().phase).toBe('authenticated');
  });

  it('rejects over-long names client-side', async () => {
    let tree!: ReactTestRenderer.ReactTestRenderer;
    await ReactTestRenderer.act(async () => {
      tree = renderScreen();
    });
    const input = tree.root.findByType(TextInput);
    await ReactTestRenderer.act(async () => {
      input.props.onChangeText('a'.repeat(81));
    });
    const save = tree.root.findByProps({title: 'Tiếp tục'});
    await ReactTestRenderer.act(async () => {
      save.props.onPress();
    });
    expect(mockFetch).not.toHaveBeenCalled();
    expect(JSON.stringify(tree.toJSON())).toContain('quá dài');
  });

  it('shows the failure state with a retry affordance', async () => {
    useAccountStore.setState({
      phase: 'failed',
      failureCode: 'SERVER',
      failureMessage: 'Boom.',
    });
    let tree!: ReactTestRenderer.ReactTestRenderer;
    await ReactTestRenderer.act(async () => {
      tree = renderScreen();
    });
    const text = JSON.stringify(tree.toJSON());
    expect(text).toContain('Boom.');
    expect(text).toContain('Thử lại');
  });
});
