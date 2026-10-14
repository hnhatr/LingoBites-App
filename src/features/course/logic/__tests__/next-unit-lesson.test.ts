import {findNextUnitLesson} from '../nextUnitLesson';

jest.mock('../courseClient', () => ({
  fetchUnitLessons: jest.fn(),
}));

const {fetchUnitLessons} = jest.requireMock('../courseClient') as {
  fetchUnitLessons: jest.Mock;
};

const lessons = [{id: 'a'}, {id: 'b'}, {id: 'c'}];

describe('findNextUnitLesson', () => {
  it('returns the lesson after the given one in unit order', async () => {
    fetchUnitLessons.mockResolvedValue({ok: true, value: lessons});
    await expect(findNextUnitLesson('unit-1', 'a')).resolves.toBe('b');
    expect(fetchUnitLessons).toHaveBeenCalledWith('unit-1', {
      fetchImpl: undefined,
    });
  });

  it('returns null on the last lesson or an unknown lesson', async () => {
    fetchUnitLessons.mockResolvedValue({ok: true, value: lessons});
    await expect(findNextUnitLesson('unit-1', 'c')).resolves.toBeNull();
    await expect(findNextUnitLesson('unit-1', 'z')).resolves.toBeNull();
  });

  it('returns null when the unit cannot load', async () => {
    fetchUnitLessons.mockResolvedValue({
      ok: false,
      kind: 'network-error',
      message: 'offline',
    });
    await expect(findNextUnitLesson('unit-1', 'a')).resolves.toBeNull();
  });
});
