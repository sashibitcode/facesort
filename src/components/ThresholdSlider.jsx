import React from 'react';
import { SlidersHorizontal, Info } from 'lucide-react';

export default function ThresholdSlider({ threshold, onChange, personCount }) {
  return (
    <div className="threshold-container">
      <div className="threshold-header">
        <div className="threshold-title-wrap">
          <SlidersHorizontal size={18} className="text-mint" />
          <span className="threshold-title">Grouping Sensitivity</span>
          <span className="threshold-badge">{threshold.toFixed(2)}</span>
        </div>
        <span className="threshold-result-count">
          <strong>{personCount}</strong> {personCount === 1 ? 'person group' : 'person groups'} formed
        </span>
      </div>

      <div className="slider-wrapper">
        <input 
          type="range"
          min="0.40"
          max="0.60"
          step="0.01"
          value={threshold}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          className="custom-range-slider"
          aria-label="Clustering Distance Threshold"
        />
        <div className="slider-scale-labels">
          <span>0.40 (Stricter, more groups)</span>
          <span className="scale-center">0.48 (Recommended)</span>
          <span>0.60 (Looser, more merged)</span>
        </div>
      </div>

      <div className="threshold-tip">
        <Info size={14} className="text-muted" />
        <span>
          Default <strong>0.48</strong>. If one person is split into multiple folders, increase towards <strong>0.52+</strong>. If different people are merged together, decrease towards <strong>0.44</strong>.
        </span>
      </div>
    </div>
  );
}
