#!/usr/bin/env node
/**
 * Validates a single [LING93_INV002] log line (used by run-ios-inv002.sh and harness tests).
 */
const line = process.argv[2];
if (!line) {
  console.error('Usage: validate-inv002-marker.mjs <log-line>');
  process.exit(2);
}
const jsonText = line.replace(/^.*\[LING93_INV002\]\s*/, '');
let result;
try {
  result = JSON.parse(jsonText);
} catch (error) {
  console.error('Invalid INV-002 marker JSON:', error);
  process.exit(1);
}
if (result.status !== 'pass') {
  console.error(
    'Characterization result status is not pass:',
    jsonText.slice(0, 500),
  );
  process.exit(1);
}
if (!result.assertions || typeof result.assertions !== 'object') {
  console.error('Characterization result missing assertions object');
  process.exit(1);
}
process.exit(0);
