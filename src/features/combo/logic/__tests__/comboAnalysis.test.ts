import {analysisOf, noteSegments, partTone} from '../comboAnalysis';
import type {ComboSentence} from '../comboClient';

const base: ComboSentence = {
  id: 's1',
  position: 0,
  batch: 1,
  subject_group: 'he_she',
  subject_text: 'She',
  polarity: 'negative',
  text_en: "She doesn't like June.",
  text_vi: 'Cô ấy không thích tháng Sáu.',
  tokens: [
    {t: 'she', ipa: null, role: 'subject'},
    {t: "doesn't", ipa: null, role: 'aux'},
    {t: 'like', ipa: null, role: 'verb'},
    {t: 'june', ipa: null, role: 'item'},
  ],
};

describe('comboAnalysis', () => {
  it('keeps the analysis the Server sent', () => {
    const analysis = {tense: null, parts: [], notes: ['x']};
    expect(analysisOf({...base, analysis})).toBe(analysis);
  });

  it('reads the parts from the word roles when there is none', () => {
    expect(analysisOf(base)).toEqual({
      tense: null,
      parts: [
        {text: 'she', role: 'subject', label_vi: 'Chủ ngữ'},
        {text: "doesn't like", role: 'verb', label_vi: 'Động từ'},
        {text: 'june', role: 'item', label_vi: 'Từ đang học'},
      ],
      notes: [],
    });
  });

  it('colours the auxiliary with the verb', () => {
    expect(partTone('aux')).toBe('verb');
    expect(partTone('unknown')).toBe('other');
  });

  it('splits bold words out of a note', () => {
    expect(noteSegments('**came** là V2 của **come**.')).toEqual([
      {text: 'came', bold: true},
      {text: ' là V2 của ', bold: false},
      {text: 'come', bold: true},
      {text: '.', bold: false},
    ]);
  });
});
