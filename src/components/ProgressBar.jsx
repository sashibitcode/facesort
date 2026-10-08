import React from 'react';
import { AlertTriangle, StopCircle, CheckCircle2, ScanFace, Image as ImageIcon } from 'lucide-react';

export default function ProgressBar({
  progress,
  currentFileName,
  currentThumbnail,
  facesFoundSoFar,
  warnings,
  onCancel
}) {
  const { current, total, percent } = progress;

  return (
    <div className="progress-card">
      <div className="progress-header">
        <div className="progress-info">
          <div className="progress-tag">
            <ScanFace size={16} className="text-mint animate-pulse" />
            <span>Scanning Faces</span>
          </div>
          <h2 className="progress-title">
            Processing {current} / {total} photos
          </h2>
          <p className="progress-subtitle">
            Found <strong className="text-highlight">{facesFoundSoFar}</strong> faces across images so far
          </p>
        </div>

        {onCancel && (
          <button 
            type="button" 
            className="btn-danger btn-sm"
            onClick={onCancel}
            title="Stop processing remaining photos"
          >
            <StopCircle size={16} />
            <span>Stop Early</span>
          </button>
        )}
      </div>

      {/* Progress Track */}
      <div className="progress-track-wrap">
        <div className="progress-track">
          <div 
            className={`progress-fill ${percent >= 100 ? 'progress-fill-complete' : ''}`} 
            style={{ width: `${Math.min(100, Math.max(0, percent))}%` }}
          />
        </div>
        <div className={`progress-percent-wrap ${percent >= 100 ? 'progress-complete-text' : ''}`}>
          {percent >= 100 ? (
            <span className="complete-indicator">
              <CheckCircle2 size={16} className="text-mint" />
              <span>100% Complete</span>
            </span>
          ) : (
            <span className="progress-percent">{Math.round(percent)}%</span>
          )}
        </div>
      </div>

      {/* Current Photo Live Preview */}
      <div className="progress-live-view">
        <div className="live-thumbnail-box">
          {currentThumbnail ? (
            <img src={currentThumbnail} alt="Analyzing" className="live-thumbnail-img" />
          ) : (
            <div className="live-thumbnail-placeholder">
              <ImageIcon size={24} className="text-muted" />
            </div>
          )}
        </div>
        <div className="live-file-info">
          <span className="live-file-label">Current Photo</span>
          <span className="live-file-name" title={currentFileName}>
            {currentFileName || 'Analyzing image...'}
          </span>
          <span className="live-note">Downscaling to max 800px & calculating 128-d face descriptors...</span>
        </div>
      </div>

      {/* Warning Box for Failed Images if any */}
      {warnings && warnings.length > 0 && (
        <div className="warnings-box">
          <div className="warnings-header">
            <AlertTriangle size={16} className="text-cream" />
            <span>{warnings.length} photo(s) could not be read (skipped):</span>
          </div>
          <ul className="warnings-list">
            {warnings.slice(0, 3).map((w, idx) => (
              <li key={idx}>{w}</li>
            ))}
            {warnings.length > 3 && (
              <li>...and {warnings.length - 3} more</li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
