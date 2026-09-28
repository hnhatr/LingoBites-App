/**
 * Pure step-sequence builder for the lesson runtime (SETE-108 / M3). Takes
 * denormalized lesson data (no DB access) and returns the ordered steps a
 * learner walks through. Kept side-effect free so it is unit-testable with
 * plain fixtures — `ContentLessonRuntime.ts` is the only caller that touches
 * SQLite.
 *
 * Activity-type -> step-kind mapping (documents the M1 -> M3 contract):
 *   listen_and_repeat, speaking_drill -> shadowing   (play + "I repeated it")
 *   role_play                          -> role_play   (dialogue turn by turn)
 *   fill_blank, translation            -> guided_practice (prompt -> reveal)
 *   multiple_choice                    -> active_recall   (prompt -> reveal + self-rate)
 *
 * Every chunk always gets a `context` step first (context sentence + the
 * required Vietnamese explanation). The lesson always ends with one
 * `exit_check` step (2-3 sampled Q&A items) and one `feedback` step.
 */

import type {
  ContentActivityRow,
  ContentChunkRow,
} from '../data/ContentRuntimeRepository';
import type {QAItem} from '../schema';
import type {LessonRuntimeData, RuntimeStep} from './types';

const EXIT_CHECK_ITEM_COUNT = 3;

function contextStep(chunk: ContentChunkRow): RuntimeStep {
  return {
    id: `context:${chunk.id}`,
    kind: 'context',
    chunkIds: [chunk.id],
    qaItemIds: [],
    dialogueTurnIds: [],
    data: {
      kind: 'context',
      phraseEn: chunk.phraseEn,
      phraseVi: chunk.phraseVi,
      explanationVi: chunk.explanationVi,
      contextSentenceEn: chunk.contextSentenceEn,
      contextSentenceVi: chunk.contextSentenceVi,
      audioAssetId: chunk.audioRefIds[0] ?? null,
    },
  };
}

function findQaItems(chunks: ContentChunkRow[], qaIds: string[]): QAItem[] {
  if (qaIds.length === 0) {
    return [];
  }
  const byId = new Map<string, QAItem>();
  for (const chunk of chunks) {
    for (const qa of chunk.qaItems) {
      byId.set(qa.id, qa);
    }
  }
  return qaIds
    .map(id => byId.get(id))
    .filter((qa): qa is QAItem => Boolean(qa));
}

function chunksForActivity(
  chunks: ContentChunkRow[],
  chunkRefIds: string[],
): ContentChunkRow[] {
  const ids = new Set(chunkRefIds);
  return chunks.filter(chunk => ids.has(chunk.id));
}

function activityQaItems(
  chunks: ContentChunkRow[],
  activity: ContentActivityRow,
): QAItem[] {
  const declared = findQaItems(chunks, activity.qaRefIds);
  if (declared.length > 0) {
    return declared;
  }
  // No explicit qa_ref_ids: fall back to the referenced chunks' own qa_items.
  return chunksForActivity(chunks, activity.chunkRefIds).flatMap(
    chunk => chunk.qaItems,
  );
}

