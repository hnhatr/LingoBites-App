import {readFileSync} from 'node:fs';
import {join} from 'node:path';

import {
  getRootStackRouteNames,
  ROOT_FLOW_ROUTES,
  ROOT_INGESTION_ROUTES,
} from '../rootStackRoutes';

const navigatorSource = readFileSync(
  join(__dirname, '..', 'AppNavigator.tsx'),
  'utf8',
);

function section(start: string, end: string): string {
  return navigatorSource.slice(
    navigatorSource.indexOf(start),
    navigatorSource.indexOf(end),
  );
}

const tabStacks = section(
  'function HomeStackNavigator',
  'function TabNavigator',
);
const rootStack = section(
  'function AuthenticatedRootStack',
  'export function AppNavigator',
);

function countRegistrations(source: string, route: string): number {
  return source.split(`name="${route}"`).length - 1;
}

describe('Root stack layout (navigation redesign)', () => {
  it('mounts Tabs, the enabled create-flow inputs and every task flow', () => {
    expect(getRootStackRouteNames({})).toEqual(['Tabs', ...ROOT_FLOW_ROUTES]);
    expect(getRootStackRouteNames({pasteTextInput: true}).slice(0, 2)).toEqual([
      'Tabs',
      'PasteText',
    ]);
  });

  it('registers every task flow exactly once, on the root stack', () => {
    for (const route of [...ROOT_FLOW_ROUTES, ...ROOT_INGESTION_ROUTES]) {
      expect(countRegistrations(navigatorSource, route)).toBe(1);
      expect(countRegistrations(rootStack, route)).toBe(1);
      expect(countRegistrations(tabStacks, route)).toBe(0);
    }
  });

  it('keeps each tab stack to its hub screen (plus Profile settings pages)', () => {
    expect(countRegistrations(tabStacks, 'HomeMain')).toBe(1);
    expect(countRegistrations(tabStacks, 'CourseList')).toBe(1);
    expect(countRegistrations(tabStacks, 'LessonsList')).toBe(1);
    expect(countRegistrations(tabStacks, 'ProfileMain')).toBe(1);
  });

  it('wraps the authenticated container in the app navigation provider', () => {
    expect(navigatorSource).toContain('<AppNavigationProvider');
    expect(navigatorSource).toContain('ref={navigationRef}');
  });
});
