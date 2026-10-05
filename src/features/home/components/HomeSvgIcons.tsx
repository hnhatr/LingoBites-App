/**
 * HomeSvgIcons — Home-scoped SVG icon set (LING-256 AD-001, SVG-1, SVG-2).
 *
 * Each icon reproduces the Material Icons glyph path used in mockup v4.
 * Only Home screen components may import this file; `react-native-svg` is
 * intentionally scoped to `src/features/home` (cross-feature-private rule).
 *
 * Usage: <HomeIcon name="play_circle" size={24} color="#000" />
 */
import React from 'react';
import {Path, Svg} from 'react-native-svg';

export type HomeSvgIconName =
  | 'play_circle'
  | 'article'
  | 'style'
  | 'record_voice_over'
  | 'school'
  | 'local_fire_department'
  | 'pets'
  | 'emoji_events'
  | 'lock'
  | 'chevron_right';

type Props = {
  name: HomeSvgIconName;
  size?: number;
  color?: string;
  testID?: string;
};

// Material Icons glyph paths extracted from the official 24px SVG sources.
// viewBox is always "0 0 24 24".
const PATHS: Record<HomeSvgIconName, string> = {
  play_circle:
    'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z',
  article:
    'M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z',
  style:
    'M2.53 19.65l1.34.56v-9.03l-2.43 5.86c-.41 1.02.08 2.19 1.09 2.61zm19.5-3.7L16.42 3.05c-.43-1.01-1.6-1.49-2.61-1.05L7.26 4.96l-.01-.02c-.41-1.02-1.59-1.5-2.61-1.09L3.27 4.43c-1.01.41-1.49 1.59-1.08 2.6L7.38 19.7c.43 1.01 1.6 1.49 2.61 1.05l6.56-2.95.02.04c.43 1.01 1.6 1.49 2.61 1.05l1.37-.61c1.01-.43 1.49-1.6 1.08-2.59H22zm-8.64 2.92L6.78 7.49l6.38-2.86 6.57 12.38-6.44 2.96z',
  record_voice_over:
    'M12 14c1.66 0 2.99-1.34 2.99-3L15 5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z',
  school:
    'M5 13.18v4L12 21l7-3.82v-4L12 17l-7-3.82zM12 3 1 9l11 6 9-4.91V17h2V9L12 3z',
  local_fire_department:
    'M19.48 12.35c-1.57-4.08-7.16-4.3-5.81-10.23.1-.44-.37-.78-.75-.55C9.29 3.71 6.68 8 8.87 13.62c.18.46-.36.89-.75.59C6.55 12.66 6.5 11.2 6.61 10.17c.04-.38-.46-.59-.71-.29C4.63 11.18 3 13.08 3 16c0 4.42 3.58 8 8 8s8-3.58 8-8c0-1.95-.54-3.77-1.52-5.65z',
  pets: 'M4.5 9.5c0 1.1.9 2 2 2s2-.9 2-2-.9-2-2-2-2 .9-2 2zm9 0c0 1.1.9 2 2 2s2-.9 2-2-.9-2-2-2-2 .9-2 2zM11.5 5c0 1.1.9 2 2 2s2-.9 2-2-.9-2-2-2-2 .9-2 2zm-5 0c0 1.1.9 2 2 2s2-.9 2-2-.9-2-2-2-2 .9-2 2zm2.5 7c-2.33 0-7 1.17-7 3.5V18h14v-2.5c0-2.33-4.67-3.5-7-3.5z',
  emoji_events:
    'M19 5h-2V3H7v2H5c-1.1 0-2 .9-2 2v1c0 2.55 1.92 4.63 4.39 4.94.63 1.5 1.98 2.63 3.61 2.96V19H7v2h10v-2h-4v-3.1c1.63-.33 2.98-1.46 3.61-2.96C19.08 12.63 21 10.55 21 8V7c0-1.1-.9-2-2-2zM5 8V7h2v3.82C5.84 10.4 5 9.3 5 8zm14 0c0 1.3-.84 2.4-2 2.82V7h2v1z',
  lock: 'M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z',
  chevron_right: 'M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z',
};

export function HomeIcon({name, size = 24, color = '#000', testID}: Props) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={color}
      testID={testID ?? `home-icon-${name}`}
    >
      <Path d={PATHS[name]} fill={color} />
    </Svg>
  );
}
