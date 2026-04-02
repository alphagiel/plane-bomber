// --- Supabase Multiplayer ---
const SUPABASE_URL = 'https://opztiobihdphdwpbbkyy.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9wenRpb2JpaGRwaGR3cGJia3l5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI5MjA5NDcsImV4cCI6MjA4ODQ5Njk0N30.ZyyxZRIfnxh7_irafNwSQ43QVGCrMFojvGZbgPr30tU';
let sb = null;
function initSupabase() {
  if (sb) return true;
  try {
    if (window.supabase) {
      sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
      return true;
    }
  } catch(e) { console.warn('Supabase init failed:', e); }
  return false;
}

let mp = null; // null = solo mode
let gameMode = 'solo';

const PLANE_COLORS = [
  { body: '#f90', cockpit: '#6af', name: 'P1' },
  { body: '#0cf', cockpit: '#6cf', name: 'P2' },
  { body: '#8f0', cockpit: '#af6', name: 'P3' },
];

function selectMode(mode) {
  gameMode = mode;
  document.querySelectorAll('#modeSelect button').forEach(b => b.classList.remove('active'));
  document.getElementById('lobby').style.display = mode === 'solo' ? 'none' : 'block';
  document.getElementById('lobbyCreate').style.display = mode === 'create' ? 'block' : 'none';
  document.getElementById('lobbyJoin').style.display = mode === 'join' ? 'block' : 'none';
  document.getElementById('gameSettings').style.display = mode === 'join' ? 'none' : 'block';
  document.getElementById('launchBtn').style.display = mode === 'join' ? 'none' : 'block';

  if (mode === 'solo') {
    document.getElementById('btnSolo').classList.add('active');
    if (mp && mp.channel) { mp.channel.unsubscribe(); mp = null; }
  } else if (mode === 'create') {
    document.getElementById('btnCreate').classList.add('active');
    createRoom();
  } else if (mode === 'join') {
    document.getElementById('btnJoin').classList.add('active');
  }
}

function genRoomCode() {
  return Array.from({length: 4}, () => String.fromCharCode(65 + Math.random() * 26 | 0)).join('');
}

function createRoom() {
  if (!initSupabase()) { document.getElementById('mpStatus').textContent = 'Multiplayer unavailable — Supabase failed to load. Check internet connection.'; return; }
  const code = genRoomCode();
  const playerId = crypto.randomUUID().slice(0, 8);

  mp = {
    isHost: true,
    roomCode: code,
    playerId,
    playerSlot: 0,
    channel: null,
    players: { 0: { id: playerId, name: 'Host', slot: 0, connected: true } },
    remoteInputs: {},
  };

  document.getElementById('roomCodeDisplay').textContent = code;
  updatePlayerList();

  const channel = sb.channel('room-' + code);
  channel.on('broadcast', { event: 'player-join' }, ({ payload }) => {
    const slot = Object.keys(mp.players).length;
    if (slot >= 3) return;
    mp.players[slot] = { id: payload.id, name: payload.name || 'Player', slot, connected: true };
    mp.remoteInputs[slot] = {};
    updatePlayerList();
    // Tell everyone who's in the room
    channel.send({ type: 'broadcast', event: 'lobby-update', payload: { players: mp.players } });
    document.getElementById('mpStatus').textContent = Object.keys(mp.players).length + '/3 players';
  });
  channel.on('broadcast', { event: 'input' }, ({ payload }) => {
    if (mp) mp.remoteInputs[payload.slot] = payload.keys;
  });
  channel.on('broadcast', { event: 'respawn' }, ({ payload }) => {
    // Host respawns the requesting player's plane
    if (mp && mp.isHost && game && game.planes[payload.slot]) {
      respawnPlane(game.planes[payload.slot]);
    }
  });
  channel.subscribe();
  mp.channel = channel;
}

function joinRoom() {
  if (!initSupabase()) { document.getElementById('joinStatus').textContent = 'Multiplayer unavailable — Supabase failed to load.'; return; }
  const code = document.getElementById('joinInput').value.toUpperCase().trim();
  if (code.length !== 4) {
    document.getElementById('joinStatus').textContent = 'Enter a 4-letter code';
    return;
  }

  const playerId = crypto.randomUUID().slice(0, 8);
  document.getElementById('joinStatus').textContent = 'Connecting...';

  mp = {
    isHost: false,
    roomCode: code,
    playerId,
    playerSlot: -1, // assigned by host
    channel: null,
    players: {},
    remoteInputs: {},
  };

  const channel = sb.channel('room-' + code);

  channel.on('broadcast', { event: 'lobby-update' }, ({ payload }) => {
    mp.players = payload.players;
    // Find our slot
    for (const [slot, p] of Object.entries(mp.players)) {
      if (p.id === mp.playerId) mp.playerSlot = parseInt(slot);
    }
    updatePlayerList('playerListJoin');
    document.getElementById('joinStatus').textContent = 'In room! ' + Object.keys(mp.players).length + '/3 players. Waiting for host to start...';
  });

  channel.on('broadcast', { event: 'game-start' }, ({ payload }) => {
    // Host started the game — apply settings and start
    document.getElementById('joinStatus').textContent = 'Starting!';
    applySettingsAndStart(payload.settings);
  });

  channel.on('broadcast', { event: 'state' }, ({ payload }) => {
    if (game && mp && !mp.isHost) {
      // Apply host state
      applyRemoteState(payload);
    }
  });

  channel.on('broadcast', { event: 'game-over' }, ({ payload }) => {
    if (game) endGame(payload.reason);
  });

  channel.subscribe(() => {
    // Send join request
    channel.send({ type: 'broadcast', event: 'player-join', payload: { id: playerId, name: 'Player' } });
  });

  mp.channel = channel;
}

function updatePlayerList(elementId) {
  if (!mp) return;
  const el = document.getElementById(elementId || 'playerList');
  el.innerHTML = '';
  for (const [slot, p] of Object.entries(mp.players)) {
    const row = document.createElement('div');
    row.className = 'player-row p' + slot;
    row.textContent = (parseInt(slot) === mp.playerSlot ? '> ' : '  ') + PLANE_COLORS[slot].name + ': ' + p.name + (p.id === mp.playerId ? ' (You)' : '');
    el.appendChild(row);
  }
}

function launchGame() {
  if (gameMode === 'solo') {
    startGame();
  } else if (gameMode === 'create' && mp && mp.isHost) {
    const settings = gatherSettings();
    // Tell clients to start
    mp.channel.send({ type: 'broadcast', event: 'game-start', payload: { settings } });
    startGame(settings);
  }
}

function gatherSettings() {
  return {
    diff: parseInt(document.getElementById('difficulty').value),
    bombCount: Math.max(1, Math.min(50, parseInt(document.getElementById('bombCount').value) || 5)),
    enemySpeedMult: parseFloat(document.getElementById('enemySpeed').value) || 0.5,
    enemySizeMult: parseFloat(document.getElementById('enemySize').value) || 0.6,
    spawnRate: parseInt(document.getElementById('spawnRate').value) || 120,
    spawnType: document.getElementById('spawnType').value,
    boss1Every: Math.max(1, parseInt(document.getElementById('boss1Every').value) || 20),
    boss2After: Math.max(1, parseInt(document.getElementById('boss2After').value) || 5),
    playerCount: mp ? Object.keys(mp.players).length : 1,
    players: mp ? mp.players : { 0: { name: 'Player', slot: 0 } },
  };
}

function applySettingsAndStart(settings) {
  startGame(settings);
}

function applyRemoteState(state) {
  if (!game) return;
  // Overwrite game state from host
  game.planes = state.planes;
  game.enemies = state.enemies;
  game.bombList = state.bombList;
  game.gunBullets = state.gunBullets;
  game.enemyBullets = state.enemyBullets;
  game.score = state.score;
  game.airportHP = state.airportHP;
  // Rebuild explosions with particles (can't sync particles, just positions)
  game.explosions = state.explosions.map(e => ({
    ...e, particles: [], flash: 0, shockwave: e.maxR * 3 - e.life * 2,
  }));
  // Update local plane alias
  if (mp) {
    game.plane = game.planes[mp.playerSlot] || game.planes[0];
    // Hide respawn screen if we're alive again
    if (game.plane && game.plane.alive) {
      document.getElementById('respawnScreen').style.display = 'none';
    }
  }
}

function getInputForSlot(slot) {
  if (!mp) return keys;
  if (slot === mp.playerSlot) return keys;
  return mp.remoteInputs[slot] || {};
}

// --- Canvas and Game ---
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

