export type RawCue = {startMs: number; endMs: number | null; text: string};

function parseTimestamp(str: string): number | null {
  const match = str
    .trim()
    .match(/^(?:(\d+):)?(\d{1,2}):(\d{2})(?:[.,](\d{1,3}))?$/);
  if (!match) return null;

  const h = match[1] ? parseInt(match[1], 10) : 0;
  const m = parseInt(match[2], 10);
  const s = parseInt(match[3], 10);
  const msStr = match[4] ? match[4].padEnd(3, '0') : '000';
  const ms = parseInt(msStr, 10);

  return h * 3600000 + m * 60000 + s * 1000 + ms;
}

function parseF3(lines: string[]): RawCue[] {
  const cues: RawCue[] = [];
  let currentCue: RawCue | null = null;
  let textLines: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed === 'WEBVTT' || trimmed === '') {
      if (currentCue) {
        currentCue.text = textLines.join('\n').trim();
        if (currentCue.text) cues.push(currentCue);
        currentCue = null;
        textLines = [];
      }
      continue;
    }

    const arrowMatch = trimmed.match(/^(\S.*?)\s*-->\s*(\S.*)$/);
    if (arrowMatch) {
      if (currentCue) {
        currentCue.text = textLines.join('\n').trim();
        if (currentCue.text) cues.push(currentCue);
      }
      const startMs = parseTimestamp(arrowMatch[1]);
      const endMs = parseTimestamp(arrowMatch[2]);
      if (startMs !== null) {
        currentCue = {startMs, endMs, text: ''};
        textLines = [];
      }
      continue;
    }

    if (!currentCue && /^\d+$/.test(trimmed)) {
      continue;
    }

    if (currentCue) {
      textLines.push(trimmed);
    }
  }

  if (currentCue) {
    currentCue.text = textLines.join('\n').trim();
    if (currentCue.text) cues.push(currentCue);
  }

  return cues;
}

function parseF1(lines: string[]): RawCue[] {
  const cues: RawCue[] = [];
  let currentStart: number | null = null;
  let textLines: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const ts = parseTimestamp(trimmed);
    if (ts !== null) {
      if (currentStart !== null) {
        cues.push({
          startMs: currentStart,
          endMs: null,
          text: textLines.join('\n').trim(),
        });
      }
      currentStart = ts;
      textLines = [];
    } else if (currentStart !== null) {
      textLines.push(trimmed);
    }
  }
  if (currentStart !== null) {
    cues.push({
      startMs: currentStart,
      endMs: null,
      text: textLines.join('\n').trim(),
    });
  }
  return cues.filter(c => c.text.length > 0);
}

function parseF2(lines: string[]): RawCue[] {
  const cues: RawCue[] = [];
  let currentStart: number | null = null;
  let textLines: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const match = trimmed.match(
      /^((?:(?:\d+):)?\d{1,2}:\d{2}(?:[.,]\d{1,3})?)\s+(.*)$/,
    );
    if (match) {
      const ts = parseTimestamp(match[1]);
      if (ts !== null) {
        if (currentStart !== null) {
          cues.push({
            startMs: currentStart,
            endMs: null,
            text: textLines.join('\n').trim(),
          });
        }
        currentStart = ts;
        textLines = [match[2].trim()];
        continue;
      }
    }

    if (currentStart !== null) {
      textLines.push(trimmed);
    }
  }

  if (currentStart !== null) {
    cues.push({
      startMs: currentStart,
      endMs: null,
      text: textLines.join('\n').trim(),
    });
  }

  return cues.filter(c => c.text.length > 0);
}

export function parseManualTranscript(text: string): RawCue[] {
  const lines = text.split('\n');

  const hasArrow = lines.some(l => l.includes('-->'));
  if (hasArrow) {
    const cues = parseF3(lines);
    if (cues.length > 0) return cues;
  }

  const isF1 = lines.some(l => parseTimestamp(l) !== null);
  const isF2 = lines.some(l =>
    /^(?:(?:\d+):)?\d{1,2}:\d{2}(?:[.,]\d{1,3})?\s+/.test(l.trim()),
  );

  let cues: RawCue[] = [];
  if (isF1 && !isF2) {
    cues = parseF1(lines);
  } else if (isF2 && !isF1) {
    cues = parseF2(lines);
  } else if (isF1 && isF2) {
    const cuesF1 = parseF1(lines);
    const cuesF2 = parseF2(lines);
    cues = cuesF1.length >= cuesF2.length ? cuesF1 : cuesF2;
  }

  if (cues.length === 0) {
    throw new Error(
      'TRANSCRIPT_UNPARSABLE: Vui lòng nhập định dạng hợp lệ, ví dụ:\n0:00 Hello\nhoặc:\n0:00\nHello',
    );
  }

  return cues;
}
