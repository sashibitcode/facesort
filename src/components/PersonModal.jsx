import React, { useState, useEffect } from 'react';
import { X, ArrowRightLeft, Trash2, Maximize2, Image as ImageIcon, UserCheck } from 'lucide-react';

export default function PersonModal({
  person,
  allPersons,
  onClose,
  onMovePhoto,
  onRemovePhoto
}) {
  const [activePhotoPreview, setActivePhotoPreview] = useState(null);
  const [photoUrls, setPhotoUrls] = useState({});

  // Generate object URLs for previewing photos inside modal
  useEffect(() => {
    if (!person || !person.photos) return;
    const urls = {};
    for (const photo of person.photos) {
      if (photo.file) {
        urls[photo.id] = URL.createObjectURL(photo.file);
      }
    }
    setPhotoUrls(urls);

    return () => {
      // Clean up object URLs
      for (const id in urls) {
        URL.revokeObjectURL(urls[id]);
      }
    };
  }, [person]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (activePhotoPreview) {
          setActivePhotoPreview(null);
        } else {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, activePhotoPreview]);

  if (!person) return null;

  const isNoFace = person.id === 'no-face';

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content modal-large" onClick={(e) => e.stopPropagation()}>
        {/* Modal Header */}
        <div className="modal-header">
          <div className="modal-person-summary">
            {person.thumbnail ? (
              <img src={person.thumbnail} alt={person.name} className="modal-header-avatar" />
            ) : (
              <div className="modal-header-avatar fallback">
                <ImageIcon size={24} className="text-muted" />
              </div>
            )}
            <div>
              <h2 className="modal-title">{person.name}</h2>
              <p className="modal-subtitle">
                {person.photos?.length || 0} photos in this folder
                {!isNoFace && person.faces?.length ? ` • ${person.faces.length} detected face instances` : ''}
              </p>
            </div>
          </div>

          <button className="btn-modal-close" onClick={onClose} aria-label="Close modal">
            <X size={20} />
          </button>
        </div>

        {/* Modal Body - Gallery Grid */}
        <div className="modal-gallery-body">
          {person.photos && person.photos.length > 0 ? (
            <div className="gallery-grid">
              {person.photos.map((photo) => {
                const url = photoUrls[photo.id];
                return (
                  <div key={photo.id} className="gallery-card">
                    <div 
                      className="gallery-photo-thumb"
                      onClick={() => setActivePhotoPreview(url)}
                      title="Click to enlarge"
                    >
                      {url ? (
                        <img src={url} alt={photo.name} loading="lazy" />
                      ) : (
                        <div className="thumb-loading">Loading...</div>
                      )}
                      <div className="gallery-photo-overlay">
                        <Maximize2 size={18} />
                      </div>
                    </div>

                    <div className="gallery-photo-meta">
                      <div className="gallery-photo-title-row">
                        <span className="gallery-photo-name" title={photo.name}>
                          {photo.name}
                        </span>
                        {photo.matchedByClothes && (
                          <span 
                            className="badge-clothes"
                            title="This photo was matched using clothing color histogram. You can reassign or move it back to Blur below."
                          >
                            👕 Matched by clothes
                          </span>
                        )}
                      </div>

                      {/* Photo Actions: Move to another person */}
                      <div className="gallery-photo-actions">
                        <div className="move-select-wrap">
                          <ArrowRightLeft size={13} className="text-muted" />
                          <select 
                            className="move-select"
                            defaultValue=""
                            onChange={(e) => {
                              const targetId = e.target.value;
                              if (targetId) {
                                onMovePhoto(photo.id, person.id, targetId);
                              }
                            }}
                          >
                            <option value="" disabled>Move to...</option>
                            {allPersons
                              .filter((p) => p.id !== person.id)
                              .map((p) => (
                                <option key={p.id} value={p.id}>
                                  {p.name}
                                </option>
                              ))}
                            {person.id !== 'blur' && (
                              <option value="blur">Blur Folder</option>
                            )}
                            {!isNoFace && (
                              <option value="no-face">No Face Folder</option>
                            )}
                          </select>
                        </div>

                        {onRemovePhoto && (
                          <button 
                            className="btn-remove-photo"
                            onClick={() => onRemovePhoto(person.id, photo.id)}
                            title="Remove photo from this folder (moves to Blur)"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="empty-gallery">
              <ImageIcon size={48} className="text-muted" />
              <p>No photos remaining in this person folder.</p>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="modal-footer">
          <span className="modal-footer-hint">
            Changes to photos and folders are automatically updated before ZIP export.
          </span>
          <button className="btn-secondary" onClick={onClose}>
            Done
          </button>
        </div>
      </div>

      {/* Lightbox Preview */}
      {activePhotoPreview && (
        <div className="lightbox-backdrop" onClick={() => setActivePhotoPreview(null)}>
          <div className="lightbox-content">
            <img src={activePhotoPreview} alt="Full view" className="lightbox-img" />
            <button className="lightbox-close" onClick={() => setActivePhotoPreview(null)}>
              <X size={24} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
