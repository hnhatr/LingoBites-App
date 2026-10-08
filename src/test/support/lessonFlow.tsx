import fs from 'node:fs';
import path from 'node:path';

import React from 'react';
import ReactTestRenderer, {act} from 'react-test-renderer';

import {AppThemeProvider} from '@ui/theme';

import {FeatureFlagProvider} from '@core/release';
import {
  type LessonSnapshot,
  LessonSnapshotResponseSchema,
} from '@core/schemas/lesson';

import {makeTestReleaseConfig, THEME_UI_FLAGS} from './index';

/**
 * Test helpers for the six-step lesson player (PR 10).
 */

/** The Server's seed lesson A1-DRINKS-L01 (contract fixture). */
export function seedSnapshot(): LessonSnapshot {
  return LessonSnapshotResponseSchema.parse(
    JSON.parse(
      fs.readFileSync(
        path.join(
          __dirname,
          '../../core/schemas/__tests__/fixtures/valid-lesson-snapshot-with-spec-response.json',
        ),
        'utf8',
      ),
    ),
  ).lesson;
}

export function renderWithTheme(node: React.ReactElement) {
  let tree!: ReactTestRenderer.ReactTestRenderer;
  act(() => {
    tree = ReactTestRenderer.create(
      <FeatureFlagProvider
        releaseConfig={makeTestReleaseConfig(THEME_UI_FLAGS)}
      >
        <AppThemeProvider>{node}</AppThemeProvider>
      </FeatureFlagProvider>,
    );
  });
  return tree;
}

export function byTestId(
  tree: ReactTestRenderer.ReactTestRenderer,
  testID: string,
) {
  return tree.root.findAll(node => node.props.testID === testID);
}

export function has(tree: ReactTestRenderer.ReactTestRenderer, testID: string) {
  return byTestId(tree, testID).length > 0;
}

export function press(
  tree: ReactTestRenderer.ReactTestRenderer,
  testID: string,
) {
  const node = byTestId(tree, testID).find(
    candidate => typeof candidate.props.onPress === 'function',
  );
  if (!node) throw new Error(`No pressable found for ${testID}`);
  act(() => {
    node.props.onPress();
  });
}

export function textOf(
  tree: ReactTestRenderer.ReactTestRenderer,
  testID: string,
): string {
  const node = byTestId(tree, testID)[0];
  if (!node) throw new Error(`No node for ${testID}`);
  const parts: string[] = [];
  const walk = (value: unknown) => {
    if (typeof value === 'string' || typeof value === 'number') {
      parts.push(String(value));
    } else if (Array.isArray(value)) {
      value.forEach(walk);
    } else if (value && typeof value === 'object' && 'props' in value) {
      walk((value as {props: {children?: unknown}}).props.children);
    }
  };
  walk(node.props.children);
  return parts.join('');
}
