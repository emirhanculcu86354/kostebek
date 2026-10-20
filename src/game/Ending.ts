import type { GameStateData } from './GameTypes';

export interface Ending {
  title: string;
  text: string;
}

/** Derive the epilogue from explicit story flags and final reputation. */
export function computeEnding(s: GameStateData): Ending {
  const f = s.flags;
  const r = s.reputation;
  const submitted = Object.values(s.evidence).filter((e) => e.status === 'submitted').length;
  const parts: string[] = [];
  let title: string;

  if (f['m.exposed'] || (!f['story.right_hand'] && !f['m.banished'] && f['story.finale_done'] && r.suspicion >= 85)) {
    title = 'YANMIŞ KİMLİK';
    parts.push('Murat Kaya bir gecede öldü; Emre Aydın ise zar zor hayatta kaldı.');
    parts.push(submitted >= 3 ? 'Topladığın kanıtlar sayesinde savcılık Karaca ailesine dava açtı. Haydar tutuklandı ama liman hâlâ karanlık.' : 'Elindeki kanıtlar davayı taşımaya yetmedi. Haydar şehir değiştirdi; adın artık her çetenin listesinde.');
  } else if (f['m.banished']) {
    title = 'KAPI DIŞARI';
    parts.push('Haydar seni yaşattı ama içeriye bir daha alınmadın.');
    parts.push(submitted >= 3 ? 'Merkeze ulaştırdığın kanıtlarla birkaç halka çöktü. Selim ise hâlâ Haydar\'ın yanında.' : 'Operasyon askıya alındı. Selim kazandı.');
  } else {
    title = f['story.raid'] ? 'ŞAFAK OPERASYONU' : 'DERİNLERDE';
    parts.push('Selim\'in ihaneti ortaya çıktı ve Haydar\'ın sağ kolu oldun.');
    if (f['story.raid'])
      parts.push(
        submitted >= 4
          ? 'Şafakta yapılan baskında Haydar Karaca ve belediyedeki koruyucusu gözaltına alındı. Dava sağlam.'
          : 'Baskın yapıldı ama kanıtlar zayıftı. Haydar\'ın avukatları birkaç hafta içinde onu dışarı çıkardı.',
      );
    else parts.push('İçeride kalmayı seçtin. Belediyedeki adama giden yol artık açık. Ama her gün biraz daha Murat, biraz daha az Emre oluyorsun.');
  }

  if (f['story.ferhat_hurt']) parts.push('Ferhat\'ın yüzündeki izler hiç geçmedi. Sen de unutmadın.');
  else if (f['story.ferhat_saved']) parts.push('Ferhat başka bir şehirde, başka bir isimle yaşıyor. İfadesi dosyada duruyor.');
  if (f['story.lied_hq']) parts.push('Nermin, sakladığın kanıtları raporuna yazdı. Aranızdaki güven eskisi gibi değil.');
  if (r.integrity >= 65) parts.push('Kimliğini kaybetmeden karanlığa inip çıkmayı başardın.');
  else if (r.integrity <= 30) parts.push('Aynaya baktığında kimin baktığından artık emin değilsin.');

  return { title, text: parts.join(' ') };
}
