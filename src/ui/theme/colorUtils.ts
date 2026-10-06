type Rgba = {r: number; g: number; b: number; a: number};

function parseColor(color: string): Rgba | null {
  const rgba = color.match(
    /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+)\s*)?\)$/,
  );
  if (rgba) {
    return {
      r: Number(rgba[1]),
      g: Number(rgba[2]),
      b: Number(rgba[3]),
      a: rgba[4] === undefined ? 1 : Number(rgba[4]),
    };
  }
  const hex = color.startsWith('#') ? color.slice(1) : color;
  const full =
    hex.length === 3
      ? hex
          .split('')
          .map(part => part + part)
          .join('')
      : hex;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) {
    return null;
  }
  return {
    r: parseInt(full.slice(0, 2), 16),
    g: parseInt(full.slice(2, 4), 16),
    b: parseInt(full.slice(4, 6), 16),
    a: 1,
  };
}

/**
 * Flattens a translucent `overlay` color onto an opaque `base` color.
 *
 * Surfaces that carry a hard shadow (`shadowOpacity: 1`) must be opaque:
 * on iOS the shadow is drawn through a translucent background and also
 * shadows the text, which reads as doubled, blurry labels. Falls back to
 * `overlay` when either color cannot be parsed.
 */
export function solidOver(overlay: string, base: string): string {
  const top = parseColor(overlay);
  const bottom = parseColor(base);
  if (!top || !bottom) {
    return overlay;
  }
  const mix = (a: number, b: number) => Math.round(a * top.a + b * (1 - top.a));
  const hex = (value: number) => value.toString(16).padStart(2, '0');
  return `#${hex(mix(top.r, bottom.r))}${hex(mix(top.g, bottom.g))}${hex(
    mix(top.b, bottom.b),
  )}`;
}
