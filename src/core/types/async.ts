export type AsyncIdle = {status: 'idle'};
export type AsyncLoading = {status: 'loading'};
export type AsyncSuccess<T> = {status: 'success'; data: T};
export type AsyncEmpty = {status: 'empty'};
export type AsyncError = {status: 'error'; message: string};

export type Async<T> =
  | AsyncIdle
  | AsyncLoading
  | AsyncSuccess<T>
  | AsyncEmpty
  | AsyncError;

export const idle: AsyncIdle = {status: 'idle'};
export const loading: AsyncLoading = {status: 'loading'};
