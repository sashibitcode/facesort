import React, { useState } from 'react';
import { X, GitMerge, ArrowRight, AlertCircle } from 'lucide-react';

export default function MergeModal({
  sourcePerson,
  allPersons,
  onClose,
  onConfirmMerge
}) {
  const targetCandidates = allPersons.filter(p => p.id !== sourcePerson.id);
  const [selectedTargetId, setSelectedTargetId] = useState(
    targetCandidates.length > 0 ? targetCandidates[0].id : ''
  );

  const targetPerson = allPersons.find(p => p.id === selectedTargetId);

  const handleMerge = () => {
    if (selectedTargetId) {
      onConfirmMerge(sourcePerson.id, selectedTargetId);
      onClose();
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content modal-medium" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title-with-icon">
            <GitMerge size={22} className="text-mint" />
            <h2 className="modal-title">Merge Person Groups</h2>
          </div>
          <button className="btn-modal-close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="merge-body">
          <p className="merge-explainer">
            Combine two people if the face detector split the same person into multiple groups.
          </p>

          <div className="merge-visual-row">
            {/* Source */}
            <div className="merge-avatar-card">
              <span className="merge-label">Merging From</span>
              <img 
                src={sourcePerson.thumbnail} 
                alt={sourcePerson.name} 
                className="merge-thumb" 
              />
              <span className="merge-name">{sourcePerson.name}</span>
              <span className="merge-count">{sourcePerson.photoCount} photos</span>
            </div>

            <div className="merge-arrow-wrap">
              <ArrowRight size={28} className="text-mint" />
            </div>

            {/* Target */}
            <div className="merge-avatar-card">
              <span className="merge-label">Merging Into</span>
              {targetPerson?.thumbnail ? (
                <img 
                  src={targetPerson.thumbnail} 
                  alt={targetPerson.name} 
                  className="merge-thumb" 
                />
              ) : (
                <div className="merge-thumb-placeholder">?</div>
              )}
              <span className="merge-name">{targetPerson?.name || 'Select person'}</span>
              <span className="merge-count">{targetPerson?.photoCount || 0} photos</span>
            </div>
          </div>

          {/* Select target */}
          <div className="merge-select-group">
            <label className="input-label" htmlFor="target-person-select">
              Select Destination Person:
            </label>
            <select
              id="target-person-select"
              className="styled-select"
              value={selectedTargetId}
              onChange={(e) => setSelectedTargetId(e.target.value)}
            >
              {targetCandidates.map(p => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.photoCount} photos)
                </option>
              ))}
            </select>
          </div>

          <div className="merge-warning-note">
            <AlertCircle size={16} className="text-cream" />
            <span>
              All {sourcePerson.photoCount} photos will be moved into <strong>{targetPerson?.name}</strong>, and <strong>{sourcePerson.name}</strong> will be removed.
            </span>
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button 
            className="btn-primary" 
            onClick={handleMerge}
            disabled={!selectedTargetId}
          >
            <GitMerge size={16} />
            <span>Confirm & Merge</span>
          </button>
        </div>
      </div>
    </div>
  );
}
