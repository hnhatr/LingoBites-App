import React from 'react';
import {StyleSheet, View} from 'react-native';

import {useAppTheme} from '../theme';
import {getStickerFace} from '../theme/hardShadow';
import {SectionHeader} from './SectionHeader';
import {ShelfSurface} from './ShelfSurface';

type Props = {
  title?: string;
  testID?: string;
  children: React.ReactNode;
};

/** Lets rows rendered inside a group drop their own card chrome. */
export const SettingsGroupContext = React.createContext(false);

/**
 * One titled card that holds a set of related settings rows, separated by
 * hairlines. Rows inside render flat (see `ProfileSettingsRow`).
 */
export function SettingsGroup({title, testID, children}: Props) {
  const {theme} = useAppTheme();
  const spec = theme.components.card;
  const shelf = theme.shelf?.surface;
  const stickerFace = getStickerFace(theme, 4);
  const shadowStyle =
    spec.shadow && !stickerFace ? theme.shadow[spec.shadow] : undefined;
  const items = React.Children.toArray(children);

  return (
    <View testID={testID}>
      {title ? <SectionHeader title={title} /> : null}
      <ShelfSurface
        shelfHeight={shelf?.height}
        shelfColor={shelf?.color}
        borderRadius={spec.radius}
        containerStyle={shadowStyle}
        faceStyle={[
          styles.face,
          {backgroundColor: spec.background},
          stickerFace,
        ]}
      >
        <SettingsGroupContext.Provider value>
          {items.map((child, index) => (
            <View
              key={React.isValidElement(child) ? child.key ?? index : index}
              style={
                index > 0
                  ? [
                      styles.divider,
                      {borderTopColor: theme.colors.outlineVariant},
                    ]
                  : undefined
              }
            >
              {child}
            </View>
          ))}
        </SettingsGroupContext.Provider>
      </ShelfSurface>
    </View>
  );
}

const styles = StyleSheet.create({
  divider: {
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  face: {
    overflow: 'hidden',
  },
});
