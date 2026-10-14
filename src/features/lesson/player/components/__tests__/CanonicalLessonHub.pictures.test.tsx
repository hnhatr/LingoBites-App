import fs from 'node:fs';
import path from 'node:path';

import React from 'react';
import ReactTestRenderer, {act} from 'react-test-renderer';

import {AppThemeProvider} from '@ui/theme';

import {FeatureFlagProvider} from '@core/release';
import {
  type LessonSnapshot,
  LessonSnapshotResponseSchema,
} from '@core/schemas/lesson';

import {CanonicalLessonHub} from '../CanonicalLessonHub';

jest.mock('../../logic/lessonPictures', () => ({
  useLessonPictures: jest.fn(),
}));

const {useLessonPictures} = jest.requireMock('../../logic/lessonPictures') as {
  useLessonPictures: jest.Mock;
};

const COFFEE = '940f2909-9c3d-49d2-981b-1e52b1981d99';
const TEA = '1fff6487-5e01-4b0c-9966-2a7bc52f3d5d';
const PATTERN = 'a4446cc0-0a5a-4deb-934f-254368314797';

function catalogSnapshot(): LessonSnapshot {
  const raw = JSON.parse(
    fs.readFileSync(
      path.join(
        __dirname,
        '../../../../../core/schemas/__tests__/fixtures',
        'valid-lesson-snapshot-with-spec-response.json',
      ),
      'utf8',
    ),
  );
  return LessonSnapshotResponseSchema.parse(raw).lesson;
}

function render(snapshot: LessonSnapshot, onOpenSection = jest.fn()) {
  let tree!: ReactTestRenderer.ReactTestRenderer;
  act(() => {
    tree = ReactTestRenderer.create(
      <FeatureFlagProvider>
        <AppThemeProvider>
          <CanonicalLessonHub
            analyses={{}}
            onOpenSection={onOpenSection}
            snapshot={snapshot}
          />
        </AppThemeProvider>
      </FeatureFlagProvider>,
    );
  });
  return tree;
}

const byTestId = (tree: ReactTestRenderer.ReactTestRenderer, id: string) =>
  tree.root.findAll(node => node.props.testID === id);
const imageOf = (tree: ReactTestRenderer.ReactTestRenderer, id: string) =>
  byTestId(tree, `${id}-image`)[0]?.props.source?.uri;

describe('CanonicalLessonHub pictures', () => {
  it('shows the lesson cover and the words and phrases with their pictures', () => {
    useLessonPictures.mockReturnValue({
      coverUrl: 'https://cdn.test/lesson.png',
      itemImages: new Map([[COFFEE, 'https://cdn.test/coffee.png']]),
    });
    const onOpenSection = jest.fn();
    const tree = render(catalogSnapshot(), onOpenSection);

    expect(imageOf(tree, 'canonical-hub-cover')).toBe(
      'https://cdn.test/lesson.png',
    );
    expect(imageOf(tree, `canonical-hub-item-${COFFEE}-cover`)).toBe(
      'https://cdn.test/coffee.png',
    );
    // No picture: the default cover; patterns stay off the rail.
    expect(
      byTestId(tree, `canonical-hub-item-${TEA}-cover-default`).length,
    ).toBeGreaterThan(0);
    expect(byTestId(tree, `canonical-hub-item-${PATTERN}`)).toHaveLength(0);

    const all = byTestId(tree, 'canonical-hub-item-rail-all').find(
      node => typeof node.props.onPress === 'function',
    );
    act(() => all!.props.onPress());
    expect(onOpenSection).toHaveBeenCalledWith('vocabulary');
  });

  it('draws default covers until the pictures load', () => {
    useLessonPictures.mockReturnValue({coverUrl: null, itemImages: new Map()});
    const tree = render(catalogSnapshot());
    expect(
      byTestId(tree, 'canonical-hub-cover-default').length,
    ).toBeGreaterThan(0);
    expect(byTestId(tree, 'canonical-hub-item-rail').length).toBeGreaterThan(0);
  });
});
