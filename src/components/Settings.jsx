import { useState } from 'react';
import { useGameStore } from '../lib/store';

function NumInput({ value, min, max, fallback, onChange }) {
  const [draft, setDraft] = useState(null);
  return (
    <input type="number" min={min} max={max}
      value={draft !== null ? draft : value}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => { onChange(Math.max(min, parseInt(draft) || fallback)); setDraft(null); }}
    />
  );
}

export default function Settings() {
  const { settings, updateSetting } = useGameStore();

  return (
    <div className="settings">
      <label>Difficulty Level</label>
      <select value={settings.diff} onChange={(e) => updateSetting('diff', parseInt(e.target.value))}>
        <option value={1}>Level 1 — Basic</option>
        <option value={2}>Level 2 — Hard</option>
        <option value={3}>Level 3 — Brutal</option>
      </select>

      <label>Bombs Per Reload</label>
      <NumInput value={settings.bombCount} min={1} max={50} fallback={5}
        onChange={(v) => updateSetting('bombCount', v)} />

      <label>Enemy Speed: {settings.enemySpeedMult}x</label>
      <input type="range" min="0.1" max="2" step="0.1" value={settings.enemySpeedMult}
        onChange={(e) => updateSetting('enemySpeedMult', parseFloat(e.target.value))} />

      <label>Enemy Size: {settings.enemySizeMult}x</label>
      <input type="range" min="0.3" max="1.5" step="0.1" value={settings.enemySizeMult}
        onChange={(e) => updateSetting('enemySizeMult', parseFloat(e.target.value))} />

      <label>Spawn Rate: {settings.spawnRate} frames</label>
      <input type="range" min="20" max="300" step="10" value={settings.spawnRate}
        onChange={(e) => updateSetting('spawnRate', parseInt(e.target.value))} />

      <label>Spawn Type</label>
      <select value={settings.spawnType} onChange={(e) => updateSetting('spawnType', e.target.value)}>
        <option value="normal">Normal (zombies + bosses)</option>
        <option value="zombies">Zombies only</option>
        <option value="boss1">Boss 1 only</option>
        <option value="boss2">Boss 2 only</option>
        <option value="all_bosses">Both bosses only</option>
        <option value="mix">All types mixed</option>
      </select>

      <label>Boss 1 every N spawns</label>
      <NumInput value={settings.boss1Every} min={1} max={200} fallback={20}
        onChange={(v) => updateSetting('boss1Every', v)} />

      <label>Boss 2 after N bosses</label>
      <NumInput value={settings.boss2After} min={1} max={50} fallback={5}
        onChange={(v) => updateSetting('boss2After', v)} />
    </div>
  );
}
