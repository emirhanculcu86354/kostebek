/**
 * Static layout of the compact district. Pure data: rendering and collision are built from it.
 * Coordinates: x = east, z = south. Sizes: w along x, d along z.
 */

export type MaterialKey =
  | 'brick'
  | 'brickDark'
  | 'plaster'
  | 'concrete'
  | 'metal'
  | 'wood'
  | 'woodDark'
  | 'facade'
  | 'interior'
  | 'clubWall';

export type FloorKey = 'asphalt' | 'sidewalk' | 'tiles' | 'clubFloor' | 'concreteFloor' | 'woodFloor' | 'carpet' | 'parking';

export interface WallDef {
  x: number;
  z: number;
  w: number;
  d: number;
  h: number;
  mat: MaterialKey;
}

export interface DoorDef {
  id: string;
  x: number;
  z: number;
  /** 'x' = door spans along x (in a wall running east-west). */
  axis: 'x' | 'z';
  width: number;
  name: string;
  shutter?: boolean;
}

export interface FloorDef {
  x: number;
  z: number;
  w: number;
  d: number;
  mat: FloorKey;
}

export type PropKind =
  | 'crate'
  | 'crateStack'
  | 'container'
  | 'shelf'
  | 'desk'
  | 'barCounter'
  | 'barShelf'
  | 'stool'
  | 'roundTable'
  | 'longTable'
  | 'sofa'
  | 'armchair'
  | 'cabinet'
  | 'safe'
  | 'dumpster'
  | 'car'
  | 'van'
  | 'lamp'
  | 'bench'
  | 'busStop'
  | 'kiosk'
  | 'barrier'
  | 'djBooth'
  | 'board'
  | 'plant'
  | 'pallet'
  | 'forklift'
  | 'bin'
  | 'speaker';

export interface PropDef {
  kind: PropKind;
  x: number;
  z: number;
  w?: number;
  d?: number;
  h?: number;
  rot?: number;
  color?: number;
  collide?: boolean;
}

export interface SignDef {
  text: string;
  x: number;
  z: number;
  y: number;
  w: number;
  rot: number;
  color: string;
}

export interface LightDef {
  x: number;
  z: number;
  y: number;
  color: number;
  intensity: number;
  distance: number;
  /** Lower = kept on lower quality settings. */
  priority: number;
}

export interface AreaDef {
  name: string;
  x: number;
  z: number;
  w: number;
  d: number;
}

export const WALL_T = 0.4;
export const WALL_H = 3;
export const BOUNDS = { minX: -36, maxX: 36, minZ: -28, maxZ: 28 };

const walls: WallDef[] = [];
const wx = (z: number, x1: number, x2: number, mat: MaterialKey = 'brick', h = WALL_H) =>
  walls.push({ x: (x1 + x2) / 2, z, w: Math.abs(x2 - x1) + WALL_T, d: WALL_T, h, mat });
const wz = (x: number, z1: number, z2: number, mat: MaterialKey = 'brick', h = WALL_H) =>
  walls.push({ x, z: (z1 + z2) / 2, w: WALL_T, d: Math.abs(z2 - z1) + WALL_T, h, mat });

// --- District boundary (tall facades of surrounding blocks) ---
// North/west facades stand tall behind the action; south/east (camera side) stay low so they never wall off the view.
wx(BOUNDS.minZ, BOUNDS.minX, BOUNDS.maxX, 'facade', 5.5);
wx(BOUNDS.maxZ, BOUNDS.minX, BOUNDS.maxX, 'facade', 2.2);
wz(BOUNDS.minX, BOUNDS.minZ, BOUNDS.maxZ, 'facade', 5.5);
wz(BOUNDS.maxX, BOUNDS.minZ, BOUNDS.maxZ, 'facade', 2.2);

// --- Gece Kuşu nightclub: x[-34,-10] z[-26,-7] ---
wx(-7, -34, -23, 'brickDark');
wx(-7, -20, -10, 'brickDark');
wx(-26, -34, -10, 'brickDark');
wz(-34, -26, -7, 'brickDark');
wz(-10, -26, -12, 'brickDark');
wz(-10, -10, -7, 'brickDark');
wx(-18, -34, -31, 'clubWall');
wx(-18, -29, -16.5, 'clubWall');
wx(-18, -14.5, -10, 'clubWall');
wz(-22, -26, -18, 'clubWall');

