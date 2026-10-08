import React, { useRef, useState } from 'react';
import { FolderUp, Image as ImageIcon, Sparkles, CheckCircle2, Shield, Cpu, Layers } from 'lucide-react';

const VALID_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.bmp', '.avif'];

function isImageFile(file) {
  if (file.type && file.type.startsWith('image/')) return true;
  const name = file.name.toLowerCase();
  return VALID_EXTENSIONS.some(ext => name.endsWith(ext));
}

/**
 * Recursively scans a FileSystemEntry for image files
 */
async function scanFilesFromEntry(entry) {
  if (entry.isFile) {
    return new Promise((resolve) => {
      entry.file((file) => {
        if (isImageFile(file)) {
          resolve([file]);
        } else {
          resolve([]);
        }
      }, () => resolve([]));
    });
  } else if (entry.isDirectory) {
    const reader = entry.createReader();
    const entries = await new Promise((resolve) => {
      reader.readEntries((results) => resolve(results || []), () => resolve([]));
    });
    const subFiles = await Promise.all(entries.map(scanFilesFromEntry));
    return subFiles.flat();
  }
  return [];
}

export default function DropZone({ onFilesSelected, isModelLoading, modelStatus }) {
  const [isDragOver, setIsDragOver] = useState(false);
  const folderInputRef = useRef(null);
  const filesInputRef = useRef(null);

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    setIsDragOver(false);

    const items = e.dataTransfer.items;
    let files = [];

    if (items && items.length > 0) {
      const entryPromises = [];
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.webkitGetAsEntry) {
          const entry = item.webkitGetAsEntry();
          if (entry) entryPromises.push(scanFilesFromEntry(entry));
        } else {
          const file = item.getAsFile();
          if (file && isImageFile(file)) files.push(file);
        }
      }
      if (entryPromises.length > 0) {
        const scanned = await Promise.all(entryPromises);
        files = [...files, ...scanned.flat()];
      }
    } else if (e.dataTransfer.files) {
      files = Array.from(e.dataTransfer.files).filter(isImageFile);
    }

    if (files.length > 0) {
      onFilesSelected(files);
    }
  };

  const handleFolderChange = (e) => {
    const files = Array.from(e.target.files || []).filter(isImageFile);
    if (files.length > 0) {
      onFilesSelected(files);
    }
  };

  const handleFilesChange = (e) => {
    const files = Array.from(e.target.files || []).filter(isImageFile);
    if (files.length > 0) {
      onFilesSelected(files);
    }
  };

  return (
    <div className="dropzone-section">
      <div 
        className={`dropzone-card ${isDragOver ? 'drag-over' : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <div className="dropzone-glow" />
        
        <div className="dropzone-icon-wrap">
          <FolderUp size={58} className="dropzone-icon text-mint" />
        </div>

        <h2 className="dropzone-title">Drop your photo folder here</h2>
        <p className="dropzone-desc">
          Drag & drop a folder containing photos, or use the buttons below.
          Supports JPG, PNG, WEBP.
        </p>

        {isModelLoading && (
          <div className="model-loading-notice skeleton-shimmer-box">
            <span className="spinner-mint" />
            <span className="skeleton-text">{modelStatus || 'Loading on-device face recognition models...'}</span>
          </div>
        )}

        <div className="dropzone-actions">
          {/* Folder input */}
          <input 
            type="file" 
            ref={folderInputRef}
            onChange={handleFolderChange}
            webkitdirectory="true"
            directory="true"
            multiple
            accept="image/png,image/jpeg,image/webp,image/jpg"
            style={{ display: 'none' }}
          />

          {/* Files input */}
          <input 
            type="file" 
            ref={filesInputRef}
            onChange={handleFilesChange}
            multiple
            accept="image/png,image/jpeg,image/webp,image/jpg"
            style={{ display: 'none' }}
          />

          <button 
            type="button"
            className="btn-primary btn-large"
            onClick={() => folderInputRef.current?.click()}
          >
            <FolderUp size={20} />
            <span>Select Folder</span>
          </button>

          <button 
            type="button"
            className="btn-secondary"
            onClick={() => filesInputRef.current?.click()}
          >
            <ImageIcon size={18} />
            <span>Select Photos</span>
          </button>
        </div>
      </div>

      {/* Feature highlights */}
      <div className="features-grid">
        <div className="feature-card">
          <div className="feature-icon-badge">
            <Cpu size={22} className="text-mint" />
          </div>
          <h3>Local Neural Network</h3>
          <p>Face detection & 128-d recognition running via WebGL inside your browser.</p>
        </div>

        <div className="feature-card">
          <div className="feature-icon-badge">
            <Layers size={22} className="text-mint" />
          </div>
          <h3>Multi-Person Grouping</h3>
          <p>Photos with multiple faces are automatically copied into each person's folder.</p>
        </div>

        <div className="feature-card">
          <div className="feature-icon-badge">
            <Shield size={22} className="text-mint" />
          </div>
          <h3>Zero Server Uploads</h3>
          <p>Your personal photos never leave your device. Complete privacy guaranteed.</p>
        </div>
      </div>
    </div>
  );
}
