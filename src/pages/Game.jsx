import { useEffect, useRef, useState } from 'react';
import { useGameStore } from '../lib/store';
import { GameEngine } from '../game/engine';
import { bindRender } from '../game/render';
import HUD from '../components/HUD';
import TouchControls from '../components/TouchControls';

export default function Game() {
  const canvasRef = useRef(null);
  const engineRef = useRef(null);
  const { settings, mp, setScreen } = useGameStore();
  const [hud, setHud] = useState(null);
  const [gameOverInfo, setGameOverInfo] = useState(null);
  const [respawnInfo, setRespawnInfo] = useState(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const engine = new GameEngine(canvas, {
      onHudUpdate: setHud,
      onGameOver: (reason, score) => setGameOverInfo({ reason, score }),
      onPlaneDeath: (reason) => setRespawnInfo({ reason }),
    });

    bindRender(engine);

    if (mp) engine.setMultiplayer(mp);

    const gameSettings = {
      ...settings,
      playerCount: mp ? Object.keys(mp.players || {}).length : 1,
    };
    engine.start(gameSettings);
    engineRef.current = engine;

    // If client, listen for state updates
    if (mp && !mp.isHost && mp.channel) {
      mp.channel.on('broadcast', { event: 'state' }, ({ payload }) => {
        engine.applyRemoteState(payload);
      });
      mp.channel.on('broadcast', { event: 'game-over' }, ({ payload }) => {
        setGameOverInfo({ reason: payload.reason, score: engine.game?.score || 0 });
      });
    }

    // If host, wire respawn handler
    if (mp && mp.isHost) {
      mp._onRespawn = (slot) => {
        if (engine.game?.planes[slot]) engine.respawnPlane(engine.game.planes[slot]);
      };
    }

    return () => engine.destroy();
  }, []);

  function handleRespawn() {
    const engine = engineRef.current;
    if (!engine) return;
    setRespawnInfo(null);
    if (mp && mp.channel) {
      if (mp.isHost) {
        engine.respawnPlane(engine.game.planes[mp.playerSlot]);
      } else {
        mp.channel.send({ type: 'broadcast', event: 'respawn', payload: { slot: mp.playerSlot } });
      }
    } else {
      engine.respawnPlane(engine.game.plane);
    }
  }

  function handleLeave() {
    setRespawnInfo(null);
    setScreen('menu');
  }

  return (
    <div className="game-container">
      <canvas ref={canvasRef} style={{ width: '100vw', height: '100vh', display: 'block' }} />

      {hud && <HUD data={hud} />}

      <TouchControls engine={engineRef} />

      {respawnInfo && (
        <div className="overlay-panel">
          <h2 style={{ color: '#f44' }}>You Crashed!</h2>
          <p>{respawnInfo.reason}</p>
          <button className="btn-primary" onClick={handleRespawn}>Respawn</button>
          <button className="btn-secondary" onClick={handleLeave}>Leave</button>
        </div>
      )}

      {gameOverInfo && (
        <div className="overlay-panel">
          <h1 style={{ color: '#f44' }}>GAME OVER</h1>
          <p>{gameOverInfo.reason}</p>
          <p>Final Score: {gameOverInfo.score}</p>
          <button className="btn-primary" onClick={() => location.reload()}>Play Again</button>
        </div>
      )}

      <div className="controls-hint">
        A: Left | D: Right | Space: Thrust | W/S: Climb/Dive | Q/E: Nozzle | R: Bomb | F: Gun | V: Cam
      </div>
    </div>
  );
}
