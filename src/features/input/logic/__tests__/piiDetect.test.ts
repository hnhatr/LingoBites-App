import {detectPiiLines} from '../piiDetect';
import fixture from './fixtures/pii-cases.json';

type PiiCase = {
  name: string;
  text: string;
  expected: Array<{line: number; type: string}>;
};

describe('detectPiiLines (shared fixture with the server)', () => {
  (fixture.cases as PiiCase[]).forEach(testCase => {
    it(testCase.name, () => {
      expect(detectPiiLines(testCase.text)).toEqual(testCase.expected);
    });
  });
});
