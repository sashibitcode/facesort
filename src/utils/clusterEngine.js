/**
 * Face clustering and grouping engine.
 * Implements Complete Linkage Agglomerative Clustering, Same-Photo Constraint,
 * Outlier Removal using Medoid, and Clothing-Based Second Pass for Blur Faces.
 */

/**
 * Calculates Euclidean distance between two 128-dimensional vectors.
 * @param {number[]} v1 
 * @param {number[]} v2 
 * @returns {number}
 */
export function euclideanDistance(v1, v2) {
  let sum = 0;
  for (let i = 0; i < v1.length; i++) {
    const diff = v1[i] - v2[i];
    sum += diff * diff;
  }
  return Math.sqrt(sum);
}

/**
 * Computes histogram intersection between two normalized histograms.
 * Returns a similarity score between 0.0 (completely disjoint) and 1.0 (identical).
 * 
 * @param {number[]} histA 
 * @param {number[]} histB 
 * @returns {number}
 */
export function histogramIntersection(histA, histB) {
  if (!histA || !histB || histA.length !== histB.length) return 0;
  let intersection = 0;
  for (let i = 0; i < histA.length; i++) {
    intersection += Math.min(histA[i], histB[i]);
  }
  return intersection;
}

/**
 * Computes the mean (centroid) descriptor of a cluster of descriptors.
 * @param {number[][]} descriptors 
 * @returns {number[]}
 */
export function computeCentroid(descriptors) {
  if (!descriptors || descriptors.length === 0) return [];
  const dim = descriptors[0].length;
  const centroid = new Array(dim).fill(0);

  for (const desc of descriptors) {
    for (let i = 0; i < dim; i++) {
      centroid[i] += desc[i];
    }
  }

  for (let i = 0; i < dim; i++) {
    centroid[i] /= descriptors.length;
  }

  return centroid;
}

/**
 * Computes the Medoid descriptor of a set of faces.
 * The medoid is the face whose descriptor has the minimum sum of distances to all other descriptors.
 * 
 * @param {Array<object>} faces 
 * @returns {number[]} 128-d medoid descriptor
 */
export function computeMedoidDescriptor(faces) {
  if (!faces || faces.length === 0) return [];
  if (faces.length === 1) return faces[0].descriptor;

  let minSum = Infinity;
  let bestDesc = faces[0].descriptor;

  for (let i = 0; i < faces.length; i++) {
    let sum = 0;
    for (let j = 0; j < faces.length; j++) {
      if (i !== j) {
        sum += euclideanDistance(faces[i].descriptor, faces[j].descriptor);
      }
    }
    if (sum < minSum) {
      minSum = sum;
      bestDesc = faces[i].descriptor;
    }
  }

  return bestDesc;
}

/**
 * Checks if a face qualifies as a "good face" (used as reference descriptors for a person).
 * Definition: detection score >= 0.85 and face width >= 90px.
 * 
 * @param {object} face 
 * @returns {boolean}
 */
export function isGoodFace(face) {
  const score = face.score !== undefined ? face.score : 1.0;
  const width = face.box?.width || 0;
  return score >= 0.85 && width >= 90;
}

/**
 * Performs Agglomerative Hierarchical Clustering with COMPLETE LINKAGE (Maximum distance)
 * and enforces the SAME-PHOTO CONSTRAINT (faces from the same photo cannot be in the same cluster).
 * 
 * @param {Array<object>} faces Array of face objects, each with .descriptor and .imageId
 * @param {number} threshold Maximum allowable distance to merge
 * @returns {Array<{ faces: Array<object>, imageIds: Set<string> }>}
 */
