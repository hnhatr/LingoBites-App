export type TextLengthBucket =
  | '1-100'
  | '101-500'
  | '501-1000'
  | '1001-2000'
  | '2001-3000'
  | '3000+';

export function getTextLengthBucket(length: number): TextLengthBucket {
  if (length <= 0) {
    return '1-100';
  }
  if (length <= 100) {
    return '1-100';
  }
  if (length <= 500) {
    return '101-500';
  }
  if (length <= 1000) {
    return '501-1000';
  }
  if (length <= 2000) {
    return '1001-2000';
  }
  if (length <= 3000) {
    return '2001-3000';
  }
  return '3000+';
}
