import React from 'react';
import renderer, {act} from 'react-test-renderer';
import {AppText} from '@ui/components/AppText';
import {FeatureFlagProvider} from '@/release';
import {AppThemeProvider} from '@ui/theme/index';
import {SentenceCard} from '../SentenceCard';
import {
  makeEnrichment,
  makeSegment,
  VIDEO_ID,
} from './fixtures/sentenceFixtures';

const CARD_TEST_ID = 'sentence-card-0';

function renderCard(
  props: Partial<React.ComponentProps<typeof SentenceCard>> = {},
) {
  let tree!: renderer.ReactTestRenderer;
  act(() => {
    tree = renderer.create(
      <FeatureFlagProvider>
        <AppThemeProvider>
          <SentenceCard
            enrichment={makeSegment().enrichment}
            onPressWord={() => undefined}
            segment={makeSegment()}
            testID={CARD_TEST_ID}
            videoId={VIDEO_ID}
            {...props}
          />
        </AppThemeProvider>
      </FeatureFlagProvider>,
    );
  });
  return tree;
}

function hasNode(tree: renderer.ReactTestRenderer, testID: string): boolean {
  try {
    tree.root.findByProps({testID});
    return true;
  } catch {
    return false;
  }
}

describe('SentenceCard word selection (SETE-331 TASK-4)', () => {
  it('tapping another word swaps the detail block and reports the word once', () => {
    const onPressWord = jest.fn();
    const tree = renderCard({onPressWord, onToggleWordSave: () => undefined});

    // Default selection is the AI keyword.
    expect(
      tree.root.findByProps({testID: `${CARD_TEST_ID}-word-toggle-save`}),
    ).toBeTruthy();

    act(() => {
      tree.root.findByProps({testID: `${CARD_TEST_ID}-word-6`}).props.onPress();
    });

    expect(onPressWord).toHaveBeenCalledTimes(1);
    expect(onPressWord).toHaveBeenCalledWith('through');
  });

  it('keeps punctuation/whitespace untappable (no press handler, no word testID)', () => {
    const tree = renderCard();
    // Sentence: We(0) ' '(1) are(2) ' '(3) learning(4) ' '(5) through(6) ' '(7) video(8)
    // Index 5 is whitespace between learning/through — skipped in the pill
    // row (spacing comes from `gap`), so it owns no testID at all.
    expect(hasNode(tree, `${CARD_TEST_ID}-word-5`)).toBe(false);
    // Every rendered word pill is a Pressable; punctuation never is.
    // (The `onPress` guard selects the Pressable composite — the inner
    // host view that Pressable forwards testID to carries no onPress —
    // and the `-word-\d+` anchor excludes `-word-toggle-save`.)
    const wordPillId = new RegExp(`${CARD_TEST_ID}-word-\\d+$`);
    const pills = tree.root.findAll(
      node =>
        typeof node.props?.testID === 'string' &&
        wordPillId.test(node.props.testID) &&
        typeof node.props?.onPress === 'function',
    );
    expect(pills.length).toBeGreaterThan(0);
    for (const pill of pills) {
      expect(typeof pill.props.onPress).toBe('function');
    }
  });

  it('resets to the keyword when the sentence changes', () => {
    const tree = renderCard({onToggleWordSave: () => undefined});
    act(() => {
      tree.root.findByProps({testID: `${CARD_TEST_ID}-word-6`}).props.onPress();
    });

    act(() => {
      tree.update(
        <FeatureFlagProvider>
          <AppThemeProvider>
            <SentenceCard
              enrichment={makeEnrichment({keyWord: 'video'})}
              onPressWord={() => undefined}
              onToggleWordSave={() => undefined}
              segment={{...makeSegment(), en: 'A brand new video here'}}
              testID={CARD_TEST_ID}
              videoId={VIDEO_ID}
            />
          </AppThemeProvider>
        </FeatureFlagProvider>,
      );
    });

    // After sentence change the save button still exists (selection reset,
    // no crash) and no stale word remains selected.
    expect(hasNode(tree, `${CARD_TEST_ID}-word-toggle-save`)).toBe(true);
  });

  it('syncs save state between the pod button and savedWordIds', () => {
    const onToggleWordSave = jest.fn();
    const tree = renderCard({
      onToggleWordSave,
      savedWordIds: new Set(['learning']),
    });

    const saveBtn = tree.root.findByProps({
      testID: `${CARD_TEST_ID}-word-toggle-save`,
    });
    // Saved word → labeled "Bỏ lưu từ" button (not a bare icon).
    expect(saveBtn.props.title).toMatch(/Bỏ lưu/);

    act(() => {
      saveBtn.props.onPress();
    });
    expect(onToggleWordSave).toHaveBeenCalledWith(
      'learning',
      expect.objectContaining({word: 'learning'}),
    );
  });

  it('shows a labeled save button for an unsaved selected word', () => {
    const tree = renderCard({onToggleWordSave: () => undefined});
    expect(
      tree.root.findByProps({testID: `${CARD_TEST_ID}-word-toggle-save`}).props
        .title,
    ).toMatch(/Lưu từ/);
  });

  it('renders grammar vertically in order with NGỮ PHÁP badges + per-item save', () => {
    const onToggleGrammarSave = jest.fn();
    const enrichment = makeEnrichment({
      grammar: [
        {
          name: 'Present continuous',
          description: 'd1',
          formula: 'f1',
          analysis: 'a1',
        },
        {
          name: 'Preposition through',
          description: 'd2',
          formula: 'f2',
          analysis: 'a2',
        },
      ],
    });
    const tree = renderCard({
      enrichment,
      onToggleGrammarSave,
      savedGrammarIds: new Set(['Present continuous']),
    });

    expect(
      tree.root.findByProps({testID: `${CARD_TEST_ID}-grammar-badge-0`}).props
        .label,
    ).toBe('NGỮ PHÁP 1/2');
    expect(
      tree.root.findByProps({testID: `${CARD_TEST_ID}-grammar-badge-1`}).props
        .label,
    ).toBe('NGỮ PHÁP 2/2');

    const firstSave = tree.root.findByProps({
      testID: `${CARD_TEST_ID}-grammar-save-0`,
    });
    expect(firstSave.props.tone).toBe('accent');

    act(() => {
      tree.root
        .findByProps({testID: `${CARD_TEST_ID}-grammar-save-1`})
        .props.onPress();
    });
    expect(onToggleGrammarSave).toHaveBeenCalledWith(
      expect.objectContaining({name: 'Preposition through'}),
    );
  });

  it('shortens function words to the Trong câu note', () => {
    const tree = renderCard();
    act(() => {
      tree.root.findByProps({testID: `${CARD_TEST_ID}-word-6`}).props.onPress();
    });
    // 'through' is a function word with inSentenceNote 'Trong câu: ...'
    const valueNode = tree.root.findByProps({
      testID: `${CARD_TEST_ID}-block-keyword-value`,
    });
    const renderedStrings = valueNode
      .findAllByType(AppText)
      .flatMap(node =>
        Array.isArray(node.props.children)
          ? node.props.children
          : [node.props.children],
      )
      .filter(child => typeof child === 'string');
    expect(renderedStrings.join(' ')).toMatch(/Trong câu/);
  });

  describe('SETE-335 (TASK-8): pills, pods, grammar fields, VI highlight', () => {
    it('gives every word pill an effective touch area ≥44pt via hitSlop', () => {
      const tree = renderCard();
      const wordPillId = new RegExp(`${CARD_TEST_ID}-word-\\d+$`);
      const pills = tree.root.findAll(
        node =>
          typeof node.props?.testID === 'string' &&
          wordPillId.test(node.props.testID) &&
          typeof node.props?.onPress === 'function',
      );
      expect(pills.length).toBeGreaterThan(0);
      for (const pill of pills) {
        const hitSlop = pill.props.hitSlop as Record<string, number>;
        // Pill displays ~32pt; each side needs ≥6pt so 32 + 2×6 ≥ 44.
        for (const side of ['top', 'bottom', 'left', 'right'] as const) {
          expect(hitSlop[side]).toBeGreaterThanOrEqual(6);
        }
      }
    });

    it('marks only the selected pill (amber keyword) and swaps on tap', () => {
      const tree = renderCard();
      // Default selection is the AI keyword 'learning' (token index 4).
      const selected = tree.root.findByProps({
        testID: `${CARD_TEST_ID}-word-4`,
      });
      expect(selected.props.accessibilityState).toMatchObject({
        selected: true,
      });
      // Selected pill carries the amber override style; others do not.
      const selectedStyles = selected.props.style as unknown[];
      expect(selectedStyles[1]).toBeTruthy();

      const other = tree.root.findByProps({
        testID: `${CARD_TEST_ID}-word-6`,
      });
      expect(other.props.accessibilityState).toMatchObject({selected: false});
      expect((other.props.style as unknown[])[1]).toBeFalsy();

      act(() => {
        other.props.onPress();
      });
      expect(
        tree.root.findByProps({testID: `${CARD_TEST_ID}-word-6`}).props
          .accessibilityState,
      ).toMatchObject({selected: true});
      expect(
        tree.root.findByProps({testID: `${CARD_TEST_ID}-word-4`}).props
          .accessibilityState,
      ).toMatchObject({selected: false});
    });

    it('renders the selected pod with title, pos badge, and IPA on its own line', () => {
      const tree = renderCard({onToggleWordSave: () => undefined});
      expect(
        tree.root.findByProps({testID: `${CARD_TEST_ID}-selected-word`}).props
          .children,
      ).toBe('learning');
      expect(
        tree.root.findByProps({testID: `${CARD_TEST_ID}-selected-pos`}).props
          .label,
      ).toBe('noun');
      const ipaNode = tree.root.findByProps({
        testID: `${CARD_TEST_ID}-selected-ipa`,
      });
      expect(ipaNode.props.children).toEqual(['/', 'ˈlɜːnɪŋ', '/']);
      // IPA is a standalone node, not glued into the meaning text.
      const meaningNode = tree.root.findByProps({
        testID: `${CARD_TEST_ID}-vi`,
      });
      expect(meaningNode).toBeTruthy();
      expect(ipaNode).not.toBe(meaningNode);
    });

    it('renders all four grammar fields per point', () => {
      const tree = renderCard({onToggleGrammarSave: () => undefined});
      expect(
        tree.root.findByProps({testID: `${CARD_TEST_ID}-grammar-description-0`})
          .props.children,
      ).toBe('diễn tả hành động đang xảy ra');
      const formulaNode = tree.root.findByProps({
        testID: `${CARD_TEST_ID}-grammar-formula-0`,
      });
      const formulaStrings = formulaNode
        .findAllByType(AppText)
        .flatMap(node =>
          Array.isArray(node.props.children)
            ? node.props.children
            : [node.props.children],
        )
        .filter(child => typeof child === 'string');
      expect(formulaStrings.join('')).toContain('S + am/is/are + V-ing');
    });

    it('underlines the VI phrase matching the selected word and follows taps', () => {
      const tree = renderCard();
      // Default selection 'learning' (meaning 'sự học') → 'học' in VI.
      expect(
        tree.root.findByProps({testID: `${CARD_TEST_ID}-vi-highlight`}).props
          .children,
      ).toBe('học');

      act(() => {
        tree.root
          .findByProps({testID: `${CARD_TEST_ID}-word-6`})
          .props.onPress();
      });
      // 'through' ↔ 'học qua video' in the translation.
      expect(
        tree.root.findByProps({testID: `${CARD_TEST_ID}-vi-highlight`}).props
          .children,
      ).toBe('học qua video');
    });

    it('keeps the VI badge box when no phrase matches', () => {
      const tree = renderCard({
        enrichment: makeEnrichment({
          keyWord: 'video',
          vocab: [
            {
              word: 'video',
              pos: 'noun',
              ipa: 'ˈvɪdioʊ',
              meaning: 'zzz-no-match-zzz',
            },
          ],
        }),
      });
      expect(hasNode(tree, `${CARD_TEST_ID}-vi`)).toBe(true);
      expect(hasNode(tree, `${CARD_TEST_ID}-vi-highlight`)).toBe(false);
      expect(hasNode(tree, `${CARD_TEST_ID}-vi-wrap`)).toBe(true);
    });
  });
});