export function completeLinkageCluster(faces, threshold) {
  const n = faces.length;
  if (n === 0) return [];
  if (n === 1) return [{ faces: [faces[0]], imageIds: new Set([faces[0].imageId]) }];

  // 1. Initialize distance matrix with Same-Photo Constraint
  const dist = [];
  for (let i = 0; i < n; i++) {
    dist[i] = new Float32Array(n);
    for (let j = 0; j < i; j++) {
      if (faces[i].imageId === faces[j].imageId) {
        dist[i][j] = Infinity;
        dist[j][i] = Infinity;
      } else {
        const d = euclideanDistance(faces[i].descriptor, faces[j].descriptor);
        dist[i][j] = d;
        dist[j][i] = d;
      }
    }
  }

  // 2. Track active clusters
  const active = new Array(n).fill(true);
  const clusterFacesList = faces.map(f => [f]);
  const clusterImageIds = faces.map(f => new Set([f.imageId]));

  const cDist = [];
  for (let i = 0; i < n; i++) {
    cDist[i] = new Float32Array(n);
    for (let j = 0; j < n; j++) {
      cDist[i][j] = dist[i][j];
    }
  }

  // 3. Iteratively merge closest clusters under threshold
  while (true) {
    let minD = Infinity;
    let mergeI = -1;
    let mergeJ = -1;

    for (let i = 0; i < n; i++) {
      if (!active[i]) continue;
      for (let j = i + 1; j < n; j++) {
        if (!active[j]) continue;
        if (cDist[i][j] < minD) {
          minD = cDist[i][j];
          mergeI = i;
          mergeJ = j;
        }
      }
    }

    if (mergeI === -1 || minD > threshold || !isFinite(minD)) {
      break;
    }

    // Merge J into I using Complete Linkage
    for (let k = 0; k < n; k++) {
      if (!active[k] || k === mergeI || k === mergeJ) continue;

      let hasOverlap = false;
      for (const imgId of clusterImageIds[mergeJ]) {
        if (clusterImageIds[k].has(imgId)) {
          hasOverlap = true;
          break;
        }
      }

      if (hasOverlap) {
        cDist[mergeI][k] = Infinity;
        cDist[k][mergeI] = Infinity;
      } else {
        const maxD = Math.max(cDist[mergeI][k], cDist[mergeJ][k]);
        cDist[mergeI][k] = maxD;
        cDist[k][mergeI] = maxD;
      }
    }

    clusterFacesList[mergeI].push(...clusterFacesList[mergeJ]);
    for (const imgId of clusterImageIds[mergeJ]) {
      clusterImageIds[mergeI].add(imgId);
    }

    active[mergeJ] = false;
    clusterFacesList[mergeJ] = [];
    clusterImageIds[mergeJ].clear();
  }

  const clusters = [];
  for (let i = 0; i < n; i++) {
    if (active[i] && clusterFacesList[i].length > 0) {
      clusters.push({
        faces: clusterFacesList[i],
        imageIds: clusterImageIds[i]
      });
    }
  }

  return clusters;
}

/**
 * Calculates internal pairwise distance statistics for a person's faces.
 * 
 * @param {Array<object>} faces 
 * @returns {{ avgInternalDist: number, maxInternalDist: number, isHighVariance: boolean }}
 */
export function computeInternalDistances(faces) {
  if (!faces || faces.length <= 1) {
    return { avgInternalDist: 0.0, maxInternalDist: 0.0, isHighVariance: false };
  }

  let totalDist = 0;
  let maxDist = 0;
  let count = 0;

  for (let i = 0; i < faces.length; i++) {
    for (let j = i + 1; j < faces.length; j++) {
      const d = euclideanDistance(faces[i].descriptor, faces[j].descriptor);
      totalDist += d;
      if (d > maxDist) maxDist = d;
      count++;
    }
  }

  const avgDist = count > 0 ? totalDist / count : 0.0;
  const isHighVariance = maxDist > 0.55;

  return {
    avgInternalDist: parseFloat(avgDist.toFixed(3)),
    maxInternalDist: parseFloat(maxDist.toFixed(3)),
    isHighVariance
  };
}

/**
 * Two-pass/Three-pass Face Clustering with Complete Linkage, Same-Photo Constraint,
 * Outlier Removal, and Clothing-Based Second Pass for Blur Faces.
 * 
 * @param {Array<{ id: string, name: string, file: File, faces: Array<object> }>} processedImages 
 * @param {number} [threshold=0.48] Strictness threshold (0.40 to 0.60, default 0.48)
 * @param {Map<string, string>} [preservedNames] Map of personId -> customName
 * @returns {{
 *   persons: Array<object>,
 *   blurPhotos: Array<object>,
 *   blurFaces: Array<object>,
 *   noFacePhotos: Array<object>,
 *   debugInfo: { totalFaces: number, goodFaces: number, totalPersons: number, blurInitialFaces: number, movedByClothing: number, blurRemainingFaces: number, blurPhotos: number, noFacePhotos: number }
 * }}
 */