// --- Liman Deposu warehouse: x[2,34] z[-26,-7] ---
wz(2, -26, -15, 'concrete');
wz(2, -13, -7, 'concrete');
wx(-7, 2, 16, 'concrete');
wx(-7, 21, 34, 'concrete');
wx(-26, 2, 34, 'concrete');
wz(34, -26, -7, 'concrete');
wz(26, -26, -19, 'plaster');
wx(-19, 26, 29, 'plaster');
wx(-19, 31, 34, 'plaster');

// --- Güvenli ev (police safehouse): x[-34,-18] z[8,22] ---
wx(8, -34, -27, 'plaster');
wx(8, -25, -18, 'plaster');
wx(22, -34, -18, 'plaster');
wz(-34, 8, 22, 'plaster');
wz(-18, 8, 22, 'plaster');

// --- Yılmaz Muhasebe office: x[12,26] z[10,22] ---
wx(10, 12, 17, 'brick');
wx(10, 19, 26, 'brick');
wx(22, 12, 22, 'brick');
wx(22, 24, 26, 'brick');
wz(12, 10, 22, 'brick');
wz(26, 10, 22, 'brick');

// --- Low walls bordering the parking lot and back street ---
wx(26.5, -16, 10, 'concrete', 1.1);

export const WALLS: WallDef[] = walls;

export const DOORS: DoorDef[] = [
  { id: 'club_front', x: -21.5, z: -7, axis: 'x', width: 3, name: 'Kulüp girişi' },
  { id: 'club_back', x: -10, z: -11, axis: 'z', width: 2, name: 'Kulüp arka kapısı' },
  { id: 'office_door', x: -30, z: -18, axis: 'x', width: 2, name: 'Arka ofis' },
  { id: 'vip_door', x: -15.5, z: -18, axis: 'x', width: 2, name: 'VIP bölümü' },
  { id: 'wh_side', x: 2, z: -14, axis: 'z', width: 2, name: 'Depo yan kapısı' },
  { id: 'wh_shutter', x: 18.5, z: -7, axis: 'x', width: 5, name: 'Depo kepengi', shutter: true },
  { id: 'wh_office', x: 30, z: -19, axis: 'x', width: 2, name: 'Depo ofisi' },
  { id: 'safe_door', x: -26, z: 8, axis: 'x', width: 2, name: 'Güvenli ev' },
  { id: 'ferhat_front', x: 18, z: 10, axis: 'x', width: 2, name: 'Muhasebe bürosu' },
  { id: 'ferhat_back', x: 23, z: 22, axis: 'x', width: 2, name: 'Büronun arka kapısı' },
];

export const FLOORS: FloorDef[] = [
  { x: 0, z: 0, w: 72, d: 7, mat: 'asphalt' },
  { x: 0, z: -4.75, w: 72, d: 2.5, mat: 'sidewalk' },
  { x: 0, z: 4.75, w: 72, d: 2.5, mat: 'sidewalk' },
  { x: -22, z: -16.5, w: 24, d: 19, mat: 'clubFloor' },
  { x: -4, z: -16, w: 12, d: 20, mat: 'tiles' },
  { x: 18, z: -16.5, w: 32, d: 19, mat: 'concreteFloor' },
  { x: -26, z: 15, w: 16, d: 14, mat: 'woodFloor' },
  { x: -3, z: 17, w: 26, d: 18, mat: 'parking' },
  { x: 19, z: 16, w: 14, d: 12, mat: 'carpet' },
  { x: 31, z: 17, w: 10, d: 22, mat: 'tiles' },
  { x: 19, z: 25, w: 14, d: 6, mat: 'tiles' },
];

