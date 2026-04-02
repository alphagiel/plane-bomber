export const CANVAS_W = 1200;
export const CANVAS_H = 700;
export const WORLD_W = 2400;
export const CAVE_X = 1340;
export const GROUND_Y = CANVAS_H - 60;
export const RUNWAY_X = 40;
export const RUNWAY_W = 320;
export const RUNWAY_Y = GROUND_Y;

export const PLANE_COLORS = [
  { body: '#f90', cockpit: '#6af', name: 'P1' },
  { body: '#0cf', cockpit: '#6cf', name: 'P2' },
  { body: '#8f0', cockpit: '#af6', name: 'P3' },
];

export const PHYSICS = {
  GRAVITY: 0.07,
  THRUST: 0.06,
  TURN_SPEED: 0.03,
  MAX_SPEED: 3.5,
  MIN_FLY_SPEED: 1.0,
  DRAG: 0.992,
  LAND_MAX_SPEED: 1.8,
  LAND_MAX_VY: 1.5,
  CLIMB_FORCE: 0.12,
  NOZZLE_SPEED: 0.05,
};
