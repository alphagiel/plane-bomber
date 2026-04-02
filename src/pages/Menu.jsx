import { useState } from 'react';
import { useGameStore } from '../lib/store';
import { supabase } from '../lib/supabase';
import Settings from '../components/Settings';
import Lobby from '../components/Lobby';

export default function Menu() {
  const { gameMode, setGameMode, setScreen, setMp, settings } = useGameStore();
  const [mode, setMode] = useState('solo');

  function handleModeChange(m) {
    setMode(m);
    setGameMode(m);
  }

  function handleStart(mpState) {
    if (mpState) setMp(mpState);
    setScreen('game');
  }

  return (
    <div className="menu-container">
      <h1>Airport Bomber Defense</h1>
      <h2>Defend your airport from the stick figure invasion!</h2>

      <div className="mode-select">
        <button className={mode === 'solo' ? 'active' : ''} onClick={() => handleModeChange('solo')}>Solo</button>
        <button className={mode === 'create' ? 'active' : ''} onClick={() => handleModeChange('create')}>Create Room</button>
        <button className={mode === 'join' ? 'active' : ''} onClick={() => handleModeChange('join')}>Join Room</button>
      </div>

      {mode !== 'solo' && <Lobby mode={mode} onStart={handleStart} />}

      {mode !== 'join' && <Settings />}

      {mode !== 'join' && (
        <button className="launch-btn" onClick={() => handleStart(null)}>
          {mode === 'solo' ? 'Take Off!' : 'Start Game'}
        </button>
      )}
    </div>
  );
}