export const PROPS: PropDef[] = [
  // Club
  { kind: 'barCounter', x: -30, z: -12.5, w: 1, d: 7, h: 1.1 },
  { kind: 'barShelf', x: -33.5, z: -12.5, w: 0.6, d: 7, h: 2.3 },
  { kind: 'stool', x: -28.9, z: -15, collide: false },
  { kind: 'stool', x: -28.9, z: -13.3, collide: false },
  { kind: 'stool', x: -28.9, z: -11.6, collide: false },
  { kind: 'stool', x: -28.9, z: -9.9, collide: false },
  { kind: 'roundTable', x: -13, z: -9.3 },
  { kind: 'roundTable', x: -13, z: -15.5 },
  { kind: 'roundTable', x: -24.5, z: -9.3 },
  { kind: 'roundTable', x: -24.5, z: -16 },
  { kind: 'djBooth', x: -18, z: -16.9, w: 3, d: 1, h: 1.2 },
  { kind: 'speaker', x: -21.5, z: -17.2 },
  { kind: 'speaker', x: -14.5, z: -17.2 },
  { kind: 'desk', x: -28, z: -23.5, w: 2.4, d: 1.1 },
  { kind: 'cabinet', x: -33.4, z: -21.5, w: 0.8, d: 2.2, h: 2 },
  { kind: 'cabinet', x: -33.4, z: -24.4, w: 0.8, d: 1.8, h: 2 },
  { kind: 'safe', x: -23.2, z: -25.1, w: 1, d: 1, h: 1.2 },
  { kind: 'longTable', x: -16, z: -22.5, w: 4, d: 1.6 },
  { kind: 'sofa', x: -16, z: -25.2, w: 5, d: 0.9, rot: 0 },
  { kind: 'armchair', x: -19.6, z: -22.5, rot: Math.PI / 2 },
  { kind: 'plant', x: -11, z: -25 },
  { kind: 'plant', x: -21, z: -19 },
  // Alley
  { kind: 'dumpster', x: -8.4, z: -21, w: 1.3, d: 2.4, h: 1.4 },
  { kind: 'dumpster', x: 0.9, z: -17, w: 1.3, d: 2.4, h: 1.4 },
  { kind: 'crateStack', x: -2, z: -24.2, w: 1.6, d: 1.6, h: 1.8 },
  { kind: 'crate', x: -8.6, z: -16, w: 1, d: 1, h: 1 },
  { kind: 'pallet', x: -1, z: -11 },
  { kind: 'bin', x: 1.2, z: -8 },
  // Warehouse
  { kind: 'container', x: 9, z: -22.2, w: 6.2, d: 2.6, h: 2.7, color: 0x2f5d7c },
  { kind: 'crateStack', x: 7, z: -12, w: 2, d: 2, h: 2.2 },
  { kind: 'crateStack', x: 13, z: -16, w: 2, d: 1.5, h: 1.6 },
  { kind: 'crate', x: 19, z: -12.5, w: 1.6, d: 1.6, h: 1.4 },
  { kind: 'crateStack', x: 22, z: -21, w: 2, d: 2, h: 2.4 },
  { kind: 'crateStack', x: 28, z: -12, w: 2, d: 2.4, h: 2 },
  { kind: 'crate', x: 14, z: -10, w: 1.2, d: 1.2, h: 1.2 },
  { kind: 'crate', x: 24, z: -15.5, w: 1.4, d: 1.4, h: 1.3 },
  { kind: 'shelf', x: 16.5, z: -25.2, w: 6, d: 1, h: 2.6 },
  { kind: 'forklift', x: 11, z: -9.6, w: 1.4, d: 2.4, h: 1.6, rot: 0 },
  { kind: 'pallet', x: 5, z: -17 },
  { kind: 'pallet', x: 25, z: -9 },
  { kind: 'desk', x: 30, z: -24, w: 2.2, d: 1 },
  { kind: 'cabinet', x: 33.4, z: -22, w: 0.8, d: 2, h: 2 },
  // Safehouse
  { kind: 'desk', x: -30, z: 12, w: 2.2, d: 1 },
  { kind: 'board', x: -26, z: 21.6, w: 4, d: 0.2, h: 2.2 },
  { kind: 'sofa', x: -20.9, z: 16, w: 3, d: 0.9, rot: Math.PI / 2 },
  { kind: 'roundTable', x: -24.5, z: 15.5 },
  { kind: 'cabinet', x: -33.4, z: 18, w: 0.8, d: 2, h: 2 },
  { kind: 'plant', x: -19, z: 9 },
  // Parking lot
  { kind: 'car', x: -12, z: 12, rot: 0, color: 0x6b1f22 },
  { kind: 'car', x: -7, z: 12, rot: 0, color: 0x2b3a4a },
  { kind: 'car', x: 3, z: 12, rot: 0, color: 0x8a8f96 },
  { kind: 'car', x: -12, z: 21, rot: Math.PI, color: 0x1d1f22 },
  { kind: 'van', x: -4, z: 20, rot: 0, color: 0xc9c4b8 },
  { kind: 'car', x: 5, z: 21, rot: Math.PI, color: 0x3d4a33 },
  { kind: 'kiosk', x: 8, z: 24.5, w: 2.2, d: 2.2, h: 2.4 },
  // Ferhat's office
  { kind: 'desk', x: 17, z: 16, w: 2.2, d: 1 },
  { kind: 'cabinet', x: 25.4, z: 13, w: 0.8, d: 2.5, h: 2 },
  { kind: 'cabinet', x: 12.6, z: 19, w: 0.8, d: 2.5, h: 2 },
  { kind: 'plant', x: 13, z: 11 },
  // Back street
  { kind: 'dumpster', x: 29.5, z: 18, w: 1.3, d: 2.4, h: 1.4 },
  { kind: 'dumpster', x: 33.5, z: 12, w: 1.3, d: 2.4, h: 1.4 },
  { kind: 'crateStack', x: 30, z: 24, w: 1.6, d: 1.6, h: 1.8 },
  // Street
  { kind: 'car', x: -26, z: 2.2, rot: Math.PI / 2, color: 0x7a5a2a },
  { kind: 'car', x: 12, z: -2.2, rot: -Math.PI / 2, color: 0x24303d },
  { kind: 'car', x: 27, z: 2.2, rot: Math.PI / 2, color: 0x5c1a1a },
  { kind: 'busStop', x: -6, z: 5.4, w: 3.2, d: 1, h: 2.4 },
  { kind: 'bench', x: 6.5, z: -5.2, rot: 0 },
  { kind: 'bench', x: -32, z: 5.2, rot: Math.PI },
  { kind: 'bin', x: -14, z: -5.4 },
  { kind: 'bin', x: 24, z: 5.4 },
  { kind: 'barrier', x: 31, z: -5.2 },
  { kind: 'lamp', x: -30, z: -5.6 },
  { kind: 'lamp', x: -6, z: -5.6 },
  { kind: 'lamp', x: 18, z: -5.6 },
  { kind: 'lamp', x: -18, z: 5.6 },
  { kind: 'lamp', x: 6, z: 5.6 },
  { kind: 'lamp', x: 30, z: 5.6 },
  { kind: 'lamp', x: -4, z: -20 },
  { kind: 'lamp', x: -9.5, z: 16.5 },
  { kind: 'lamp', x: 6.5, z: 16.5 },
  { kind: 'lamp', x: 31, z: 22 },
];

