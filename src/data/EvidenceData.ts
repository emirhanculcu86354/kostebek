export type EvidenceKind = 'ledger' | 'phone' | 'photo' | 'document' | 'recording' | 'witness' | 'footage';

export interface EvidenceDef {
  id: string;
  name: string;
  kind: EvidenceKind;
  description: string;
  /** Extra interpretation revealed by the "Göz Hafızası" skill. */
  analysis: string;
  mission: string;
  related: string[];
  /** 0..1 — how much weight it carries in court. */
  reliability: number;
  /** Police trust awarded when submitted to headquarters. */
  policeValue: number;
}

export const KIND_LABEL: Record<EvidenceKind, string> = {
  ledger: 'Defter',
  phone: 'Telefon kaydı',
  photo: 'Fotoğraf',
  document: 'Belge',
  recording: 'Ses kaydı',
  witness: 'Tanık ifadesi',
  footage: 'Güvenlik kaydı',
};

export const EVIDENCE: Record<string, EvidenceDef> = {
  ev_package_photo: {
    id: 'ev_package_photo',
    name: 'Paketin Fotoğrafı',
    kind: 'photo',
    description: 'Mühürlü paketin içi: deste deste nakit ve kutusu açılmamış altı kontörlü telefon.',
    analysis: 'Banknotların bantlarında aynı bankanın şube kodu var. Para tek bir kaynaktan çıkıyor.',
    mission: 'm1',
    related: ['Tekin', 'Selim Doğan'],
    reliability: 0.4,
    policeValue: 5,
  },
  ev_rumor: {
    id: 'ev_rumor',
    name: 'Barmenin Söylentisi',
    kind: 'witness',
    description: 'Rıza\'ya göre arka masada her perşembe "liman işleri" konuşuluyor ve Selim son zamanlarda geceleri ortadan kayboluyor.',
    analysis: 'Rıza Selim\'den korkuyor ama ondan nefret ediyor. Söyledikleri doğrulanırsa değerli.',
    mission: 'm2',
    related: ['Rıza', 'Selim Doğan', 'Haydar Karaca'],
    reliability: 0.3,
    policeValue: 4,
  },
  ev_phone_records: {
    id: 'ev_phone_records',
    name: 'Telefon Kayıtları',
    kind: 'phone',
    description: 'Arka ofisteki dizüstünden alınan arama dökümü. Liman şirketine ve bir belediye hattına düzenli aramalar.',
    analysis: 'Belediye hattı imar müdürlüğüne kayıtlı. Örgütün resmi bir koruyucusu var.',
    mission: 'm2',
    related: ['Haydar Karaca', 'Belediye'],
    reliability: 0.7,
    policeValue: 10,
  },
  ev_ledger: {
    id: 'ev_ledger',
    name: 'Kayıp Defter',
    kind: 'ledger',
    description: 'Karaca ailesinin hesap defteri. Haraç ödemeleri, liman rüşvetleri ve isimler.',
    analysis: 'Son sayfalardaki el yazısı farklı: biri defterden düzenli olarak para çekmiş ve "S." diye imzalamış.',
    mission: 'm3',
    related: ['Haydar Karaca', 'Selim Doğan', 'Sarıkaya'],
    reliability: 0.95,
    policeValue: 20,
  },
  ev_ledger_copy: {
    id: 'ev_ledger_copy',
    name: 'Defterin Fotoğrafları',
    kind: 'photo',
    description: 'Defterin kritik sayfalarının net fotoğrafları. Aslı örgüte iade edildi.',
    analysis: 'Fotoğraflar mahkemede tek başına zayıf ama defterin varlığını kanıtlıyor.',
    mission: 'm3',
    related: ['Haydar Karaca'],
    reliability: 0.6,
    policeValue: 12,
  },
  ev_witness_ferhat: {
    id: 'ev_witness_ferhat',
    name: 'Ferhat\'ın İfadesi',
    kind: 'witness',
    description: 'Muhasebeci Ferhat Yılmaz: "Kasadan parayı ben almadım. Selim aldı, beni günah keçisi yaptı."',
    analysis: 'Ferhat\'ın verdiği tarihler defterdeki "S." imzalı çekimlerle örtüşüyor.',
    mission: 'm4',
    related: ['Ferhat Yılmaz', 'Selim Doğan'],
    reliability: 0.75,
    policeValue: 14,
  },
  ev_frame_note: {
    id: 'ev_frame_note',
    name: 'Sahte İhbar Notu',
    kind: 'document',
    description: 'Selim\'in masasında, senin adınla hazırlanmış sahte bir polis ihbar notu.',
    analysis: 'Not, Selim\'in kullandığı yazıcıdan çıkmış. Seni köstebek gibi göstermeye hazırlanıyor.',
    mission: 'm5',
    related: ['Selim Doğan'],
    reliability: 0.6,
    policeValue: 6,
  },
  ev_footage: {
    id: 'ev_footage',
    name: 'Güvenlik Kaydı',
    kind: 'footage',
    description: 'Depo kamerası: Selim gece yarısı Sarıkaya\'nın adamlarına bir çanta teslim ediyor.',
    analysis: 'Zaman damgası defterin kaybolduğu geceyle aynı. Defteri rakiplere satan Selim.',
    mission: 'm5',
    related: ['Selim Doğan', 'Sarıkaya'],
    reliability: 0.85,
    policeValue: 15,
  },
};
