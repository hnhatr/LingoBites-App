export {createConsoleErrorReportingAdapter} from './adapters/ConsoleErrorReportingAdapter';
export {
  installGlobalErrorHandler,
  reportError,
  resetErrorReportingAdapter,
  setErrorReportingAdapter,
} from './errorReportingService';
export type {ErrorReportContext, ErrorReportingAdapter} from './types';