export const SIGNS: SignDef[] = [
  { text: 'GECE KUŞU', x: -21.5, z: -6.75, y: 3.6, w: 6, rot: 0, color: '#d99a42' },
  { text: 'LİMAN DEPOSU', x: 9, z: -6.75, y: 3.4, w: 6.5, rot: 0, color: '#a3adb9' },
  { text: 'YILMAZ MUHASEBE', x: 18, z: 9.75, y: 3.4, w: 5.5, rot: Math.PI, color: '#a3adb9' },
  { text: 'OTOPARK', x: -3, z: 7.4, y: 2.2, w: 2.8, rot: Math.PI, color: '#54a879' },
];

export const LIGHTS: LightDef[] = [
  // Street lamps (warm sodium)
  { x: -30, z: -4.6, y: 4.6, color: 0xffb066, intensity: 38, distance: 15, priority: 1 },
  { x: -6, z: -4.6, y: 4.6, color: 0xffb066, intensity: 38, distance: 15, priority: 1 },
  { x: 18, z: -4.6, y: 4.6, color: 0xffb066, intensity: 38, distance: 15, priority: 1 },
  { x: -18, z: 4.6, y: 4.6, color: 0xffb066, intensity: 38, distance: 15, priority: 2 },
  { x: 6, z: 4.6, y: 4.6, color: 0xffb066, intensity: 38, distance: 15, priority: 2 },
  { x: 30, z: 4.6, y: 4.6, color: 0xffb066, intensity: 32, distance: 14, priority: 3 },
  // Parking lot lamps
  { x: -9.5, z: 17.5, y: 4.6, color: 0xffb066, intensity: 34, distance: 14, priority: 2 },
  { x: 6.5, z: 17.5, y: 4.6, color: 0xffb066, intensity: 34, distance: 14, priority: 3 },
  // Club interior: amber bar, restrained red dance floor
  { x: -30, z: -12.5, y: 2.6, color: 0xffa040, intensity: 18, distance: 9, priority: 1 },
  { x: -18, z: -12.5, y: 2.8, color: 0xc94a4a, intensity: 20, distance: 10, priority: 1 },
  { x: -16, z: -22.5, y: 2.6, color: 0xffc070, intensity: 14, distance: 8, priority: 2 },
  { x: -28, z: -22, y: 2.6, color: 0xd8e2ff, intensity: 10, distance: 7, priority: 3 },
  // Warehouse fluorescents (cool)
  { x: 10, z: -15, y: 2.9, color: 0xcfe0ff, intensity: 16, distance: 13, priority: 1 },
  { x: 22, z: -15, y: 2.9, color: 0xcfe0ff, intensity: 16, distance: 13, priority: 2 },
  { x: 30, z: -22.5, y: 2.6, color: 0xffd9a0, intensity: 10, distance: 7, priority: 2 },
  // Safehouse desk lamp, Ferhat's office, alley, back street
  { x: -28, z: 13, y: 2.4, color: 0xffc27a, intensity: 14, distance: 10, priority: 1 },
  { x: 19, z: 16, y: 2.5, color: 0xffd9a0, intensity: 12, distance: 9, priority: 2 },
  { x: -4, z: -19.5, y: 3.8, color: 0xffa860, intensity: 14, distance: 10, priority: 2 },
  { x: 31, z: 21.5, y: 3.8, color: 0xffa860, intensity: 12, distance: 10, priority: 3 },
];