export function clusterFaces(processedImages, threshold = 0.48, preservedNames = new Map(), dismissedPairs = new Set()) {
  const allFaceInstances = [];
  const noFacePhotos = [];

  for (const img of processedImages) {
    if (!img.faces || img.faces.length === 0) {
      noFacePhotos.push(img);
    } else {
      for (const face of img.faces) {
        allFaceInstances.push({
          ...face,
          image: img,
          imageId: img.id
        });
      }
    }
  }

  // 1. Separate into Good Faces (references) and Remaining Faces
  const goodFaces = [];
  const remainingFaces = [];

  for (const face of allFaceInstances) {
    if (isGoodFace(face)) {
      goodFaces.push(face);
    } else {
      remainingFaces.push(face);
    }
  }

  // Threshold adjustments according to slider (default 0.48):
  const pass1Threshold = threshold;
  const pass2Threshold = threshold + 0.04; // 0.52
  const pass3Threshold = threshold; // 0.48
  const autoMergeAvgThreshold = threshold - 0.03; // 0.45
  const autoMergeTop3MaxThreshold = threshold + 0.02; // 0.50
  const outlierThreshold = 0.55;

  // PASS 1: Build main persons using only GOOD faces with COMPLETE LINKAGE
  let mainClusters = [];
  if (goodFaces.length > 0) {
    const rawClusters = completeLinkageCluster(goodFaces, pass1Threshold);
    mainClusters = rawClusters.map(c => ({
      referenceFaces: [...c.faces],
      assignedFaces: [...c.faces],
      imageIds: new Set(c.imageIds),
      matchedByClothesPhotoIds: new Set()
    }));
  }

  // PASS 2: Assign remaining faces (small, side, blurry)
  const pendingFaces = [];
  const blurFaces = [];

  for (const remFace of remainingFaces) {
    if (mainClusters.length === 0) {
      pendingFaces.push(remFace);
      continue;
    }

    const candidates = [];

    for (let cIdx = 0; cIdx < mainClusters.length; cIdx++) {
      const cluster = mainClusters[cIdx];

      // SAME-PHOTO RULE: Cannot assign if this cluster already contains a face from this photo!
      if (cluster.imageIds.has(remFace.imageId)) {
        continue;
      }

      const refList = cluster.referenceFaces.length > 0 ? cluster.referenceFaces : cluster.assignedFaces;
      if (refList.length === 0) continue;

      const dists = refList.map(rf => euclideanDistance(remFace.descriptor, rf.descriptor));
      dists.sort((a, b) => a - b);

      const topK = dists.slice(0, Math.min(5, dists.length));
      const avgDist = topK.reduce((a, b) => a + b, 0) / topK.length;

      candidates.push({ clusterIndex: cIdx, avgDist });
    }

    if (candidates.length === 0) {
      pendingFaces.push(remFace);
      continue;
    }

    candidates.sort((a, b) => a.avgDist - b.avgDist);
    const best = candidates[0];
    const secondBestDist = candidates.length > 1 ? candidates[1].avgDist : Infinity;
    const gap = secondBestDist - best.avgDist;

    if (best.avgDist < pass2Threshold) {
      if (gap >= 0.04) {
        const targetCluster = mainClusters[best.clusterIndex];
        targetCluster.assignedFaces.push(remFace);
        targetCluster.imageIds.add(remFace.imageId);
      } else {
        // Ambiguous match (gap < 0.04): send to Blur directly
        blurFaces.push(remFace);
      }
    } else {
      pendingFaces.push(remFace);
    }
  }

  // PASS 3: Handle pending faces
  if (pendingFaces.length > 0) {
    const pendingClusters = completeLinkageCluster(pendingFaces, pass3Threshold);

    for (const pCluster of pendingClusters) {
      if (pCluster.imageIds.size >= 3) {
        mainClusters.push({
          referenceFaces: [...pCluster.faces],
          assignedFaces: [...pCluster.faces],
          imageIds: new Set(pCluster.imageIds),
          matchedByClothesPhotoIds: new Set()
        });
      } else {
        // All other pending faces go to Blur
        blurFaces.push(...pCluster.faces);
      }
    }
  }

  // SECTION 3: RE-CHECK OUTLIERS
  for (const cluster of mainClusters) {
    if (cluster.assignedFaces.length <= 1) continue;

    const medoidDesc = computeMedoidDescriptor(cluster.assignedFaces);
    const validAssigned = [];
    const validReference = [];
    const validImageIds = new Set();

    for (const f of cluster.assignedFaces) {
      const d = euclideanDistance(f.descriptor, medoidDesc);
      if (d > outlierThreshold) {
        // Outlier detected: send to Blur
        blurFaces.push(f);
      } else {
        validAssigned.push(f);
        validImageIds.add(f.imageId);
        if (isGoodFace(f)) {
          validReference.push(f);
        }
      }
    }

    cluster.assignedFaces = validAssigned;
    cluster.referenceFaces = validReference.length > 0 ? validReference : validAssigned.slice(0, 3);
    cluster.imageIds = validImageIds;
  }

  mainClusters = mainClusters.filter(c => c.assignedFaces.length > 0);

  // Helper to extract clothing profiles for a cluster
  function updateClusterProfiles(cluster) {
    const profiles = [];
    for (const f of cluster.assignedFaces) {
      if (f.clothingHistogram && (isGoodFace(f) || cluster.referenceFaces.includes(f))) {
        profiles.push(f.clothingHistogram);
      }
    }
    if (profiles.length === 0) {
      for (const f of cluster.assignedFaces) {
        if (f.clothingHistogram) profiles.push(f.clothingHistogram);
      }
    }
    cluster.clothingProfiles = profiles;
  }

  // Helper to compute centroid of good faces (or all faces if no good faces)
  function getClusterCentroid(cluster) {
    const good = cluster.assignedFaces.filter(isGoodFace);
    const targetFaces = good.length > 0 ? good : cluster.assignedFaces;
    const descriptors = targetFaces.map(f => f.descriptor).filter(Boolean);
    return computeCentroid(descriptors);
  }

  // Pre-calculate profiles for all clusters
  for (const cluster of mainClusters) {
    updateClusterProfiles(cluster);
  }

  // SECTION 4: SMART MERGE OF DUPLICATE PERSONS
  // Runs after clustering and before the clothing step
  let mergesAutoCount = 0;
  const rejectedBySamePhotoPairs = new Set();
  const safetyBlockedPairs = new Set();

  let canMergeMore = true;
  while (canMergeMore && mainClusters.length > 1) {
    canMergeMore = false;
    let bestCandidate = null;
    let minMergeMetric = Infinity;

    for (let i = 0; i < mainClusters.length; i++) {
      for (let j = i + 1; j < mainClusters.length; j++) {
        const clusterA = mainClusters[i];
        const clusterB = mainClusters[j];

        // Track pair identity for safety / rejection sets using representative face IDs
        const repA = clusterA.assignedFaces[0]?.id || `c_${i}`;
        const repB = clusterB.assignedFaces[0]?.id || `c_${j}`;
        const pairKey = [repA, repB].sort().join(':::');

        if (safetyBlockedPairs.has(pairKey)) {
          continue;
        }

        // a) Centroid distance: distance between mean descriptors of their good faces
        const centroidA = getClusterCentroid(clusterA);
        const centroidB = getClusterCentroid(clusterB);
        const centroidDist = euclideanDistance(centroidA, centroidB);

        // b) Linkage distance: AVERAGE of the 3 smallest distances between any face of A and any face of B
        const pairDists = [];
        for (const fa of clusterA.assignedFaces) {
          for (const fb of clusterB.assignedFaces) {
            pairDists.push(euclideanDistance(fa.descriptor, fb.descriptor));
          }
        }
        if (pairDists.length === 0) continue;

        pairDists.sort((a, b) => a - b);
        const top3Dists = pairDists.slice(0, Math.min(3, pairDists.length));
        const linkageDist = top3Dists.reduce((acc, d) => acc + d, 0) / top3Dists.length;

        // Clothing similarity between A and B
        let maxClothingSim = 0;
        if (clusterA.clothingProfiles?.length > 0 && clusterB.clothingProfiles?.length > 0) {
          for (const pa of clusterA.clothingProfiles) {
            for (const pb of clusterB.clothingProfiles) {
              const sim = histogramIntersection(pa, pb);
              if (sim > maxClothingSim) maxClothingSim = sim;
            }
          }
        }

        // Base merge condition:
        // centroid distance < 0.52 OR linkage distance < 0.47
        // OR clothing help: centroid between 0.52 and 0.58 AND clothing similarity > 0.90
        const qualifiesByFace = (centroidDist < 0.52 || linkageDist < 0.47);
        const qualifiesByClothing = (centroidDist >= 0.52 && centroidDist <= 0.58 && maxClothingSim > 0.90);
        const meetsDistanceCriteria = qualifiesByFace || qualifiesByClothing;

        // SAME-PHOTO RULE: no photo contains a face from A and a face from B at the same time
        let hasPhotoOverlap = false;
        for (const imgId of clusterB.imageIds) {
          if (clusterA.imageIds.has(imgId)) {
            hasPhotoOverlap = true;
            break;
          }
        }

        // If candidate meets distance criteria (or suggestion threshold <= 0.60) but shares photo:
        if (hasPhotoOverlap) {
          if (meetsDistanceCriteria || centroidDist <= 0.60) {
            rejectedBySamePhotoPairs.add(pairKey);
          }
          // If it does, they are different people: never merge.
          continue;
        }

        if (!meetsDistanceCriteria) {
          continue;
        }

        // EXTRA CHECK FOR SAFETY 1:
        // Never merge two persons if both have 5 or more photos together with a centroid distance above 0.50
        if (clusterA.imageIds.size >= 5 && clusterB.imageIds.size >= 5 && centroidDist > 0.50) {
          continue;
        }

        // EXTRA CHECK FOR SAFETY 2:
        // After a merge, if largest internal distance of new person goes above 0.65, undo that merge.
        const maxDistA = computeInternalDistances(clusterA.assignedFaces).maxInternalDist;
        const maxDistB = computeInternalDistances(clusterB.assignedFaces).maxInternalDist;
        const maxCrossDist = pairDists[pairDists.length - 1]; // largest distance between any face of A and B
        const potentialMaxInternalDist = Math.max(maxDistA, maxDistB, maxCrossDist);

        if (potentialMaxInternalDist > 0.65) {
          // Safety violation: undo / do not merge
          safetyBlockedPairs.add(pairKey);
          continue;
        }

        // Always merge the closest pair first
        const mergeMetric = Math.min(centroidDist, linkageDist);
        if (mergeMetric < minMergeMetric) {
          minMergeMetric = mergeMetric;
          bestCandidate = { idxA: i, idxB: j };
        }
      }
    }

    if (bestCandidate) {
      const target = mainClusters[bestCandidate.idxA];
      const source = mainClusters[bestCandidate.idxB];

      target.assignedFaces.push(...source.assignedFaces);
      target.referenceFaces.push(...source.referenceFaces);
      for (const imgId of source.imageIds) {
        target.imageIds.add(imgId);
      }
      for (const imgId of source.matchedByClothesPhotoIds) {
        target.matchedByClothesPhotoIds.add(imgId);
      }

      // Recompute profiles and ensure updated state
      updateClusterProfiles(target);

      mainClusters.splice(bestCandidate.idxB, 1);
      mergesAutoCount++;
      canMergeMore = true;
    }
  }

  // SECTION 5: CLOTHING SECOND PASS FOR BLUR
  const blurInitialCount = blurFaces.length;
  let movedByClothingCount = 0;
  const remainingBlurFaces = [];

  for (const bFace of blurFaces) {
    if (!bFace.clothingHistogram || mainClusters.length === 0) {
      remainingBlurFaces.push(bFace);
      continue;
    }

    const candidateMatches = [];

    for (const cluster of mainClusters) {
      // Condition d: SAME-PHOTO RULE (person not already present in photo)
      if (cluster.imageIds.has(bFace.imageId)) {
        continue;
      }

      // Condition c: FACE DISTANCE BELOW 0.65 (face must not strongly disagree)
      const refFaces = cluster.referenceFaces.length > 0 ? cluster.referenceFaces : cluster.assignedFaces;
      let minFaceDist = Infinity;
      for (const rf of refFaces) {
        const d = euclideanDistance(bFace.descriptor, rf.descriptor);
        if (d < minFaceDist) minFaceDist = d;
      }

      if (minFaceDist >= 0.65) {
        continue;
      }

      // Check clothing similarity across person's clothing profiles
      if (!cluster.clothingProfiles || cluster.clothingProfiles.length === 0) {
        continue;
      }

      let maxSim = 0;
      for (const profile of cluster.clothingProfiles) {
        const sim = histogramIntersection(bFace.clothingHistogram, profile);
        if (sim > maxSim) maxSim = sim;
      }

      candidateMatches.push({ cluster, clothingSim: maxSim, minFaceDist });
    }

    if (candidateMatches.length === 0) {
      remainingBlurFaces.push(bFace);
      continue;
    }

    candidateMatches.sort((a, b) => b.clothingSim - a.clothingSim);
    const bestMatch = candidateMatches[0];
    const secondBestSim = candidateMatches.length > 1 ? candidateMatches[1].clothingSim : 0;
    const simGap = bestMatch.clothingSim - secondBestSim;

    if (bestMatch.clothingSim > 0.85 && simGap >= 0.10) {
      bestMatch.cluster.assignedFaces.push(bFace);
      bestMatch.cluster.imageIds.add(bFace.imageId);
      bestMatch.cluster.matchedByClothesPhotoIds.add(bFace.imageId);
      movedByClothingCount++;
    } else {
      remainingBlurFaces.push(bFace);
    }
  }

  // SECTION 6: CONSTRUCT STRUCTURED PERSON VIEW
  mainClusters.sort((a, b) => b.assignedFaces.length - a.assignedFaces.length);

  let personCounter = 1;
  const persons = mainClusters.map(cluster => {
    const personId = `person_${personCounter}`;
    const defaultName = `Person ${personCounter}`;
    const customName = preservedNames.get(personId) || defaultName;

    let bestThumbFace = cluster.assignedFaces.find(f => isGoodFace(f)) || cluster.assignedFaces[0];
    for (const f of cluster.assignedFaces) {
      if ((f.score || 0) > (bestThumbFace?.score || 0)) {
        bestThumbFace = f;
      }
    }

    const photoMap = new Map();
    for (const f of cluster.assignedFaces) {
      if (!photoMap.has(f.imageId)) {
        const isMatchedByClothes = cluster.matchedByClothesPhotoIds.has(f.imageId);
        photoMap.set(f.imageId, {
          ...f.image,
          matchedByClothes: isMatchedByClothes
        });
      }
    }
    const photos = Array.from(photoMap.values());

    const descriptors = cluster.assignedFaces.map(f => f.descriptor).filter(Boolean);
    const centroid = computeCentroid(descriptors);
    const { avgInternalDist, maxInternalDist, isHighVariance } = computeInternalDistances(cluster.assignedFaces);

    personCounter++;

    return {
      id: personId,
      name: customName,
      thumbnail: bestThumbFace?.thumbnail || '',
      centroid,
      faces: cluster.assignedFaces,
      photos,
      photoCount: photos.length,
      faceCount: cluster.assignedFaces.length,
      avgInternalDist,
      maxInternalDist,
      isHighVariance
    };
  });

  // Unique photos for Blur folder
  const blurPhotoMap = new Map();
  for (const f of remainingBlurFaces) {
    if (!blurPhotoMap.has(f.imageId)) {
      blurPhotoMap.set(f.imageId, f.image);
    }
  }
  const blurPhotos = Array.from(blurPhotoMap.values());

  // SECTION 7: SUGGESTED MERGES (Centroid distance between 0.52 and 0.60 not auto-merged)
  const suggestedMerges = [];
  for (let i = 0; i < persons.length; i++) {
    for (let j = i + 1; j < persons.length; j++) {
      const pA = persons[i];
      const pB = persons[j];

      // Key to track dismissed pairs
      const pairKey = [pA.id, pB.id].sort().join(':::');
      if (dismissedPairs && dismissedPairs.has(pairKey)) {
        continue;
      }

      // Compute centroid distance between mean descriptors of good faces
      const goodA = pA.faces.filter(isGoodFace);
      const goodB = pB.faces.filter(isGoodFace);
      const descListA = (goodA.length > 0 ? goodA : pA.faces).map(f => f.descriptor).filter(Boolean);
      const descListB = (goodB.length > 0 ? goodB : pB.faces).map(f => f.descriptor).filter(Boolean);

      const cA = computeCentroid(descListA);
      const cB = computeCentroid(descListB);
      const cDist = euclideanDistance(cA, cB);

      // Check SAME-PHOTO RULE
      const photoIdsA = new Set(pA.photos.map(ph => ph.id));
      let hasOverlap = false;
      for (const ph of pB.photos) {
        if (photoIdsA.has(ph.id)) {
          hasOverlap = true;
          break;
        }
      }

      if (hasOverlap) {
        if (cDist <= 0.60) {
          const repFaceA = pA.faces[0]?.id || pA.id;
          const repFaceB = pB.faces[0]?.id || pB.id;
          rejectedBySamePhotoPairs.add([repFaceA, repFaceB].sort().join(':::'));
        }
        // Different people in same photo: cannot be suggested
        continue;
      }

      // Centroid distance between 0.52 and 0.60
      if (cDist >= 0.52 && cDist <= 0.60) {
        // Compute linkage distance for information
        const pairDists = [];
        for (const fa of pA.faces) {
          for (const fb of pB.faces) {
            pairDists.push(euclideanDistance(fa.descriptor, fb.descriptor));
          }
        }
        pairDists.sort((a, b) => a - b);
        const top3 = pairDists.slice(0, Math.min(3, pairDists.length));
        const lDist = top3.reduce((acc, d) => acc + d, 0) / top3.length;

        suggestedMerges.push({
          personA: {
            id: pA.id,
            name: pA.name,
            thumbnail: pA.thumbnail,
            photoCount: pA.photoCount,
            faceCount: pA.faceCount
          },
          personB: {
            id: pB.id,
            name: pB.name,
            thumbnail: pB.thumbnail,
            photoCount: pB.photoCount,
            faceCount: pB.faceCount
          },
          centroidDistance: parseFloat(cDist.toFixed(3)),
          linkageDistance: parseFloat(lDist.toFixed(3))
        });
      }
    }
  }

  const debugInfo = {
    totalFaces: allFaceInstances.length,
    goodFaces: goodFaces.length,
    totalPersons: persons.length,
    blurInitialFaces: blurInitialCount,
    movedByClothing: movedByClothingCount,
    blurRemainingFaces: remainingBlurFaces.length,
    blurPhotos: blurPhotos.length,
    noFacePhotos: noFacePhotos.length,
    mergesAutoCount,
    suggestedMergesCount: suggestedMerges.length,
    rejectedBySamePhotoCount: rejectedBySamePhotoPairs.size
  };

  return {
    persons,
    blurPhotos,
    blurFaces: remainingBlurFaces,
    noFacePhotos,
    suggestedMerges,
    debugInfo
  };
}

