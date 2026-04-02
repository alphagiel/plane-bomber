import { useGameStore } from '../lib/store';

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
      <input type="number" value={settings.bombCount} min={1} max={50}
        onChange={(e) => updateSetting('bombCount', Math.max(1, parseInt(e.target.value) || 5))} />

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
      <input type="number" value={settings.boss1Every} min={1} max={200}
        onChange={(e) => updateSetting('boss1Every', Math.max(1, parseInt(e.target.value) || 20))} />

      <label>Boss 2 after N bosses</label>
      <input type="number" value={settings.boss2After} min={1} max={50}
        onChange={(e) => updateSetting('boss2After', Math.max(1, parseInt(e.target.value) || 5))} />
    </div>
  );
}
