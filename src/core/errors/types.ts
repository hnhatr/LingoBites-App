export type ErrorReportContext = Record<
  string,
  string | number | boolean | undefined
>;

export type ErrorReportingAdapter = {
  reportError: (error: unknown, context?: ErrorReportContext) => void;
};
