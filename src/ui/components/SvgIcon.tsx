import React from 'react';
import {Path, Svg} from 'react-native-svg';

/**
 * Path data copied from `assets/svg/<name>.svg` (24px, viewBox 0 -960 960 960).
 * Add a name here by copying the `d` attribute of its asset file.
 */
const SVG_ICON_PATHS = {
  check_circle:
    'm424-296 282-282-56-56-226 226-114-114-56 56 170 170Zm56 216q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Zm0-80q134 0 227-93t93-227q0-134-93-227t-227-93q-134 0-227 93t-93 227q0 134 93 227t227 93Zm0-320Z',
  description:
    'M320-240h320v-80H320v80Zm0-160h320v-80H320v80ZM240-80q-33 0-56.5-23.5T160-160v-640q0-33 23.5-56.5T240-880h320l240 240v480q0 33-23.5 56.5T720-80H240Zm280-520v-200H240v640h480v-440H520ZM240-800v200-200 640-640Z',
  auto_stories:
    'M480-160q-48-38-104-59t-116-21q-42 0-82.5 11T100-198q-21 11-40.5-1T40-234v-482q0-11 5.5-21T62-752q46-24 96-36t102-12q58 0 113.5 15T480-740v484q51-32 107-48t113-16q36 0 70.5 6t69.5 18v-480q15 5 29.5 10.5T898-752q11 5 16.5 15t5.5 21v482q0 23-19.5 35t-40.5 1q-37-20-77.5-31T700-240q-60 0-116 21t-104 59Zm80-200v-380l200-200v400L560-360Zm-160 65v-396q-33-14-68.5-21.5T260-720q-37 0-72 7t-68 21v397q35-13 69.5-19t70.5-6q36 0 70.5 6t69.5 19Zm0 0v-396 396Z',
} as const;

export type SvgIconName = keyof typeof SVG_ICON_PATHS;

type Props = {
  name: SvgIconName;
  size?: number;
  color: string;
};

/** Decorative SVG icon; hidden from accessibility like `MaterialIcon`. */
export function SvgIcon({name, size = 24, color}: Props) {
  return (
    <Svg
      accessibilityElementsHidden
      height={size}
      importantForAccessibility="no"
      viewBox="0 -960 960 960"
      width={size}
    >
      <Path d={SVG_ICON_PATHS[name]} fill={color} />
    </Svg>
  );
}
