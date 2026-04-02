import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useGameStore } from '../lib/store';
import { PLANE_COLORS } from '../lib/constants';

export default function Lobby({ mode, onStart }) {
  const [roomCode, setRoomCode] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [players, setPlayers] = useState({});
  const [status, setStatus] = useState('');
  const mpRef = useRef(null);
  const { settings } = useGameStore();

  useEffect(() => {
    if (mode === 'create') createRoom();
    return () => {
      if (mpRef.current?.channel) mpRef.current.channel.unsubscribe();
    };
  }, [mode]);

  function genCode() {
    return Array.from({ length: 4 }, () => String.fromCharCode(65 + Math.random() * 26 | 0)).join('');
  }

  function createRoom() {
    const code = genCode();
    const playerId = crypto.randomUUID().slice(0, 8);

    const mp = {
      isHost: true,
      roomCode: code,
      playerId,
      playerSlot: 0,
      channel: null,
      players: { 0: { id: playerId, name: 'Host', slot: 0 } },
      remoteInputs: {},
    };

    setRoomCode(code);
    setPlayers(mp.players);
    setStatus('Waiting for players...');

    const channel = supabase.channel('room-' + code);
    channel.on('broadcast', { event: 'player-join' }, ({ payload }) => {
      const slot = Object.keys(mp.players).length;
      if (slot >= 3) return;
      mp.players[slot] = { id: payload.id, name: payload.name || 'Player', slot };
      mp.remoteInputs[slot] = {};
      setPlayers({ ...mp.players });
      setStatus(Object.keys(mp.players).length + '/3 players');
      channel.send({ type: 'broadcast', event: 'lobby-update', payload: { players: mp.players } });
    });
    channel.on('broadcast', { event: 'input' }, ({ payload }) => {
      mp.remoteInputs[payload.slot] = payload.keys;
    });
    channel.on('broadcast', { event: 'respawn' }, ({ payload }) => {
      // Will be handled by game engine
      if (mp._onRespawn) mp._onRespawn(payload.slot);
    });
    channel.subscribe();
    mp.channel = channel;
    mpRef.current = mp;
  }

  function joinRoom() {
    const code = joinCode.toUpperCase().trim();
    if (code.length !== 4) { setStatus('Enter a 4-letter code'); return; }

    const playerId = crypto.randomUUID().slice(0, 8);
    setStatus('Connecting...');

    const mp = {
      isHost: false,
      roomCode: code,
      playerId,
      playerSlot: -1,
      channel: null,
      players: {},
      remoteInputs: {},
    };

    const channel = supabase.channel('room-' + code);
    channel.on('broadcast', { event: 'lobby-update' }, ({ payload }) => {
      mp.players = payload.players;
      for (const [slot, p] of Object.entries(mp.players)) {
        if (p.id === mp.playerId) mp.playerSlot = parseInt(slot);
      }
      setPlayers({ ...mp.players });
      setStatus('In room! Waiting for host to start...');
    });
    channel.on('broadcast', { event: 'game-start' }, ({ payload }) => {
      setStatus('Starting!');
      onStart(mp);
    });
    channel.on('broadcast', { event: 'state' }, () => {});
    channel.on('broadcast', { event: 'game-over' }, () => {});
    channel.subscribe(() => {
      channel.send({ type: 'broadcast', event: 'player-join', payload: { id: playerId, name: 'Player' } });
    });
    mp.channel = channel;
    mpRef.current = mp;
  }

  function handleHostStart() {
    const mp = mpRef.current;
    if (!mp) return;
    const gameSettings = {
      ...settings,
      playerCount: Object.keys(mp.players).length,
      players: mp.players,
    };
    mp.channel.send({ type: 'broadcast', event: 'game-start', payload: { settings: gameSettings } });
    onStart(mp);
  }

  return (
    <div className="lobby">
      {mode === 'create' && (
        <>
          <div>Room Code:</div>
          <div className="room-code">{roomCode || '----'}</div>
          <div>Share this code with friends!</div>
          <div className="player-list">
            {Object.entries(players).map(([slot, p]) => (
              <div key={slot} style={{ color: PLANE_COLORS[slot]?.body }}>
                {PLANE_COLORS[slot]?.name}: {p.name} {p.id === mpRef.current?.playerId ? '(You)' : ''}
              </div>
            ))}
          </div>
          <div className="status">{status}</div>
          {Object.keys(players).length > 1 && (
            <button className="launch-btn" onClick={handleHostStart}>Start Game</button>
          )}
        </>
      )}

      {mode === 'join' && (
        <>
          <label>Enter Room Code</label>
          <input
            type="text" maxLength={4} placeholder="ABCD"
            className="join-input"
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
          />
          <button onClick={joinRoom} style={{ marginTop: 12 }}>Join</button>
          <div className="status">{status}</div>
          <div className="player-list">
            {Object.entries(players).map(([slot, p]) => (
              <div key={slot} style={{ color: PLANE_COLORS[slot]?.body }}>
                {PLANE_COLORS[slot]?.name}: {p.name} {p.id === mpRef.current?.playerId ? '(You)' : ''}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
