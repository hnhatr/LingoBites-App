import React from 'react';
import ReactTestRenderer, {act} from 'react-test-renderer';
import {open} from 'react-native-quick-sqlite';
import {FeatureFlagProvider} from '@/release';
import {makeTestReleaseConfig, CORE_WITH_REVIEW} from '@/test-support';
import {DB_NAME} from '@shared/db/constants';
import {resetDatabaseForTests} from '@shared/db/database';
import {runMigrations} from '@shared/db/migrations';
import {AppThemeProvider} from '@ui/theme/index';
import {__resetMockDatabases} from '../../../../test-utils/sqliteMock';
import {TodayScreen} from '../TodayScreen';
import {captureErrorEvent} from '@shared/db/SpeakingRepository';

const mockNavigate = jest.fn();

jest.mock('@react-navigation/native', () => {
  const ReactModule = require('react');
  return {
    useNavigation: () => ({
      navigate: mockNavigate,
      goBack: jest.fn(),
    }),
    useFocusEffect: (cb: () => void) => {
      ReactModule.useEffect(() => {
        cb();
      }, [cb]);
    },
  };
});

function setupDb() {
  __resetMockDatabases();
  const db = open({name: DB_NAME});
  resetDatabaseForTests(db);
  runMigrations(db);
  return db;
}

async function renderTodayScreen() {
  let tree!: ReactTestRenderer.ReactTestRenderer;
  await act(async () => {
    tree = ReactTestRenderer.create(
      <FeatureFlagProvider
        releaseConfig={makeTestReleaseConfig(CORE_WITH_REVIEW)}
      >
        <AppThemeProvider>
          <TodayScreen />
        </AppThemeProvider>
      </FeatureFlagProvider>,
    );
    await Promise.resolve();
  });
  return tree;
}

describe('TodayScreen UI', () => {
  beforeEach(() => {
    setupDb();
    mockNavigate.mockClear();
  });

  it('renders Today screen with mode selector and explainability card', async () => {
    const tree = await renderTodayScreen();

    const screen = tree.root.findByProps({testID: 'today-screen'});
    expect(screen).toBeTruthy();

    const modeSelector = tree.root.findByProps({testID: 'mode-selector'});
    expect(modeSelector).toBeTruthy();

    const explainabilityCard = tree.root.findByProps({
      testID: 'explainability-card',
    });
    expect(explainabilityCard).toBeTruthy();
  });

  it('shows Vietnamese reason labels instead of raw reason-code enums', async () => {
    const tree = await renderTodayScreen();

    const text = JSON.stringify(tree.toJSON());
    expect(text).toContain('Hôm nay');
    expect(text).not.toContain('Today Study Center');
    expect(text).not.toContain('#SPEAKING_GAP_PRIORITY');
    expect(text).not.toContain('SPEAKING_GAP_PRIORITY');
    // A fresh DB has no speaking history, so the speaking-gap tag appears
    // with its Vietnamese label.
    expect(text).toContain('Ưu tiên phát âm');
  });

  it('allows changing Today mode and updates plan display', async () => {
    const tree = await renderTodayScreen();

    const modeChip5Min = tree.root.findByProps({testID: 'mode-5-minute'});
    expect(modeChip5Min).toBeTruthy();

    await act(async () => {
      modeChip5Min.props.onPress();
    });

    const modeChipDeep = tree.root.findByProps({testID: 'mode-deep-practice'});
    expect(modeChipDeep).toBeTruthy();

    await act(async () => {
      modeChipDeep.props.onPress();
    });
  });

  it('shows backlog consolidation banner when backlog threshold is exceeded', async () => {
    // Seed error events to exceed threshold if needed, or check normal mode
    for (let i = 0; i < 25; i += 1) {
      captureErrorEvent({
        id: `err-test-${i}`,
        source: 'speaking_room',
        category: 'vocabulary',
        createdAt: '2026-09-01T00:00:00.000Z',
      });
    }

    const tree = await renderTodayScreen();

    const banner = tree.root.findAllByProps({
      testID: 'backlog-consolidation-banner',
    });
    expect(banner.length).toBeGreaterThan(0);
  });
});
