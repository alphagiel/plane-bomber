/**
 * Game Engine - extracted from legacy single-file game.
 * This module exports a GameEngine class that manages the canvas,
 * game loop, update, and render. React components control it via methods.
 */

import { CANVAS_W, CANVAS_H, WORLD_W, CAVE_X, GROUND_Y, RUNWAY_X, RUNWAY_W, RUNWAY_Y, PLANE_COLORS, PHYSICS } from '../lib/constants';

export class GameEngine {
  constructor(canvas, callbacks = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    canvas.width = CANVAS_W;
    canvas.height = CANVAS_H;
    this.W = CANVAS_W;
    this.H = CANVAS_H;

    this.game = null;
    this.keys = {};
    this.mp = null; // multiplayer ref
    this.callbacks = callbacks; // { onGameOver, onPlaneDeath, onHudUpdate }
    this.running = false;

    this._bindInput();
  }

  _bindInput() {
    this._onKeyDown = (e) => {
      this.keys[e.key.toLowerCase()] = true;
      if (e.key === ' ') e.preventDefault();
    };
    this._onKeyUp = (e) => {
      this.keys[e.key.toLowerCase()] = false;
    };
    this._onWheel = (e) => {
      if (!this.game || this.game.gameOver) return;
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.1 : 0.1;
      this.game.zoom = Math.max(0.5, Math.min(3, this.game.zoom + delta));
    };
    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
    this.canvas.addEventListener('wheel', this._onWheel, { passive: false });
  }

  destroy() {
    this.running = false;
    window.removeEventListener('keydown', this._onKeyDown);
    window.removeEventListener('keyup', this._onKeyUp);
    this.canvas.removeEventListener('wheel', this._onWheel);
  }

  setMultiplayer(mp) {
    this.mp = mp;
  }

  simulateKey(key, pressed) {
    this.keys[key] = pressed;
  }

  getInputForSlot(slot) {
    if (!this.mp) return this.keys;
    if (slot === this.mp.playerSlot) return this.keys;
    return this.mp.remoteInputs?.[slot] || {};
  }

  // --- Game State Creation ---

  makePlane(slot, bombCount) {
    return {
      x: RUNWAY_X + 60 + slot * 40,
      y: RUNWAY_Y - 12,
      vx: 0, vy: 0,
      angle: 0, thrusterAngle: 0,
      speed: 0,
      airborne: false, onRunway: true, facingRight: true,
      width: 48, height: 16,
      slot,
      hp: 100, maxHP: 100,
      bombs: bombCount, bombMax: bombCount,
      bombCooldown: 0, gunCooldown: 0,
      alive: true,
      color: PLANE_COLORS[slot] || PLANE_COLORS[0],
    };
  }

  start(settings) {
    const s = settings;
    const playerCount = s.playerCount || 1;
    const planes = [];
    for (let i = 0; i < playerCount; i++) {
      planes.push(this.makePlane(i, s.bombCount));
    }

    this.game = {
      diff: s.diff,
      enemySpeedMult: s.enemySpeedMult,
      enemySizeMult: s.enemySizeMult,
      score: 0,
      airportHP: 200, airportMaxHP: 200,
      planes,
      plane: planes[this.mp ? this.mp.playerSlot : 0],
      bombList: [], explosions: [], enemies: [],
      enemyBullets: [], gunBullets: [],
      spawnTimer: 0,
      spawnInterval: s.spawnRate,
      followCam: true, camX: 0,
      gameOver: false, gameOverReason: '',
      zoom: 1, spawnCount: 0,
      spawnType: s.spawnType,
      boss1Every: s.boss1Every,
      boss2After: s.boss2After,
      frameCount: 0,
    };

    this.running = true;
    this._loop();
  }

  stop() {
    this.running = false;
  }

