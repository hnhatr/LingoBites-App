import {Platform} from 'react-native';

import {getStickerEdge} from '../hardShadow';

describe('getStickerEdge', () => {
  const originalOs = Platform.OS;

  afterEach(() => {
    Platform.OS = originalOs;
  });

  it('is the unblurred hard shadow on iOS', () => {
    Platform.OS = 'ios' as typeof Platform.OS;
    expect(getStickerEdge(4, '#1c1c10')).toEqual(
      expect.objectContaining({
        shadowColor: '#1c1c10',
        shadowOffset: {width: 0, height: 4},
        shadowOpacity: 1,
        shadowRadius: 0,
      }),
    );
  });

  it('is a bottom border with no elevation on Android', () => {
    Platform.OS = 'android' as typeof Platform.OS;
    expect(getStickerEdge(3, '#1c1c10')).toEqual({
      borderBottomWidth: 3,
      borderColor: '#1c1c10',
    });
  });
});
