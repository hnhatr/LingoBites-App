/**
 * HomeSvgIcons tests (LING-256 TASK-001)
 *
 * Verifies that:
 * - Every HomeSvgIconName renders without errors under the Jest SVG mock (SVG-1, DQ-007).
 * - Default and explicit props propagate correctly.
 * - testID is applied for accessibility querying.
 */
import React from 'react';
import ReactTestRenderer, {act} from 'react-test-renderer';

import {HomeIcon, type HomeSvgIconName} from '../HomeSvgIcons';

const ALL_ICONS: HomeSvgIconName[] = [
  'play_circle',
  'article',
  'style',
  'record_voice_over',
  'school',
  'local_fire_department',
  'pets',
  'emoji_events',
  'lock',
  'chevron_right',
];

describe('HomeIcon (SVG-1, SVG-2, DQ-007)', () => {
  it('renders every icon name without throwing', async () => {
    for (const name of ALL_ICONS) {
      let tree: ReactTestRenderer.ReactTestRenderer | null = null;
      await act(async () => {
        tree = ReactTestRenderer.create(
          <HomeIcon name={name} size={24} color="#226FAB" />,
        );
      });
      expect(tree).not.toBeNull();
      tree!.unmount();
    }
  });

  it('applies the default testID based on icon name', async () => {
    let tree!: ReactTestRenderer.ReactTestRenderer;
    await act(async () => {
      tree = ReactTestRenderer.create(<HomeIcon name="pets" />);
    });
    const nodes = tree.root.findAll(
      node => node.props.testID === 'home-icon-pets',
    );
    expect(nodes.length).toBeGreaterThan(0);
    tree.unmount();
  });

  it('applies a custom testID when supplied', async () => {
    let tree!: ReactTestRenderer.ReactTestRenderer;
    await act(async () => {
      tree = ReactTestRenderer.create(
        <HomeIcon name="local_fire_department" testID="streak-flame-icon" />,
      );
    });
    const nodes = tree.root.findAll(
      node => node.props.testID === 'streak-flame-icon',
    );
    expect(nodes.length).toBeGreaterThan(0);
    tree.unmount();
  });

  it('passes size and color to the Svg element', async () => {
    let tree!: ReactTestRenderer.ReactTestRenderer;
    await act(async () => {
      tree = ReactTestRenderer.create(
        <HomeIcon name="emoji_events" size={32} color="#EB6B6C" />,
      );
    });
    const svgNode = tree.root.findAll(
      node =>
        node.props.width === 32 &&
        node.props.height === 32 &&
        node.props.fill === '#EB6B6C',
    );
    expect(svgNode.length).toBeGreaterThan(0);
    tree.unmount();
  });
});
