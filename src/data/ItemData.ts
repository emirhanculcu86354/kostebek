import type { Condition, Effect } from '../game/GameTypes';

export type ItemCategory = 'weapon' | 'ammo' | 'evidence' | 'mission' | 'medical' | 'equipment';

export interface ItemDef {
  id: string;
  name: string;
  description: string;
  category: ItemCategory;
  maxStack: number;
  /** Mission items cannot be dropped. */
  missionItem?: boolean;
  /** For weapons: weapon definition id. */
  weapon?: string;
  /** For medical: health restored. */
  heal?: number;
  icon: string;
  /** Scripted "Kullan" action from the inventory. */
  use?: { label: string; requires?: Condition; requiresText?: string; effects: Effect[] };
}

export const ITEMS: Record<string, ItemDef> = {
  pistol: {
    id: 'pistol',
    name: '9mm Tabanca',
    description: 'Sivil ruhsatlı görünen, seri numarası kazınmış bir tabanca. Güvenilir ve sessiz değil.',
    category: 'weapon',
    maxStack: 1,
    weapon: 'pistol',
    icon: '🔫',
  },
  shotgun: {
    id: 'shotgun',
    name: 'Pompalı Tüfek',
    description: 'Kısa namlulu pompalı. Yakın mesafede yıkıcı, uzakta etkisiz.',
    category: 'weapon',
    maxStack: 1,
    weapon: 'shotgun',
    icon: '💥',
  },
  ammo_9mm: {
    id: 'ammo_9mm',
    name: '9mm Mermi',
    description: 'Tabanca için yedek mermi.',
    category: 'ammo',
    maxStack: 120,
    icon: '▮',
  },
  ammo_12g: {
    id: 'ammo_12g',
    name: '12 Kalibre Fişek',
    description: 'Pompalı tüfek için fişek.',
    category: 'ammo',
    maxStack: 40,
    icon: '▬',
  },
  medkit: {
    id: 'medkit',
    name: 'İlk Yardım Kiti',
    description: 'Sargı bezi, dezenfektan ve ağrı kesici. 45 sağlık yeniler.',
    category: 'medical',
    maxStack: 5,
    heal: 45,
    icon: '✚',
  },
  camera: {
    id: 'camera',
    name: 'Mini Kamera',
    description: 'Düğme boyutunda kamera. Belgeleri iz bırakmadan fotoğraflamanı sağlar.',
    category: 'equipment',
    maxStack: 1,
    icon: '◉',
  },
  package: {
    id: 'package',
    name: 'Mühürlü Paket',
    description: 'Tekin\'in teslim etmeni istediği paket. Ağır ve mühürlü.',
    category: 'mission',
    maxStack: 1,
    missionItem: true,
    icon: '▣',
    use: {
      label: 'Gizlice aç ve fotoğrafla',
      requires: { all: [{ hasItem: 'camera' }, { notFlag: 'story.package_opened' }] },
      requiresText: 'Kamera gerekli ya da paket zaten açıldı.',
      effects: [
        { type: 'evidence', id: 'ev_package_photo', action: 'collect' },
        { type: 'flag', flag: 'story.package_opened' },
        { type: 'notify', text: 'Kanıt: Paketin Fotoğrafı — mühür artık gevşek.', tone: 'good' },
      ],
    },
  },
  warehouse_key: {
    id: 'warehouse_key',
    name: 'Depo Ofisi Anahtarı',
    description: 'Liman deposunun ofis kapısını açar.',
    category: 'mission',
    maxStack: 1,
    missionItem: true,
    icon: '⚿',
  },
  ledger: {
    id: 'ledger',
    name: 'Kayıp Defter',
    description: 'Karaca ailesinin el yazısıyla tutulmuş hesap defteri. Ödemeler, isimler, tarihler.',
    category: 'evidence',
    maxStack: 1,
    missionItem: true,
    icon: '📒',
  },
};

export interface WeaponDef {
  id: string;
  name: string;
  kind: 'melee' | 'firearm';
  damage: number;
  /** Seconds between attacks. */
  cooldown: number;
  magazine: number;
  ammoItem: string | null;
  reloadTime: number;
  range: number;
  /** Spread in radians at rest. */
  spread: number;
  pellets: number;
  /** Noise radius in world units heard by enemies. */
  noise: number;
}

export const WEAPONS: Record<string, WeaponDef> = {
  fists: {
    id: 'fists',
    name: 'Yumruk',
    kind: 'melee',
    damage: 22,
    cooldown: 0.5,
    magazine: 0,
    ammoItem: null,
    reloadTime: 0,
    range: 1.7,
    spread: 0,
    pellets: 1,
    noise: 3,
  },
  pistol: {
    id: 'pistol',
    name: '9mm Tabanca',
    kind: 'firearm',
    damage: 26,
    cooldown: 0.26,
    magazine: 12,
    ammoItem: 'ammo_9mm',
    reloadTime: 1.35,
    range: 20,
    spread: 0.06,
    pellets: 1,
    noise: 18,
  },
  shotgun: {
    id: 'shotgun',
    name: 'Pompalı Tüfek',
    kind: 'firearm',
    damage: 14,
    cooldown: 0.85,
    magazine: 5,
    ammoItem: 'ammo_12g',
    reloadTime: 2.1,
    range: 10,
    spread: 0.22,
    pellets: 6,
    noise: 24,
  },
};
