import test from 'node:test';
import assert from 'node:assert/strict';
import { createDraftMediaFrame, nativePointToDisplay, displayPointToNative,
  nativeRectangleToDisplay, displayRectangleToNative, qualifyDraftReadingRegion } from '../../scripts/archives/draft-media-frames.mjs';

// Entirely invented asymmetric 7 x 5 raster, with a unique label at each pixel.
// Array transposition/reversal is independent of the edge-coordinate formulas.
const raster = Array.from({ length: 5 }, (_, y) => Array.from({ length: 7 }, (_, x) => `invented-${x}-${y}`));
const rotate = orientation => orientation === 6 ? raster[0].map((_, x) => raster.map(row => row[x]).reverse())
  : orientation === 8 ? raster[0].map((_, x) => raster.map(row => row[6 - x])) : raster.map(row => [...row]);
for (const orientation of [null, 1, 6, 8]) {
  test(`EXIF ${orientation ?? 'omitted'}: every invented pixel centre matches independently rotated asymmetric raster`, () => {
    const frame = createDraftMediaFrame({ codedWidth: 7, codedHeight: 5, exifOrientation: orientation });
    const displayed = rotate(orientation);
    assert.deepEqual([frame.displayWidth, frame.displayHeight], [displayed[0].length, displayed.length]);
    for (let y = 0; y < 5; y++) for (let x = 0; x < 7; x++) {
      const point = nativePointToDisplay(frame, [x + .5, y + .5]);
      assert.equal(displayed[Math.floor(point[1])][Math.floor(point[0])], raster[y][x]);
      assert.deepEqual(displayPointToNative(frame, point), [x + .5, y + .5]);
    }
    for (const rectangle of [[0, 0, 7, 5], [1, 1, 4, 2], [6, 4, 1, 1], [.5, 1.5, 2, 1]]) {
      const mapped = nativeRectangleToDisplay(frame, rectangle);
      assert.equal(mapped[2] * mapped[3], rectangle[2] * rectangle[3]);
      assert.deepEqual(displayRectangleToNative(frame, mapped), rectangle);
    }
  });
}
test('quarter-turn rectangles use raster edges without off-by-one or source mutation', () => {
  const region = { reference_frame: 'native-coded-raster', coordinate_units: 'pixel-edges-xywh', native_bbox: [1, 1, 4, 2] };
  const before = JSON.stringify(region);
  assert.deepEqual(qualifyDraftReadingRegion(createDraftMediaFrame({ codedWidth: 7, codedHeight: 5, exifOrientation: 6 }), region).displayRectangle, [2, 1, 2, 4]);
  assert.deepEqual(qualifyDraftReadingRegion(createDraftMediaFrame({ codedWidth: 7, codedHeight: 5, exifOrientation: 8 }), region).displayRectangle, [1, 2, 2, 4]);
  assert.equal(JSON.stringify(region), before);
});
test('ambiguous, transformed, missing and out-of-bounds regions remain pending, never inferred', () => {
  const frame = createDraftMediaFrame({ codedWidth: 7, codedHeight: 5, exifOrientation: 6 });
  for (const region of [null, { reference_frame: 'original-view', native_bbox: [1, 1, 4, 2] },
    { reference_frame: 'native-coded-raster', native_bbox: [1, 1, 4, 2] },
    { reference_frame: 'native-coded-raster', coordinate_units: 'pixel-edges-xywh', native_bbox: [6, 0, 2, 1] },
    { reference_frame: 'native-coded-raster', coordinate_units: 'pixel-edges-xywh', native_bbox: [1, 1, 4, 2], coordinate_transform: 'rotate 90 then crop' }]) {
    const result = qualifyDraftReadingRegion(frame, region);
    assert.equal(result.status, 'pending-reference-frame'); assert.equal(result.displayRectangle, null);
    assert.equal(result.individualWordRectangle, null); assert.equal(result.humanReview, 'pending');
  }
});
test('constructed frame and valid supported orientation are mandatory', () => {
  for (const orientation of [undefined, 0, 2, 3, 4, 5, 7, '6']) assert.throws(() => createDraftMediaFrame({ codedWidth: 7, codedHeight: 5, exifOrientation: orientation }));
  const frame = createDraftMediaFrame({ codedWidth: 7, codedHeight: 5, exifOrientation: 6 });
  assert.throws(() => nativePointToDisplay({ ...frame }, [0, 0]));
  for (const point of [[-1, 0], [8, 0], [0, 6], [NaN, 0]]) assert.throws(() => nativePointToDisplay(frame, point));
  for (const rectangle of [[0, 0, 0, 1], [0, 0, 1, -1], [0, 0, 8, 1]]) assert.throws(() => nativeRectangleToDisplay(frame, rectangle));
});
