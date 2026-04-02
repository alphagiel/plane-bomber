import { create } from 'zustand';

export const useGameStore = create((set, get) => ({
  // App state
  screen: 'menu', // menu | lobby | game | gameover
  gameMode: 'solo', // solo | create | join

  // Multiplayer
  mp: null,
  roomCode: null,
  players: {},

  // Game settings
  settings: {
    diff: 1,
    bombCount: 5,
    enemySpeedMult: 0.5,
    enemySizeMult: 0.6,
    spawnRate: 120,
    spawnType: 'normal',
    boss1Every: 20,
    boss2After: 5,
  },

  // Runtime game state (managed by game engine, not React)
  game: null,

  // Actions
  setScreen: (screen) => set({ screen }),
  setGameMode: (gameMode) => set({ gameMode }),
  setSettings: (settings) => set((s) => ({ settings: { ...s.settings, ...settings } })),
  setMp: (mp) => set({ mp }),
  setRoomCode: (roomCode) => set({ roomCode }),
  setPlayers: (players) => set({ players }),
  setGame: (game) => set({ game }),

  updateSetting: (key, value) => set((s) => ({
    settings: { ...s.settings, [key]: value }
  })),
}));
