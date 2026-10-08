import React, { useState, useEffect, useRef, useMemo } from 'react';
import confetti from 'canvas-confetti';
import { 
  Download, 
  RotateCcw, 
  FolderSync, 
  Search, 
  Users, 
  Sparkles, 
  CheckCircle,
  HelpCircle,
  ScanFace,
  ShieldCheck,
  AlertTriangle,
  Bug,
  Shirt
} from 'lucide-react';

import Header from './components/Header.jsx';
import DropZone from './components/DropZone.jsx';
import ProgressBar from './components/ProgressBar.jsx';
import ThresholdSlider from './components/ThresholdSlider.jsx';
import PersonCard from './components/PersonCard.jsx';
import PersonModal from './components/PersonModal.jsx';
import MergeModal from './components/MergeModal.jsx';
import SuggestedMerges from './components/SuggestedMerges.jsx';

import { loadFaceModels } from './utils/faceDetector.js';
import { loadImage, downscaleImage } from './utils/imageUtils.js';
import { detectFaces } from './utils/faceDetector.js';
import { clusterFaces, mergePersons, movePhoto } from './utils/clusterEngine.js';
import { downloadOrganizedZip } from './utils/zipExporter.js';

import './App.css';

export default function App() {
  // Theme state: 'dark' (default) | 'light'
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('facesort_theme') || 'dark';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('facesort_theme', theme);
  }, [theme]);

  const handleToggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  // Application phase: 'IDLE' | 'PROCESSING' | 'ORGANIZING' | 'EXPORTING'
  const [phase, setPhase] = useState('IDLE');

  // AI Model Loading State
  const [isModelLoading, setIsModelLoading] = useState(false);
  const [modelStatus, setModelStatus] = useState('');

  // Processing state
  const [progress, setProgress] = useState({ current: 0, total: 0, percent: 0 });
  const [currentFileName, setCurrentFileName] = useState('');
  const [currentThumbnail, setCurrentThumbnail] = useState('');
  const [facesFoundSoFar, setFacesFoundSoFar] = useState(0);
  const [warnings, setWarnings] = useState([]);
  const cancelProcessingRef = useRef(false);

  // Cached analyzed photos: Array<{ id, name, file, faces: [] }>
  const [processedImages, setProcessedImages] = useState([]);

  // Clustering state (Default threshold 0.48 as specified)
  const [threshold, setThreshold] = useState(0.48);
  const [persons, setPersons] = useState([]);
  const [blurPhotos, setBlurPhotos] = useState([]);
  const [blurFaces, setBlurFaces] = useState([]);
  const [noFacePhotos, setNoFacePhotos] = useState([]);
  const [suggestedMerges, setSuggestedMerges] = useState([]);
  const [dismissedPairs, setDismissedPairs] = useState(new Set());
  const dismissedPairsRef = useRef(new Set());

  const [debugInfo, setDebugInfo] = useState({
    totalFaces: 0,
    goodFaces: 0,
    totalPersons: 0,
    blurInitialFaces: 0,
    movedByClothing: 0,
    blurRemainingFaces: 0,
    blurPhotos: 0,
    noFacePhotos: 0,
    mergesAutoCount: 0,
    suggestedMergesCount: 0,
    rejectedBySamePhotoCount: 0
  });

  const preservedNamesRef = useRef(new Map());

  // Interactive UI state
  const [activePersonModal, setActivePersonModal] = useState(null);
  const [activeMergePerson, setActiveMergePerson] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [zipProgress, setZipProgress] = useState({ active: false, percent: 0, message: '' });

  // Preload face models in background when app mounts
  useEffect(() => {
    setIsModelLoading(true);
    loadFaceModels((status) => setModelStatus(status))
      .then(() => setIsModelLoading(false))
      .catch((err) => {
        console.error('Failed to preload models:', err);
        setModelStatus('Failed to load models. Will retry on scan.');
        setIsModelLoading(false);
      });
  }, []);

  // Whenever threshold or processed images change, recompute clusters
  const runClustering = (images, currentThreshold) => {
    const result = clusterFaces(images, currentThreshold, preservedNamesRef.current, dismissedPairsRef.current);
    setPersons(result.persons);
    setBlurPhotos(result.blurPhotos);
    setBlurFaces(result.blurFaces);
    setNoFacePhotos(result.noFacePhotos);
    setSuggestedMerges(result.suggestedMerges || []);
    setDebugInfo(result.debugInfo);
  };

  const handleThresholdChange = (newThreshold) => {
    setThreshold(newThreshold);
    if (processedImages.length > 0) {
      runClustering(processedImages, newThreshold);
    }
  };

  // Start processing files from folder selection
  const handleFilesSelected = async (files) => {
    if (!files || files.length === 0) return;

    setPhase('PROCESSING');
    setProgress({ current: 0, total: files.length, percent: 0 });
    setFacesFoundSoFar(0);
    setWarnings([]);
    cancelProcessingRef.current = false;

    // Ensure models are loaded
    try {
      await loadFaceModels((status) => setModelStatus(status));
    } catch (err) {
      alert(`Model loading error: ${err.message}`);
      setPhase('IDLE');
      return;
    }

    const collectedImages = [];
    const collectedWarnings = [];
    let totalFacesCount = 0;

    for (let i = 0; i < files.length; i++) {
      if (cancelProcessingRef.current) {
        break;
      }

      const file = files[i];
      setCurrentFileName(file.name);
      setProgress({
        current: i + 1,
        total: files.length,
        percent: ((i + 1) / files.length) * 100
      });

      try {
        // Load image
        const img = await loadImage(file);
        
        // Downscale to max 1600px width/height to preserve face resolution in group photos
        const { canvas } = downscaleImage(img, 1600);
        setCurrentThumbnail(canvas.toDataURL('image/jpeg', 0.5));

        // Detect faces with minConfidence 0.6 and minFaceSize 50px
        const detectedFaces = await detectFaces(canvas, {
          minConfidence: 0.6,
          minFaceSize: 50
        });

        totalFacesCount += detectedFaces.length;
        setFacesFoundSoFar(totalFacesCount);

        const facesWithIds = detectedFaces.map((f, faceIdx) => ({
          ...f,
          id: `face_${i}_${faceIdx}`
        }));

        collectedImages.push({
          id: `img_${i}_${file.name}`,
          name: file.name,
          file,
          faces: facesWithIds
        });

        // Let the browser breathe and update React UI smoothly
        await new Promise((resolve) => setTimeout(resolve, 8));
      } catch (err) {
        console.warn(`Error processing ${file.name}:`, err);
        collectedWarnings.push(`${file.name}: ${err.message || 'corrupt file'}`);
        setWarnings([...collectedWarnings]);
      }
    }

    setProcessedImages(collectedImages);

    // Initial multi-pass agglomerative cluster formation
    runClustering(collectedImages, threshold);

    setPhase('ORGANIZING');

    // Trigger celebration
    confetti({
      particleCount: 80,
      spread: 60,
      origin: { y: 0.6 }
    });
  };

  const handleCancelProcessing = () => {
    cancelProcessingRef.current = true;
  };

  const handleReset = () => {
    if (window.confirm('Are you sure you want to start over with a new folder?')) {
      setPhase('IDLE');
      setProcessedImages([]);
      setPersons([]);
      setBlurPhotos([]);
      setBlurFaces([]);
      setNoFacePhotos([]);
      setSuggestedMerges([]);
      setDismissedPairs(new Set());
      dismissedPairsRef.current.clear();
      setDebugInfo({
        totalFaces: 0,
        goodFaces: 0,
        totalPersons: 0,
        blurInitialFaces: 0,
        movedByClothing: 0,
        blurRemainingFaces: 0,
        blurPhotos: 0,
        noFacePhotos: 0,
        mergesAutoCount: 0,
        suggestedMergesCount: 0,
        rejectedBySamePhotoCount: 0
      });
      preservedNamesRef.current.clear();
      setActivePersonModal(null);
      setActiveMergePerson(null);
    }
  };

  // Person Actions
  const handleRenamePerson = (personId, newName) => {
    preservedNamesRef.current.set(personId, newName);
    setPersons((prev) =>
      prev.map((p) => (p.id === personId ? { ...p, name: newName } : p))
    );
  };

  const handleConfirmMerge = (sourceId, targetId) => {
    const updated = mergePersons(persons, sourceId, targetId);
    setPersons(updated);
    // Remove merged candidates from suggested merges
    setSuggestedMerges((prev) =>
      prev.filter(
        (m) =>
          m.personA.id !== sourceId &&
          m.personB.id !== sourceId &&
          m.personA.id !== targetId &&
          m.personB.id !== targetId
      )
    );
    setDebugInfo((prev) => ({ 
      ...prev, 
      totalPersons: updated.length,
      suggestedMergesCount: Math.max(0, prev.suggestedMergesCount - 1)
    }));
  };

  const handleDismissPair = (personAId, personBId) => {
    const pairKey = [personAId, personBId].sort().join(':::');
    dismissedPairsRef.current.add(pairKey);
    setDismissedPairs(new Set(dismissedPairsRef.current));
    setSuggestedMerges((prev) =>
      prev.filter((m) => [m.personA.id, m.personB.id].sort().join(':::') !== pairKey)
    );
    setDebugInfo((prev) => ({
      ...prev,
      suggestedMergesCount: Math.max(0, prev.suggestedMergesCount - 1)
    }));
  };

  const handleMovePhoto = (photoId, fromPersonId, toPersonId) => {
    const result = movePhoto(persons, blurPhotos, noFacePhotos, photoId, fromPersonId, toPersonId);
    setPersons(result.persons);
    setBlurPhotos(result.blurPhotos);
    setNoFacePhotos(result.noFacePhotos);
    setDebugInfo((prev) => ({
      ...prev,
      totalPersons: result.persons.length,
      blurPhotos: result.blurPhotos.length,
      noFacePhotos: result.noFacePhotos.length
    }));

    // Update active modal person if currently viewing
    if (activePersonModal) {
      if (activePersonModal.id === fromPersonId) {
        if (fromPersonId === 'blur') {
          setActivePersonModal({
            ...activePersonModal,
            photos: result.blurPhotos,
            photoCount: result.blurPhotos.length
          });
        } else if (fromPersonId === 'no-face') {
          setActivePersonModal({
            ...activePersonModal,
            photos: result.noFacePhotos,
            photoCount: result.noFacePhotos.length
          });
        } else {
          const updatedSelf = result.persons.find((p) => p.id === fromPersonId);
          setActivePersonModal(updatedSelf || null);
        }
      } else if (activePersonModal.id === toPersonId) {
        const updatedTarget = result.persons.find((p) => p.id === toPersonId);
        setActivePersonModal(updatedTarget || null);
      }
    }
  };

  const handleRemovePhotoFromPerson = (personId, photoId) => {
    // Moving photo to Blur removes it from the current person
    handleMovePhoto(photoId, personId, 'blur');
  };

  // ZIP Export
  const handleDownloadZip = async () => {
    try {
      setZipProgress({ active: true, percent: 5, message: 'Preparing folders...' });
      await downloadOrganizedZip(persons, blurPhotos, noFacePhotos, (percent, message) => {
        setZipProgress({ active: true, percent, message });
      });
      setZipProgress({ active: false, percent: 100, message: '' });

      // Celebration
      confetti({
        particleCount: 120,
        spread: 90,
        origin: { y: 0.5 }
      });
    } catch (err) {
      console.error('Failed to create ZIP:', err);
      alert(`Could not create ZIP: ${err.message}`);
      setZipProgress({ active: false, percent: 0, message: '' });
    }
  };

  // Filtered persons
  const filteredPersons = useMemo(() => {
    if (!searchQuery.trim()) return persons;
    const query = searchQuery.toLowerCase();
    return persons.filter((p) => p.name.toLowerCase().includes(query));
  }, [persons, searchQuery]);

  // Overall Stats
  const stats = useMemo(() => {
    if (phase === 'IDLE') return null;
    return {
      totalPhotos: processedImages.length,
      totalFaces: debugInfo.totalFaces,
      totalPersons: persons.length
    };
  }, [phase, processedImages, persons, debugInfo]);

  const totalFolderCount = persons.length + 
    (blurPhotos.length > 0 ? 1 : 0) + 
    (noFacePhotos.length > 0 ? 1 : 0);

  return (
    <div className="app-container">
      <Header 
        stats={stats} 
        onReset={phase !== 'IDLE' ? handleReset : null} 
        isProcessing={phase === 'PROCESSING'}
        theme={theme}
        onToggleTheme={handleToggleTheme}
      />

      <main className="main-content">
        {/* PHASE 1: IDLE / UPLOAD */}
        {phase === 'IDLE' && (
          <DropZone 
            onFilesSelected={handleFilesSelected}
            isModelLoading={isModelLoading}
            modelStatus={modelStatus}
          />
        )}

        {/* PHASE 2: PROCESSING */}
        {phase === 'PROCESSING' && (
          <ProgressBar 
            progress={progress}
            currentFileName={currentFileName}
            currentThumbnail={currentThumbnail}
            facesFoundSoFar={facesFoundSoFar}
            warnings={warnings}
            onCancel={handleCancelProcessing}
          />
        )}

        {/* PHASE 3: ORGANIZING / RESULTS */}
        {phase === 'ORGANIZING' && (
          <div className="workspace-section">
            {/* DEBUG PANEL */}
            <div className="debug-panel">
              <div className="debug-panel-header">
                <div className="debug-title-wrap">
                  <Bug size={16} className="text-mint" />
                  <span>Clustering Diagnostics & Clothing Match</span>
                </div>
                <span className="debug-tag">Complete Linkage + Clothing Pass</span>
              </div>
              <div className="debug-stats-grid">
                <div className="debug-stat-card">
                  <div className="debug-stat-icon-wrap text-mint">
                    <ScanFace size={20} />
                  </div>
                  <div className="debug-stat-content">
                    <span className="debug-stat-label">Total Faces Found</span>
                    <span className="debug-stat-val">{debugInfo.totalFaces}</span>
                  </div>
                </div>

                <div className="debug-stat-card">
                  <div className="debug-stat-icon-wrap text-mint">
                    <ShieldCheck size={20} />
                  </div>
                  <div className="debug-stat-content">
                    <span className="debug-stat-label">Good Faces (Score ≥ 0.85, ≥ 90px)</span>
                    <span className="debug-stat-val text-mint">{debugInfo.goodFaces}</span>
                  </div>
                </div>

                <div className="debug-stat-card">
                  <div className="debug-stat-icon-wrap text-mint">
                    <Users size={20} />
                  </div>
                  <div className="debug-stat-content">
                    <span className="debug-stat-label">Persons Formed</span>
                    <span className="debug-stat-val text-mint">{debugInfo.totalPersons}</span>
                  </div>
                </div>

                <div className="debug-stat-card">
                  <div className="debug-stat-icon-wrap text-cream">
                    <AlertTriangle size={20} />
                  </div>
                  <div className="debug-stat-content">
                    <span className="debug-stat-label">Faces in Blur (Initial)</span>
                    <span className="debug-stat-val text-cream">{debugInfo.blurInitialFaces}</span>
                  </div>
                </div>

                <div className="debug-stat-card">
                  <div className="debug-stat-icon-wrap text-mint">
                    <Shirt size={20} />
                  </div>
                  <div className="debug-stat-content">
                    <span className="debug-stat-label">Moved by Clothing</span>
                    <span className="debug-stat-val text-mint">{debugInfo.movedByClothing}</span>
                  </div>
                </div>

                <div className="debug-stat-card">
                  <div className="debug-stat-icon-wrap text-muted">
                    <AlertTriangle size={20} />
                  </div>
                  <div className="debug-stat-content">
                    <span className="debug-stat-label">Remaining in Blur</span>
                    <span className="debug-stat-val text-muted">{debugInfo.blurRemainingFaces}</span>
                  </div>
                </div>

                <div className="debug-stat-card">
                  <div className="debug-stat-icon-wrap text-mint">
                    <FolderSync size={20} />
                  </div>
                  <div className="debug-stat-content">
                    <span className="debug-stat-label">Auto-Merges Done</span>
                    <span className="debug-stat-val text-mint">{debugInfo.mergesAutoCount ?? 0}</span>
                  </div>
                </div>

                <div className="debug-stat-card">
                  <div className="debug-stat-icon-wrap text-mint">
                    <Sparkles size={20} />
                  </div>
                  <div className="debug-stat-content">
                    <span className="debug-stat-label">Suggested Merges (0.52 - 0.60)</span>
                    <span className="debug-stat-val text-mint">{debugInfo.suggestedMergesCount ?? 0}</span>
                  </div>
                </div>

                <div className="debug-stat-card">
                  <div className="debug-stat-icon-wrap text-cream">
                    <ShieldCheck size={20} />
                  </div>
                  <div className="debug-stat-content">
                    <span className="debug-stat-label">Blocked by Same-Photo Rule</span>
                    <span className="debug-stat-val text-cream">{debugInfo.rejectedBySamePhotoCount ?? 0}</span>
                  </div>
                </div>
              </div>

              {/* Per-folder distance analysis table */}
              {persons.length > 0 && (
                <div className="debug-table-wrap">
                  <table className="debug-table">
                    <thead>
                      <tr>
                        <th>Person Folder</th>
                        <th>Photos</th>
                        <th>Faces</th>
                        <th>Avg Distance</th>
                        <th>Max Distance</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {persons.map((p) => (
                        <tr key={p.id} className={p.isHighVariance ? 'debug-row-danger' : ''}>
                          <td><strong>{p.name}</strong></td>
                          <td>{p.photoCount}</td>
                          <td>{p.faceCount}</td>
                          <td>{(p.avgInternalDist ?? 0).toFixed(3)}</td>
                          <td>
                            <strong className={p.isHighVariance ? 'text-cream' : ''}>
                              {(p.maxInternalDist ?? 0).toFixed(3)}
                            </strong>
                          </td>
                          <td>
                            {p.isHighVariance ? (
                              <span className="badge-variance-danger">⚠️ Check this folder</span>
                            ) : (
                              <span className="text-mint">✓ Consistent</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Toolbar */}
            <div className="workspace-toolbar">
              <div className="toolbar-left">
                <ThresholdSlider 
                  threshold={threshold}
                  onChange={handleThresholdChange}
                  personCount={persons.length}
                />
              </div>

              <div className="toolbar-right">
                {/* Search */}
                <div className="search-wrap">
                  <Search size={16} className="text-muted" />
                  <input 
                    type="text"
                    placeholder="Search people..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="styled-search-input"
                  />
                </div>

                {/* Download ZIP */}
                <button 
                  type="button"
                  className="btn-primary btn-large btn-download"
                  onClick={handleDownloadZip}
                  title="Download all organized photos as a structured ZIP file"
                >
                  <Download size={20} />
                  <span>Download ZIP ({totalFolderCount} Folders)</span>
                </button>
              </div>
            </div>

            {/* Suggested Merges Section */}
            <SuggestedMerges 
              suggestedMerges={suggestedMerges}
              onMerge={handleConfirmMerge}
              onDismiss={handleDismissPair}
            />

            {/* People Cards Grid */}
            <div className="persons-grid">
              {filteredPersons.map((person, idx) => (
                <PersonCard 
                  key={person.id}
                  person={person}
                  cardIndex={idx}
                  onRename={handleRenamePerson}
                  onViewPhotos={(p) => setActivePersonModal(p)}
                  onMerge={(p) => setActiveMergePerson(p)}
                />
              ))}

              {/* Special Blur Card */}
              {blurPhotos.length > 0 && (
                <PersonCard 
                  person={{
                    id: 'blur',
                    name: 'Blur',
                    thumbnail: blurFaces[0]?.thumbnail || '',
                    photos: blurPhotos,
                    photoCount: blurPhotos.length,
                    faceCount: blurFaces.length
                  }}
                  cardIndex={filteredPersons.length}
                  onViewPhotos={() => setActivePersonModal({
                    id: 'blur',
                    name: 'Blur Folder',
                    thumbnail: blurFaces[0]?.thumbnail || '',
                    photos: blurPhotos,
                    photoCount: blurPhotos.length,
                    faces: blurFaces
                  })}
                  isSpecialBlur={true}
                />
              )}

              {/* Special No Face Card */}
              {noFacePhotos.length > 0 && (
                <PersonCard 
                  person={{
                    id: 'no-face',
                    name: 'No Face',
                    thumbnail: '',
                    photos: noFacePhotos,
                    photoCount: noFacePhotos.length,
                    faceCount: 0
                  }}
                  cardIndex={filteredPersons.length + 1}
                  onViewPhotos={() => setActivePersonModal({
                    id: 'no-face',
                    name: 'No Face',
                    thumbnail: '',
                    photos: noFacePhotos,
                    photoCount: noFacePhotos.length,
                    faces: []
                  })}
                  isSpecialNoFace={true}
                />
              )}
            </div>

            {filteredPersons.length === 0 && blurPhotos.length === 0 && noFacePhotos.length === 0 && (
              <div className="empty-results-box">
                <Users size={48} className="text-muted" />
                <h3>No faces detected</h3>
                <p>No faces were found in this batch of images. Try adjusting the sensitivity slider.</p>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Slim Developer Credit Footer */}
      <footer className="app-footer">
        <p className="footer-credit">
          Developed with <span className="footer-heart">❤️</span> by{' '}
          <strong className="footer-author">SHASHIKANT RAJ</strong>{' '}
          <span className="footer-handle">(sashibitcode)</span>
        </p>
      </footer>

      {/* Person Photo Inspector Modal */}
      {activePersonModal && (
        <PersonModal 
          person={activePersonModal}
          allPersons={persons}
          onClose={() => setActivePersonModal(null)}
          onMovePhoto={handleMovePhoto}
          onRemovePhoto={handleRemovePhotoFromPerson}
        />
      )}

      {/* Merge Groups Modal */}
      {activeMergePerson && (
        <MergeModal 
          sourcePerson={activeMergePerson}
          allPersons={persons}
          onClose={() => setActiveMergePerson(null)}
          onConfirmMerge={handleConfirmMerge}
        />
      )}

      {/* ZIP Packaging Overlay */}
      {zipProgress.active && (
        <div className="modal-backdrop">
          <div className="modal-content modal-medium packaging-card">
            <div className="packaging-header">
              <FolderSync size={32} className="text-mint animate-spin" />
              <h3>Packaging Your Organized Folders</h3>
              <p>{zipProgress.message || 'Building ZIP archive...'}</p>
            </div>
            <div className="progress-track-wrap">
              <div className="progress-track">
                <div 
                  className="progress-fill" 
                  style={{ width: `${zipProgress.percent}%` }}
                />
              </div>
              <span className="progress-percent">{zipProgress.percent}%</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
