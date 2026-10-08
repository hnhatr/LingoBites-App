import fs from 'node:fs';
import path from 'node:path';

import {
  acceptedAnswers,
  acceptedForValues,
  normalizeAnswer,
} from '../acceptedAnswers';
import type {PatternPayload} from '../itemPayload';

/**
 * The shared fixture is a byte-identical copy of the Server's
 * `test/fixtures/accepted-answers.json`, SHA-pinned with the other contract
 * fixtures (`@core/schemas/fixtures`): the Server, the admin and the app
 * accept exactly the same answers.
 */
const fixture = JSON.parse(
  fs.readFileSync(
    path.join(
      __dirname,
      '../../schemas/__tests__/fixtures/accepted-answers.json',
    ),
    'utf8',
  ),
) as {
  pattern: {text: string; payload: PatternPayload};
  variants: {text: string}[];
  refs: Record<string, string>;
  accepted: string[];
  limited: {limit: number; accepted: string[]};
  forValues: {values: Record<string, string>; accepted: string[]};
  normalize: [string, string][];
};

const resolveRef = (code: string) => fixture.refs[code] ?? null;

describe('acceptedAnswers (copy of the Server)', () => {
  it('matches the shared fixture', () => {
    expect(
      acceptedAnswers(fixture.pattern, fixture.variants, resolveRef),
    ).toEqual(fixture.accepted);
    expect(
      acceptedAnswers(
        fixture.pattern,
        fixture.variants,
        resolveRef,
        fixture.limited.limit,
      ),
    ).toEqual(fixture.limited.accepted);
    expect(
      acceptedForValues(
        fixture.pattern,
        fixture.variants,
        fixture.forValues.values,
      ),
    ).toEqual(fixture.forValues.accepted);
    for (const [input, normalised] of fixture.normalize) {
      expect(normalizeAnswer(input)).toBe(normalised);
    }
  });
});
