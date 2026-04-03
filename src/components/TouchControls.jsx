import { useState, useCallback } from 'react';

const BUTTONS = [
  // D-pad
  { key: 'w', label: 'W', className: 'dpad-btn dpad-up' },
  { key: 's', label: 'S', className: 'dpad-btn dpad-down' },
  { key: 'a', label: '←', className: 'dpad-btn dpad-left' },
  { key: 'd', label: '→', className: 'dpad-btn dpad-right' },
  // Nozzle
  { key: 'q', label: 'Q ↑', className: 'nozzle-btn nozzle-left' },
  { key: 'e', label: 'E ↓', className: 'nozzle-btn nozzle-right' },
  // Actions
  { key: 'r', label: 'BOMB', className: 'act-btn act-bomb' },
  { key: 'f', label: 'GUN', className: 'act-btn act-gun' },
  { key: ' ', label: 'THRUST', className: 'act-btn act-thrust' },
  { key: 'v', label: 'CAM', className: 'act-btn act-cam' },
];

export default function TouchControls({ engine }) {
  const handlePress = useCallback((key) => {
    if (engine.current) engine.current.simulateKey(key, true);
  }, [engine]);

  const handleRelease = useCallback((key) => {
    if (engine.current) engine.current.simulateKey(key, false);
  }, [engine]);

  return (
        <div className="touch-bar">
          <div className="touch-section dpad">
            {BUTTONS.filter(b => b.className.startsWith('dpad')).map(b => (
              <div key={b.key} className={b.className}
                onTouchStart={(e) => { e.preventDefault(); handlePress(b.key); }}
                onTouchEnd={(e) => { e.preventDefault(); handleRelease(b.key); }}
                onMouseDown={() => handlePress(b.key)}
                onMouseUp={() => handleRelease(b.key)}
                onMouseLeave={() => handleRelease(b.key)}
              >{b.label}</div>
            ))}
          </div>
          <div className="touch-section nozzle-btns">
            {BUTTONS.filter(b => b.className.startsWith('nozzle')).map(b => (
              <div key={b.key} className={b.className}
                onTouchStart={(e) => { e.preventDefault(); handlePress(b.key); }}
                onTouchEnd={(e) => { e.preventDefault(); handleRelease(b.key); }}
                onMouseDown={() => handlePress(b.key)}
                onMouseUp={() => handleRelease(b.key)}
                onMouseLeave={() => handleRelease(b.key)}
              >{b.label}</div>
            ))}
          </div>
          <div className="touch-section action-btns">
            {BUTTONS.filter(b => b.className.startsWith('act')).map(b => (
              <div key={b.key} className={b.className}
                onTouchStart={(e) => { e.preventDefault(); handlePress(b.key); }}
                onTouchEnd={(e) => { e.preventDefault(); handleRelease(b.key); }}
                onMouseDown={() => handlePress(b.key)}
                onMouseUp={() => handleRelease(b.key)}
                onMouseLeave={() => handleRelease(b.key)}
              >{b.label}</div>
            ))}
          </div>
        </div>
  );
}
