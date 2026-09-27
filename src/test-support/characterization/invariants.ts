/** LING-92 invariant ids pinned by TASK-001 characterization tests. */
export const CHARACTERIZATION_INVARIANTS = {
  INV_001: 'INV-001',
  INV_002: 'INV-002',
  INV_003: 'INV-003',
  INV_004: 'INV-004',
  INV_005: 'INV-005',
} as const;

export type CharacterizationInvariantId =
  (typeof CHARACTERIZATION_INVARIANTS)[keyof typeof CHARACTERIZATION_INVARIANTS];