// Sizing
canvas.width = 1200;
canvas.height = 700;
const W = canvas.width;
const H = canvas.height;

// World
const WORLD_W = 1400;
const GROUND_Y = H - 60;
const RUNWAY_X = 40;
const RUNWAY_W = 320;
const RUNWAY_Y = GROUND_Y;

// Game state
let game = null;

const keys = {};
window.addEventListener('keydown', e => { keys[e.key.toLowerCase()] = true; if(e.key === ' ') e.preventDefault(); });
window.addEventListener('keyup', e => { keys[e.key.toLowerCase()] = false; });
canvas.addEventListener('wheel', e => {
  if (!game || game.gameOver) return;
  e.preventDefault();
  const delta = e.deltaY > 0 ? -0.1 : 0.1;
  game.zoom = Math.max(0.5, Math.min(3, game.zoom + delta));
}, { passive: false });

function makePlane(slot, bombCount) {
  return {
    x: RUNWAY_X + 60 + slot * 40,
    y: RUNWAY_Y - 12,
    vx: 0, vy: 0,
    angle: 0,
    thrusterAngle: 0,
    speed: 0,
    airborne: false,
    onRunway: true,
    facingRight: true,
    width: 48, height: 16,
    slot: slot,
    hp: 100, maxHP: 100,
    bombs: bombCount, bombMax: bombCount,
    bombCooldown: 0, gunCooldown: 0,
    alive: true,
    color: PLANE_COLORS[slot] || PLANE_COLORS[0],
  };
}

function startGame(settings) {
  const s = settings || gatherSettings();
  document.getElementById('menu').style.display = 'none';
  document.getElementById('hud').style.display = 'block';

  const playerCount = s.playerCount || 1;
  const planes = [];
  for (let i = 0; i < playerCount; i++) {
    planes.push(makePlane(i, s.bombCount));
  }

  game = {
    diff: s.diff,
    bombMax: s.bombCount,
    enemySpeedMult: s.enemySpeedMult,
    enemySizeMult: s.enemySizeMult,
    spawnRateOverride: s.spawnRate,
    score: 0,
    airportHP: 200,
    airportMaxHP: 200,
    planes: planes,
    plane: planes[mp ? mp.playerSlot : 0], // alias for local player (backward compat)
    bombList: [],
    explosions: [],
    enemies: [],
    enemyBullets: [],
    spawnTimer: 0,
    spawnInterval: s.spawnRate,
    followCam: true,
    camX: 0,
    gameOver: false,
    gameOverReason: '',
    gunBullets: [],
    zoom: 1,
    spawnCount: 0,
    spawnType: s.spawnType,
    boss1Every: s.boss1Every,
    boss2After: s.boss2After,
    frameCount: 0,
  };

  requestAnimationFrame(loop);
}

function loop() {
  if (!game) return;
  // Host and solo run full update; clients only render (state comes from host)
  if (!mp || mp.isHost) {
    update();
  } else {
    // Client: still send input and update HUD
    game.frameCount = (game.frameCount || 0) + 1;
    if (mp.channel && game.frameCount % 3 === 0) {
      const inputKeys = {};
      ['w','s','a','d','q','e',' ','r','f','v'].forEach(k => { if (keys[k]) inputKeys[k] = true; });
      mp.channel.send({ type: 'broadcast', event: 'input', payload: { slot: mp.playerSlot, keys: inputKeys } });
    }
    // Update HUD from synced state
    const p = game.plane;
    if (p) {
      document.getElementById('scoreVal').textContent = game.score;
      document.getElementById('bombVal').textContent = p.bombs + ' / ' + p.bombMax;
      document.getElementById('reloadMsg').style.display = p.bombs === 0 ? 'inline' : 'none';
      document.getElementById('planeHPBar').style.width = Math.max(0, p.hp / p.maxHP * 100) + '%';
      document.getElementById('airportHPBar').style.width = Math.max(0, game.airportHP / game.airportMaxHP * 100) + '%';
    }
  }
  render();
  if (!game.gameOver) requestAnimationFrame(loop);
}

function killPlane(p, reason) {
  p.alive = false;
  // Explosion at crash site
  game.explosions.push({
    x: p.x, y: p.y, r: 40, maxR: 40, life: 60,
    particles: [], flash: 1, shockwave: 0,
  });

  // In multiplayer, show respawn prompt to the dead player
  const localSlot = mp ? mp.playerSlot : 0;
  if (game.planes.length > 1 && p.slot === localSlot) {
    document.getElementById('respawnReason').textContent = reason;
    document.getElementById('respawnScreen').style.display = 'block';
    return; // don't end game, others still playing
  }

  // Check if all planes dead
  const anyAlive = game.planes.some(pl => pl.alive);
  if (!anyAlive) {
    endGame(reason);
  }
}

function respawnPlane(p) {
  p.x = RUNWAY_X + 60 + p.slot * 40;
  p.y = RUNWAY_Y - 12;
  p.vx = 0; p.vy = 0;
  p.angle = 0; p.thrusterAngle = 0;
  p.speed = 0;
  p.airborne = false; p.onRunway = true;
  p.facingRight = true;
  p.hp = p.maxHP;
  p.bombs = p.bombMax;
  p.bombCooldown = 0; p.gunCooldown = 0;
  p.alive = true;
}

function requestRespawn() {
  document.getElementById('respawnScreen').style.display = 'none';
  if (mp && mp.channel) {
    if (mp.isHost) {
      // Host respawns locally
      respawnPlane(game.planes[mp.playerSlot]);
    } else {
      // Client asks host to respawn
      mp.channel.send({ type: 'broadcast', event: 'respawn', payload: { slot: mp.playerSlot } });
    }
  } else {
    // Solo — just respawn
    respawnPlane(game.plane);
  }
}

function leaveGame() {
  document.getElementById('respawnScreen').style.display = 'none';
  if (mp && mp.channel) mp.channel.unsubscribe();
  mp = null;
  location.reload();
}

function nearestAlivePlane(ex, ey) {
  let best = null, bestDist = Infinity;
  for (const pl of game.planes) {
    if (!pl.alive) continue;
    const d = Math.hypot(pl.x - ex, pl.y - ey);
    if (d < bestDist) { bestDist = d; best = pl; }
  }
  return best;
}

