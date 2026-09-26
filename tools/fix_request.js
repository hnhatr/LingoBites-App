const fs = require('fs');
let content = fs.readFileSync('src/shared/api/lessonV2Client.ts', 'utf8');

content = content.replace(
  /async function request\(\n {2}fetchImpl: FetchImpl,\n {2}url: string,\n {2}init: RequestInit,\n {2}signal: AbortSignal \| undefined,\n {2}timeoutMs: number,\n\): Promise<\{response\?: Response; error\?: LessonV2ClientError\}> \{\n {2}const timeout = withTimeout\(timeoutMs, signal\);\n {2}try \{\n {4}return \{response: await fetchImpl\(url, \{\.\.\.init, signal: timeout\.signal\}\)\};\n {2}\} catch \{/g,
  `async function request(
  fetchImpl: FetchImpl | undefined,
  url: string,
  init: RequestInit,
  signal: AbortSignal | undefined,
  timeoutMs: number,
): Promise<{response?: Response; error?: LessonV2ClientError}> {
  const timeout = withTimeout(timeoutMs, signal);
  try {
    return {response: await authenticatedFetch(url, {...init, signal: timeout.signal}, fetchImpl)};
  } catch {`,
);

// We need to pass options.fetchImpl down to request instead of options.fetchImpl ?? authenticatedFetch
content = content.replace(
  /options\.fetchImpl \?\? authenticatedFetch,/g,
  'options.fetchImpl,',
);

fs.writeFileSync('src/shared/api/lessonV2Client.ts', content);
