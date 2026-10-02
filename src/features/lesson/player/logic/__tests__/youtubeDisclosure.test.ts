import AsyncStorage from '@react-native-async-storage/async-storage';
import {Alert} from 'react-native';

import {
  acknowledgeYouTubeDisclosure,
  ensureYouTubeDisclosureAcknowledged,
  hasAcknowledgedYouTubeDisclosure,
  YOUTUBE_DISCLOSURE_KEY,
} from '../youtubeDisclosure';

const copy = {
  title: 'Privacy notice',
  body: 'Transcript leaves the device.',
  confirmLabel: 'I understand, continue',
  cancelLabel: 'Not now',
};

function pressAlertButton(index: number) {
  const buttons = (Alert.alert as jest.Mock).mock.calls[0][2] as {
    onPress?: () => void;
  }[];
  buttons[index].onPress?.();
}

function dismissAlert() {
  const options = (Alert.alert as jest.Mock).mock.calls[0][3] as {
    onDismiss?: () => void;
  };
  options.onDismiss?.();
}

async function flushStorageRead() {
  await new Promise<void>(resolve => setImmediate(resolve));
}

describe('youtubeDisclosure (LING-191)', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    jest.clearAllMocks();
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  });

  afterEach(() => {
    (Alert.alert as jest.Mock).mockRestore?.();
  });

  it('starts unacknowledged and persists acknowledgement', async () => {
    expect(await hasAcknowledgedYouTubeDisclosure()).toBe(false);
    await acknowledgeYouTubeDisclosure();
    expect(await AsyncStorage.getItem(YOUTUBE_DISCLOSURE_KEY)).toBe('1');
    expect(await hasAcknowledgedYouTubeDisclosure()).toBe(true);
  });

  it('skips the dialog once acknowledged', async () => {
    await acknowledgeYouTubeDisclosure();
    expect(await ensureYouTubeDisclosureAcknowledged(copy)).toBe(true);
    expect(Alert.alert).not.toHaveBeenCalled();
  });

  it('blocks the submit until the user confirms, then persists', async () => {
    const pending = ensureYouTubeDisclosureAcknowledged(copy);
    await flushStorageRead();
    expect(Alert.alert).toHaveBeenCalledTimes(1);
    expect((Alert.alert as jest.Mock).mock.calls[0][0]).toBe(copy.title);
    expect((Alert.alert as jest.Mock).mock.calls[0][1]).toBe(copy.body);

    pressAlertButton(1);
    await expect(pending).resolves.toBe(true);
    expect(await hasAcknowledgedYouTubeDisclosure()).toBe(true);
  });

  it('aborts the submit when the user cancels and persists nothing', async () => {
    const pending = ensureYouTubeDisclosureAcknowledged(copy);
    await flushStorageRead();
    pressAlertButton(0);
    await expect(pending).resolves.toBe(false);
    expect(await hasAcknowledgedYouTubeDisclosure()).toBe(false);
  });

  it('treats dismiss without a button as cancel', async () => {
    const pending = ensureYouTubeDisclosureAcknowledged(copy);
    await flushStorageRead();
    dismissAlert();
    await expect(pending).resolves.toBe(false);
    expect(await hasAcknowledgedYouTubeDisclosure()).toBe(false);
  });

  it('fails closed when storage is unavailable', async () => {
    jest
      .spyOn(AsyncStorage, 'getItem')
      .mockRejectedValueOnce(new Error('boom'));
    expect(await hasAcknowledgedYouTubeDisclosure()).toBe(false);
  });

  it('returns true after confirm when persistence fails, leaving the key unset', async () => {
    const realSetItem = AsyncStorage.setItem.bind(AsyncStorage);
    jest.spyOn(AsyncStorage, 'setItem').mockImplementation(async (key, value) => {
      if (key === YOUTUBE_DISCLOSURE_KEY) {
        throw new Error('write failed');
      }
      return realSetItem(key, value);
    });

    const pending = ensureYouTubeDisclosureAcknowledged(copy);
    await flushStorageRead();
    pressAlertButton(1);
    await expect(pending).resolves.toBe(true);
    expect(await hasAcknowledgedYouTubeDisclosure()).toBe(false);
  });
});
