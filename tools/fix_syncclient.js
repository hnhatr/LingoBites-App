const fs = require('fs');

let content = fs.readFileSync('src/shared/api/syncClient.ts', 'utf8');
content = content.replace(
  /import \{ withTimeout \} from '\.\/clientUtils';/,
  `function withTimeout(timeoutMs: number, externalSignal?: AbortSignal) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  if (externalSignal) {
    if (externalSignal.aborted) {
      controller.abort();
    } else {
      externalSignal.addEventListener('abort', () => {
        clearTimeout(timeoutId);
        controller.abort();
      });
    }
  }

  return { signal: controller.signal };
}`,
);
fs.writeFileSync('src/shared/api/syncClient.ts', content);
