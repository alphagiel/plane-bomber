import { CANVAS_W, CANVAS_H, WORLD_W, CAVE_X, GROUND_Y, RUNWAY_X, RUNWAY_W, RUNWAY_Y, PLANE_COLORS } from "../lib/constants";

/**
 * Render function — draws the entire game frame.
 * Called as a method on GameEngine via bindRender().
 */
export function bindRender(engine) {
  engine._renderLegacy = function() {
    const g = this.game;
    if (!g) return;
    const p = g.plane;
    const ctx = this.ctx;
    const W = this.W;
    const H = this.H;
    const cx = g.camX;
    const zoom = g.zoom || 1;
    const keys = this.keys;

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
  const caveX = CAVE_X - cx;
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
  const dpInput = this.getInputForSlot(dp.slot);
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
  if (dp.slot === (this.mp ? this.mp.playerSlot : 0) && dp.airborne && dp.y > GROUND_Y - 120 && dp.x >= RUNWAY_X && dp.x <= RUNWAY_X + RUNWAY_W) {
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

  }; // end _renderLegacy
}