/**
 * Merges sourcePerson into targetPerson.
 * 
 * @param {Array<object>} persons 
 * @param {string} sourcePersonId 
 * @param {string} targetPersonId 
 * @returns {Array<object>} Updated persons array
 */
export function mergePersons(persons, sourcePersonId, targetPersonId) {
  const source = persons.find(p => p.id === sourcePersonId);
  const target = persons.find(p => p.id === targetPersonId);

  if (!source || !target || source.id === target.id) {
    return persons;
  }

  const combinedFaces = [...target.faces, ...source.faces];
  const combinedDescriptors = combinedFaces.map(f => f.descriptor).filter(Boolean);
  const newCentroid = computeCentroid(combinedDescriptors);

  const photoMap = new Map();
  for (const photo of [...target.photos, ...source.photos]) {
    photoMap.set(photo.id, photo);
  }
  const combinedPhotos = Array.from(photoMap.values());
  const { avgInternalDist, maxInternalDist, isHighVariance } = computeInternalDistances(combinedFaces);

  const updatedTarget = {
    ...target,
    centroid: newCentroid,
    faces: combinedFaces,
    photos: combinedPhotos,
    photoCount: combinedPhotos.length,
    faceCount: combinedFaces.length,
    thumbnail: target.thumbnail || source.thumbnail,
    avgInternalDist,
    maxInternalDist,
    isHighVariance
  };

  return persons
    .filter(p => p.id !== sourcePersonId)
    .map(p => (p.id === targetPersonId ? updatedTarget : p));
}

