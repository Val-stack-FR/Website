// Coordinates are continuous raster edges, not integer pixel-centre indexes.
// EXIF rotates the browser's display only; source bytes and source regions stay sealed.
const frames = new WeakSet();
const check = (condition, message) => { if (!condition) throw new Error(`Draft media frame: ${message}`); };
export function createDraftMediaFrame({ codedWidth, codedHeight, exifOrientation }) {
  check(Number.isSafeInteger(codedWidth) && codedWidth > 0 && codedWidth <= 65535
    && Number.isSafeInteger(codedHeight) && codedHeight > 0 && codedHeight <= 65535, 'invalid coded dimensions');
  check([null, 1, 6, 8].includes(exifOrientation), 'unsupported or unspecified orientation');
  const quarterTurn = exifOrientation === 6 || exifOrientation === 8;
  const frame = Object.freeze({ codedWidth, codedHeight, exifOrientation,
    displayWidth: quarterTurn ? codedHeight : codedWidth,
    displayHeight: quarterTurn ? codedWidth : codedHeight,
    coordinateUnits: 'continuous-pixel-edges',
    transform: exifOrientation === 6 ? '(x,y) -> (H-y,x)' : exifOrientation === 8 ? '(x,y) -> (y,W-x)' : '(x,y) -> (x,y)' });
  frames.add(frame);
  return frame;
}
const frameCheck = frame => check(frames.has(frame), 'use a constructed frame');
const pointCheck = (point, width, height) => check(Array.isArray(point) && point.length === 2
  && point.every(Number.isFinite) && point[0] >= 0 && point[0] <= width && point[1] >= 0 && point[1] <= height, 'point outside raster edges');
export function nativePointToDisplay(frame, point) {
  frameCheck(frame); pointCheck(point, frame.codedWidth, frame.codedHeight);
  const [x, y] = point;
  if (frame.exifOrientation === 6) return [frame.codedHeight - y, x];
  if (frame.exifOrientation === 8) return [y, frame.codedWidth - x];
  return [x, y];
}
export function displayPointToNative(frame, point) {
  frameCheck(frame); pointCheck(point, frame.displayWidth, frame.displayHeight);
  const [x, y] = point;
  if (frame.exifOrientation === 6) return [y, frame.codedHeight - x];
  if (frame.exifOrientation === 8) return [frame.codedWidth - y, x];
  return [x, y];
}
function mapRectangle(frame, rectangle, inverse) {
  frameCheck(frame);
  check(Array.isArray(rectangle) && rectangle.length === 4 && rectangle.every(Number.isFinite), 'invalid xywh rectangle');
  const [x, y, width, height] = rectangle;
  check(width > 0 && height > 0, 'empty rectangle');
  const transform = inverse ? displayPointToNative : nativePointToDisplay;
  const corners = [[x, y], [x + width, y], [x, y + height], [x + width, y + height]].map(point => transform(frame, point));
  const xs = corners.map(point => point[0]), ys = corners.map(point => point[1]);
  return [Math.min(...xs), Math.min(...ys), Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)];
}
export const nativeRectangleToDisplay = (frame, rectangle) => mapRectangle(frame, rectangle, false);
export const displayRectangleToNative = (frame, rectangle) => mapRectangle(frame, rectangle, true);

// Only an explicit raster/units contract permits a display crop. A label such as
// "original-view" does not prove whether a previous tool had honored EXIF.
export function qualifyDraftReadingRegion(frame, region) {
  frameCheck(frame);
  const pending = reason => Object.freeze({ status: 'pending-reference-frame', reason, displayRectangle: null,
    individualWordRectangle: null, humanReview: 'pending' });
  if (!region || region.coordinate_units !== 'pixel-edges-xywh'
    || !['native-coded-raster', 'exif-display-raster'].includes(region.reference_frame)) return pending('Raster basis or coordinate units are not explicit.');
  if (region.coordinate_transform != null && region.coordinate_transform !== 'identity') return pending('A prior coordinate transform is not qualified.');
  try {
    const rectangle = region.reference_frame === 'native-coded-raster'
      ? nativeRectangleToDisplay(frame, region.native_bbox)
      : nativeRectangleToDisplay(frame, displayRectangleToNative(frame, region.native_bbox));
    return Object.freeze({ status: 'candidate-display-region', reason: null,
      displayRectangle: Object.freeze(rectangle), individualWordRectangle: null, humanReview: 'pending' });
  } catch { return pending('Declared rectangle is outside its explicit raster.'); }
}