function update() {
  const g = game;
  const p = g.plane;
  const dt = 1; // fixed timestep per frame

  // Physics constants — tuned for a light prop plane feel
  const GRAVITY = 0.07;
  const THRUST = 0.06;
  const TURN_SPEED = 0.03;
  const MAX_SPEED = 3.5;
  const MIN_FLY_SPEED = 1.0;
  const DRAG = 0.992;
  const LAND_MAX_SPEED = 1.8;
  const LAND_MAX_VY = 1.5;

  // Controls
  if (keys['v'] && !keys['_v_prev']) {
    g.followCam = !g.followCam;
  }
  keys['_v_prev'] = keys['v'];

  if (!g.gameOver) {
    // Update ALL planes
    for (const p of g.planes) {
      if (!p.alive) continue;
      const input = getInputForSlot(p.slot);

      // W/S - pitch up/down (trades horizontal speed for vertical)
      const hSpeed = Math.abs(p.vx);
      const PITCH_RATE = 0.15; // how much momentum to redirect per frame
      if (input['w'] && p.airborne && hSpeed > 0.3) {
        // Convert horizontal momentum into climb — costs forward speed
        const transfer = Math.min(PITCH_RATE, hSpeed * 0.08);
        p.vy -= transfer;
        p.vx *= (1 - 0.03); // bleed forward speed when climbing
      }
      if (input['s'] && p.airborne) {
        // Nose down — convert altitude into speed (gravity helps too)
        p.vy += 0.08;
        p.vx *= 1.005; // slight speed gain from diving
      }
      if (p.airborne) {
        const targetAngle = Math.atan2(p.vy, Math.abs(p.vx) + 0.5) * 0.4;
        p.angle += (targetAngle - p.angle) * 0.1;
      }
      // Q/E - rotate thruster nozzle
      const NOZZLE_SPEED = 0.05;
      if (input['q']) p.thrusterAngle -= NOZZLE_SPEED;
      if (input['e']) p.thrusterAngle += NOZZLE_SPEED;
      p.thrusterAngle = Math.max(-Math.PI / 2, Math.min(0, p.thrusterAngle));

      // A/D - direction
      if (input['d']) p.facingRight = true;
      if (input['a']) p.facingRight = false;

      // Space = thrust
      if (input[' ']) {
        const dir = p.facingRight ? 1 : -1;
        const thrustDir = p.angle + p.thrusterAngle;
        p.vx += Math.cos(thrustDir) * THRUST * dir;
        p.vy += Math.sin(thrustDir) * THRUST;
      }

      p.angle = Math.max(-Math.PI * 0.5, Math.min(Math.PI * 0.5, p.angle));
      p.vx *= DRAG;
      p.vx = Math.max(-MAX_SPEED, Math.min(MAX_SPEED, p.vx));
      p.speed = Math.sqrt(p.vx * p.vx + p.vy * p.vy);

      // Flight physics — passive lift only partially counters gravity
      if (p.airborne) {
        const curHSpeed = Math.abs(p.vx);
        // Lift can reduce gravity but never fully cancel it
        const liftForce = (curHSpeed * curHSpeed) * 0.008;
        const netGravity = GRAVITY - Math.min(liftForce, GRAVITY * 0.75);
        p.vy += netGravity;
        p.vy *= 0.96; // air resistance on vertical movement
      }

      // Move
      p.x += p.vx;
      p.y += p.vy;

      // World bounds
      if (p.x < 10) { p.x = 10; p.vx = 0; }
      if (p.x > WORLD_W - 10) { p.x = WORLD_W - 10; p.vx = 0; }
      if (p.y < 10) { p.y = 10; p.vy = 0; }

      // Ground collision
      if (p.y >= RUNWAY_Y - 12) {
        const onRunway = p.x >= RUNWAY_X && p.x <= RUNWAY_X + RUNWAY_W;
        if (onRunway) {
          if (p.airborne) {
            if (Math.abs(p.vx) > LAND_MAX_SPEED || p.vy > LAND_MAX_VY || Math.abs(p.angle) > 0.35) {
              killPlane(p, 'Crash landing! Too fast or too steep.');
              continue;
            }
            p.airborne = false;
            p.onRunway = true;
            p.bombs = p.bombMax;
            p.hp = p.maxHP;
          }
          p.y = RUNWAY_Y - 12;
          p.vy = 0;
          p.onRunway = true;
          if (input['w'] && Math.abs(p.vx) > MIN_FLY_SPEED) {
            p.airborne = true;
            p.onRunway = false;
            p.vy = -1.5;
            p.angle = -0.25;
          } else {
            p.angle = 0;
          }
        } else {
          if (p.y >= GROUND_Y - 12) {
            killPlane(p, 'Crashed into the ground!');
            continue;
          }
        }
      } else if (!p.airborne) {
        p.airborne = true;
        p.onRunway = false;
      }

      // Drop bomb
      if (input['r'] && p.bombCooldown <= 0 && p.bombs > 0 && p.airborne) {
        p.bombs--;
        p.bombCooldown = 15;
        g.bombList.push({ x: p.x, y: p.y + 10, vx: p.vx, vy: p.vy + 0.5, owner: p.slot });
      }
      if (p.bombCooldown > 0) p.bombCooldown--;

      // Machine gun
      if (input['f'] && p.gunCooldown <= 0) {
        p.gunCooldown = 6;
        const bulletSpeed = 7;
        const dir = p.facingRight ? 1 : -1;
        g.gunBullets.push({
          x: p.x + Math.cos(p.angle) * 26 * dir,
          y: p.y + Math.sin(p.angle) * 26,
          vx: Math.cos(p.angle) * bulletSpeed * dir + p.vx * 0.3,
          vy: Math.sin(p.angle) * bulletSpeed + p.vy * 0.3,
          life: 60, owner: p.slot,
        });
      }
      if (p.gunCooldown > 0) p.gunCooldown--;
    } // end plane loop
  }

  // Update gun bullets
  for (let i = g.gunBullets.length - 1; i >= 0; i--) {
    const b = g.gunBullets[i];
    b.x += b.vx;
    b.y += b.vy;
    b.life--;
    if (b.life <= 0 || b.y > GROUND_Y || b.y < 0 || b.x < 0 || b.x > WORLD_W) {
      g.gunBullets.splice(i, 1);
      continue;
    }
    // Hit enemies
    for (let j = g.enemies.length - 1; j >= 0; j--) {
      const e = g.enemies[j];
      const dx = Math.abs(b.x - e.x);
      const dy = Math.abs(b.y - e.y);
      const hitW = (e.boss || e.boss2) ? 20 : 8;
      const hitH = (e.boss || e.boss2) ? 50 : 20;
      if (dx < hitW && dy < hitH) {
        e.gunHits = (e.gunHits || 0) + 1;
        g.gunBullets.splice(i, 1);
        if (e.gunHits >= 3) { // 3 bullet hits = 1 HP lost
          e.hp--;
          e.gunHits = 0;
        }
        if (e.hp <= 0) {
          g.score += (e.boss || e.boss2) ? g.diff * 50 : g.diff * 5;
          g.enemies.splice(j, 1);
        }
        break;
      }
    }
  }

  // Update bombs
  for (let i = g.bombList.length - 1; i >= 0; i--) {
    const b = g.bombList[i];
    b.vy += 0.2;
    b.x += b.vx;
    b.y += b.vy;
    if (b.y >= GROUND_Y) {
      // Explode with particle effect
      const blastR = g.diff === 1 ? 50 : g.diff === 2 ? 35 : 28;
      const pushR = blastR * 3; // displacement radius
      const particles = [];
      for (let k = 0; k < 25; k++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 1 + Math.random() * 3.5;
        particles.push({
          x: 0, y: 0,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - Math.random() * 2.5,
          size: 1.5 + Math.random() * 4,
          life: 25 + Math.random() * 50,
          maxLife: 25 + Math.random() * 50,
          type: Math.random() < 0.3 ? 'debris' : 'fire',
        });
      }
      g.explosions.push({
        x: b.x, y: GROUND_Y, r: blastR, maxR: blastR, life: 60,
        particles, flash: 1, shockwave: 0,
      });

      // Check enemy hits (kill) and displacement (push)
      for (let j = g.enemies.length - 1; j >= 0; j--) {
        const e = g.enemies[j];
        const dx = e.x - b.x;
        const dist = Math.abs(dx);

        if (dist < blastR) {
          // Direct hit
          e.hp--;
          if (e.hp <= 0) {
            g.score += (e.boss || e.boss2) ? g.diff * 100 : g.diff * 10;
            g.enemies.splice(j, 1);
            continue;
          }
        }

        if (dist < pushR && dist > 0) {
          // Displacement — push away from blast (boss is heavier)
          const pushForce = (1 - dist / pushR) * ((e.boss || e.boss2) ? 3 : 8);
          const dir = dx > 0 ? 1 : -1;
          e.pushVx = (e.pushVx || 0) + dir * pushForce;
          e.pushVy = (e.pushVy || 0) - pushForce * 0.6; // launch upward too
          e.airborne = true;
        }
      }
      g.bombList.splice(i, 1);
    }
  }

  // Update explosions
  for (let i = g.explosions.length - 1; i >= 0; i--) {
    const ex = g.explosions[i];
    ex.life--;
    ex.flash = (ex.flash || 0) * 0.85;
    ex.shockwave = (ex.shockwave || 0) + 3;
    // Update particles
    if (ex.particles) {
      for (const pt of ex.particles) {
        pt.x += pt.vx;
        pt.y += pt.vy;
        pt.vy += 0.06;
        pt.vx *= 0.97;
        pt.life--;
      }
      ex.particles = ex.particles.filter(pt => pt.life > 0);
    }
    if (ex.life <= 0) g.explosions.splice(i, 1);
  }

  // Update enemy displacement physics
  for (const e of g.enemies) {
    if (e.pushVx || e.pushVy) {
      e.x += e.pushVx || 0;
      e.y += (e.pushVy || 0);
      e.pushVx = (e.pushVx || 0) * 0.9;
      e.pushVy = (e.pushVy || 0) + 0.3; // gravity pulls them back
      // Land back on ground
      if (e.y >= GROUND_Y) {
        e.y = GROUND_Y;
        e.pushVy = 0;
        e.pushVx = (e.pushVx || 0) * 0.5;
        e.airborne = false;
        if (Math.abs(e.pushVx) < 0.1) e.pushVx = 0;
        // Knockdown: lie on ground then get up
        if (!e.knockdown) {
          e.knockdown = 60; // frames to stay down
        }
      }
    }
  }

  // Plane-enemy collision (all planes take damage from touching zombies)
  if (!g.gameOver) {
    for (let i = g.enemies.length - 1; i >= 0; i--) {
      const e = g.enemies[i];
      if (e.knockdown > 0) continue;
      const hitW = (e.boss || e.boss2) ? 25 : 12;
      const hitH = (e.boss || e.boss2) ? 55 : 25;
      let enemyKilled = false;
      for (const pl of g.planes) {
        if (!pl.alive) continue;
        const dx = Math.abs(pl.x - e.x);
        const dy = Math.abs(pl.y - e.y);
        if (dx < hitW && dy < hitH) {
          const dmg = (e.boss || e.boss2) ? 15 : 5;
          pl.hp -= dmg;
          e.hp = 0;
          g.score += (e.boss || e.boss2) ? g.diff * 20 : g.diff * 2;
          if (pl.hp <= 0) killPlane(pl, 'Crashed into enemies!');
          enemyKilled = true;
          break;
        }
      }
      if (enemyKilled) { g.enemies.splice(i, 1); continue; }
    }
  }

  // Spawn enemies
  g.spawnTimer++;
  if (g.spawnTimer >= g.spawnInterval) {
    g.spawnTimer = 0;
    g.spawnCount++;

    const baseSpd = g.diff === 1 ? (0.35 + Math.random() * 0.2) : g.diff === 2 ? (0.45 + Math.random() * 0.25) : (0.55 + Math.random() * 0.3);
    const bossHP = g.diff === 1 ? 15 : g.diff === 2 ? 25 : 35;
    const boss2HP = g.diff === 1 ? 20 : g.diff === 2 ? 30 : 45;
    const zombieHP = g.diff === 1 ? 1 : g.diff === 2 ? 2 : 3;

    // Determine what to spawn based on spawnType setting
    let spawnBoss1 = false;
    let spawnBoss2 = false;

    if (g.spawnType === 'zombies') {
      // Only zombies, no bosses
    } else if (g.spawnType === 'boss1') {
      spawnBoss1 = true;
    } else if (g.spawnType === 'boss2') {
      spawnBoss2 = true;
    } else if (g.spawnType === 'all_bosses') {
      // Alternate between boss1 and boss2
      spawnBoss1 = g.spawnCount % 2 === 0;
      spawnBoss2 = !spawnBoss1;
    } else if (g.spawnType === 'mix') {
      // Random mix of all types
      const roll = Math.random();
      if (roll < 0.15) spawnBoss1 = true;
      else if (roll < 0.3) spawnBoss2 = true;
    } else {
      // "normal" — bosses on schedule
      if (g.spawnCount % g.boss1Every === 0) {
        const bossNum = Math.floor(g.spawnCount / g.boss1Every);
        if (bossNum > g.boss2After) {
          spawnBoss2 = true;
        } else {
          spawnBoss1 = true;
        }
      }
    }

    if (spawnBoss1) {
      g.enemies.push({
        x: WORLD_W - 60,
        y: GROUND_Y,
        speed: baseSpd * g.enemySpeedMult * 0.95,
        hp: bossHP, maxHP: bossHP,
        attackTimer: 0, shootTimer: 50, animFrame: 0,
        boss: true, jumpVy: 0,
      });
    } else if (spawnBoss2) {
      g.enemies.push({
        x: WORLD_W - 60,
        y: GROUND_Y,
        speed: baseSpd * g.enemySpeedMult * 0.95,
        hp: boss2HP, maxHP: boss2HP,
        attackTimer: 0, shootTimer: 50, animFrame: 0,
        boss2: true,
        jumpTimer: 60 + Math.random() * 40,
        jumpVy: 0,
        bombTimer: 80 + Math.random() * 60,
      });
    } else {
      g.enemies.push({
        x: WORLD_W - 60 + Math.random() * 30,
        y: GROUND_Y,
        speed: baseSpd * g.enemySpeedMult,
        hp: zombieHP, maxHP: zombieHP,
        attackTimer: 0, shootTimer: Math.random() * 200, animFrame: 0,
      });
    }
  }

  // Update enemies
  const AIRPORT_X = RUNWAY_X + RUNWAY_W + 30; // the structure to the right of runway
  const AIRPORT_LEFT = RUNWAY_X;
  for (let i = g.enemies.length - 1; i >= 0; i--) {
    const e = g.enemies[i];

    // Knockdown: frozen on ground, getting up
    if (e.knockdown > 0) {
      e.knockdown--;
      continue; // skip movement, attacking, shooting while knocked down
    }

    e.x -= e.speed;
    e.animFrame += e.speed * 0.1;

    // Attack airport structure (tower is at RUNWAY_X + 20, width ~70)
    if (e.x <= RUNWAY_X + 90) {
      e.attackTimer++;
      e.x = Math.max(RUNWAY_X + 20, e.x); // cluster around the building
      if (e.attackTimer % 20 === 0) {
        g.airportHP -= (e.boss || e.boss2) ? 5 : 2;
        if (g.airportHP <= 0) {
          endGame('The airport was destroyed!');
          return;
        }
      }
    }

    // Stick figures on the runway get killed if plane lands on them
    if (!p.airborne && p.onRunway) {
      const dx = Math.abs(e.x - p.x);
      if (dx < 30 && e.y >= GROUND_Y - 5) {
        e.hp = 0;
        g.enemies.splice(i, 1);
        g.score += 5;
        continue;
      }
    }

    // Boss2: jumping + bomb tossing
    if (e.boss2) {
      // Jumping
      e.jumpTimer--;
      if (e.jumpTimer <= 0 && e.y >= GROUND_Y) {
        e.jumpVy = -(4 + Math.random() * 2.5); // jump up
        e.jumpTimer = 70 + Math.random() * 50;
        e.y -= 1; // nudge off ground to start jump
      }
      // Apply jump physics
      e.jumpVy += 0.18; // gravity
      e.y += e.jumpVy;
      if (e.y >= GROUND_Y) {
        e.y = GROUND_Y;
        e.jumpVy = 0;
      }
      // Crawl: move faster on ground, slower in air
      if (e.y >= GROUND_Y) {
        e.speed = e.speed; // normal crawl
      }

      // Toss bombs at nearest plane
      e.bombTimer--;
      if (e.bombTimer <= 0) {
        e.bombTimer = 100 + Math.random() * 80;
        const target2 = nearestAlivePlane(e.x, e.y);
        if (!target2) continue;
        const dx = target2.x - e.x;
        const dy = target2.y - e.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 600) {
          // Lob a bomb in an arc toward the plane
          const toss_speed = 2.5;
          g.enemyBullets.push({
            x: e.x,
            y: e.y - 30,
            vx: (dx / dist) * toss_speed,
            vy: -3 + (dy / dist) * toss_speed, // arc upward
            life: 180,
            isBomb: true, // special: has gravity, explodes
          });
        }
      }
    }

    // Shoot at nearest plane (level 3 enemies + all boss1)
    if (g.diff >= 3 || e.boss) {
      e.shootTimer--;
      if (e.shootTimer <= 0) {
        e.shootTimer = e.boss ? (60 + Math.random() * 80) : (150 + Math.random() * 200);
        const target = nearestAlivePlane(e.x, e.y);
        if (!target) continue;
        const dx = target.x - e.x;
        const dy = target.y - e.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const shootRange = e.boss ? 800 : 500;
        if (dist < shootRange) {
          const bspeed = e.boss ? 4 : 3;
          g.enemyBullets.push({
            x: e.x,
            y: e.y - (e.boss ? 50 : 20),
            vx: (dx / dist) * bspeed,
            vy: (dy / dist) * bspeed,
            life: 150,
          });
          // Boss fires a second shot slightly offset
          if (e.boss) {
            g.enemyBullets.push({
              x: e.x + 10,
              y: e.y - 45,
              vx: (dx / dist) * bspeed + (Math.random() - 0.5),
              vy: (dy / dist) * bspeed + (Math.random() - 0.5),
              life: 150,
            });
          }
        }
      }
    }
  }

  // Update enemy bullets
  for (let i = g.enemyBullets.length - 1; i >= 0; i--) {
    const b = g.enemyBullets[i];
    // Boss2 bombs have gravity
    if (b.isBomb) b.vy += 0.08;
    b.x += b.vx;
    b.y += b.vy;
    b.life--;
    if (b.life <= 0 || b.y < 0) {
      g.enemyBullets.splice(i, 1);
      continue;
    }
    // Boss2 bombs explode on ground
    if (b.isBomb && b.y >= GROUND_Y) {
      g.explosions.push({
        x: b.x, y: GROUND_Y, r: 30, maxR: 30, life: 40,
        particles: [], flash: 0.5, shockwave: 0,
      });
      g.enemyBullets.splice(i, 1);
      // Damage any plane if nearby
      for (const pl of g.planes) {
        if (!pl.alive) continue;
        if (Math.abs(b.x - pl.x) < 40 && Math.abs(GROUND_Y - pl.y) < 40) {
          pl.hp -= 12;
          if (pl.hp <= 0) killPlane(pl, 'Hit by enemy bomb!');
        }
      }
      continue;
    }
    if (b.y > GROUND_Y) {
      g.enemyBullets.splice(i, 1);
      continue;
    }
    // Hit any plane?
    let bulletHit = false;
    for (const pl of g.planes) {
      if (!pl.alive) continue;
      if (Math.abs(b.x - pl.x) < 24 && Math.abs(b.y - pl.y) < 12) {
        pl.hp -= b.isBomb ? 15 : 8;
        g.enemyBullets.splice(i, 1);
        if (pl.hp <= 0) killPlane(pl, b.isBomb ? 'Hit by enemy bomb!' : 'Plane shot down!');
        bulletHit = true;
        break;
      }
    }
    if (bulletHit) continue;
  }

  // Update HUD
  document.getElementById('scoreVal').textContent = g.score;
  document.getElementById('bombVal').textContent = p.bombs + ' / ' + p.bombMax;
  document.getElementById('reloadMsg').style.display = p.bombs === 0 ? 'inline' : 'none';
  document.getElementById('zoomVal').textContent = g.zoom.toFixed(1) + 'x';
  document.getElementById('nozzleVal').textContent = Math.round(p.thrusterAngle * -180 / Math.PI) + '°';
  document.getElementById('planeHPBar').style.width = Math.max(0, p.hp / p.maxHP * 100) + '%';
  document.getElementById('planeHPBar').style.background = p.hp > 50 ? '#4f4' : p.hp > 25 ? '#fa0' : '#f44';
  document.getElementById('airportHPBar').style.width = Math.max(0, g.airportHP / g.airportMaxHP * 100) + '%';
  document.getElementById('airportHPBar').style.background = g.airportHP > 100 ? '#48f' : g.airportHP > 50 ? '#fa0' : '#f44';

  // Camera
  if (g.followCam) {
    g.camX = p.x - W / 3;
    g.camX = Math.max(0, Math.min(WORLD_W - W, g.camX));
  } else {
    g.camX = 0;
  }

  // Multiplayer: host broadcasts state every 3 frames
  g.frameCount = (g.frameCount || 0) + 1;
  if (mp && mp.isHost && g.frameCount % 3 === 0 && mp.channel) {
    mp.channel.send({ type: 'broadcast', event: 'state', payload: {
      planes: g.planes.map(pl => ({
        x: pl.x, y: pl.y, vx: pl.vx, vy: pl.vy,
        angle: pl.angle, thrusterAngle: pl.thrusterAngle,
        airborne: pl.airborne, onRunway: pl.onRunway,
        facingRight: pl.facingRight, hp: pl.hp, maxHP: pl.maxHP,
        bombs: pl.bombs, bombMax: pl.bombMax, alive: pl.alive, slot: pl.slot,
      })),
      enemies: g.enemies.map(e => ({
        x: e.x, y: e.y, hp: e.hp, maxHP: e.maxHP, speed: e.speed,
        boss: e.boss, boss2: e.boss2, animFrame: e.animFrame,
        knockdown: e.knockdown || 0, jumpVy: e.jumpVy, bombTimer: e.bombTimer,
      })),
      bombList: g.bombList,
      gunBullets: g.gunBullets,
      enemyBullets: g.enemyBullets,
      explosions: g.explosions.map(e => ({ x: e.x, y: e.y, life: e.life, maxR: e.maxR })),
      score: g.score, airportHP: g.airportHP,
    }});
  }
  // Multiplayer: client sends input every 3 frames
  if (mp && !mp.isHost && g.frameCount % 3 === 0 && mp.channel) {
    const inputKeys = {};
    ['w','s','a','d','q','e',' ','r','f','v'].forEach(k => { if (keys[k]) inputKeys[k] = true; });
    mp.channel.send({ type: 'broadcast', event: 'input', payload: { slot: mp.playerSlot, keys: inputKeys } });
  }
}

