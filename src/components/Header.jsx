import React, { useState, useEffect } from 'react';
import { ShieldCheck, RefreshCw, ScanFace, Sun, Moon, CheckCircle2 } from 'lucide-react';

export default function Header({ stats, onReset, isProcessing, theme = 'dark', onToggleTheme }) {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // Check if running as installed standalone app
    if (window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true) {
      setIsInstalled(true);
    }

    const handleBeforeInstall = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    if (isInstalled) return;

    if (deferredPrompt) {
      deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice && choice.outcome === 'accepted') {
        setIsInstalled(true);
      }
      setDeferredPrompt(null);
    } else {
      alert('To install FaceSort on your device, use your browser menu (⋮ or Share) and select "Install App" or "Add to Home Screen".');
    }
  };

  return (
    <header className="header-container">
      {/* Brand logo: Face in white, Sort in red with face-scan icon */}
      <div className="header-brand">
        <div className="brand-logo-wrap">
          <ScanFace className="brand-logo-icon" size={26} />
        </div>
        <div className="brand-text-wrap">
          <div className="brand-title-wrap">
            <h1 className="brand-title">
              Face<span className="brand-title-accent">Sort</span>
            </h1>
            <span className="badge-ai">AI Powered</span>
          </div>
          <p className="brand-subtitle">
            Organize mixed photo albums into person-specific folders automatically
          </p>
        </div>
      </div>

      <div className="header-actions">
        {/* Get App PWA Button */}
        <button 
          type="button"
          className={`btn-get-app ${isInstalled ? 'btn-get-app-installed' : ''}`}
          onClick={handleInstallClick}
          title={isInstalled ? 'FaceSort is installed' : 'Install FaceSort as an app on your device'}
        >
          {isInstalled ? (
            <>
              <CheckCircle2 size={14} className="text-black" />
              <span>Installed</span>
            </>
          ) : (
            <>
              <span className="pulse-mint-dot" />
              <span>Get App</span>
            </>
          )}
        </button>

        {/* Theme Sun/Moon Toggle */}
        <button
          type="button"
          className="btn-theme-toggle"
          onClick={onToggleTheme}
          aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
        >
          {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
        </button>

        {/* Privacy Pill */}
        <div className="privacy-pill" title="All processing happens inside your browser. No files are uploaded to any server.">
          <ShieldCheck size={16} className="text-mint" />
          <span>100% Private (Runs Locally)</span>
        </div>

        {/* Live Batch Stats */}
        {stats && (
          <div className="stats-strip">
            <div className="stat-item">
              <span className="stat-label">Photos</span>
              <span className="stat-value">{stats.totalPhotos}</span>
            </div>
            <div className="stat-divider" />
            <div className="stat-item">
              <span className="stat-label">Faces</span>
              <span className="stat-value">{stats.totalFaces}</span>
            </div>
            <div className="stat-divider" />
            <div className="stat-item">
              <span className="stat-label">People</span>
              <span className="stat-value stat-highlight">{stats.totalPersons}</span>
            </div>
          </div>
        )}

        {/* Reset Button */}
        {onReset && (
          <button 
            type="button"
            className="btn-secondary btn-icon-only" 
            onClick={onReset}
            disabled={isProcessing}
            title="Start over with a new folder"
          >
            <RefreshCw size={16} />
            <span className="btn-text-desktop">Reset</span>
          </button>
        )}
      </div>
    </header>
  );
}
