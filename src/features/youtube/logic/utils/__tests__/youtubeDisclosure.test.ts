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

async function flushStorageRead() {
  await new Promise<void>(resolve => setImmediate(resolve));
}

describe('youtubeDisclosure (SETE-283, HVB-08a)', () => {
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

  // Last: spying on the in-memory storage mock leaves it unusable for later
  // tests (verified with a probe), so the failure case runs in isolation
  // at the end — mirroring themeStorage.test.ts.
  it('fails closed when storage is unavailable', async () => {
    jest
      .spyOn(AsyncStorage, 'getItem')
      .mockRejectedValueOnce(new Error('boom'));
    expect(await hasAcknowledgedYouTubeDisclosure()).toBe(false);
  });
});
