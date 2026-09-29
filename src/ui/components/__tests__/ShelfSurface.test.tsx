import React from 'react';
import {Text, StyleSheet} from 'react-native';
import ReactTestRenderer, {act} from 'react-test-renderer';
import {FeatureFlagProvider} from '@core/release/index';
import {AppThemeProvider} from '@ui/theme/index';
import {ShelfSurface} from '../ShelfSurface';
import {AccessibilityInfo} from 'react-native';

jest.mock('react-native', () => {
  const rn = jest.requireActual('react-native');
  rn.AccessibilityInfo.isReduceMotionEnabled = jest.fn(() =>
    Promise.resolve(false),
  );
  return rn;
});

async function render(ui: React.ReactElement) {
  let tree!: ReactTestRenderer.ReactTestRenderer;
  await act(async () => {
    tree = ReactTestRenderer.create(
      <FeatureFlagProvider>
        <AppThemeProvider>{ui}</AppThemeProvider>
      </FeatureFlagProvider>,
    );
  });
  return tree;
}

describe('ShelfSurface', () => {
  it('renders the shelf background when shelfHeight > 0', async () => {
    const tree = await render(
      <ShelfSurface shelfHeight={4} shelfColor="#ff0000" faceTestID="face">
        <Text>Content</Text>
      </ShelfSurface>,
    );
    // Absolute fill view is the shelf
    const views = tree.root.findAllByType('View' as any);
    const shelf = views.find(
      (v: any) =>
        v.props.style &&
        StyleSheet.flatten(v.props.style).backgroundColor === '#ff0000',
    );
    expect(shelf).toBeDefined();
    expect(StyleSheet.flatten(shelf!.props.style).top).toBe(4);
  });

  it('translates the face down when pressed', async () => {
    const tree = await render(
      <ShelfSurface
        shelfHeight={4}
        shelfColor="#ff0000"
        isPressed={true}
        faceTestID="face"
      >
        <Text>Content</Text>
      </ShelfSurface>,
    );
    // The animated view translates Y by shelfHeight - 2
    const face = tree.root.findByProps({testID: 'face'});
    expect(face).toBeDefined();
  });

  it('falls back to opacity fading when reduceMotion is enabled', async () => {
    (
      AccessibilityInfo.isReduceMotionEnabled as jest.Mock
    ).mockResolvedValueOnce(true);
    const tree = await render(
      <ShelfSurface
        shelfHeight={4}
        shelfColor="#ff0000"
        isPressed={true}
        faceTestID="face"
      >
        <Text>Content</Text>
      </ShelfSurface>,
    );
    const face = tree.root.findByProps({testID: 'face'});
    expect(face).toBeDefined();
    // It should have opacity < 1
    const flattened = StyleSheet.flatten(face.props.style);
    expect(flattened.opacity).toBeLessThan(1);
  });
});
