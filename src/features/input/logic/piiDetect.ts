/**
 * E3 (Q-E3): the same personal-information rules as the server's piiDetect,
 * run on the device so a line is highlighted as the learner edits. Both sides
 * read the same fixture (__tests__/fixtures/pii-cases.json). It warns and never
 * blocks.
 */
export type PiiLineType = 'phone' | 'email' | 'id_number';
export type PiiLine = {line: number; type: PiiLineType};

const EMAIL = /[\w.+-]+@[\w-]+\.[\w.-]+/;
const VN_PHONE = /(?<![\d.,])0\d{2,3}[ .-]?\d{3}[ .-]?\d{3,4}(?![\d.,])/;
const INTL_PHONE = /\+\d{1,3}[ .-]?\d{6,14}(?![\d])/;
const ID_NUMBER = /(?<![\d.,:/$€£¥])\d(?:[ -]?\d){8,18}(?![\d.,:/])/;

export function detectPiiLines(text: string): PiiLine[] {
  const found: PiiLine[] = [];
  text.split(/\r?\n/).forEach((content, index) => {
    const line = index + 1;
    if (EMAIL.test(content)) {
      found.push({line, type: 'email'});
    } else if (VN_PHONE.test(content) || INTL_PHONE.test(content)) {
      found.push({line, type: 'phone'});
    } else if (ID_NUMBER.test(content)) {
      found.push({line, type: 'id_number'});
    }
  });
  return found;
}
