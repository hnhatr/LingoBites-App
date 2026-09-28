/**
 * Tests for the import-state store (SETE-107 / M2).
 */

import {
  __resetImportStateForTests,
  getImportState,
  reportFailure,
  reportProgress,
  reportSuccess,
  startImport,
  subscribeImportState,
  subscribeImportProgress,
} from '../importState';

describe('importState', () => {
  beforeEach(() => {
    __resetImportStateForTests();
  });

  it('starts in an empty state', () => {
    const state = getImportState();
    expect(state).toEqual({
      current: null,
      lastSuccess: null,
      lastFailure: null,
    });
  });

  it('emits a sequence of progress events to subscribers', () => {
    const events: string[] = [];
    const unsub = subscribeImportState(state =>
      events.push(state.current?.phase ?? 'null'),
    );
    startImport({
      phase: 'downloading',
      ratio: null,
      message: 'Downloading…',
      error: null,
    });
    reportProgress({
      phase: 'extracting',
      ratio: null,
      message: 'Extracting…',
      error: null,
    });
    unsub();
    expect(events).toEqual(['downloading', 'extracting']);
  });

  it('emits progress-only events to the progress listener', () => {
    const events: string[] = [];
    const unsub = subscribeImportProgress(p => events.push(p.phase));
    startImport({
      phase: 'downloading',
      ratio: null,
      message: 'x',
      error: null,
    });
    reportProgress({
      phase: 'verifying',
      ratio: null,
      message: 'x',
      error: null,
    });
    unsub();
    expect(events).toEqual(['downloading', 'verifying']);
  });

  it('records the last success and clears last failure', () => {
    reportFailure({
      ok: false,
      error: {code: 'NETWORK_ERROR', message: 'boom'},
      previousActivePackageId: null,
    });
    expect(getImportState().lastFailure?.error.code).toBe('NETWORK_ERROR');
    reportSuccess({
      ok: true,
      packageId: 'pkg',
      packageSlug: 's',
      schemaVersion: '0.1.0',
      lessonCount: 1,
      itemCount: 8,
    });
    const state = getImportState();
    expect(state.lastSuccess?.packageId).toBe('pkg');
    expect(state.lastFailure).toBeNull();
  });

  it('records the last failure and clears last success', () => {
    reportSuccess({
      ok: true,
      packageId: 'pkg',
      packageSlug: 's',
      schemaVersion: '0.1.0',
      lessonCount: 1,
      itemCount: 8,
    });
    reportFailure({
      ok: false,
      error: {code: 'INVALID_ZIP', message: 'oops'},
      previousActivePackageId: 'pkg',
    });
    const state = getImportState();
    expect(state.lastSuccess).toBeNull();
    expect(state.lastFailure?.error.code).toBe('INVALID_ZIP');
    expect(state.current?.phase).toBe('failed');
  });

  it('stops emitting to unsubscribed listeners', () => {
    const events: string[] = [];
    const unsub = subscribeImportState(state =>
      events.push(state.current?.phase ?? 'null'),
    );
    reportProgress({
      phase: 'downloading',
      ratio: null,
      message: 'x',
      error: null,
    });
    unsub();
    reportProgress({
      phase: 'extracting',
      ratio: null,
      message: 'x',
      error: null,
    });
    expect(events).toEqual(['downloading']);
  });
});
