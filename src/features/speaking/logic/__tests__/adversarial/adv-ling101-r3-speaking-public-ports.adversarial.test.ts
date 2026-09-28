/**
 * LING-101 adversarial re-review r3 (INV-001 / INV-005). The CR-003 repair
 * split the speaking Public surface into `speakingQueryPort` (Today) and
 * `speakingUiPort` (AppNavigator) while the root barrel still re-exports the
 * query port and the recording client. Every Public entry must resolve to the
 * single private repository/client instance, otherwise a caller could write
 * or upload through a second copy. Loading the query entries must not pull the
 * native permission facade (OBS-001 / CR-001 regression guard).
 */

const nativePermissionsLoaded = {value: false};

jest.mock('react-native-permissions', () => {
  nativePermissionsLoaded.value = true;
  return {
    check: jest.fn().mockResolvedValue('granted'),
    request: jest.fn().mockResolvedValue('granted'),
    PERMISSIONS: {
      IOS: {MICROPHONE: 'ios.permission.MICROPHONE'},
      ANDROID: {RECORD_AUDIO: 'android.permission.RECORD_AUDIO'},
    },
    RESULTS: {UNAVAILABLE: 'unavailable', GRANTED: 'granted', DENIED: 'denied'},
  };
});

const QUERY_KEYS = [
  'captureErrorEvent',
  'insertSpeakingRecording',
  'listErrorEvents',
  'listSpeakingRecordings',
] as const;

describe('LING-101 adversarial r3: speaking Public ports', () => {
  it('ADV-006 / INV-001 / INV-005: query port, root barrel, legacy shim, UI port and private repo/client share one instance; query entries load without native permissions', () => {
    const privateRepo = require('@features/speaking/logic/data/SpeakingRepository');
    const privateClient = require('@features/speaking/logic/api/recordingClient');
    const queryPort = require('@features/speaking/logic/speakingQueryPort');
    const barrel = require('@features/speaking');
    const legacyShim = require('@features/speaking/logic/data/SpeakingRepository');
    const legacyClient = require('@features/speaking/logic/api/recordingClient');
    require('@features/today/logic/todayAdapter');

    expect(nativePermissionsLoaded.value).toBe(false);

    for (const key of QUERY_KEYS) {
      expect({key, same: queryPort[key] === privateRepo[key]}).toEqual({
        key,
        same: true,
      });
      expect({key, same: barrel[key] === privateRepo[key]}).toEqual({
        key,
        same: true,
      });
      expect({key, same: legacyShim[key] === privateRepo[key]}).toEqual({
        key,
        same: true,
      });
    }
    for (const key of [
      'createRecordingMetadata',
      'uploadRecordingBinary',
    ] as const) {
      expect({key, same: barrel[key] === privateClient[key]}).toEqual({
        key,
        same: true,
      });
      expect({key, same: legacyClient[key] === privateClient[key]}).toEqual({
        key,
        same: true,
      });
    }

    const uiPort = require('@features/speaking/screens/speakingUiPort');
    expect(typeof uiPort.SpeakingRoomScreen).toBe('function');
    expect(typeof uiPort.deleteRecordingFile).toBe('function');
  });
});
