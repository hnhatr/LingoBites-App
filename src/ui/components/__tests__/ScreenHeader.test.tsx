import React from 'react';
import {Text} from 'react-native';
import ReactTestRenderer, {act} from 'react-test-renderer';

import {AppThemeProvider} from '@ui/theme';

import {FeatureFlagProvider} from '@core/release';

import {ScreenHeader} from '../ScreenHeader';

async function renderHeader(
  title: string,
  props?: Partial<React.ComponentProps<typeof ScreenHeader>>,
) {
  let tree!: ReactTestRenderer.ReactTestRenderer;
  await act(async () => {
    tree = ReactTestRenderer.create(
      <FeatureFlagProvider>
        <AppThemeProvider>
          <ScreenHeader onBack={() => {}} title={title} {...props} />
        </AppThemeProvider>
      </FeatureFlagProvider>,
    );
  });
  return tree;
}

describe('ScreenHeader', () => {
  it('allows lesson titles to scale and wrap at large text sizes', async () => {
    const tree = await renderHeader(
      'Bài học tiếng Anh với tiêu đề rất dài để kiểm tra Dynamic Type',
    );

    const title = tree.root.findAll(
      node =>
        node.type === Text &&
        typeof node.props.children === 'string' &&
        node.props.children.includes('Bài học tiếng Anh'),
    )[0];

    expect(title.props.numberOfLines).toBe(2);
    expect(title.props.adjustsFontSizeToFit).toBe(true);
    expect(title.props.minimumFontScale).toBe(0.85);
    expect(title.props.maxFontSizeMultiplier).toBe(1.5);
  });

  it('allows overriding titleNumberOfLines to a single line', async () => {
    const tree = await renderHeader('Bài học tiếng Anh với tiêu đề rất dài', {
      titleNumberOfLines: 1,
    });

    const title = tree.root.findAll(
      node =>
        node.type === Text &&
        typeof node.props.children === 'string' &&
        node.props.children.includes('Bài học tiếng Anh'),
    )[0];

    expect(title.props.numberOfLines).toBe(1);
    expect(title.props.adjustsFontSizeToFit).toBe(false);
    expect(title.props.minimumFontScale).toBeUndefined();
  });

  it('disables font shrink for single line via numberOfLines', async () => {
    const tree = await renderHeader('Bài học tiếng Anh với tiêu đề rất dài', {
      numberOfLines: 1,
    });

    const title = tree.root.findAll(
      node =>
        node.type === Text &&
        typeof node.props.children === 'string' &&
        node.props.children.includes('Bài học tiếng Anh'),
    )[0];

    expect(title.props.numberOfLines).toBe(1);
    expect(title.props.adjustsFontSizeToFit).toBe(false);
    expect(title.props.minimumFontScale).toBeUndefined();
  });

  it('allows overriding line count via numberOfLines', async () => {
    const tree = await renderHeader('Bài học tiếng Anh với tiêu đề rất dài', {
      numberOfLines: 3,
    });

    const title = tree.root.findAll(
      node =>
        node.type === Text &&
        typeof node.props.children === 'string' &&
        node.props.children.includes('Bài học tiếng Anh'),
    )[0];

    expect(title.props.numberOfLines).toBe(3);
  });

  it('uses a flexible header height instead of a fixed 56px cap', async () => {
    const tree = await renderHeader('Ngắn');

    const {StyleSheet} = require('react-native');
    const headerStyle = StyleSheet.flatten(
      tree.root.findByProps({testID: 'screen-header'}).props.style,
    );
    expect(headerStyle.minHeight).toBe(56);
    expect(headerStyle.height).toBeUndefined();
  });
});
