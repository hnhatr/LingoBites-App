import {createConsoleErrorReportingAdapter} from './adapters/ConsoleErrorReportingAdapter';
import type {ErrorReportContext, ErrorReportingAdapter} from './types';

let adapter: ErrorReportingAdapter = createConsoleErrorReportingAdapter();

export function setErrorReportingAdapter(
  nextAdapter: ErrorReportingAdapter,
): void {
  adapter = nextAdapter;
}

export function resetErrorReportingAdapter(): void {
  adapter = createConsoleErrorReportingAdapter();
}

export function reportError(
  error: unknown,
  context?: ErrorReportContext,
): void {
  adapter.reportError(error, context);
}

export function installGlobalErrorHandler(): void {
  if (typeof ErrorUtils === 'undefined') {
    return;
  }

  const previousHandler = ErrorUtils.getGlobalHandler();

  ErrorUtils.setGlobalHandler((error, isFatal) => {
    reportError(error, {is_fatal: isFatal ?? false, scope: 'global'});
    previousHandler?.(error, isFatal);
  });
}
