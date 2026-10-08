import React from 'react';
import { GitMerge, UserX, Sparkles, Image as ImageIcon, Link2 } from 'lucide-react';

export default function SuggestedMerges({ suggestedMerges = [], onMerge, onDismiss }) {
  if (!suggestedMerges || suggestedMerges.length === 0) {
    return null;
  }

  return (
    <div className="suggested-merges-panel glass-card">
      <div className="suggested-merges-header">
        <div className="suggested-title-wrap">
          <Sparkles size={18} className="text-mint animate-pulse" />
          <h3 className="suggested-heading text-mint">Suggested Merges</h3>
          <span className="badge-suggested-count">{suggestedMerges.length} to review</span>
        </div>
        <p className="suggested-subtitle">
          These persons have similar facial descriptors (centroid distance 0.52 &ndash; 0.60) and appear in separate photos. 
          Merge them if they are the same individual, or dismiss them with &ldquo;Not same&rdquo;.
        </p>
      </div>

      <div className="suggested-cards-grid">
        {suggestedMerges.map((pair) => {
          const { personA, personB, centroidDistance, linkageDistance } = pair;
          const pairKey = [personA.id, personB.id].sort().join(':::');
          const similarityPct = Math.round(Math.max(0, (1 - centroidDistance) * 100));

          return (
            <div key={pairKey} className="suggested-merge-card">
              <div className="suggested-comparison-row">
                {/* Person A */}
                <div className="suggested-person-side">
                  <div className="suggested-avatar-wrap ring-mint">
                    {personA.thumbnail ? (
                      <img 
                        src={personA.thumbnail} 
                        alt={personA.name} 
                        className="suggested-avatar-img"
                      />
                    ) : (
                      <div className="suggested-avatar-fallback">
                        <ImageIcon size={20} className="text-muted" />
                      </div>
                    )}
                  </div>
                  <div className="suggested-person-info">
                    <span className="suggested-person-name" title={personA.name}>{personA.name}</span>
                    <span className="suggested-person-meta">{personA.photoCount} photos</span>
                  </div>
                </div>

                {/* Link Icon & Match indicator */}
                <div className="suggested-metric-pill" title={`Centroid dist: ${centroidDistance}, Linkage dist: ${linkageDistance}`}>
                  <Link2 size={16} className="suggested-link-icon text-mint" />
                  <span className="suggested-distance-tag">Dist {centroidDistance}</span>
                  <span className="suggested-match-tag">~{similarityPct}%</span>
                </div>

                {/* Person B */}
                <div className="suggested-person-side">
                  <div className="suggested-avatar-wrap ring-mint">
                    {personB.thumbnail ? (
                      <img 
                        src={personB.thumbnail} 
                        alt={personB.name} 
                        className="suggested-avatar-img"
                      />
                    ) : (
                      <div className="suggested-avatar-fallback">
                        <ImageIcon size={20} className="text-muted" />
                      </div>
                    )}
                  </div>
                  <div className="suggested-person-info">
                    <span className="suggested-person-name" title={personB.name}>{personB.name}</span>
                    <span className="suggested-person-meta">{personB.photoCount} photos</span>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="suggested-actions-row">
                <button
                  type="button"
                  className="btn-suggested-action btn-suggested-merge"
                  onClick={() => onMerge(personB.id, personA.id)}
                  title={`Merge ${personB.name} into ${personA.name}`}
                >
                  <GitMerge size={15} />
                  <span>Merge</span>
                </button>
                <button
                  type="button"
                  className="btn-suggested-action btn-suggested-dismiss"
                  onClick={() => onDismiss(personA.id, personB.id)}
                  title="Remember as different people (never suggest again)"
                >
                  <UserX size={15} />
                  <span>Not same</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
