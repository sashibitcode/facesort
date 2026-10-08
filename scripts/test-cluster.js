import { 
  euclideanDistance, 
  computeCentroid, 
  computeMedoidDescriptor,
  histogramIntersection,
  completeLinkageCluster, 
  isGoodFace, 
  clusterFaces, 
  computeInternalDistances,
  mergePersons, 
  movePhoto 
} from '../src/utils/clusterEngine.js';

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ Assertion Failed: ${message}`);
    process.exit(1);
  }
  console.log(`✓ ${message}`);
}

console.log('--- Testing FaceSort Blur Folder & Clothing Second Pass Engine ---');

// 1. Test Histogram Intersection
const histA = new Float32Array(128).fill(1 / 128);
const histB = new Float32Array(128).fill(1 / 128);
assert(Math.abs(histogramIntersection(histA, histB) - 1.0) < 1e-5, 'Identical histograms have intersection 1.0');

const histDisjoint1 = new Float32Array(128);
histDisjoint1[0] = 1.0;
const histDisjoint2 = new Float32Array(128);
histDisjoint2[1] = 1.0;
assert(histogramIntersection(histDisjoint1, histDisjoint2) === 0.0, 'Disjoint histograms have intersection 0.0');

// 2. Test Good Face definition
assert(isGoodFace({ score: 0.9, box: { width: 95 } }) === true, 'Score >= 0.85 and width >= 90 is a good face');
assert(isGoodFace({ score: 0.80, box: { width: 100 } }) === false, 'Score 0.80 is not a good face');

// 3. Test Clothing Matching Second Pass
// Setup:
// Person 1 (Rahul) wears a distinct Blue/Red shirt (histOutfitP1)
// Person 2 (Bob) wears a distinct Green shirt (histOutfitP2)

const histOutfitP1 = new Float32Array(128);
histOutfitP1[10] = 0.6;
histOutfitP1[20] = 0.4;

const histOutfitP2 = new Float32Array(128);
histOutfitP2[80] = 0.8;
histOutfitP2[90] = 0.2;

const descP1 = new Array(128).fill(0.1);
const descP2 = new Array(128).fill(0.8);

// Blurry face with same shirt as Rahul (histOutfitP1) and face dist ~0.58 (> 0.52 inconclusive for face pass, but < 0.65)
const descBlurRahul = new Array(128).fill(0.1513); // dist to P1 = 0.58
// Blurry face with same shirt as Rahul BUT same-photo collision with Rahul
const descBlurSamePhoto = new Array(128).fill(0.1513);
// Blurry face with same shirt as Rahul BUT face distance 0.85 (> 0.65, strongly disagrees)
const descBlurDisagrees = new Array(128).fill(0.9);

const mockImages = [
  // Rahul solo clear photo
  {
    id: 'photo_rahul_clear',
    name: 'rahul_clear.jpg',
    faces: [{
      id: 'f_p1',
      imageId: 'photo_rahul_clear',
      descriptor: descP1,
      clothingHistogram: Array.from(histOutfitP1),
      score: 0.95,
      box: { width: 100 }
    }]
  },
  // Bob solo clear photo
  {
    id: 'photo_bob_clear',
    name: 'bob_clear.jpg',
    faces: [{
      id: 'f_p2',
      imageId: 'photo_bob_clear',
      descriptor: descP2,
      clothingHistogram: Array.from(histOutfitP2),
      score: 0.95,
      box: { width: 100 }
    }]
  },
  // Case A: Blurry Rahul (score 0.6, width 40). Clothing matches P1 (>0.85, gap >= 0.10, dist < 0.65)
  // Should be MOVED TO RAHUL by clothing pass!
  {
    id: 'photo_rahul_blur_matched',
    name: 'rahul_blur_matched.jpg',
    faces: [{
      id: 'f_blur1',
      imageId: 'photo_rahul_blur_matched',
      descriptor: descBlurRahul,
      clothingHistogram: Array.from(histOutfitP1), // exact clothing match!
      score: 0.62,
      box: { width: 45 }
    }]
  },
  // Case B: Blurry face in Rahul's clear photo (Same-Photo rule: cannot be assigned to Rahul!)
  // Should STAY IN BLUR!
  {
    id: 'photo_rahul_clear', // same photo as Rahul!
    name: 'rahul_clear.jpg',
    faces: [{
      id: 'f_blur_same_photo',
      imageId: 'photo_rahul_clear',
      descriptor: descBlurSamePhoto,
      clothingHistogram: Array.from(histOutfitP1),
      score: 0.60,
      box: { width: 40 }
    }]
  },
  // Case C: Blurry face with Rahul's clothes BUT face strongly disagrees (dist > 0.65)
  // Should STAY IN BLUR!
  {
    id: 'photo_stranger_same_clothes',
    name: 'stranger_same_clothes.jpg',
    faces: [{
      id: 'f_stranger',
      imageId: 'photo_stranger_same_clothes',
      descriptor: descBlurDisagrees,
      clothingHistogram: Array.from(histOutfitP1),
      score: 0.65,
      box: { width: 45 }
    }]
  }
];

const result = clusterFaces(mockImages, 0.48);

console.log('Result summary:', {
  persons: result.persons.map(p => ({
    name: p.name,
    photoCount: p.photoCount,
    photos: p.photos.map(ph => ({ name: ph.name, matchedByClothes: ph.matchedByClothes }))
  })),
  blurPhotos: result.blurPhotos.map(p => p.name),
  debugInfo: result.debugInfo
});

// Check Rahul: should contain rahul_clear.jpg AND rahul_blur_matched.jpg!
const rahul = result.persons.find(p => p.photos.some(ph => ph.name === 'rahul_clear.jpg'));
assert(rahul !== undefined, 'Rahul folder created');
assert(rahul.photos.some(ph => ph.name === 'rahul_blur_matched.jpg' && ph.matchedByClothes === true), 'rahul_blur_matched.jpg was moved to Rahul by clothing pass with matchedByClothes badge!');

// Check that Case B and Case C stayed in Blur
assert(result.blurPhotos.some(p => p.name === 'stranger_same_clothes.jpg'), 'stranger_same_clothes.jpg stayed in Blur (face strongly disagreed)');

// Check Debug Info metrics
assert(result.debugInfo.movedByClothing === 1, `1 face moved by clothing (got ${result.debugInfo.movedByClothing})`);
assert(result.debugInfo.blurInitialFaces >= 3, `Initial blur faces counted properly (got ${result.debugInfo.blurInitialFaces})`);
assert(result.debugInfo.blurRemainingFaces === 2, `2 faces remaining in Blur (got ${result.debugInfo.blurRemainingFaces})`);

console.log('✅ ALL BLUR FOLDER & CLOTHING SECOND PASS TESTS PASSED SUCCESSFULLY!');

console.log('\n--- Testing SMART MERGE OF DUPLICATE PERSONS Engine ---');

function makeVec(delta) {
  return new Array(128).fill(delta);
}

const sqrt128 = Math.sqrt(128);

// Test 1: Auto-merge when centroid distance < 0.52
// Person A in photo1 (v=0), Person B in photo2 (v=0.044194 -> dist=0.50)
// Both are good faces, separate photos. Should be auto-merged into 1 person!
const imgSm1 = [
  {
    id: 'sm_img_1',
    name: 'sm_1.jpg',
    faces: [{
      id: 'f_sm_1',
      imageId: 'sm_img_1',
      descriptor: makeVec(0.0),
      score: 0.95,
      box: { width: 100 }
    }]
  },
  {
    id: 'sm_img_2',
    name: 'sm_2.jpg',
    faces: [{
      id: 'f_sm_2',
      imageId: 'sm_img_2',
      descriptor: makeVec(0.50 / sqrt128),
      score: 0.95,
      box: { width: 100 }
    }]
  }
];

const resSm1 = clusterFaces(imgSm1, 0.48);
assert(resSm1.persons.length === 1, `Centroid distance 0.50 (< 0.52) auto-merges: expected 1 person, got ${resSm1.persons.length}`);
assert(resSm1.debugInfo.mergesAutoCount === 1, `mergesAutoCount is 1 (got ${resSm1.debugInfo.mergesAutoCount})`);

// Test 2: SAME-PHOTO RULE blocks merge even if centroid distance < 0.52
// Two faces in the SAME photo with dist = 0.49
const imgSmSamePhoto = [
  {
    id: 'sm_img_same',
    name: 'sm_same.jpg',
    faces: [
      {
        id: 'f_sp_1',
        imageId: 'sm_img_same',
        descriptor: makeVec(0.0),
        score: 0.95,
        box: { width: 100 }
      },
      {
        id: 'f_sp_2',
        imageId: 'sm_img_same',
        descriptor: makeVec(0.49 / sqrt128),
        score: 0.95,
        box: { width: 100 }
      }
    ]
  }
];

const resSmSame = clusterFaces(imgSmSamePhoto, 0.48);
assert(resSmSame.persons.length === 2, `Same photo rule prevents merge: expected 2 persons, got ${resSmSame.persons.length}`);
assert(resSmSame.debugInfo.rejectedBySamePhotoCount >= 1, `rejectedBySamePhotoCount tracked: got ${resSmSame.debugInfo.rejectedBySamePhotoCount}`);

// Test 3: Safety check - undo merge if largest internal distance > 0.65
// Cluster A has 2 faces (dist 0.40 apart: v=0.0 and v=0.40/sqrt128)
// Cluster B has 1 face (v=0.46/sqrt128). Centroid dist to A is ~0.26, BUT dist between v=0 and v=0.70 is > 0.65
const imgSmSafety = [
  {
    id: 'sm_safe_1',
    name: 'sm_safe_1.jpg',
    faces: [{
      id: 'f_safe_1',
      imageId: 'sm_safe_1',
      descriptor: makeVec(0.0),
      score: 0.95,
      box: { width: 100 }
    }]
  },
  {
    id: 'sm_safe_2',
    name: 'sm_safe_2.jpg',
    faces: [{
      id: 'f_safe_2',
      imageId: 'sm_safe_2',
      descriptor: makeVec(0.70 / sqrt128), // dist to f_safe_1 is 0.70 > 0.65!
      score: 0.95,
      box: { width: 100 }
    }]
  }
];

const resSmSafety = clusterFaces(imgSmSafety, 0.48);
assert(resSmSafety.persons.length === 2, `Safety check prevents merge when max internal distance > 0.65: got ${resSmSafety.persons.length}`);

// Test 4: Safety check - 5+ photos each with centroid distance > 0.50
// Person A has 5 photos at v=0. Person B has 5 photos at dist=0.51 (> 0.50).
const img5Photos = [];
for (let i = 0; i < 5; i++) {
  img5Photos.push({
    id: `img_a_${i}`,
    name: `a_${i}.jpg`,
    faces: [{ id: `fa_${i}`, imageId: `img_a_${i}`, descriptor: makeVec(0.0), score: 0.95, box: { width: 100 } }]
  });
}
for (let i = 0; i < 5; i++) {
  img5Photos.push({
    id: `img_b_${i}`,
    name: `b_${i}.jpg`,
    faces: [{ id: `fb_${i}`, imageId: `img_b_${i}`, descriptor: makeVec(0.51 / sqrt128), score: 0.95, box: { width: 100 } }]
  });
}
const res5Photos = clusterFaces(img5Photos, 0.48);
assert(res5Photos.persons.length === 2, `5+ photos each with centroid > 0.50 never merged: expected 2 persons, got ${res5Photos.persons.length}`);

// Test 5: Clothing Help for Merging
// Centroid distance = 0.55 (between 0.52 and 0.58).
// Clothing similarity > 0.90 -> should auto-merge!
const histSameClothing = new Float32Array(128);
histSameClothing[5] = 0.5;
histSameClothing[15] = 0.5;

const imgClothingMerge = [
  {
    id: 'cloth_m_1',
    name: 'cloth_1.jpg',
    faces: [{
      id: 'f_cm_1',
      imageId: 'cloth_m_1',
      descriptor: makeVec(0.0),
      clothingHistogram: Array.from(histSameClothing),
      score: 0.95,
      box: { width: 100 }
    }]
  },
  {
    id: 'cloth_m_2',
    name: 'cloth_2.jpg',
    faces: [{
      id: 'f_cm_2',
      imageId: 'cloth_m_2',
      descriptor: makeVec(0.55 / sqrt128), // dist = 0.55
      clothingHistogram: Array.from(histSameClothing), // similarity = 1.0 > 0.90!
      score: 0.95,
      box: { width: 100 }
    }]
  }
];

const resClothingMerge = clusterFaces(imgClothingMerge, 0.48);
assert(resClothingMerge.persons.length === 1, `Clothing help merges persons when centroid is 0.55 and clothing sim > 0.90: got ${resClothingMerge.persons.length}`);
assert(resClothingMerge.debugInfo.mergesAutoCount === 1, `Auto-merges count updated: got ${resClothingMerge.debugInfo.mergesAutoCount}`);

// Test 6: Suggested Merges (0.52 - 0.60) when not auto-merged
// Centroid distance = 0.56, no matching clothes.
// Should NOT auto-merge, but should appear in suggestedMerges!
const histDiffClothing1 = new Float32Array(128);
histDiffClothing1[1] = 1.0;
const histDiffClothing2 = new Float32Array(128);
histDiffClothing2[2] = 1.0;

const imgSuggested = [
  {
    id: 'sugg_1',
    name: 'sugg_1.jpg',
    faces: [{
      id: 'f_sg_1',
      imageId: 'sugg_1',
      descriptor: makeVec(0.0),
      clothingHistogram: Array.from(histDiffClothing1),
      score: 0.95,
      box: { width: 100 }
    }]
  },
  {
    id: 'sugg_2',
    name: 'sugg_2.jpg',
    faces: [{
      id: 'f_sg_2',
      imageId: 'sugg_2',
      descriptor: makeVec(0.56 / sqrt128), // dist = 0.56
      clothingHistogram: Array.from(histDiffClothing2),
      score: 0.95,
      box: { width: 100 }
    }]
  }
];

const resSuggested = clusterFaces(imgSuggested, 0.48);
assert(resSuggested.persons.length === 2, `Not auto-merged: 2 persons kept`);
assert(resSuggested.suggestedMerges.length === 1, `Suggested merge found: expected 1, got ${resSuggested.suggestedMerges.length}`);
assert(resSuggested.debugInfo.suggestedMergesCount === 1, `debugInfo.suggestedMergesCount is 1`);

// Test 7: Dismissed Pairs ("Not same" button memory)
const dismissed = new Set();
const pKey = [resSuggested.persons[0].id, resSuggested.persons[1].id].sort().join(':::');
dismissed.add(pKey);

const resDismissed = clusterFaces(imgSuggested, 0.48, new Map(), dismissed);
assert(resDismissed.suggestedMerges.length === 0, `"Not same" remembers dismissed pair: expected 0 suggested, got ${resDismissed.suggestedMerges.length}`);

console.log('✅ ALL SMART MERGE OF DUPLICATE PERSONS TESTS PASSED SUCCESSFULLY!');

