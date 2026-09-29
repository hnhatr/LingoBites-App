/**
 * Toast notification utility.
 * Simple placeholder for now - can be replaced with actual toast library later.
 */
export function showToast(message: string): void {
  // Fallback to console.error if no UI layer exists
  console.error(`[Toast] ${message}`);
}
