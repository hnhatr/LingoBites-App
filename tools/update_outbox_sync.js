/* eslint-disable no-regex-spaces */
const fs = require('fs');

let content = fs.readFileSync('src/modules/sync/outboxSync.ts', 'utf8');

// Add import for syncPush and SyncCollectionSchema
content = content.replace(
  /import \{SYNC_BATCH_LIMIT, isSyncStuck\} from '\.\/syncPolicy';/,
  "import {SYNC_BATCH_LIMIT, isSyncStuck} from './syncPolicy';\nimport {syncPush} from '@shared/api/syncClient';\nimport {SyncCollectionSchema, type SyncPushMutation} from '@shared/schemas/sync';",
);

// We need a helper to check if an event is a generic sync push collection
content = content.replace(
  /function toReviewWireEvent\(/,
  `function isGenericSyncCollection(eventType: string): boolean {
  return SyncCollectionSchema.safeParse(eventType).success;
}

function toReviewWireEvent(`,
);

// Inside drainOutboxOnce, after separating practice and review, we separate generic events
content = content.replace(
  /[ ]{2}const reviewEvents = eligible\.filter\(\n[ ]{4}event => event\.eventType === REVIEW_EVENT_TYPE,\n[ ]{2}\);\n[ ]{2}const practiceEvents = eligible\.filter\(\n[ ]{4}event => event\.eventType === PRACTICE_EVENT_TYPE,\n[ ]{2}\);\n[ ]{2}\/\/ Forward-compat: rows with an unknown type drain through the review\n[ ]{2}\/\/ endpoint so they are never silently stuck\.\n[ ]{2}const unknownEvents = eligible\.filter\(\n[ ]{4}event =>\n      event\.eventType !== REVIEW_EVENT_TYPE &&\n      event\.eventType !== PRACTICE_EVENT_TYPE,\n  \);\n  const reviewBatch = \[\.\.\.reviewEvents, \.\.\.unknownEvents\];/,
  `  const reviewEvents = eligible.filter(
    event => event.eventType === REVIEW_EVENT_TYPE,
  );
  const practiceEvents = eligible.filter(
    event => event.eventType === PRACTICE_EVENT_TYPE,
  );
  const genericEvents = eligible.filter(
    event => isGenericSyncCollection(event.eventType)
  );
  // Forward-compat: rows with an unknown type that are NOT in SyncCollection drain through the review endpoint
  const unknownEvents = eligible.filter(
    event =>
      event.eventType !== REVIEW_EVENT_TYPE &&
      event.eventType !== PRACTICE_EVENT_TYPE &&
      !isGenericSyncCollection(event.eventType)
  );
  const reviewBatch = [...reviewEvents, ...unknownEvents];`,
);

// After processing practiceEvents, we process genericEvents
const genericProcessing = `
  if (genericEvents.length > 0) {
    const mutations: SyncPushMutation[] = genericEvents.map(event => ({
      mutation_id: event.id,
      collection: event.eventType as any, // We know it's valid
      entity_id: event.entityId,
      payload: (event.payload as any).tombstone ? {} : event.payload,
      tombstone: (event.payload as any).tombstone === true,
      occurred_at: event.createdAt,
    }));

    const result = await syncPush({ mutations }, deps);
    if (result.ok) {
      const successfulIds = result.data.results.map(r => r.mutation_id);
      if (successfulIds.length > 0) {
        markSyncEventsSynced(successfulIds);
        syncedIds.push(...successfulIds);
      }
      
      // If a result was marked 'stale', it means our write lost, but we still consider it successfully processed by the outbox
      // (Actually, successfulIds includes 'applied', 'duplicate', 'stale')
      
      // For any failures not in results (though syncPush returns all), we could handle them. 
      // But syncPush either succeeds the whole batch (and returns results for each) or fails the whole batch.
    } else {
      markSyncEventsFailed(
        genericEvents.map(event => event.id),
        result.message,
      );
      const failure = { errorCode: result.errorCode, message: result.message };
      if (result.retryable) {
        firstRetryableFailure ??= failure;
      } else {
        firstPermanentFailure ??= failure;
      }
    }
  }
`;

content = content.replace(
  / {2}if \(syncedIds\.length > 0\) \{/,
  `${genericProcessing}\n  if (syncedIds.length > 0) {`,
);

fs.writeFileSync('src/modules/sync/outboxSync.ts', content);