function render() {
  const g = game;
  const p = g.plane;
  const cx = g.camX;
  const zoom = g.zoom || 1;

  // Clear entire canvas first (prevents zoom artifacts)
  ctx.clearRect(0, 0, W, H);

  // Apply zoom centered on canvas center
  ctx.save();
  const centerX = W / 2;
  const centerY = H / 2;
  ctx.translate(centerX, centerY);
  ctx.scale(zoom, zoom);
  ctx.translate(-centerX, -centerY);

  // Sky gradient (oversized to cover zoomed view)
  const pad = W; // extra padding for zoom
  const sky = ctx.createLinearGradient(0, -pad, 0, H + pad);
  sky.addColorStop(0, '#1a2a4a');
  sky.addColorStop(0.7, '#3a6090');
  sky.addColorStop(1, '#6a9fd8');
  ctx.fillStyle = sky;
  ctx.fillRect(-pad, -pad, W + pad * 2, H + pad * 2);

  // Clouds
  ctx.fillStyle = 'rgba(255,255,255,0.15)';
  for (let i = 0; i < 8; i++) {
    const cloudX = (i * 300 + 100) - cx * 0.3;
    ctx.beginPath();
    ctx.arc(cloudX, 80 + (i % 3) * 50, 40, 0, Math.PI * 2);
    ctx.arc(cloudX + 35, 75 + (i % 3) * 50, 30, 0, Math.PI * 2);
    ctx.arc(cloudX - 30, 85 + (i % 3) * 50, 25, 0, Math.PI * 2);
    ctx.fill();
  }

  // Ground (extend full world width + extra for zoom)
  ctx.fillStyle = '#3a5a2a';
  ctx.fillRect(-W - cx, GROUND_Y, WORLD_W + W * 3, H);

  // Underground layer
  ctx.fillStyle = '#2a4a1a';
  ctx.fillRect(-W - cx, GROUND_Y + 20, WORLD_W + W * 3, H);

  // Runway
  ctx.fillStyle = '#555';
  ctx.fillRect(RUNWAY_X - cx, GROUND_Y - 4, RUNWAY_W, 8);
  // Runway markings
  ctx.fillStyle = '#fff';
  for (let i = 0; i < 8; i++) {
    ctx.fillRect(RUNWAY_X + 15 + i * 38 - cx, GROUND_Y - 1, 20, 2);
  }

  // Airport structure (control tower)
  const towerX = RUNWAY_X + 20 - cx;
  const towerW = 40;
  const towerH = 80;
  // Building base
  ctx.fillStyle = '#888';
  ctx.fillRect(towerX - 15, GROUND_Y - 40, 70, 40);
  // Tower
  ctx.fillStyle = '#aaa';
  ctx.fillRect(towerX, GROUND_Y - towerH - 40, towerW, towerH);
  // Tower top (control room)
  ctx.fillStyle = '#66aacc';
  ctx.fillRect(towerX - 8, GROUND_Y - towerH - 55, towerW + 16, 20);
  // Windows
  ctx.fillStyle = '#aaddf8';
  for (let i = 0; i < 3; i++) {
    ctx.fillRect(towerX + 5 + i * 12, GROUND_Y - towerH - 50, 8, 10);
  }
  // Damage overlay
  if (g.airportHP < g.airportMaxHP) {
    const dmg = 1 - g.airportHP / g.airportMaxHP;
    ctx.fillStyle = `rgba(80,30,0,${dmg * 0.5})`;
    ctx.fillRect(towerX - 15, GROUND_Y - towerH - 55, 70, towerH + 55);
    // Cracks
    if (dmg > 0.3) {
      ctx.strokeStyle = '#333';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(towerX + 10, GROUND_Y - 60);
      ctx.lineTo(towerX + 25, GROUND_Y - 90);
      ctx.lineTo(towerX + 15, GROUND_Y - 110);
      ctx.stroke();
    }
  }

  // Cave (enemy spawn point) at right side of world
  const caveX = WORLD_W - 60 - cx;
  const caveW = 70;
  const caveH = 50;
  // Hill / mound around the cave
  ctx.fillStyle = '#4a3a2a';
  ctx.beginPath();
  ctx.moveTo(caveX - 50, GROUND_Y);
  ctx.quadraticCurveTo(caveX - 20, GROUND_Y - 70, caveX + caveW / 2, GROUND_Y - 65);
  ctx.quadraticCurveTo(caveX + caveW + 20, GROUND_Y - 70, caveX + caveW + 50, GROUND_Y);
  ctx.closePath();
  ctx.fill();
  // Cave opening (dark hole)
  ctx.fillStyle = '#111';
  ctx.beginPath();
  ctx.ellipse(caveX + caveW / 2, GROUND_Y - 5, caveW / 2, caveH / 2, 0, Math.PI, 0);
  ctx.fill();
  // Cave depth shading
  ctx.fillStyle = '#1a1a1a';
  ctx.beginPath();
  ctx.ellipse(caveX + caveW / 2, GROUND_Y - 3, caveW / 2 - 5, caveH / 2 - 8, 0, Math.PI, 0);
  ctx.fill();
  // Rocks around entrance
  ctx.fillStyle = '#5a4a3a';
  ctx.beginPath();
  ctx.arc(caveX - 5, GROUND_Y - 8, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(caveX + caveW + 5, GROUND_Y - 6, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(caveX + caveW / 2, GROUND_Y - caveH + 5, 6, 0, Math.PI * 2);
  ctx.fill();

  // Enemies (stick figures + bosses)
  const viewMargin = W / zoom + 100;
  for (const e of g.enemies) {
    const ex = e.x - cx;
    const ey = e.y;
    if (ex < -viewMargin || ex > viewMargin * 2) continue;

    const s = (e.boss || e.boss2) ? 2.0 : g.enemySizeMult; // bosses are big
    const hpRatio = e.hp / e.maxHP;
    const knocked = e.knockdown > 0;

    // Color
    if (e.boss2) {
      ctx.strokeStyle = hpRatio > 0.6 ? '#0c0' : hpRatio > 0.3 ? '#8f0' : '#ff0';
    } else if (e.boss) {
      ctx.strokeStyle = hpRatio > 0.6 ? '#f44' : hpRatio > 0.3 ? '#f80' : '#ff0';
    } else {
      ctx.strokeStyle = hpRatio > 0.6 ? '#eee' : hpRatio > 0.3 ? '#fa0' : '#f44';
    }
    ctx.lineWidth = e.boss ? 3 : 1.5;

    if (knocked) {
      // Knocked down — draw lying flat on ground
      const getUpProg = 1 - (e.knockdown / 60); // 0 = just fell, 1 = about to get up
      const tilt = (1 - getUpProg) * Math.PI / 2; // 90° = flat, 0° = standing

      ctx.save();
      ctx.translate(ex, ey);
      ctx.rotate(tilt);

      // Body lying down
      ctx.beginPath();
      ctx.moveTo(0, -18 * s);
      ctx.lineTo(0, 0);
      ctx.stroke();
      // Head
      ctx.beginPath();
      ctx.arc(0, -21 * s, 3 * s, 0, Math.PI * 2);
      ctx.stroke();
      // Legs
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(-4 * s, 8 * s);
      ctx.moveTo(0, 0);
      ctx.lineTo(4 * s, 8 * s);
      ctx.stroke();
      // Arms limp
      ctx.beginPath();
      ctx.moveTo(0, -15 * s);
      ctx.lineTo(-6 * s, -10 * s);
      ctx.moveTo(0, -15 * s);
      ctx.lineTo(6 * s, -10 * s);
      ctx.stroke();

      ctx.restore();

      // Stars/daze effect
      if (e.knockdown > 20) {
        ctx.fillStyle = '#ff0';
        ctx.font = `${8 * s}px sans-serif`;
        const starX = ex + Math.sin(e.knockdown * 0.3) * 8 * s;
        const starY = ey - 25 * s + Math.cos(e.knockdown * 0.2) * 4;
        ctx.fillText('*', starX, starY);
        ctx.fillText('*', starX + 10 * s, starY - 3);
      }
    } else if (e.boss2) {
      // Boss2: crawling/jumping beast
      const isJumping = e.y < GROUND_Y;
      const legSwing = Math.sin(e.animFrame * 4) * 12;

      if (isJumping) {
        // Leaping pose — body horizontal, flying through air facing left
        ctx.save();
        ctx.translate(ex, ey);
        // Head
        ctx.beginPath();
        ctx.arc(-12 * s, -8 * s, 3 * s, 0, Math.PI * 2);
        ctx.stroke();
        // Body (horizontal)
        ctx.beginPath();
        ctx.moveTo(-9 * s, -6 * s);
        ctx.lineTo(8 * s, -6 * s);
        ctx.stroke();
        // Arms reaching forward
        ctx.beginPath();
        ctx.moveTo(-6 * s, -6 * s);
        ctx.lineTo(-14 * s, -10 * s);
        ctx.moveTo(-6 * s, -6 * s);
        ctx.lineTo(-13 * s, -3 * s);
        ctx.stroke();
        // Legs trailing
        ctx.beginPath();
        ctx.moveTo(8 * s, -6 * s);
        ctx.lineTo(13 * s, -2 * s);
        ctx.moveTo(8 * s, -6 * s);
        ctx.lineTo(12 * s, -10 * s);
        ctx.stroke();
        // Eyes
        ctx.fillStyle = '#0f0';
        ctx.beginPath();
        ctx.arc(-13 * s, -9 * s, 1 * s, 0, Math.PI * 2);
        ctx.arc(-11 * s, -9 * s, 1 * s, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      } else {
        // Crawling on all fours — very low to ground, facing left
        ctx.save();
        ctx.translate(ex, ey);
        // Body (nearly horizontal, very low)
        ctx.beginPath();
        ctx.moveTo(-6 * s, -4 * s);
        ctx.lineTo(6 * s, -3 * s);
        ctx.stroke();
        // Head (low, jutting forward-left)
        ctx.beginPath();
        ctx.arc(-9 * s, -5 * s, 2.5 * s, 0, Math.PI * 2);
        ctx.stroke();
        // Front arms (crawling, alternating)
        ctx.beginPath();
        ctx.moveTo(-4 * s, -3.5 * s);
        ctx.lineTo(-8 * s + legSwing * 0.2, 0);
        ctx.moveTo(-2 * s, -3.5 * s);
        ctx.lineTo(-5 * s - legSwing * 0.2, 0);
        ctx.stroke();
        // Back legs
        ctx.beginPath();
        ctx.moveTo(4 * s, -3 * s);
        ctx.lineTo(8 * s - legSwing * 0.2, 0);
        ctx.moveTo(6 * s, -3 * s);
        ctx.lineTo(10 * s + legSwing * 0.2, 0);
        ctx.stroke();
        // Eyes (menacing, forward)
        ctx.fillStyle = '#0f0';
        ctx.beginPath();
        ctx.arc(-10 * s, -6 * s, 1 * s, 0, Math.PI * 2);
        ctx.arc(-8 * s, -6 * s, 1 * s, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // Bomb in hand when about to throw
      if (e.bombTimer < 30) {
        const bombX = isJumping ? ex - 14 * s : ex - 8 * s;
        const bombY = isJumping ? ey - 8 * s : ey - 4 * s;
        ctx.fillStyle = '#333';
        ctx.beginPath();
        ctx.arc(bombX, bombY, 2.5 * s, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ff0';
        ctx.beginPath();
        ctx.arc(bombX, bombY - 2.5 * s, 1.5, 0, Math.PI * 2);
        ctx.fill();
      }
    } else {
      // Normal walking pose
      const legSwing = Math.sin(e.animFrame * 3) * 10;
      const armSwing = Math.sin(e.animFrame * 3 + 1) * 8;

      // Head
      ctx.beginPath();
      ctx.arc(ex, ey - 21 * s, 3 * s, 0, Math.PI * 2);
      ctx.stroke();

      // Body
      ctx.beginPath();
      ctx.moveTo(ex, ey - 18 * s);
      ctx.lineTo(ex, ey - 8 * s);
      ctx.stroke();

      // Legs
      ctx.beginPath();
      ctx.moveTo(ex, ey - 8 * s);
      ctx.lineTo(ex - 4 * s + legSwing * 0.3, ey);
      ctx.moveTo(ex, ey - 8 * s);
      ctx.lineTo(ex + 4 * s - legSwing * 0.3, ey);
      ctx.stroke();

      // Arms + axe
      ctx.beginPath();
      ctx.moveTo(ex, ey - 15 * s);
      ctx.lineTo(ex - 6 * s - armSwing * 0.2, ey - 10 * s);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(ex, ey - 15 * s);
      const axeX = ex - 8 * s + armSwing * 0.2;
      const axeY = ey - 14 * s;
      ctx.lineTo(axeX, axeY);
      ctx.stroke();

      // Axe head (bigger for boss)
      ctx.fillStyle = e.boss ? '#c44' : '#999';
      ctx.fillRect(axeX - 2 * s, axeY - 3 * s, 4 * s, 5 * s);

      // Boss1: angry eyes
      if (e.boss) {
        ctx.fillStyle = '#f00';
        ctx.beginPath();
        ctx.arc(ex - 1.5 * s, ey - 22 * s, 0.8 * s, 0, Math.PI * 2);
        ctx.arc(ex + 1.5 * s, ey - 22 * s, 0.8 * s, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // HP bar (always show for bosses, show for multi-hp enemies)
    if (e.maxHP > 1 || e.boss2) {
      const isBoss = e.boss || e.boss2;
      const barW = isBoss ? 50 : 14;
      const barH = isBoss ? 5 : 2;
      const barY = ey - (knocked ? 10 : 26 * s);
      ctx.fillStyle = '#400';
      ctx.fillRect(ex - barW / 2, barY, barW, barH);
      ctx.fillStyle = e.boss2 ? '#0a0' : e.boss ? '#f00' : '#f44';
      ctx.fillRect(ex - barW / 2, barY, barW * hpRatio, barH);
      // Boss label
      if (e.boss) {
        ctx.fillStyle = '#f44';
        ctx.font = 'bold 10px sans-serif';
        ctx.fillText('BOSS', ex - 14, barY - 4);
      }
      if (e.boss2) {
        ctx.fillStyle = '#0f0';
        ctx.font = 'bold 10px sans-serif';
        ctx.fillText('BOSS 2', ex - 18, barY - 4);
      }
    }
  }

  // Bombs
  ctx.fillStyle = '#333';
  for (const b of g.bombList) {
    const bx = b.x - cx;
    ctx.beginPath();
    ctx.ellipse(bx, b.y, 4, 6, Math.atan2(b.vy, b.vx) + Math.PI / 2, 0, Math.PI * 2);
    ctx.fill();
    // Fins
    ctx.strokeStyle = '#555';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(bx - 3, b.y - 5);
    ctx.lineTo(bx, b.y - 2);
    ctx.lineTo(bx + 3, b.y - 5);
    ctx.stroke();
  }

  // Explosions
  for (const ex of g.explosions) {
    const exx = ex.x - cx;
    const alpha = Math.min(1, ex.life / 30);

    // White flash on impact
    if (ex.flash > 0.1) {
      ctx.fillStyle = `rgba(255,255,220,${ex.flash * 0.4})`;
      ctx.beginPath();
      ctx.arc(exx, ex.y, ex.maxR * 1.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // Shockwave ring (expanding, fading)
    if (ex.shockwave < ex.maxR * 3) {
      const ringAlpha = Math.max(0, 0.4 * (1 - ex.shockwave / (ex.maxR * 3)));
      ctx.strokeStyle = `rgba(255,200,100,${ringAlpha})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(exx, ex.y, ex.shockwave, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Fire ball (shrinks over time)
    const fireR = ex.maxR * alpha;
    ctx.beginPath();
    ctx.arc(exx, ex.y - 5, fireR, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255,80,0,${alpha * 0.6})`;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(exx, ex.y - 8, fireR * 0.6, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255,180,0,${alpha * 0.7})`;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(exx, ex.y - 10, fireR * 0.3, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255,255,150,${alpha * 0.8})`;
    ctx.fill();

    // Particles (fire + debris)
    if (ex.particles) {
      for (const pt of ex.particles) {
        const pa = pt.life / pt.maxLife;
        const px = exx + pt.x;
        const py = ex.y + pt.y;
        if (pt.type === 'fire') {
          const r = 255;
          const g = Math.floor(100 + 150 * pa);
          const b = Math.floor(50 * pa);
          ctx.fillStyle = `rgba(${r},${g},${b},${pa})`;
          ctx.beginPath();
          ctx.arc(px, py, pt.size * pa, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.fillStyle = `rgba(60,50,40,${pa})`;
          ctx.fillRect(px - pt.size / 2, py - pt.size / 2, pt.size, pt.size);
        }
      }
    }

    // Smoke (rises after initial blast)
    if (ex.life < 40) {
      const smokeAlpha = Math.min(0.35, (40 - ex.life) / 60);
      for (let i = 0; i < 2; i++) {
        const sy = ex.y - 15 - (40 - ex.life) * 0.7 - i * 10;
        const sx = exx + Math.sin(ex.life * 0.15 + i) * 5;
        ctx.fillStyle = `rgba(80,80,80,${smokeAlpha * (1 - i * 0.3)})`;
        ctx.beginPath();
        ctx.arc(sx, sy, 6 + i * 4, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  // Player gun bullets (yellow tracers)
  for (const b of g.gunBullets) {
    const bx = b.x - cx;
    ctx.strokeStyle = '#ff0';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(bx, b.y);
    ctx.lineTo(bx - b.vx * 2, b.y - b.vy * 2);
    ctx.stroke();
    ctx.fillStyle = '#ffa';
    ctx.beginPath();
    ctx.arc(bx, b.y, 1.5, 0, Math.PI * 2);
    ctx.fill();
  }

  // Enemy bullets and bombs
  for (const b of g.enemyBullets) {
    const bx = b.x - cx;
    if (b.isBomb) {
      // Boss2 bomb — dark sphere with fuse
      ctx.fillStyle = '#222';
      ctx.beginPath();
      ctx.arc(bx, b.y, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ff0';
      ctx.beginPath();
      ctx.arc(bx, b.y - 5, 1.5 + Math.random(), 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillStyle = '#f44';
      ctx.beginPath();
      ctx.arc(bx, b.y, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Draw ALL planes
  for (const dp of g.planes) {
  if (!dp.alive) continue;
  if (g.gameOver) break;
  const px = dp.x - cx;
  const py = dp.y;
  const planeColor = dp.color || PLANE_COLORS[0];
  ctx.save();
  ctx.translate(px, py);
  if (!dp.facingRight) {
    ctx.scale(-1, 1);
  }
  ctx.rotate(p.angle);

  // Fuselage
  ctx.fillStyle = planeColor.body;
  ctx.beginPath();
  ctx.moveTo(24, 0);
  ctx.lineTo(-20, -5);
  ctx.lineTo(-24, -3);
  ctx.lineTo(-24, 3);
  ctx.lineTo(-20, 5);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#999';
  ctx.lineWidth = 1;
  ctx.stroke();

  // Wings
  ctx.fillStyle = '#bbb';
  ctx.beginPath();
  ctx.moveTo(-2, -2);
  ctx.lineTo(4, -14);
  ctx.lineTo(10, -14);
  ctx.lineTo(6, -2);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(-2, 2);
  ctx.lineTo(4, 14);
  ctx.lineTo(10, 14);
  ctx.lineTo(6, 2);
  ctx.closePath();
  ctx.fill();

  // Tail
  ctx.fillStyle = '#aaa';
  ctx.beginPath();
  ctx.moveTo(-20, -3);
  ctx.lineTo(-26, -10);
  ctx.lineTo(-18, -10);
  ctx.lineTo(-16, -3);
  ctx.closePath();
  ctx.fill();

  // Cockpit
  ctx.fillStyle = planeColor.cockpit;
  ctx.beginPath();
  ctx.ellipse(14, 0, 6, 3, 0, 0, Math.PI * 2);
  ctx.fill();

  // Propeller hint
  ctx.strokeStyle = '#666';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(24, -6);
  ctx.lineTo(25, 6);
  ctx.stroke();

  // Thruster nozzle visual (small rectangle that rotates)
  ctx.save();
  ctx.translate(-22, 0);
  ctx.rotate(dp.thrusterAngle);
  ctx.fillStyle = '#666';
  ctx.fillRect(-4, -3, 6, 6);
  // Rocket boost fire when thrusting
  const dpInput = getInputForSlot(dp.slot);
  if (dpInput[' ']) {
    const boostScale = 1;
    const flicker = Math.random() * 8 * boostScale;
    // Outer flame — bigger when boosting
    ctx.fillStyle = `rgba(255,${100 + Math.random() * 80},0,0.8)`;
    ctx.beginPath();
    ctx.moveTo(-4, -3 * boostScale);
    ctx.lineTo(-14 * boostScale - flicker, 0);
    ctx.lineTo(-4, 3 * boostScale);
    ctx.closePath();
    ctx.fill();
    // Inner flame
    ctx.fillStyle = `rgba(255,255,${150 + Math.random() * 100},0.9)`;
    ctx.beginPath();
    ctx.moveTo(-4, -1.5 * boostScale);
    ctx.lineTo(-9 * boostScale - flicker * 0.5, 0);
    ctx.lineTo(-4, 1.5 * boostScale);
    ctx.closePath();
    ctx.fill();
    // Glow
    ctx.fillStyle = 'rgba(255,150,0,0.2)';
    ctx.beginPath();
    ctx.arc(-6, 0, (6 + flicker * 0.4) * boostScale, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  // Nozzle angle indicator (small arc showing current angle)
  ctx.strokeStyle = 'rgba(255,200,0,0.4)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(-22, 0, 10, Math.PI + dp.thrusterAngle - 0.1, Math.PI + dp.thrusterAngle + 0.1);
  ctx.stroke();

  // Machine gun muzzle flash
  if (dp.gunCooldown > 3) {
    ctx.fillStyle = `rgba(255,255,100,${0.8})`;
    ctx.beginPath();
    ctx.arc(27, 0, 3 + Math.random() * 2, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();

  // Plane damage visual
  if (dp.hp < dp.maxHP * 0.5) {
    // Smoke trail
    ctx.fillStyle = `rgba(100,100,100,${0.3 * (1 - dp.hp / dp.maxHP)})`;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.arc(px - 20 - i * 12 + Math.random() * 6, py + Math.random() * 8, 4 + Math.random() * 4, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Landing indicator when near runway (local player only)
  if (dp.slot === (mp ? mp.playerSlot : 0) && dp.airborne && dp.y > GROUND_Y - 120 && dp.x >= RUNWAY_X && dp.x <= RUNWAY_X + RUNWAY_W) {
    const speedOk = Math.abs(dp.vx) <= 3;
    const vyOk = dp.vy <= 2.5;
    const angleOk = Math.abs(dp.angle) <= 0.35;
    const color = (speedOk && vyOk && angleOk) ? '#4f4' : '#f44';
    ctx.fillStyle = color;
    ctx.font = '12px monospace';
    ctx.fillText(speedOk ? '✓ SPD' : '✗ SPD', px - 40, py - 25);
    ctx.fillText(vyOk ? '✓ VSI' : '✗ VSI', px - 40, py - 38);
    ctx.fillText(angleOk ? '✓ ANG' : '✗ ANG', px - 40, py - 51);
  }

  // Player name label above plane
  if (g.planes.length > 1) {
    ctx.fillStyle = planeColor.body;
    ctx.font = 'bold 10px sans-serif';
    ctx.fillText(planeColor.name, px - 8, py - 22);
  }
  } // end planes loop

  // Close zoom transform
  ctx.restore();
}

function endGame(reason) {
  game.gameOver = true;
  game.gameOverReason = reason;

  // Spawn crash explosion at plane position
  game.crashExplosion = {
    x: game.plane.x,
    y: game.plane.y,
    particles: [],
    life: 120, // 2 seconds at 60fps
    flash: 1,
  };
  // Generate debris and fire particles
  for (let i = 0; i < 40; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 1 + Math.random() * 4;
    game.crashExplosion.particles.push({
      x: 0, y: 0,
      vx: Math.cos(angle) * speed + game.plane.vx * 0.3,
      vy: Math.sin(angle) * speed - Math.random() * 2,
      size: 2 + Math.random() * 5,
      life: 40 + Math.random() * 80,
      maxLife: 40 + Math.random() * 80,
      type: Math.random() < 0.4 ? 'debris' : 'fire',
    });
  }

  // Delay the game over screen to show the explosion
  setTimeout(() => {
    document.getElementById('gameOverScreen').style.display = 'block';
    document.getElementById('gameOverReason').textContent = reason;
    document.getElementById('finalScore').textContent = game.score;
  }, 2000);

  // Keep rendering the explosion
  requestAnimationFrame(crashLoop);
}

function crashLoop() {
  if (!game || !game.crashExplosion) return;
  const ce = game.crashExplosion;
  ce.life--;
  ce.flash *= 0.9;

  // Update particles
  for (const p of ce.particles) {
    p.x += p.vx;
    p.y += p.vy;
    p.vy += 0.05; // gravity on debris
    p.vx *= 0.98;
    p.life--;
  }
  ce.particles = ce.particles.filter(p => p.life > 0);

  // Render
  render();

  // Draw explosion on top
  const cx = game.camX;
  const ex = ce.x - cx;
  const ey = ce.y;

  // White flash
  if (ce.flash > 0.1) {
    ctx.fillStyle = `rgba(255,255,255,${ce.flash * 0.5})`;
    ctx.fillRect(0, 0, W, H);
  }

  // Fire ball (fades over time)
  const fireAlpha = Math.min(1, ce.life / 60);
  const fireR = 30 + (120 - ce.life) * 0.3;
  ctx.beginPath();
  ctx.arc(ex, ey, fireR, 0, Math.PI * 2);
  ctx.fillStyle = `rgba(255,80,0,${fireAlpha * 0.3})`;
  ctx.fill();
  ctx.beginPath();
  ctx.arc(ex, ey, fireR * 0.5, 0, Math.PI * 2);
  ctx.fillStyle = `rgba(255,160,0,${fireAlpha * 0.4})`;
  ctx.fill();

  // Particles
  for (const p of ce.particles) {
    const alpha = p.life / p.maxLife;
    const px = ex + p.x;
    const py = ey + p.y;
    if (p.type === 'fire') {
      const r = Math.floor(255);
      const g = Math.floor(100 + 150 * alpha);
      const b = Math.floor(50 * alpha);
      ctx.fillStyle = `rgba(${r},${g},${b},${alpha})`;
      ctx.beginPath();
      ctx.arc(px, py, p.size * alpha, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // Debris — dark chunks
      ctx.fillStyle = `rgba(60,60,60,${alpha})`;
      ctx.fillRect(px - p.size / 2, py - p.size / 2, p.size, p.size);
    }
  }

  // Smoke column rising
  if (ce.life < 100) {
    const smokeAlpha = Math.min(0.4, (100 - ce.life) / 100);
    for (let i = 0; i < 3; i++) {
      const sy = ey - 20 - (100 - ce.life) * 0.8 - i * 15;
      const sx = ex + Math.sin(ce.life * 0.1 + i) * 8;
      ctx.fillStyle = `rgba(80,80,80,${smokeAlpha * (1 - i * 0.25)})`;
      ctx.beginPath();
      ctx.arc(sx, sy, 10 + i * 5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  if (ce.life > 0) {
    requestAnimationFrame(crashLoop);
  }
}

// --- Touch Controls ---
function toggleTouch() {
  const tc = document.getElementById('touchControls');
  const btn = document.getElementById('touchToggle');
  if (tc.classList.contains('visible')) {
    tc.classList.remove('visible');
    btn.textContent = 'Show Touch Controls';
  } else {
    tc.classList.add('visible');
    btn.textContent = 'Hide Touch Controls';
  }
}

// Auto-show on touch devices
if ('ontouchstart' in window) {
  document.getElementById('touchControls').classList.add('visible');
  document.getElementById('touchToggle').textContent = 'Hide Touch Controls';
}

// Wire up touch buttons to simulate key presses
(function() {
  const allBtns = document.querySelectorAll('[data-key]');
  const doubleTapTimers = {};

  allBtns.forEach(btn => {
    const key = btn.getAttribute('data-key');
    const isDoubleTap = btn.getAttribute('data-doubletap') === 'true';

    function press(e) {
      e.preventDefault();
      btn.classList.add('pressed');

      if (isDoubleTap) {
        // Simulate double-tap: fire keydown twice quickly
        const now = Date.now();
        if (!doubleTapTimers[key] || now - doubleTapTimers[key] > 400) {
          // First tap
          doubleTapTimers[key] = now;
          keys[key] = true;
          // Brief release then re-press to trigger double-tap detection
          setTimeout(() => {
            keys[key] = false;
            keys['_' + key + '_prev'] = false;
            setTimeout(() => { keys[key] = true; }, 20);
          }, 30);
        } else {
          keys[key] = true;
        }
      } else {
        keys[key] = true;
      }
    }

    function release(e) {
      e.preventDefault();
      btn.classList.remove('pressed');
      keys[key] = false;
    }

    btn.addEventListener('touchstart', press, { passive: false });
    btn.addEventListener('touchend', release, { passive: false });
    btn.addEventListener('touchcancel', release, { passive: false });
    // Mouse fallback for testing on desktop
    btn.addEventListener('mousedown', press);
    btn.addEventListener('mouseup', release);
    btn.addEventListener('mouseleave', release);
  });

  // Prevent default touch behavior on canvas to avoid scrolling
  canvas.addEventListener('touchstart', e => e.preventDefault(), { passive: false });
  canvas.addEventListener('touchmove', e => e.preventDefault(), { passive: false });
})();
