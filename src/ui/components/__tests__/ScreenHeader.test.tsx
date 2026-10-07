import React from 'react';
import {StyleSheet, View} from 'react-native';
import ReactTestRenderer, {act} from 'react-test-renderer';

import {AppThemeProvider} from '@ui/theme';

import {FeatureFlagProvider} from '@core/release';

import {
  HEADER_BUTTON_SIZE,
  HEADER_ICON_SIZE,
  HeaderIconButton,
} from '../HeaderIconButton';
import {MaterialIcon} from '../MaterialIcon';
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

function findHostByTestID(
  tree: ReactTestRenderer.ReactTestRenderer,
  testID: string,
) {
  return tree.root.findAll(
    node => typeof node.type === 'string' && node.props.testID === testID,
  )[0];
}

describe('ScreenHeader', () => {
  it('renders the title on one line without shrinking the font', async () => {
    const tree = await renderHeader(
      'Bài học tiếng Anh với tiêu đề rất dài để kiểm tra Dynamic Type',
    );

    const title = findHostByTestID(tree, 'screen-header-title');
    expect(title.props.numberOfLines).toBe(1);
    expect(title.props.adjustsFontSizeToFit).toBeFalsy();
    expect(title.props.maxFontSizeMultiplier).toBe(1.5);
    expect(StyleSheet.flatten(title.props.style).fontSize).toBe(18);
  });

  it('renders the back button as a standard header button', async () => {
    const onBack = jest.fn();
    const tree = await renderHeader('Ngắn', {onBack});

    const back = tree.root.findByProps({testID: 'screen-header-back'});
    expect(back.type).toBe(HeaderIconButton);
    const icon = back.findByType(MaterialIcon);
    expect(icon.props.name).toBe('arrow_back');
    expect(icon.props.size).toBe(HEADER_ICON_SIZE);

    await act(async () => back.props.onPress());
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('starts the title at the gutter when there is no back button', async () => {
    const tree = await renderHeader('Hồ sơ', {onBack: undefined});

    expect(
      tree.root.findAll(node => node.props.testID === 'screen-header-back'),
    ).toHaveLength(0);
    const header = findHostByTestID(tree, 'screen-header');
    expect(header.props.children.filter(Boolean)).toHaveLength(1);
  });

  it('lays out right actions in a row', async () => {
    const tree = await renderHeader('Bài học', {
      rightAction: (
        <>
          <HeaderIconButton
            accessibilityLabel="a"
            icon="translate"
            onPress={() => {}}
          />
          <HeaderIconButton
            accessibilityLabel="b"
            label="IPA"
            onPress={() => {}}
          />
        </>
      ),
    });

    const buttons = tree.root.findAllByType(HeaderIconButton);
    expect(buttons).toHaveLength(3);
    const actions = buttons[1].parent?.parent;
    expect(actions?.type).toBe(View);
    expect(StyleSheet.flatten(actions?.props.style).flexDirection).toBe('row');
  });

  it('uses a flexible header height instead of a fixed 56px cap', async () => {
    const tree = await renderHeader('Ngắn');

    const headerStyle = StyleSheet.flatten(
      findHostByTestID(tree, 'screen-header').props.style,
    );
    expect(headerStyle.minHeight).toBe(56);
    expect(headerStyle.height).toBeUndefined();
  });
});

describe('HeaderIconButton', () => {
  async function renderButton(
    props?: Partial<React.ComponentProps<typeof HeaderIconButton>>,
  ) {
    let tree!: ReactTestRenderer.ReactTestRenderer;
    await act(async () => {
      tree = ReactTestRenderer.create(
        <FeatureFlagProvider>
          <AppThemeProvider>
            <HeaderIconButton
              accessibilityLabel="Đóng"
              icon="close"
              onPress={() => {}}
              testID="btn"
              {...props}
            />
          </AppThemeProvider>
        </FeatureFlagProvider>,
      );
    });
    return findHostByTestID(tree, 'btn');
  }

  it('is a 40px circle with a 44px touch target', async () => {
    const button = await renderButton();
    const style = StyleSheet.flatten(button.props.style);
    expect(style.width).toBe(HEADER_BUTTON_SIZE);
    expect(style.height).toBe(HEADER_BUTTON_SIZE);
    expect(HEADER_BUTTON_SIZE + 2 * button.props.hitSlop).toBeGreaterThan(43);
  });

  it('switches background when selected', async () => {
    const off = StyleSheet.flatten((await renderButton()).props.style);
    const on = StyleSheet.flatten(
      (await renderButton({selected: true})).props.style,
    );
    expect(on.backgroundColor).not.toBe(off.backgroundColor);
  });
});