/**
 * Moves a photo from one group to another (person, blur, or no-face).
 * 
 * @param {Array<object>} persons 
 * @param {Array<object>} blurPhotos 
 * @param {Array<object>} noFacePhotos 
 * @param {string} photoId 
 * @param {string} fromPersonId 
 * @param {string} toPersonId 
 * @returns {{ persons: Array<object>, blurPhotos: Array<object>, noFacePhotos: Array<object> }}
 */
export function movePhoto(persons, blurPhotos, noFacePhotos, photoId, fromPersonId, toPersonId) {
  let photoToMove = null;
  let newBlurPhotos = [...blurPhotos];
  let newNoFacePhotos = [...noFacePhotos];

  let updatedPersons = persons.map(p => {
    if (p.id === fromPersonId) {
      const photo = p.photos.find(img => img.id === photoId);
      if (photo) photoToMove = photo;
      const filteredPhotos = p.photos.filter(img => img.id !== photoId);
      const filteredFaces = p.faces.filter(f => f.imageId !== photoId);
      const { avgInternalDist, maxInternalDist, isHighVariance } = computeInternalDistances(filteredFaces);
      return {
        ...p,
        photos: filteredPhotos,
        faces: filteredFaces,
        photoCount: filteredPhotos.length,
        faceCount: filteredFaces.length,
        thumbnail: filteredFaces[0]?.thumbnail || p.thumbnail,
        avgInternalDist,
        maxInternalDist,
        isHighVariance
      };
    }
    return p;
  });

  if (fromPersonId === 'blur') {
    photoToMove = blurPhotos.find(img => img.id === photoId);
    newBlurPhotos = blurPhotos.filter(img => img.id !== photoId);
  } else if (fromPersonId === 'no-face') {
    photoToMove = noFacePhotos.find(img => img.id === photoId);
    newNoFacePhotos = noFacePhotos.filter(img => img.id !== photoId);
  }

  if (!photoToMove) return { persons, blurPhotos: newBlurPhotos, noFacePhotos: newNoFacePhotos };

  // Remove matchedByClothes tag if manually moved
  const cleanPhotoToMove = { ...photoToMove, matchedByClothes: false };

  if (toPersonId === 'blur') {
    if (!newBlurPhotos.some(img => img.id === photoId)) {
      newBlurPhotos.push(cleanPhotoToMove);
    }
  } else if (toPersonId === 'no-face') {
    if (!newNoFacePhotos.some(img => img.id === photoId)) {
      newNoFacePhotos.push(cleanPhotoToMove);
    }
  } else {
    updatedPersons = updatedPersons.map(p => {
      if (p.id === toPersonId) {
        if (!p.photos.some(img => img.id === photoId)) {
          const newPhotos = [...p.photos, cleanPhotoToMove];
          return {
            ...p,
            photos: newPhotos,
            photoCount: newPhotos.length
          };
        }
      }
      return p;
    });
  }

  updatedPersons = updatedPersons.filter(p => p.photoCount > 0);

  return {
    persons: updatedPersons,
    blurPhotos: newBlurPhotos,
    noFacePhotos: newNoFacePhotos
  };
}
