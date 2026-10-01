import {getRootStackRouteNames} from '../rootStackRoutes';

describe('RootStack route registration (LING-149 TASK-008)', () => {
  it('registers only Tabs at the root after legacy flows were removed', () => {
    expect(getRootStackRouteNames({youtubeLearning: true})).toEqual(['Tabs']);
    expect(getRootStackRouteNames({youtubeLearning: false})).toEqual(['Tabs']);
    expect(getRootStackRouteNames({})).toEqual(['Tabs']);
  });
});
