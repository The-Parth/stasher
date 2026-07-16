'use client';
import { useState, useEffect } from 'react';

interface ThemeModalProps {
  onClose: () => void;
}

export const DEFAULT_THEME = { h: 128, s: 48 };

const PRESETS = [
  { name: 'Koishi Green', h: 128, s: 48 },
  { name: 'Ocean Blue', h: 215, s: 70 },
  { name: 'Sunset Orange', h: 25, s: 85 },
  { name: 'Lavender', h: 260, s: 60 },
  { name: 'Rose', h: 340, s: 75 },
  { name: 'Monochrome', h: 0, s: 0 },
];

export default function ThemeModal({ onClose }: ThemeModalProps) {
  const [hue, setHue] = useState(DEFAULT_THEME.h);
  const [saturation, setSaturation] = useState(DEFAULT_THEME.s);

  useEffect(() => {
    // Read from DOM root when opening
    const root = document.documentElement;
    const currentH = root.style.getPropertyValue('--theme-h');
    const currentS = root.style.getPropertyValue('--theme-s');
    if (currentH) setHue(parseInt(currentH, 10));
    // Remove the % sign for the state
    if (currentS) setSaturation(parseInt(currentS.replace('%', ''), 10));
  }, []);

  const applyTheme = (h: number, s: number) => {
    setHue(h);
    setSaturation(s);
    const root = document.documentElement;
    root.style.setProperty('--theme-h', h.toString());
    root.style.setProperty('--theme-s', `${s}%`);
    localStorage.setItem('stasher_theme', JSON.stringify({ h, s }));
  };

  const handleReset = () => {
    applyTheme(DEFAULT_THEME.h, DEFAULT_THEME.s);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-title">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
          </svg>
          Theme Settings
        </div>

        <div className="field" style={{ marginBottom: 'var(--space-5)' }}>
          <label className="label">Accent Hue: {hue}°</label>
          <input 
            type="range" 
            min="0" max="360" 
            value={hue}
            onChange={(e) => applyTheme(parseInt(e.target.value, 10), saturation)}
            style={{ 
              width: '100%', 
              cursor: 'pointer',
              height: '8px',
              borderRadius: '4px',
              appearance: 'none',
              outline: 'none',
              background: `linear-gradient(to right, hsl(0, ${saturation}%, 50%), hsl(60, ${saturation}%, 50%), hsl(120, ${saturation}%, 50%), hsl(180, ${saturation}%, 50%), hsl(240, ${saturation}%, 50%), hsl(300, ${saturation}%, 50%), hsl(360, ${saturation}%, 50%))`
            }} 
            className="slider"
          />
        </div>

        <div className="field" style={{ marginBottom: 'var(--space-6)' }}>
          <label className="label">Saturation: {saturation}%</label>
          <input 
            type="range" 
            min="0" max="100" 
            value={saturation}
            onChange={(e) => applyTheme(hue, parseInt(e.target.value, 10))}
            style={{ 
              width: '100%', 
              cursor: 'pointer',
              height: '8px',
              borderRadius: '4px',
              appearance: 'none',
              outline: 'none',
              background: `linear-gradient(to right, hsl(${hue}, 0%, 50%), hsl(${hue}, 100%, 50%))`
            }} 
            className="slider"
          />
        </div>

        <div className="field" style={{ marginBottom: 'var(--space-6)' }}>
          <label className="label">Presets</label>
          <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
            {PRESETS.map(preset => (
              <button
                key={preset.name}
                className="btn-icon"
                title={preset.name}
                onClick={() => applyTheme(preset.h, preset.s)}
                style={{ 
                  width: '32px', height: '32px', borderRadius: '50%',
                  background: `hsl(${preset.h}, ${preset.s}%, 50%)`,
                  border: hue === preset.h && saturation === preset.s ? '2px solid white' : '2px solid transparent',
                  boxShadow: hue === preset.h && saturation === preset.s ? '0 0 10px rgba(255,255,255,0.2)' : 'none'
                }}
              />
            ))}
          </div>
        </div>

        <div className="modal-actions" style={{ justifyContent: 'space-between' }}>
          <button className="btn btn-ghost" onClick={handleReset}>
            Reset to Default
          </button>
          <button className="btn btn-primary" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