export const AREAS: AreaDef[] = [
  { name: 'Arka Ofis', x: -28, z: -22, w: 12, d: 8 },
  { name: 'VIP Bölümü', x: -16, z: -22, w: 12, d: 8 },
  { name: 'Gece Kuşu Kulübü', x: -22, z: -12.5, w: 24, d: 11 },
  { name: 'Ara Sokak', x: -4, z: -16, w: 12, d: 20 },
  { name: 'Depo Ofisi', x: 30, z: -22.5, w: 8, d: 7 },
  { name: 'Liman Deposu', x: 18, z: -16.5, w: 32, d: 19 },
  { name: 'Güvenli Ev', x: -26, z: 15, w: 16, d: 14 },
  { name: 'Yılmaz Muhasebe', x: 19, z: 16, w: 14, d: 12 },
  { name: 'Arka Sokak', x: 30, z: 17, w: 12, d: 22 },
  { name: 'Otopark', x: -3, z: 17, w: 26, d: 18 },
  { name: 'Cumhuriyet Caddesi', x: 0, z: 0, w: 72, d: 12 },
];

export function areaAt(x: number, z: number): string {
  for (const a of AREAS) {
    if (Math.abs(x - a.x) <= a.w / 2 && Math.abs(z - a.z) <= a.d / 2) return a.name;
  }
  return 'Cumhuriyet Caddesi';
}

/**
 * Wall segments overlap by the wall thickness at their ends so corners close cleanly.
 * Next to doorways that overlap would narrow the opening, so trim it back to the door edge.
 */
function trimDoorGaps(): void {
  for (const d of DOORS) {
    const half = d.width / 2;
    for (const w of WALLS) {
      if (d.axis === 'x' && Math.abs(w.z - d.z) < 0.01 && w.d <= WALL_T + 0.01) {
        const minX = w.x - w.w / 2;
        const maxX = w.x + w.w / 2;
        const gapMin = d.x - half;
        const gapMax = d.x + half;
        if (maxX > gapMin && maxX < gapMin + WALL_T) {
          const newMax = gapMin;
          w.w = newMax - minX;
          w.x = (minX + newMax) / 2;
        } else if (minX < gapMax && minX > gapMax - WALL_T) {
          const newMin = gapMax;
          w.w = maxX - newMin;
          w.x = (newMin + maxX) / 2;
        }
      } else if (d.axis === 'z' && Math.abs(w.x - d.x) < 0.01 && w.w <= WALL_T + 0.01) {
        const minZ = w.z - w.d / 2;
        const maxZ = w.z + w.d / 2;
        const gapMin = d.z - half;
        const gapMax = d.z + half;
        if (maxZ > gapMin && maxZ < gapMin + WALL_T) {
          w.d = gapMin - minZ;
          w.z = (minZ + gapMin) / 2;
        } else if (minZ < gapMax && minZ > gapMax - WALL_T) {
          w.d = maxZ - gapMax;
          w.z = (gapMax + maxZ) / 2;
        }
      }
    }
  }
}
trimDoorGaps();
