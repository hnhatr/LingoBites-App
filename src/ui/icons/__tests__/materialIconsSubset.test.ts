import fs from 'fs';
import path from 'path';

const SUBSET_FONT = path.join(
  __dirname,
  '../../../../assets/fonts/MaterialIcons.ttf',
);
const FULL_FONT = path.join(
  __dirname,
  '../../../../node_modules/react-native-vector-icons/Fonts/MaterialIcons.ttf',
);

describe('MaterialIcons subset font', () => {
  it('ships a committed subset smaller than the upstream font', () => {
    expect(fs.existsSync(SUBSET_FONT)).toBe(true);

    const subsetBytes = fs.statSync(SUBSET_FONT).size;
    const fullBytes = fs.statSync(FULL_FONT).size;

    expect(subsetBytes).toBeGreaterThan(0);
    expect(subsetBytes).toBeLessThan(fullBytes / 4);
  });
});
