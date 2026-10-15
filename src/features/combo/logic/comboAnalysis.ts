/**
 * Vocab path P5: the grammar breakdown under a combo sentence. The Server
 * sends it with each sentence; a set kept from before that has none, so its
 * parts are read from the word roles and the tense is left out.
 */
import type {ComboAnalysis, ComboSentence} from './comboClient';

export type AnalysisPartTone = 'subject' | 'verb' | 'item' | 'other';

const ROLE_LABEL: Record<string, string> = {
  subject: 'Chủ ngữ',
  aux: 'Trợ động từ',
  verb: 'Động từ',
  item: 'Từ đang học',
  other: 'Thành phần khác',
};

/** The colour family of a part: the auxiliary goes with the verb. */
export function partTone(role: string): AnalysisPartTone {
  if (role === 'subject' || role === 'item' || role === 'other') return role;
  if (role === 'verb' || role === 'aux') return 'verb';
  return 'other';
}

export function analysisOf(sentence: ComboSentence): ComboAnalysis {
  if (sentence.analysis) return sentence.analysis;
  const parts: ComboAnalysis['parts'] = [];
  sentence.tokens.forEach(token => {
    const role = token.role === 'aux' ? 'verb' : token.role;
    const last = parts[parts.length - 1];
    if (last && last.role === role) last.text = `${last.text} ${token.t}`;
    else parts.push({text: token.t, role, label_vi: ROLE_LABEL[role] ?? ''});
  });
  return {tense: null, parts, notes: []};
}

/** "**came** là…" → [{text: 'came', bold: true}, {text: ' là…', bold: false}]. */
export function noteSegments(
  note: string,
): Array<{text: string; bold: boolean}> {
  return note
    .split('**')
    .map((text, index) => ({text, bold: index % 2 === 1}))
    .filter(segment => segment.text.length > 0);
}
