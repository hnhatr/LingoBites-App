import {Platform} from 'react-native';

import {defaultTheme} from '@ui/theme/themes/default';

import {stickerCard} from '../LibraryShelf';

describe('stickerCard', () => {
  const originalOs = Platform.OS;

  afterEach(() => {
    Platform.OS = originalOs;
  });

  it('draws a hard ink shadow on iOS', () => {
    Platform.OS = 'ios' as typeof Platform.OS;
    expect(stickerCard(defaultTheme, 3)).toEqual(
      expect.objectContaining({
        shadowColor: defaultTheme.colors.ink,
        shadowOffset: {width: 0, height: 3},
        shadowOpacity: 1,
        shadowRadius: 0,
      }),
    );
  });

  it('draws an ink bottom edge on Android, with no blurred elevation', () => {
    Platform.OS = 'android' as typeof Platform.OS;
    const face = stickerCard(defaultTheme, 4);
    expect(face).toEqual({
      borderBottomWidth: 4,
      borderColor: defaultTheme.colors.ink,
    });
    expect(face).not.toHaveProperty('elevation');
  });
});
