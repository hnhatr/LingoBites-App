/**
 * Sentence enrichment contract v1 — api-server <-> mobile-app.
 * Implements SETE-323 BTASK-1. Single source of truth for both sides:
 * copy this file (or its generated schema) into `api-server` and `mobile-app`.
 *
 * Publish rules (đã chốt):
 * - A lesson is publishable when every sentence has EN + VI.
 * - vocab[] / grammar[] MAY be missing -> client renders a shorter card,
 *   never an error, never an empty placeholder (status 'partial').
 * - keyWord null -> client falls back to longest content word (BTASK-3).
 *
 * Only erasable TypeScript is used (interfaces, type aliases, annotations),
 * so `node --check` can syntax-verify this file without a compiler.
 */

export type AnalysisStatus = 'pending' | 'partial' | 'ready' | 'failed';

export interface VocabEntry {
  word: string;
  pos: string; // loại từ, e.g. 'verb' | 'noun' | 'từ chức năng'
  ipa: string;
  meaning: string; // nghĩa tiếng Việt
  tip?: string; // mẹo nhớ; absent for function words
  inSentenceNote?: string; // rút gọn cho từ chức năng: 'Trong câu: …'
}

export interface GrammarPoint {
  name: string;
  description: string;
  formula: string;
  analysis: string; // phân tích trong câu này
}

export interface SentenceEnrichment {
  keyWord: string | null; // null = AI chưa trả -> client fallback
  vocab: VocabEntry[];
  grammar: GrammarPoint[];
  status: AnalysisStatus;
  error?: string | null; // set when status is 'failed' (per-block retry)
}

export interface YouTubeSegmentV1 {
  index: number;
  start_ms: number;
  end_ms: number;
  en: string; // single source of truth (C-01) — client must not keep a 2nd copy
  vi: string;
  ipa: string; // IPA cả câu (đã có từ enrichment cũ)
  enrichment: SentenceEnrichment;
}

export interface LessonPayloadV1 {
  videoId: string;
  duration_ms: number;
  /** Lesson-level label (D-1): user-chosen at creation, AI may suggest.
   *  Null = hidden in card headers per the empty-block rule. Never per-sentence. */
  level?: string | null;
  segments: YouTubeSegmentV1[];
}

/** Publish gate: EN + VI required on every sentence; vocab/grammar optional. */
export function isPublishable(payload: LessonPayloadV1): boolean {
  return (
    payload.segments.length > 0 &&
    payload.segments.every(
      (s: YouTubeSegmentV1): boolean =>
        s.en.trim() !== '' && s.vi.trim() !== '',
    )
  );
}

/** Client-side keyword fallback (BTASK-3): longest content word. */
const FUNCTION_WORDS: ReadonlySet<string> = new Set(
  'a,an,the,is,are,was,were,be,been,to,of,in,on,at,for,and,or,but,with,as,by,it,this,that,i,you,we,they,he,she'.split(
    ',',
  ),
);

export function pickKeyword(en: string, aiKeyword: string | null): string {
  if (aiKeyword !== null && aiKeyword !== '') return aiKeyword;
  const words: string[] = (en.match(/[A-Za-z']+/g) ?? []).filter(
    (w: string): boolean => !FUNCTION_WORDS.has(w.toLowerCase()),
  );
  let best = '';
  for (const w of words) if (w.length > best.length) best = w;
  return best !== '' ? best : ((en.match(/[A-Za-z']+/g) ?? [''])[0] as string);
}