function activityStep(
  chunks: ContentChunkRow[],
  activity: ContentActivityRow,
): RuntimeStep | null {
  const referencedChunks = chunksForActivity(chunks, activity.chunkRefIds);

  switch (activity.type) {
    case 'listen_and_repeat':
    case 'speaking_drill': {
      const lines = referencedChunks.map(chunk => ({
        textEn: chunk.phraseEn,
        textVi: chunk.phraseVi,
        audioAssetId: chunk.audioRefIds[0] ?? null,
      }));
      return {
        id: `activity:${activity.id}`,
        kind: 'shadowing',
        // Chunk-level "completed" attribution belongs to the context step
        // alone; an activity step only attributes the qa/dialogue content it
        // directly drills.
        chunkIds: [],
        qaItemIds: [],
        dialogueTurnIds: [],
        data: {
          kind: 'shadowing',
          titleVi: activity.titleVi,
          instructionsVi: activity.instructionsVi,
          lines,
        },
      };
    }
    case 'role_play': {
      const turns = referencedChunks.flatMap(chunk => chunk.dialogueTurns);
      return {
        id: `activity:${activity.id}`,
        kind: 'role_play',
        chunkIds: [],
        qaItemIds: [],
        dialogueTurnIds: turns.map(turn => turn.id),
        data: {
          kind: 'role_play',
          titleVi: activity.titleVi,
          instructionsVi: activity.instructionsVi,
          turns,
        },
      };
    }
    case 'fill_blank':
    case 'translation': {
      const items = activityQaItems(chunks, activity);
      return {
        id: `activity:${activity.id}`,
        kind: 'guided_practice',
        chunkIds: [],
        qaItemIds: items.map(item => item.id),
        dialogueTurnIds: [],
        data: {
          kind: 'guided_practice',
          titleVi: activity.titleVi,
          instructionsVi: activity.instructionsVi,
          items,
        },
      };
    }
    case 'multiple_choice': {
      const items = activityQaItems(chunks, activity);
      return {
        id: `activity:${activity.id}`,
        kind: 'active_recall',
        chunkIds: [],
        qaItemIds: items.map(item => item.id),
        dialogueTurnIds: [],
        data: {
          kind: 'active_recall',
          titleVi: activity.titleVi,
          instructionsVi: activity.instructionsVi,
          items,
        },
      };
    }
    default:
      return null;
  }
}

function exitCheckStep(chunks: ContentChunkRow[]): RuntimeStep {
  const items: QAItem[] = [];
  for (const chunk of chunks) {
    if (items.length >= EXIT_CHECK_ITEM_COUNT) {
      break;
    }
    const first = chunk.qaItems[0];
    if (first) {
      items.push(first);
    }
  }
  return {
    id: 'exit_check',
    kind: 'exit_check',
    chunkIds: [],
    qaItemIds: items.map(item => item.id),
    dialogueTurnIds: [],
    data: {kind: 'exit_check', items},
  };
}

function feedbackStep(): RuntimeStep {
  return {
    id: 'feedback',
    kind: 'feedback',
    chunkIds: [],
    qaItemIds: [],
    dialogueTurnIds: [],
    // Filled in with real counts by ContentLessonRuntime once attempts exist.
    data: {
      kind: 'feedback',
      newChunkCount: 0,
      completedCount: 0,
      skippedCount: 0,
      nextReviewHint: '',
    },
  };
}

function activityPlacementOrder(
  activity: {chunkRefIds: string[]},
  chunks: ContentChunkRow[],
): number {
  const orderById = new Map(chunks.map(row => [row.id, row.order]));
  const orders = activity.chunkRefIds
    .map(id => orderById.get(id))
    .filter((order): order is number => order !== undefined);
  if (orders.length === 0) {
    return Number.POSITIVE_INFINITY;
  }
  return Math.max(...orders);
}

export function buildLessonSteps(data: LessonRuntimeData): RuntimeStep[] {
  const steps: RuntimeStep[] = [];
  const orderedChunks = [...data.chunks].sort((a, b) => a.order - b.order);
  const placedActivityIds = new Set<string>();

  for (const chunk of orderedChunks) {
    steps.push(contextStep(chunk));
    for (const activity of data.activities) {
      if (placedActivityIds.has(activity.id)) {
        continue;
      }
      if (activityPlacementOrder(activity, orderedChunks) !== chunk.order) {
        continue;
      }
      const step = activityStep(orderedChunks, activity);
      if (step) {
        steps.push(step);
        placedActivityIds.add(activity.id);
      }
    }
  }

  for (const activity of data.activities) {
    if (placedActivityIds.has(activity.id)) {
      continue;
    }
    const step = activityStep(orderedChunks, activity);
    if (step) {
      steps.push(step);
      placedActivityIds.add(activity.id);
    }
  }

  steps.push(exitCheckStep(orderedChunks));
  steps.push(feedbackStep());

  return steps;
}
