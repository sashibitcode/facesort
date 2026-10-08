import * as faceapi from '@vladmandic/face-api';
import { cropFaceThumbnail, extractClothingHistogram } from './imageUtils.js';

let modelsLoaded = false;
let loadPromise = null;

const LOCAL_MODEL_PATH = '/models';
const CDN_MODEL_PATH = 'https://raw.githubusercontent.com/vladmandic/face-api/master/model';

/**
 * Initializes and loads the face-api.js neural network models.
 * Tries local /models folder first, falls back to raw CDN if necessary.
 * 
 * @param {Function} [onStatus] Callback reporting model loading steps
 * @returns {Promise<boolean>}
 */
export async function loadFaceModels(onStatus = () => {}) {
  if (modelsLoaded) return true;
  if (loadPromise) return loadPromise;

  loadPromise = (async () => {
    try {
      onStatus('Loading AI Face Detection models (local)...');
      
      // Load SSD MobileNet V1
      await faceapi.nets.ssdMobilenetv1.loadFromUri(LOCAL_MODEL_PATH);
      onStatus('Loading Face Landmarks model...');
      
      // Load 68-point facial landmarks
      await faceapi.nets.faceLandmark68Net.loadFromUri(LOCAL_MODEL_PATH);
      onStatus('Loading Face Recognition model...');
      
      // Load 128-d recognition network
      await faceapi.nets.faceRecognitionNet.loadFromUri(LOCAL_MODEL_PATH);
      
      modelsLoaded = true;
      onStatus('All AI models loaded successfully!');
      return true;
    } catch (localErr) {
      console.warn('Local model load failed, attempting CDN fallback:', localErr);
      onStatus('Local models not found. Loading from CDN fallback...');

      try {
        await faceapi.nets.ssdMobilenetv1.loadFromUri(CDN_MODEL_PATH);
        await faceapi.nets.faceLandmark68Net.loadFromUri(CDN_MODEL_PATH);
        await faceapi.nets.faceRecognitionNet.loadFromUri(CDN_MODEL_PATH);
        modelsLoaded = true;
        onStatus('AI models loaded from CDN!');
        return true;
      } catch (cdnErr) {
        console.error('All model loading attempts failed:', cdnErr);
        throw new Error('Could not load face recognition models. Please check your internet connection or verify /models folder.');
      }
    }
  })();

  return loadPromise;
}

/**
 * Returns whether models have been initialized
 */
export function areModelsLoaded() {
  return modelsLoaded;
}

/**
 * Detects faces in an image or pre-scaled canvas and extracts descriptors and thumbnails.
 * 
 * @param {HTMLCanvasElement|HTMLImageElement} imageSource 
 * @param {object} [options]
 * @param {number} [options.minConfidence=0.6] Detection confidence threshold (ignores weak detections)
 * @param {number} [options.minFaceSize=50] Minimum face size in pixels to prevent false positives
 * @returns {Promise<Array<{ descriptor: number[], box: {x,y,width,height}, thumbnail: string, score: number }>>}
 */
export async function detectFaces(imageSource, options = {}) {
  if (!modelsLoaded) {
    await loadFaceModels();
  }

  const minConfidence = options.minConfidence ?? 0.6;
  const minFaceSize = options.minFaceSize ?? 50;

  const detectionOptions = new faceapi.SsdMobilenetv1Options({
    minConfidence
  });

  // Run full detection pipeline: Detection -> 68 Landmarks -> 128-d Vector
  const detections = await faceapi
    .detectAllFaces(imageSource, detectionOptions)
    .withFaceLandmarks()
    .withFaceDescriptors();

  const faces = [];

  for (const det of detections) {
    const box = det.detection.box;

    // Filter out very small or blurry faces
    if (box.width < minFaceSize || box.height < minFaceSize) {
      continue;
    }

    // Extract cropped avatar thumbnail
    const thumbnail = cropFaceThumbnail(imageSource, box);

    // Extract normalized HSV clothing histogram from torso area below face
    const clothingHistogram = extractClothingHistogram(imageSource, box);

    // Convert Float32Array to standard array for serialization and clustering
    const descriptor = Array.from(det.descriptor);

    faces.push({
      box: {
        x: Math.round(box.x),
        y: Math.round(box.y),
        width: Math.round(box.width),
        height: Math.round(box.height)
      },
      descriptor,
      thumbnail,
      clothingHistogram,
      score: det.detection.score
    });
  }

  return faces;
}
