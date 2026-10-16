import type {CatalogItem} from '@core/schemas/lesson';

/** A slot of a pattern frame as the detail lists it. */
export type FrameSlot = {name: string; labelVi: string; values: string[]};

/**
 * The slots a pattern payload names, read leniently: the Server may add
 * fields the App does not know (`tense_mode`, `combo_subject_groups`).
 */
export function frameSlots(item: CatalogItem): FrameSlot[] {
  const slots = (item.payload as {slots?: unknown}).slots;
  if (typeof slots !== 'object' || slots === null) return [];
  return Object.entries(slots as Record<string, unknown>).map(
    ([name, slot]) => {
      const value = (slot ?? {}) as {label_vi?: unknown; values?: unknown};
      return {
        name,
        labelVi: typeof value.label_vi === 'string' ? value.label_vi : name,
        values: Array.isArray(value.values)
          ? value.values.filter(
              (entry): entry is string => typeof entry === 'string',
            )
          : [],
      };
    },
  );
}

/** The frame with each `{slot}` shown as `[nhãn]`: `It is worth noting that [mệnh đề]`. */
export function frameText(item: CatalogItem): string {
  const labels = new Map(
    frameSlots(item).map(slot => [slot.name, slot.labelVi]),
  );
  return item.text.replace(
    /\{([a-z][a-z_]*)\}/g,
    (_, name: string) => `[${labels.get(name) ?? '…'}]`,
  );
}
