import React, { useState } from 'react';
import { Eye, GitMerge, Edit3, Image as ImageIcon, UserX, UserCheck } from 'lucide-react';

export default function PersonCard({
  person,
  onRename,
  onViewPhotos,
  onMerge,
  isSpecialNoFace = false,
  isSpecialBlur = false,
  isSpecialUnsorted = false,
  cardIndex = 0
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [tempName, setTempName] = useState(person.name);

  const handleBlur = () => {
    setIsEditing(false);
    const trimmed = tempName.trim();
    if (trimmed && trimmed !== person.name) {
      onRename(person.id, trimmed);
    } else {
      setTempName(person.name);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.target.blur();
    } else if (e.key === 'Escape') {
      setTempName(person.name);
      setIsEditing(false);
    }
  };

  const isBlurGroup = isSpecialBlur || isSpecialUnsorted;
  const isSpecial = isSpecialNoFace || isBlurGroup;

  return (
    <div 
      className={`person-card ${isSpecialNoFace ? 'card-no-face' : ''} ${isBlurGroup ? 'card-blur' : ''} ${person.isHighVariance ? 'card-high-variance' : ''}`}
      style={{ '--card-index': cardIndex }}
    >
      {/* Thumbnail area with circular 3px ring */}
      <div 
        className="person-thumbnail-wrapper"
        onClick={() => onViewPhotos(person)}
        title="Click to view all photos"
      >
        <div className={`avatar-ring-container ${isBlurGroup ? 'ring-cream' : isSpecialNoFace ? 'ring-muted' : 'ring-mint'}`}>
          {isSpecialNoFace ? (
            <div className="no-face-thumbnail-fallback">
              <UserX size={36} className="text-muted" />
            </div>
          ) : person.thumbnail ? (
            <img 
              src={person.thumbnail} 
              alt={person.name} 
              className="person-thumbnail-img" 
              loading="lazy"
            />
          ) : (
            <div className="no-face-thumbnail-fallback">
              <ImageIcon size={32} className="text-muted" />
            </div>
          )}
        </div>

        <div className="thumbnail-hover-overlay">
          <Eye size={20} />
          <span>View</span>
        </div>
      </div>

      {/* Details & Name */}
      <div className="person-details">
        <div className="person-name-row">
          {isSpecialNoFace ? (
            <span className="person-name-static text-muted">No Face Detected</span>
          ) : isBlurGroup ? (
            <span className="person-name-static text-cream">Blur</span>
          ) : isEditing ? (
            <input 
              type="text"
              className="person-name-input"
              value={tempName}
              onChange={(e) => setTempName(e.target.value)}
              onBlur={handleBlur}
              onKeyDown={handleKeyDown}
              autoFocus
              maxLength={40}
              placeholder="Enter person name"
            />
          ) : (
            <div 
              className="person-name-display"
              onClick={() => setIsEditing(true)}
              title="Click to rename folder"
            >
              <span className="person-name-text">{person.name}</span>
              <Edit3 size={14} className="edit-icon" />
            </div>
          )}
        </div>

        {/* Badges: Mint pill for photo count, Cream pill for Blur */}
        <div className="person-badges-row">
          {isBlurGroup ? (
            <span className="badge-photos-pill badge-pill-cream" title="Needs manual review">
              Needs review ({person.photoCount})
            </span>
          ) : (
            <span className="badge-photos-pill">
              {person.photoCount} {person.photoCount === 1 ? 'photo' : 'photos'}
            </span>
          )}
          {person.faceCount !== undefined && person.faceCount > 0 && !isSpecial && (
            <span className="badge-faces" title="Total face detections in this group">
              <UserCheck size={12} />
              <span>{person.faceCount} faces</span>
            </span>
          )}
          {!isSpecial && person.maxInternalDist !== undefined && person.faceCount > 1 && (
            <span 
              className={`badge-variance ${person.isHighVariance ? 'badge-variance-danger' : ''}`}
              title={`Internal distance: avg ${person.avgInternalDist}, max ${person.maxInternalDist}. ${person.isHighVariance ? 'Warning: max distance > 0.55 indicates possible mixed people!' : 'Tight, consistent cluster.'}`}
            >
              {person.isHighVariance ? '⚠️ max: ' : 'dist: '}{person.maxInternalDist}
            </span>
          )}
        </div>

        {/* Card Actions */}
        <div className="person-card-actions">
          <button 
            type="button"
            className="btn-card-action btn-view"
            onClick={() => onViewPhotos(person)}
            title="Inspect photos in this group"
          >
            <Eye size={15} />
            <span>Photos</span>
          </button>

          {!isSpecial && onMerge && (
            <button 
              type="button"
              className="btn-card-action btn-merge"
              onClick={() => onMerge(person)}
              title="Merge this person into another group"
            >
              <GitMerge size={15} />
              <span>Merge</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
