export type ComboSetupRouteParams = {
  itemCode: string;
  /** Vocab path P6: the tense to pick first (a lesson's tense), when open. */
  grammarCode?: string;
};
export type ComboSetRouteParams = {
  setId: string;
  /** How many sentences were just made; the set greets them with a toast. */
  created?: number;
};
