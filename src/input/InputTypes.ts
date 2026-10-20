/**
 * Device-independent per-frame player intent. Gameplay only reads this, so a future network
 * client can produce the same structure for a remote co-op partner.
 */
export interface PlayerIntent {
  /** Screen-space movement: x right, y up, length ≤ 1. */
  moveX: number;
  moveY: number;
  run: boolean;
  /** Precision aim mode (RMB / aim stick). */
  aim: boolean;
  /** Mouse cursor in canvas pixels. */
  aimScreen: { x: number; y: number } | null;
  /** Touch aim stick direction, screen space (x right, y up). */
  aimStick: { x: number; y: number } | null;
  fire: boolean;
  firePressed: boolean;
  /** Touch fire without aim stick: aim at the best visible target. */
  autoTarget: boolean;
  interact: boolean;
  reload: boolean;
  dodge: boolean;
  switchWeapon: boolean;
  heal: boolean;
  inventory: boolean;
  journal: boolean;
  pause: boolean;
  zoomDelta: number;
}

export const emptyIntent = (): PlayerIntent => ({
  moveX: 0,
  moveY: 0,
  run: false,
  aim: false,
  aimScreen: null,
  aimStick: null,
  fire: false,
  firePressed: false,
  autoTarget: false,
  interact: false,
  reload: false,
  dodge: false,
  switchWeapon: false,
  heal: false,
  inventory: false,
  journal: false,
  pause: false,
  zoomDelta: 0,
});
