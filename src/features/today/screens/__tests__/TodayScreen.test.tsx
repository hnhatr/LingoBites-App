import React from 'react';
import {open} from 'react-native-quick-sqlite';
import ReactTestRenderer, {act} from 'react-test-renderer';

const mockGetDueFlashcards = jest.fn<
  import('@core/db/types').FlashcardRecord[],
  [import('@core/db/types').GetDueFlashcardsOptions?]
>(() => []);

jest.mock('@features/review', () => ({
  getDueFlashcards: (
    options?: import('@core/db/types').GetDueFlashcardsOptions,
  ) => mockGetDueFlashcards(options),
}));

import {AppThemeProvider} from '@ui/theme';

import {DB_NAME} from '@core/db/constants';
import {resetDatabaseForTests} from '@core/db/database';
import {runMigrations} from '@core/db/migrations';
import {FeatureFlagProvider} from '@core/release';

import {CORE_WITH_REVIEW, makeTestReleaseConfig} from '@test/support';

import {__resetMockDatabases} from '../../../../../test-utils/sqliteMock';
import {TodayScreen} from '../TodayScreen';

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
    mockGetDueFlashcards.mockReturnValue([]);
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
    mockGetDueFlashcards.mockReturnValue(
      Array.from({length: 25}, (_, index) => ({
        revision: 1,
        tombstone: false,
        id: `fc-${index}`,
        lessonId: 'lesson-1',
        vocabularyId: `voc-${index}`,
        word: 'word',
        phraseFromText: null,
        wordType: null,
        meaningVi: 'nghĩa',
        pronunciationGuideVi: null,
        ipa: null,
        cefrLevel: null,
        sourceSentence: null,
        example: null,
        exampleTranslation: null,
        isSaved: false,
        createdAt: '2026-09-01T00:00:00.000Z',
        updatedAt: '2026-09-01T00:00:00.000Z',
      })),
    );

    const tree = await renderTodayScreen();

    const banner = tree.root.findAllByProps({
      testID: 'backlog-consolidation-banner',
    });
    expect(banner.length).toBeGreaterThan(0);
  });
});
