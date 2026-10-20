export type SkillBranch = 'combat' | 'stealth' | 'investigation';

export type SkillModifier =
  | 'damage'
  | 'spread'
  | 'reloadTime'
  | 'meleeDamage'
  | 'noise'
  | 'suspicionGain'
  | 'detectionSpeed';

export interface SkillDef {
  id: string;
  branch: SkillBranch;
  name: string;
  description: string;
  cost: number;
  requires?: string;
  modifiers?: Partial<Record<SkillModifier, number>>;
}

export const BRANCH_NAMES: Record<SkillBranch, string> = {
  combat: 'DÖVÜŞ',
  stealth: 'GİZLİLİK',
  investigation: 'SORUŞTURMA',
};

export const SKILLS: SkillDef[] = [
  {
    id: 'combat_handling',
    branch: 'combat',
    name: 'Silah Hakimiyeti',
    description: 'Ateşli silah hasarı %15 artar, saçılma %40 azalır.',
    cost: 1,
    modifiers: { damage: 1.15, spread: 0.6 },
  },
  {
    id: 'combat_reload',
    branch: 'combat',
    name: 'Hızlı Şarjör',
    description: 'Şarjör değiştirme süresi %35 kısalır.',
    cost: 1,
    requires: 'combat_handling',
    modifiers: { reloadTime: 0.65 },
  },
  {
    id: 'combat_melee',
    branch: 'combat',
    name: 'Ağır El',
    description: 'Yakın dövüş hasarı %60 artar.',
    cost: 1,
    modifiers: { meleeDamage: 1.6 },
  },
  {
    id: 'stealth_quiet',
    branch: 'stealth',
    name: 'Sessiz Adım',
    description: 'Koşarken ve ateş ederken çıkardığın ses %45 azalır.',
    cost: 1,
    modifiers: { noise: 0.55 },
  },
  {
    id: 'stealth_calm',
    branch: 'stealth',
    name: 'Soğukkanlılık',
    description: 'Şüphe artışları %30 daha az etkili olur.',
    cost: 1,
    modifiers: { suspicionGain: 0.7 },
  },
  {
    id: 'stealth_shadow',
    branch: 'stealth',
    name: 'Gölge',
    description: 'Muhafızlar seni %40 daha yavaş fark eder.',
    cost: 1,
    requires: 'stealth_quiet',
    modifiers: { detectionSpeed: 0.6 },
  },
  {
    id: 'inv_eye',
    branch: 'investigation',
    name: 'Göz Hafızası',
    description: 'Kanıtları analiz edebilir, belgelerin fotoğrafını çekip aslını yerinde bırakabilirsin.',
    cost: 1,
  },
  {
    id: 'inv_talk',
    branch: 'investigation',
    name: 'İkna',
    description: 'Konuşmalarda ek seçenekler açılır.',
    cost: 1,
  },
  {
    id: 'inv_network',
    branch: 'investigation',
    name: 'Muhbir Ağı',
    description: 'Seçili karakterlerden ek bilgi alırsın ve kanıt konumları haritada işaretlenir.',
    cost: 1,
    requires: 'inv_talk',
  },
];

export const SKILL_BY_ID: Record<string, SkillDef> = Object.fromEntries(SKILLS.map((s) => [s.id, s]));
