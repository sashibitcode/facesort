/**
 * Utilities for loading, resizing, and cropping face thumbnails from images.
 */

/**
 * Loads a File object into an HTMLImageElement
 * @param {File} file 
 * @returns {Promise<HTMLImageElement>}
 */
export function loadImage(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      // Keep objectUrl referenced for thumbnailing / display until revoked
      img._objectUrl = objectUrl;
      resolve(img);
    };

    img.onerror = (err) => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error(`Failed to load image "${file.name}": ${err?.message || 'corrupt or unsupported format'}`));
    };

    img.src = objectUrl;
  });
}

/**
 * Creates an offscreen canvas with the image downscaled to at most maxDim (e.g. 1600px).
 * Using 1600px preserves fine details for small faces in group photos.
 * 
 * @param {HTMLImageElement} img 
 * @param {number} maxDim 
 * @returns {{ canvas: HTMLCanvasElement, scale: number, originalWidth: number, originalHeight: number }}
 */
export function downscaleImage(img, maxDim = 1600) {
  const origW = img.naturalWidth || img.width;
  const origH = img.naturalHeight || img.height;

  let targetW = origW;
  let targetH = origH;
  let scale = 1;

  if (origW > maxDim || origH > maxDim) {
    if (origW >= origH) {
      targetW = maxDim;
      targetH = Math.round((origH * maxDim) / origW);
      scale = targetW / origW;
    } else {
      targetH = maxDim;
      targetW = Math.round((origW * maxDim) / origH);
      scale = targetH / origH;
    }
  }

  const canvas = document.createElement('canvas');
  canvas.width = targetW;
  canvas.height = targetH;

  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0, targetW, targetH);

  return {
    canvas,
    scale,
    originalWidth: origW,
    originalHeight: origH
  };
}

/**
 * Crops a square thumbnail around the detected face bounding box with padding.
 * 
 * @param {HTMLCanvasElement|HTMLImageElement} source 
 * @param {{ x: number, y: number, width: number, height: number }} box 
 * @param {number} paddingFrac e.g. 0.25 for 25% padding around face
 * @param {number} thumbSize Target square thumbnail dimension (e.g. 160)
 * @returns {string} Data URL of the cropped face
 */
export function cropFaceThumbnail(source, box, paddingFrac = 0.25, thumbSize = 160) {
  const padW = box.width * paddingFrac;
  const padH = box.height * paddingFrac;

  // Make square crop box
  const size = Math.max(box.width + padW * 2, box.height + padH * 2);
  const centerX = box.x + box.width / 2;
  const centerY = box.y + box.height / 2;

  let cropX = centerX - size / 2;
  let cropY = centerY - size / 2;

  // Clamp within source bounds
  const sourceW = source.width || source.naturalWidth;
  const sourceH = source.height || source.naturalHeight;

  if (cropX < 0) cropX = 0;
  if (cropY < 0) cropY = 0;
  const cropW = Math.min(size, sourceW - cropX);
  const cropH = Math.min(size, sourceH - cropY);

  const canvas = document.createElement('canvas');
  canvas.width = thumbSize;
  canvas.height = thumbSize;

  const ctx = canvas.getContext('2d');
  // Fill subtle dark background in case of non-square aspect clipping
  ctx.fillStyle = '#1e293b';
  ctx.fillRect(0, 0, thumbSize, thumbSize);

  try {
    ctx.drawImage(source, cropX, cropY, cropW, cropH, 0, 0, thumbSize, thumbSize);
    return canvas.toDataURL('image/jpeg', 0.85);
  } catch (err) {
    console.warn('Failed to crop face thumbnail:', err);
    return '';
  }
}

/**
 * Extracts a normalized HSV color histogram (8 hue x 4 sat x 4 val = 128 bins)
 * for the torso area below a detected face.
 * 
 * Torso box:
 * - starts just below the chin (top = y + height)
 * - width = 1.8x face width centered on the face
 * - height = 2.2x face height
 * - clipped to image bounds
 * - if box is under 30px tall, skips clothing (returns null)
 * 
 * @param {HTMLCanvasElement} canvas
 * @param {{ x: number, y: number, width: number, height: number }} box
 * @returns {number[]|null} Normalized 128-bin array or null if skipped
 */
export function extractClothingHistogram(canvas, box) {
  if (!canvas || !box) return null;
  const canvasW = canvas.width;
  const canvasH = canvas.height;

  const torsoW = box.width * 1.8;
  const torsoH = box.height * 2.2;
  const torsoLeft = (box.x + box.width / 2) - torsoW / 2;
  const torsoTop = box.y + box.height;

  const clipLeft = Math.max(0, Math.round(torsoLeft));
  const clipTop = Math.max(0, Math.round(torsoTop));
  const clipRight = Math.min(canvasW, Math.round(torsoLeft + torsoW));
  const clipBottom = Math.min(canvasH, Math.round(torsoTop + torsoH));

  const actualW = clipRight - clipLeft;
  const actualH = clipBottom - clipTop;

  // Skip clothing if under 30px tall or under 15px wide
  if (actualH < 30 || actualW < 15) {
    return null;
  }

  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  let imgData;
  try {
    imgData = ctx.getImageData(clipLeft, clipTop, actualW, actualH);
  } catch (err) {
    console.warn('Failed to extract torso image data:', err);
    return null;
  }

  const data = imgData.data;
  // 8 hue x 4 sat x 4 val = 128 bins
  const hist = new Float32Array(128);
  let totalPixels = 0;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i] / 255;
    const g = data[i + 1] / 255;
    const b = data[i + 2] / 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const delta = max - min;

    const v = max;
    const s = max === 0 ? 0 : delta / max;
    let h = 0;

    if (delta !== 0) {
      if (max === r) {
        h = 60 * (((g - b) / delta) % 6);
      } else if (max === g) {
        h = 60 * (((b - r) / delta) + 2);
      } else {
        h = 60 * (((r - g) / delta) + 4);
      }
      if (h < 0) h += 360;
    }

    // 8 hue bins: [0, 45), [45, 90), ...
    const hBin = Math.min(7, Math.floor(h / 45));
    // 4 sat bins: [0, 0.25), [0.25, 0.50), ...
    const sBin = Math.min(3, Math.floor(s * 4));
    // 4 val bins: [0, 0.25), [0.25, 0.50), ...
    const vBin = Math.min(3, Math.floor(v * 4));

    const binIdx = hBin * 16 + sBin * 4 + vBin;
    hist[binIdx] += 1;
    totalPixels++;
  }

  if (totalPixels === 0) return null;

  // Normalize so sum equals 1.0 (L1 normalization)
  for (let b = 0; b < 128; b++) {
    hist[b] /= totalPixels;
  }

  return Array.from(hist);
}