  respawnPlane(p) {
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

  applyRemoteState(state) {
    if (!this.game) return;
    this.game.planes = state.planes;
    this.game.enemies = state.enemies;
    this.game.bombList = state.bombList;
    this.game.gunBullets = state.gunBullets;
    this.game.enemyBullets = state.enemyBullets;
    this.game.score = state.score;
    this.game.airportHP = state.airportHP;
    this.game.explosions = (state.explosions || []).map(e => ({
      ...e, particles: [], flash: 0, shockwave: e.maxR * 3 - e.life * 2,
    }));
    if (this.mp) {
      this.game.plane = this.game.planes[this.mp.playerSlot] || this.game.planes[0];
    }
  }

  // --- Game Loop ---

  _loop() {
    if (!this.running || !this.game) return;

    if (!this.mp || this.mp.isHost) {
      this._update();
    } else {
      // Client: send input
      this.game.frameCount = (this.game.frameCount || 0) + 1;
      if (this.mp.channel && this.game.frameCount % 3 === 0) {
        const inputKeys = {};
        ['w','s','a','d','q','e',' ','r','f','v'].forEach(k => { if (this.keys[k]) inputKeys[k] = true; });
        this.mp.channel.send({ type: 'broadcast', event: 'input', payload: { slot: this.mp.playerSlot, keys: inputKeys } });
      }
    }

    this._render();
    this._notifyHud();

    if (!this.game.gameOver) {
      requestAnimationFrame(() => this._loop());
    }
  }

  _notifyHud() {
    if (!this.callbacks.onHudUpdate || !this.game) return;
    const p = this.game.plane;
    this.callbacks.onHudUpdate({
      score: this.game.score,
      bombs: p.bombs,
      bombMax: p.bombMax,
      planeHP: p.hp,
      planeMaxHP: p.maxHP,
      airportHP: this.game.airportHP,
      airportMaxHP: this.game.airportMaxHP,
      zoom: this.game.zoom,
      nozzleAngle: Math.round(p.thrusterAngle * -180 / Math.PI),
      planes: this.game.planes,
    });
  }

  // --- Helpers ---

  _nearestAlivePlane(ex, ey) {
    let best = null, bestDist = Infinity;
    for (const pl of this.game.planes) {
      if (!pl.alive) continue;
      const d = Math.hypot(pl.x - ex, pl.y - ey);
      if (d < bestDist) { bestDist = d; best = pl; }
    }
    return best;
  }

  _killPlane(p, reason) {
    p.alive = false;
    this.game.explosions.push({
      x: p.x, y: p.y, r: 40, maxR: 40, life: 60,
      particles: [], flash: 1, shockwave: 0,
    });

    const localSlot = this.mp ? this.mp.playerSlot : 0;
    if (this.game.planes.length > 1 && p.slot === localSlot) {
      if (this.callbacks.onPlaneDeath) this.callbacks.onPlaneDeath(reason);
      return;
    }

    const anyAlive = this.game.planes.some(pl => pl.alive);
    if (!anyAlive) {
      this._endGame(reason);
    }
  }

  _endGame(reason) {
    this.game.gameOver = true;
    this.game.gameOverReason = reason;
    if (this.callbacks.onGameOver) this.callbacks.onGameOver(reason, this.game.score);
    if (this.mp && this.mp.isHost && this.mp.channel) {
      this.mp.channel.send({ type: 'broadcast', event: 'game-over', payload: { reason } });
    }
  }

  // ============================================================
  //  UPDATE — all game physics, spawning, collisions
  // ============================================================
  _update() {
    const g = this.game;
    const p = g.plane;
    const keys = this.keys;
    const { GRAVITY, THRUST, MAX_SPEED, MIN_FLY_SPEED, DRAG, LAND_MAX_SPEED, LAND_MAX_VY, CLIMB_FORCE, NOZZLE_SPEED } = PHYSICS;

    // Camera toggle
    if (keys['v'] && !keys['_v_prev']) g.followCam = !g.followCam;
    keys['_v_prev'] = keys['v'];

    if (!g.gameOver) {
      // Update ALL planes
      for (const p of g.planes) {
        if (!p.alive) continue;
        const input = this.getInputForSlot(p.slot);

        // W/S - pitch up/down (trades horizontal speed for vertical)
        const hSpeed = Math.abs(p.vx);
        const PITCH_RATE = 0.15;
        if (input['w'] && p.airborne && hSpeed > 0.3) {
          const transfer = Math.min(PITCH_RATE, hSpeed * 0.08);
          p.vy -= transfer;
          p.vx *= (1 - 0.03); // bleed forward speed when climbing
        }
        if (input['s'] && p.airborne) {
          p.vy += 0.08;
          p.vx *= 1.005; // slight speed gain from diving
        }
        if (p.airborne) {
          const targetAngle = Math.atan2(p.vy, Math.abs(p.vx) + 0.5) * 0.4;
          p.angle += (targetAngle - p.angle) * 0.1;
        }

        // Q/E nozzle
        if (input['q']) p.thrusterAngle -= NOZZLE_SPEED;
        if (input['e']) p.thrusterAngle += NOZZLE_SPEED;
        p.thrusterAngle = Math.max(-Math.PI / 2, Math.min(0, p.thrusterAngle));

        // A/D direction
        if (input['d']) p.facingRight = true;
        if (input['a']) p.facingRight = false;

        // Space thrust
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
                this._killPlane(p, 'Crash landing!');
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
              this._killPlane(p, 'Crashed into the ground!');
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
      }
    }

    // Update gun bullets
    for (let i = g.gunBullets.length - 1; i >= 0; i--) {
      const b = g.gunBullets[i];
      b.x += b.vx; b.y += b.vy; b.life--;
      if (b.life <= 0 || b.y > GROUND_Y || b.y < 0 || b.x < 0 || b.x > WORLD_W) {
        g.gunBullets.splice(i, 1); continue;
      }
      for (let j = g.enemies.length - 1; j >= 0; j--) {
        const e = g.enemies[j];
        const hitW = (e.boss || e.boss2) ? 20 : 8;
        const hitH = (e.boss || e.boss2) ? 50 : 20;
        if (Math.abs(b.x - e.x) < hitW && Math.abs(b.y - e.y) < hitH) {
          e.gunHits = (e.gunHits || 0) + 1;
          g.gunBullets.splice(i, 1);
          if (e.gunHits >= 3) { e.hp--; e.gunHits = 0; }
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
      b.vy += 0.2; b.x += b.vx; b.y += b.vy;
      if (b.y >= GROUND_Y) {
        const blastR = 123;
        const pushR = blastR * 3;
        const particles = [];
        for (let k = 0; k < 25; k++) {
          const angle = Math.random() * Math.PI * 2;
          const speed = 1 + Math.random() * 3.5;
          particles.push({
            x: 0, y: 0,
            vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed - Math.random() * 2.5,
            size: 1.5 + Math.random() * 4,
            life: 25 + Math.random() * 50, maxLife: 25 + Math.random() * 50,
            type: Math.random() < 0.3 ? 'debris' : 'fire',
          });
        }
        g.explosions.push({ x: b.x, y: GROUND_Y, r: blastR, maxR: blastR, life: 60, particles, flash: 1, shockwave: 0 });
        for (let j = g.enemies.length - 1; j >= 0; j--) {
          const e = g.enemies[j];
          const dx = e.x - b.x;
          const dist = Math.abs(dx);
          if (dist < blastR) {
            // Direct hit — bombs deal extra damage to bosses
            const bombDmg = (e.boss || e.boss2) ? 3 : 1;
            e.hp -= bombDmg;
            if (e.hp <= 0) {
              g.score += (e.boss || e.boss2) ? g.diff * 100 : g.diff * 10;
              g.enemies.splice(j, 1); continue;
            }
          }
          if (dist < pushR && dist > 0) {
            const pushForce = (1 - dist / pushR) * ((e.boss || e.boss2) ? 3 : 8);
            const dir = dx > 0 ? 1 : -1;
            e.pushVx = (e.pushVx || 0) + dir * pushForce;
            e.pushVy = (e.pushVy || 0) - pushForce * 0.6;
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
      if (ex.particles) {
        for (const pt of ex.particles) {
          pt.x += pt.vx; pt.y += pt.vy;
          pt.vy += 0.06; pt.vx *= 0.97; pt.life--;
        }
        ex.particles = ex.particles.filter(pt => pt.life > 0);
      }
      if (ex.life <= 0) g.explosions.splice(i, 1);
    }

    // Update enemy displacement
    for (const e of g.enemies) {
      if (e.pushVx || e.pushVy) {
        e.x += e.pushVx || 0;
        e.y += (e.pushVy || 0);
        e.pushVx = (e.pushVx || 0) * 0.9;
        e.pushVy = (e.pushVy || 0) + 0.3;
        if (e.y >= GROUND_Y) {
          e.y = GROUND_Y; e.pushVy = 0;
          e.pushVx = (e.pushVx || 0) * 0.5;
          e.airborne = false;
          if (Math.abs(e.pushVx) < 0.1) e.pushVx = 0;
          if (!e.knockdown) e.knockdown = 60;
        }
      }
    }

    // Plane-enemy collision
    if (!g.gameOver) {
      for (let i = g.enemies.length - 1; i >= 0; i--) {
        const e = g.enemies[i];
        if (e.knockdown > 0) continue;
        const hitW = (e.boss || e.boss2) ? 25 : 12;
        const hitH = (e.boss || e.boss2) ? 55 : 25;
        let enemyKilled = false;
        for (const pl of g.planes) {
          if (!pl.alive) continue;
          if (Math.abs(pl.x - e.x) < hitW && Math.abs(pl.y - e.y) < hitH) {
            pl.hp -= (e.boss || e.boss2) ? 15 : 5;
            e.hp = 0;
            g.score += (e.boss || e.boss2) ? g.diff * 20 : g.diff * 2;
            if (pl.hp <= 0) this._killPlane(pl, 'Crashed into enemies!');
            enemyKilled = true; break;
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

      let spawnBoss1 = false, spawnBoss2 = false;
      if (g.spawnType === 'zombies') {
      } else if (g.spawnType === 'boss1') { spawnBoss1 = true;
      } else if (g.spawnType === 'boss2') { spawnBoss2 = true;
      } else if (g.spawnType === 'all_bosses') {
        spawnBoss1 = g.spawnCount % 2 === 0; spawnBoss2 = !spawnBoss1;
      } else if (g.spawnType === 'mix') {
        const roll = Math.random();
        if (roll < 0.15) spawnBoss1 = true;
        else if (roll < 0.3) spawnBoss2 = true;
      } else {
        if (g.spawnCount % g.boss1Every === 0) {
          const bossNum = Math.floor(g.spawnCount / g.boss1Every);
          if (bossNum > g.boss2After) spawnBoss2 = true;
          else spawnBoss1 = true;
        }
      }

      if (spawnBoss1) {
        g.enemies.push({ x: CAVE_X, y: GROUND_Y, speed: baseSpd * g.enemySpeedMult * 0.95, hp: bossHP, maxHP: bossHP, attackTimer: 0, shootTimer: 50, animFrame: 0, boss: true, jumpVy: 0 });
      } else if (spawnBoss2) {
        g.enemies.push({ x: CAVE_X, y: GROUND_Y, speed: baseSpd * g.enemySpeedMult * 0.95, hp: boss2HP, maxHP: boss2HP, attackTimer: 0, shootTimer: 50, animFrame: 0, boss2: true, jumpTimer: 60 + Math.random() * 40, jumpVy: 0, bombTimer: 80 + Math.random() * 60 });
      } else {
        g.enemies.push({ x: CAVE_X + Math.random() * 30, y: GROUND_Y, speed: baseSpd * g.enemySpeedMult, hp: zombieHP, maxHP: zombieHP, attackTimer: 0, shootTimer: Math.random() * 200, animFrame: 0 });
      }
    }

    // Update enemies
    for (let i = g.enemies.length - 1; i >= 0; i--) {
      const e = g.enemies[i];
      if (e.knockdown > 0) { e.knockdown--; continue; }
      e.x -= e.speed;
      e.animFrame += e.speed * 0.1;

      // Attack airport
      if (e.x <= RUNWAY_X + 90) {
        e.attackTimer++;
        e.x = Math.max(RUNWAY_X + 20, e.x);
        if (e.attackTimer % 20 === 0) {
          g.airportHP -= (e.boss || e.boss2) ? 5 : 2;
          if (g.airportHP <= 0) { this._endGame('The airport was destroyed!'); return; }
        }
      }

      // Runway squish
      for (const pl of g.planes) {
        if (!pl.airborne && pl.onRunway && pl.alive) {
          if (Math.abs(e.x - pl.x) < 30 && e.y >= GROUND_Y - 5) {
            e.hp = 0; g.enemies.splice(i, 1); g.score += 5; break;
          }
        }
      }

      // Boss2 jumping + bombs
      if (e.boss2) {
        e.jumpTimer = (e.jumpTimer || 0) - 1;
        if (e.jumpTimer <= 0 && e.y >= GROUND_Y) {
          e.jumpVy = -(4 + Math.random() * 2.5);
          e.jumpTimer = 70 + Math.random() * 50;
          e.y -= 1;
        }
        e.jumpVy = (e.jumpVy || 0) + 0.18;
        e.y += e.jumpVy;
        if (e.y >= GROUND_Y) { e.y = GROUND_Y; e.jumpVy = 0; }

        e.bombTimer = (e.bombTimer || 0) - 1;
        if (e.bombTimer <= 0) {
          e.bombTimer = 100 + Math.random() * 80;
          const target = this._nearestAlivePlane(e.x, e.y);
          if (target) {
            const dx = target.x - e.x, dy = target.y - e.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < 600) {
              g.enemyBullets.push({ x: e.x, y: e.y - 30, vx: (dx / dist) * 2.5, vy: -3 + (dy / dist) * 2.5, life: 180, isBomb: true });
            }
          }
        }
      }

      // Shooting (level 3 + boss1)
      if (g.diff >= 3 || e.boss) {
        e.shootTimer = (e.shootTimer || 0) - 1;
        if (e.shootTimer <= 0) {
          e.shootTimer = e.boss ? (60 + Math.random() * 80) : (150 + Math.random() * 200);
          const target = this._nearestAlivePlane(e.x, e.y);
          if (target) {
            const dx = target.x - e.x, dy = target.y - e.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const shootRange = e.boss ? 800 : 500;
            if (dist < shootRange) {
              const bspeed = e.boss ? 4 : 3;
              g.enemyBullets.push({ x: e.x, y: e.y - (e.boss ? 50 : 20), vx: (dx / dist) * bspeed, vy: (dy / dist) * bspeed, life: 150 });
              if (e.boss) {
                g.enemyBullets.push({ x: e.x + 10, y: e.y - 45, vx: (dx / dist) * bspeed + (Math.random() - 0.5), vy: (dy / dist) * bspeed + (Math.random() - 0.5), life: 150 });
              }
            }
          }
        }
      }
    }

    // Update enemy bullets
    for (let i = g.enemyBullets.length - 1; i >= 0; i--) {
      const b = g.enemyBullets[i];
      if (b.isBomb) b.vy += 0.08;
      b.x += b.vx; b.y += b.vy; b.life--;
      if (b.life <= 0 || b.y < 0) { g.enemyBullets.splice(i, 1); continue; }
      if (b.isBomb && b.y >= GROUND_Y) {
        g.explosions.push({ x: b.x, y: GROUND_Y, r: 30, maxR: 30, life: 40, particles: [], flash: 0.5, shockwave: 0 });
        g.enemyBullets.splice(i, 1);
        for (const pl of g.planes) {
          if (!pl.alive) continue;
          if (Math.abs(b.x - pl.x) < 40 && Math.abs(GROUND_Y - pl.y) < 40) {
            pl.hp -= 12;
            if (pl.hp <= 0) this._killPlane(pl, 'Hit by enemy bomb!');
          }
        }
        continue;
      }
      if (b.y > GROUND_Y) { g.enemyBullets.splice(i, 1); continue; }
      let bulletHit = false;
      for (const pl of g.planes) {
        if (!pl.alive) continue;
        if (Math.abs(b.x - pl.x) < 24 && Math.abs(b.y - pl.y) < 12) {
          pl.hp -= b.isBomb ? 15 : 8;
          g.enemyBullets.splice(i, 1);
          if (pl.hp <= 0) this._killPlane(pl, 'Plane shot down!');
          bulletHit = true; break;
        }
      }
      if (bulletHit) continue;
    }

    // Camera
    const localPlane = g.plane;
    if (g.followCam && localPlane) {
      g.camX = localPlane.x - this.W / 3;
      g.camX = Math.max(0, Math.min(WORLD_W - this.W, g.camX));
    } else {
      g.camX = 0;
    }

    // Multiplayer broadcast
    g.frameCount = (g.frameCount || 0) + 1;
    if (this.mp && this.mp.isHost && g.frameCount % 3 === 0 && this.mp.channel) {
      this.mp.channel.send({ type: 'broadcast', event: 'state', payload: {
        planes: g.planes.map(pl => ({ x: pl.x, y: pl.y, vx: pl.vx, vy: pl.vy, angle: pl.angle, thrusterAngle: pl.thrusterAngle, airborne: pl.airborne, onRunway: pl.onRunway, facingRight: pl.facingRight, hp: pl.hp, maxHP: pl.maxHP, bombs: pl.bombs, bombMax: pl.bombMax, alive: pl.alive, slot: pl.slot, gunCooldown: pl.gunCooldown })),
        enemies: g.enemies.map(e => ({ x: e.x, y: e.y, hp: e.hp, maxHP: e.maxHP, speed: e.speed, boss: e.boss, boss2: e.boss2, animFrame: e.animFrame, knockdown: e.knockdown || 0, jumpVy: e.jumpVy, bombTimer: e.bombTimer })),
        bombList: g.bombList,
        gunBullets: g.gunBullets,
        enemyBullets: g.enemyBullets,
        explosions: g.explosions.map(e => ({ x: e.x, y: e.y, life: e.life, maxR: e.maxR })),
        score: g.score, airportHP: g.airportHP,
      }});
    }
  }

  // ============================================================
  //  RENDER — all drawing (imported from legacy, uses same logic)
  // ============================================================
  _render() {
    // For now, use the legacy render extracted into engine-raw.js
    // This will be migrated incrementally
    if (this._renderLegacy) this._renderLegacy();
  }
}
