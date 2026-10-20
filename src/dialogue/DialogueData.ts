import type { Effect, EvidenceAction, RepStat } from '../game/GameTypes';
import type { DialogueDef, Speaker } from './DialogueTypes';

export const SPEAKERS: Record<string, Speaker> = {
  murat: { id: 'murat', name: 'Murat Kaya', role: 'Gizli kimlik', color: '#D99A42' },
  haydar: { id: 'haydar', name: 'Haydar Karaca', role: 'Karaca ailesinin reisi', color: '#C94A4A' },
  selim: { id: 'selim', name: 'Selim Doğan', role: 'Haydar\'ın sağ kolu', color: '#C07A4A' },
  nermin: { id: 'nermin', name: 'Nermin Aksoy', role: 'Emniyet irtibatı', color: '#7FA8D6' },
  tekin: { id: 'tekin', name: 'Tekin', role: 'Sokak aracısı', color: '#A3ADB9' },
  riza: { id: 'riza', name: 'Rıza', role: 'Gece Kuşu barmeni', color: '#C9A35A' },
  ferhat: { id: 'ferhat', name: 'Ferhat Yılmaz', role: 'Muhasebeci', color: '#8FB8A0' },
  bora: { id: 'bora', name: 'Bora', role: 'Selim\'in adamı', color: '#9A6A6A' },
  kapici: { id: 'kapici', name: 'Fedai', role: 'VIP kapısı', color: '#8A8F96' },
  scene: { id: 'scene', name: '', role: '', color: '#A3ADB9' },
};

const rep = (stat: RepStat, delta: number, reason?: string): Effect => ({ type: 'rep', stat, delta, reason });
const flag = (f: string, value = true): Effect => ({ type: 'flag', flag: f, value });
const ev = (id: string, action: EvidenceAction): Effect => ({ type: 'evidence', id, action });
const evt = (name: string, arg?: string): Effect => ({ type: 'event', name, arg });
const give = (item: string, count = 1): Effect => ({ type: 'giveItem', item, count });
const take = (item: string, count = 1): Effect => ({ type: 'takeItem', item, count });

const D: DialogueDef[] = [
  // ───────────────────────── MISSION 1 ─────────────────────────
  {
    id: 'nermin_m1',
    start: 'n1',
    nodes: {
      n1: {
        id: 'n1',
        speaker: 'nermin',
        text: 'Geç kaldın, Emre. Pardon — Murat. Bundan sonra kendi adını düşünmek bile lüks.',
        choices: [
          { text: 'Murat Kaya. Kırk sekiz saattir o adamım.', next: 'n2' },
          { text: 'Gerçek adımı unutturmayın da yeter.', next: 'n2', effects: [rep('integrity', 2)] },
        ],
      },
      n2: {
        id: 'n2',
        speaker: 'nermin',
        text: 'Tekin dün gece seni Karaca\'ların adamlarına önermiş. Ara sokakta bekliyor. Küçük bir teslimat verecekler. Bu bir sınav.',
        choices: [
          { text: 'Karaca\'lar hakkında yeni ne var?', next: 'n3' },
          { text: 'Hazırım. Ekipman?', next: 'n4' },
        ],
      },
      n3: {
        id: 'n3',
        speaker: 'nermin',
        text: 'Haydar Karaca on beş yıldır limanı yönetiyor ama elimizde tek imzası yok. Sağ kolu Selim Doğan kimseye güvenmez. Sana da güvenmeyecek.',
        next: 'n4',
      },
      n4: {
        id: 'n4',
        speaker: 'nermin',
        text: 'Şu düğme kamera. Gördüğün her belgeyi çek. Yakalanırsan seni tanımam. Yedek şarjör de koydum; umarım gerekmez.',
        effects: [give('camera'), give('ammo_9mm', 12)],
        choices: [
          { text: 'Merak etme, kimse beni yakalayamaz.', next: 'n5a' },
          { text: 'İşler sarpa sararsa?', next: 'n5b' },
          {
            text: 'Selim hakkında bildiğin her şeyi anlat.',
            tag: '[İkna]',
            conditions: { skill: 'inv_talk' },
            lockedLabel: 'İkna becerisi gerekli',
            next: 'n5c',
          },
        ],
      },
      n5a: { id: 'n5a', speaker: 'nermin', text: 'Kendine fazla güvenen ajanları çok gömdük. Ara sokak, Tekin. Git.' },
      n5b: {
        id: 'n5b',
        speaker: 'nermin',
        text: 'O zaman buraya gel. Bu kapı sana hep açık. Ve unutma: sivillere zarar gelirse operasyon biter.',
        effects: [rep('integrity', 3)],
      },
      n5c: {
        id: 'n5c',
        speaker: 'nermin',
        text: 'İki yıl önce bir muhbirimiz kayboldu. Son görüldüğü yer Selim\'in arabası. Ona yalan söylerken gözünü kaçırma.',
        effects: [flag('story.selim_warned')],
      },
    },
  },
  {
    id: 'tekin_m1',
    start: 't1',
    nodes: {
      t1: {
        id: 't1',
        speaker: 'tekin',
        text: 'Murat sen misin? Daha uzun boylu sanıyordum. Neyse. Patronun adamları seni bir kere sınar. Bir kere.',
        choices: [
          { text: 'Uzun boylular erken ölüyor.', next: 't2a', effects: [rep('mafia', 3)] },
          { text: 'Ne iş varsa yaparım, Tekin.', next: 't2b', effects: [rep('mafia', 1)] },
          { text: 'Önce ne kazanacağımı söyle.', next: 't2c', effects: [rep('mafia', 2)] },
        ],
      },
      t2a: { id: 't2a', speaker: 'tekin', text: 'Ha! İyiymiş. Selim böyle laflardan hoşlanır. Ya da hoşlanmaz, belli olmaz.', next: 't3' },
      t2b: { id: 't2b', speaker: 'tekin', text: 'Herkes öyle der. Bakalım.', next: 't3' },
      t2c: { id: 't2c', speaker: 'tekin', text: 'Paranı Selim söyler, ben değil. Ama bu işi temiz yaparsan masada yerin olur.', next: 't3' },
      t3: {
        id: 't3',
        speaker: 'tekin',
        text: 'Otoparktaki beyaz minibüsün arkasında bir paket var. Al, Gece Kuşu\'nun arka kapısına götür. Selim orada. Paketi açma. Ciddiyim.',
        choices: [
          { text: 'Anlaşıldı.' },
          { text: 'İçinde ne var?', next: 't4', effects: [rep('suspicion', 3, 'Fazla soru')] },
        ],
      },
      t4: { id: 't4', speaker: 'tekin', text: 'Bilmemen gereken bir şey. Bu soruyu Selim\'e sakın sorma. Hadi, yürü.' },
    },
  },
  {
    id: 'selim_m1_wait',
    start: 'w1',
    nodes: {
      w1: { id: 'w1', speaker: 'selim', text: 'Elin boş. Paketi getirmeden kapımı çalma.' },
    },
  },
  {
    id: 'selim_m1',
    start: 's1',
    nodes: {
      s1: {
        id: 's1',
        speaker: 'selim',
        text: 'Tekin\'in yeni köpeği. Paket?',
        choices: [
          {
            text: 'Yolda Sarıkaya\'nın iki adamı vardı. Paketin peşindeydiler.',
            conditions: { counter: 'm.kill.ambush', min: 2 },
            next: 's1b',
            effects: [rep('mafia', 4)],
          },
          { text: 'Burada. Mühür sağlam.', conditions: { notFlag: 'story.package_opened' }, next: 's2', effects: [take('package'), flag('m.delivered'), rep('mafia', 8, 'Temiz teslimat')] },
          { text: 'Burada.', conditions: { flag: 'story.package_opened' }, next: 's2b', effects: [take('package'), flag('m.delivered')] },
        ],
      },
      s1b: {
        id: 's1b',
        speaker: 'selim',
        text: 'Sarıkaya. Kokusunu her yerden alırım. Demek ki birileri konuşuyor. Neyse... paket?',
        choices: [
          { text: 'Burada. Mühür sağlam.', conditions: { notFlag: 'story.package_opened' }, next: 's2', effects: [take('package'), flag('m.delivered'), rep('mafia', 8, 'Temiz teslimat')] },
          { text: 'Burada.', conditions: { flag: 'story.package_opened' }, next: 's2b', effects: [take('package'), flag('m.delivered')] },
        ],
      },
      s2: { id: 's2', speaker: 'selim', text: 'Mühür sağlam. Tekin ilk defa doğru adam getirmiş olabilir.', next: 's3' },
      s2b: {
        id: 's2b',
        speaker: 'selim',
        text: 'Mührün kenarı kalkık. Paketi açtın mı, Murat?',
        choices: [
          { text: 'Yolda düştü. Sadece kontrol ettim.', next: 's2c', effects: [rep('suspicion', 8, 'Açılmış paket')] },
          {
            text: 'Sarıkaya\'nın adamları kurcalamış olmalı. Ben aldığımda böyleydi.',
            tag: '[İkna]',
            conditions: { skill: 'inv_talk' },
            lockedLabel: 'İkna becerisi gerekli',
            next: 's3',
            effects: [rep('suspicion', 1), rep('mafia', 4)],
          },
          { text: 'Açtım. Ne taşıdığımı bilmek isterim.', next: 's2d', effects: [rep('suspicion', 4), rep('mafia', 2)] },
        ],
      },
      s2c: { id: 's2c', speaker: 'selim', text: 'Düştü. Tabii. Bir dahakine elini daha sıkı tut.', next: 's3' },
      s2d: { id: 's2d', speaker: 'selim', text: 'Dürüst bir meraklı. Bu şehirde ender bulunur. Genelde de kısa yaşar.', next: 's3' },
      s3: {
        id: 's3',
        speaker: 'selim',
        text: 'Yarın gece kulübe gel. Ön kapıdan. Patron yeni yüzleri görmek ister. Ve Murat — burada herkes birini izler. Sen de izleniyorsun.',
        choices: [{ text: 'Anladım.' }, { text: 'Ben de herkesi izlerim.', effects: [rep('mafia', 2), rep('suspicion', 1)] }],
      },
    },
  },

  // ───────────────────────── MISSION 2 ─────────────────────────
  {
    id: 'riza_m2',
    start: 'r1',
    nodes: {
      r1: {
        id: 'r1',
        speaker: 'riza',
        text: 'Yeni yüz. Selim\'in adamı mısın, yoksa sadece susamış biri mi?',
        choices: [
          { text: 'Selim\'in. Patronla görüşeceğim.', next: 'r2' },
          { text: 'Susamış biri. Ne önerirsin?', next: 'r2b' },
        ],
      },
      r2: { id: 'r2', speaker: 'riza', text: 'Patron arka masada. Çağrılmadan kimse geçemez. Rakı mı, su mu?', next: 'r3' },
      r2b: { id: 'r2b', speaker: 'riza', text: 'Bu saatte burada susamış adam olmaz. Herkes bir şey ister.', next: 'r3' },
      r3: {
        id: 'r3',
        speaker: 'riza',
        text: 'Söyle bakalım. Ne istiyorsun?',
        choices: [
          { text: 'Burada kim kime bakar? Kuralları öğrenmem lazım.', next: 'r4' },
          {
            text: 'Selim\'den hoşlanmıyorsun. Yüzünden okunuyor.',
            tag: '[İkna]',
            conditions: { skill: 'inv_talk' },
            lockedLabel: 'İkna becerisi gerekli',
            next: 'r5',
          },
          { text: 'Doğru bilgi için iyi bahşiş bırakırım.', next: 'r6', effects: [rep('integrity', -1)] },
          { text: 'Konuşmazsan Selim\'e seni sorarım.', next: 'r7', effects: [rep('mafia', 2), rep('integrity', -4), flag('story.riza_hostile')] },
        ],
      },
      r4: {
        id: 'r4',
        speaker: 'riza',
        text: 'Haydar Bey her şeyi arka masadan yönetir. Selim onun gözü kulağı. Arka ofise kimse girmez: telefonlar, dizüstü, hepsi orada. Bunu sana ben söylemedim.',
        effects: [flag('m.knows_office')],
        next: 'r8',
      },
      r5: {
        id: 'r5',
        speaker: 'riza',
        text: '...Selim son zamanlarda geceleri ortadan kayboluyor. Limana gidiyormuş. Haydar Bey bilmiyor. Bunu benden duymadın.',
        effects: [ev('ev_rumor', 'collect'), flag('story.riza_trust')],
        next: 'r8',
      },
      r6: {
        id: 'r6',
        speaker: 'riza',
        text: 'Paran Selim\'in öfkesinden az korkutucu. Ama tamam: arka ofisteki dizüstü her aramayı tutar. Bekçi düzenli tur atar, zamanlamana dikkat et.',
        effects: [flag('m.knows_office'), ev('ev_rumor', 'collect')],
        next: 'r8',
      },
      r7: { id: 'r7', speaker: 'riza', text: 'Git Selim\'e sor o zaman. Benden sana bir şey çıkmaz. Kapıdakine söyledim, seni bekliyorlar.' },
      r8: {
        id: 'r8',
        speaker: 'riza',
        text: 'Patronla görüşmek istiyorsan kapıdakine benim gönderdiğimi söyle.',
        choices: [
          {
            text: 'Liman işleri hangi gece konuşuluyor?',
            tag: '[Muhbir Ağı]',
            conditions: { skill: 'inv_network' },
            lockedLabel: 'Muhbir Ağı gerekli',
            next: 'r9',
          },
          { text: 'Sağ ol, Rıza.' },
        ],
      },
      r9: {
        id: 'r9',
        speaker: 'riza',
        text: 'Perşembe geceleri. Bir de belediyeden biri gelir. Takım elbiseli, hiç içmez, hep aynı masaya oturur.',
        effects: [flag('story.knows_official'), rep('police', 3, 'Belediye bağlantısı')],
      },
    },
  },
  {
    id: 'kapici_m2',
    start: 'k1',
    startIf: [{ when: { flag: 'm.dlg.riza_m2' }, node: 'k2' }],
    nodes: {
      k1: { id: 'k1', speaker: 'kapici', text: 'Patron seni çağırmadı. Önce bara uğra, sonra konuşuruz.' },
      k2: { id: 'k2', speaker: 'kapici', text: 'Rıza haber verdi. Geç. Elini silahından uzak tut.' },
    },
  },
  {
    id: 'haydar_m2',
    start: 'h1',
    nodes: {
      h1: {
        id: 'h1',
        speaker: 'haydar',
        text: 'Otur. Tekin senden bahsetti. Selim de. Biri iyi şeyler söyledi, biri söylemedi. Hangisinin hangisi olduğunu tahmin et.',
        choices: [
          { text: 'Selim kimse hakkında iyi şey söylemez.', next: 'h2a', effects: [rep('mafia', 3)] },
          { text: 'Tahmin etmem. Sonuçlarıma bakarsınız.', next: 'h2b', effects: [rep('mafia', 5)] },
          { text: 'Ben sadece iş arıyorum, Haydar Bey.', next: 'h2c' },
        ],
      },
      h2a: { id: 'h2a', speaker: 'selim', text: 'Dilin uzun. Kısaltmak kolay.', next: 'h2a2' },
      h2a2: { id: 'h2a2', speaker: 'haydar', text: 'Sakin ol, Selim. Adam doğruyu söyledi.', next: 'h3' },
      h2b: { id: 'h2b', speaker: 'haydar', text: 'Sonuç. Güzel kelime. Bu şehirde sonuç görmek isteyen az kişi kaldı.', next: 'h3' },
      h2c: { id: 'h2c', speaker: 'haydar', text: 'Herkes iş arar. Ben adam ararım.', next: 'h3' },
      h3: {
        id: 'h3',
        speaker: 'selim',
        text: 'Murat Kaya. Kartal\'dan gelmişsin. Kartal\'da kimi tanırsın?',
        choices: [
          { text: 'Kimseyi. Yalnız çalışırım.', next: 'h4a', effects: [rep('suspicion', 5, 'Belirsiz geçmiş')] },
          { text: 'Ayhan Usta\'nın tamirhanesinde çalıştım. Kapanınca açıkta kaldım.', next: 'h4b', effects: [rep('suspicion', -3, 'Tutarlı hikâye'), flag('story.cover_ayhan')] },
          {
            text: 'Kartal\'ı bırak. Paketini kim sağ salim getirdi, ona bak.',
            tag: '[İkna]',
            conditions: { skill: 'inv_talk' },
            lockedLabel: 'İkna becerisi gerekli',
            next: 'h4c',
            effects: [rep('mafia', 4), rep('suspicion', -2)],
          },
          {
            text: 'Telefon kayıtlarında belediyeyle konuştuğunuzu gördüm. Ben de konuşmayı bilirim.',
            tag: '[Kanıt]',
            conditions: { evidenceHeld: 'ev_phone_records' },
            next: 'h4d',
            effects: [rep('suspicion', 12, 'Fazla bilgili'), rep('mafia', 3)],
          },
        ],
      },
      h4a: { id: 'h4a', speaker: 'selim', text: 'Yalnız çalışan adam ya polistir ya ölü.', next: 'h4a2' },
      h4a2: { id: 'h4a2', speaker: 'haydar', text: 'Selim. Yeter.', next: 'h5' },
      h4b: { id: 'h4b', speaker: 'selim', text: 'Ayhan Usta... Sorarım.', next: 'h5' },
      h4c: { id: 'h4c', speaker: 'haydar', text: 'Haklı, Selim. Adam işini yaptı. Bırak.', next: 'h5' },
      h4d: { id: 'h4d', speaker: 'haydar', text: '(uzun bir sessizlik) Arka ofise girmişsin. Cesaret mi, aptallık mı, henüz bilmiyorum. Bir daha izinsiz girme.', next: 'h5' },
      h5: {
        id: 'h5',
        speaker: 'haydar',
        text: 'Bir defterim kayboldu. Hesaplarım. Sarıkaya\'nın adamları limandaki depoya kaçırmış. O defteri geri istiyorum. Sen gideceksin.',
        choices: [
          { text: 'Defter yarın masanızda olur.', next: 'h6', effects: [rep('mafia', 5), flag('story.accepted_ledger')] },
          { text: 'Orada kaç adam var?', next: 'h5b' },
        ],
      },
      h5b: {
        id: 'h5b',
        speaker: 'haydar',
        text: 'Yeterince. Korkuyorsan şimdi söyle.',
        choices: [
          { text: 'Korkmuyorum.', next: 'h6', effects: [rep('mafia', 3)] },
          { text: 'Korkmayan adam aptaldır. Ama giderim.', next: 'h6', effects: [rep('mafia', 4)] },
        ],
      },
      h6: { id: 'h6', speaker: 'haydar', text: 'Güzel. Ve Murat: defteri açma. Okuma. Sadece getir.', effects: [flag('story.met_haydar')] },
    },
  },

  // ───────────────────────── MISSION 4 ─────────────────────────
  {
    id: 'selim_m4',
    start: 's0',
    startIf: [
      { when: { flag: 'story.ledger_police' }, node: 's0p' },
      { when: { flag: 'story.ledger_kept' }, node: 's0k' },
    ],
    nodes: {
      s0: { id: 's0', speaker: 'selim', text: 'Defter için Haydar Bey memnun. Ama memnuniyet bir gün sürer.', next: 's1' },
      s0p: {
        id: 's0p',
        speaker: 'selim',
        text: 'Depoda cesetler var ama defter yok. Haydar Bey sana hâlâ inanıyor. Ben inanmıyorum.',
        next: 's1',
      },
      s0k: { id: 's0k', speaker: 'selim', text: 'Defteri hâlâ teslim etmedin. Haydar Bey sabırlı adamdır. Ben değilim.', next: 's1' },
      s1: {
        id: 's1',
        speaker: 'selim',
        text: 'Muhasebecimiz Ferhat kasadan para çalmış. Bürosu karşıda. Git, ona bir ders ver. Bora seni izleyecek.',
        choices: [
          { text: 'Ne kadar sert?', next: 's2' },
          {
            text: 'Ne kadar çalmış? Rakamı bilmek isterim.',
            tag: '[İkna]',
            conditions: { skill: 'inv_talk' },
            lockedLabel: 'İkna becerisi gerekli',
            next: 's3',
          },
          { text: 'Bu iş bana göre değil.', next: 's4', effects: [rep('suspicion', 8, 'İsteksizlik')] },
          { text: 'Hallederim.', effects: [rep('mafia', 2)] },
        ],
      },
      s2: { id: 's2', speaker: 'selim', text: 'Unutmayacağı kadar. Ama öldürme. Ölü muhasebeci hesap tutamaz.' },
      s3: {
        id: 's3',
        speaker: 'selim',
        text: 'Kırk bin. Fazla merak ediyorsun, Murat.',
        effects: [flag('story.asked_amount'), rep('suspicion', 2)],
      },
      s4: { id: 's4', speaker: 'selim', text: 'Sana göre olan işi ben belirlerim. Git.' },
    },
  },
  {
    id: 'ferhat_m4',
    start: 'f1',
    nodes: {
      f1: {
        id: 'f1',
        speaker: 'ferhat',
        text: 'Kimsin sen? Selim mi gönderdi? Yemin ederim o parayı ben almadım!',
        choices: [
          { text: 'Sakin ol. Anlat.', next: 'f2' },
          { text: 'Selim\'in selamı var.', next: 'f2', effects: [rep('integrity', -2)] },
        ],
      },
      f2: {
        id: 'f2',
        speaker: 'ferhat',
        text: 'Kasadan altmış bin eksik. Defterlere ben bakıyorum, kimin aldığını biliyorum. Selim aldı! Ben fark ettim diye beni günah keçisi yapıyor.',
        choices: [
          {
            text: 'Selim bana kırk bin dedi.',
            tag: '[Bilgi]',
            conditions: { flag: 'story.asked_amount' },
            next: 'f2c',
          },
          { text: 'Bunu kanıtlayabilir misin?', next: 'f3' },
        ],
      },
      f2c: {
        id: 'f2c',
        speaker: 'ferhat',
        text: 'Kırk mı? Görüyor musun! Rakamı bile tutturamıyor, çünkü yirmisini kendi cebine koydu.',
        effects: [flag('story.selim_lie')],
        next: 'f3',
      },
      f3: {
        id: 'f3',
        speaker: 'ferhat',
        text: 'Tarihler, rakamlar, hepsi aklımda. Ama kim dinler? ...Ne yapacaksın bana?',
        choices: [
          {
            text: 'Emir emirdir, Ferhat.',
            next: 'fc',
            effects: [flag('m.path.comply'), rep('mafia', 15, 'Emre itaat'), rep('police', -15, 'Sivile şiddet'), rep('integrity', -20), flag('story.ferhat_hurt')],
          },
          {
            text: 'Dinle. Burada bir gösteri yapacağız, sonra arka kapıdan çıkacaksın.',
            next: 'ff',
            effects: [flag('m.path.fake'), evt('follow', 'ferhat'), rep('integrity', 8)],
          },
          {
            text: 'Kimse sana dokunmayacak. Arkamda dur.',
            next: 'fp',
            effects: [flag('m.path.protect'), evt('follow', 'ferhat'), rep('suspicion', 25, 'Açık itaatsizlik'), rep('mafia', -15), rep('integrity', 12)],
          },
        ],
      },
      fc: {
        id: 'fc',
        speaker: 'scene',
        text: 'Ferhat\'ı duvara ittin. Birkaç darbe, bastırılmış bir inilti. Pencerenin ardında Bora\'nın sigarası parladı. Yere çöken adam bir daha başını kaldırmadı.',
        effects: [evt('injure', 'ferhat')],
      },
      ff: {
        id: 'ff',
        speaker: 'ferhat',
        text: 'Arka kapı mı? Bora dışarıda! Görürse ikimizi de... Peki. Peki. Sen ne zaman dersen.',
        next: 'ff2',
      },
      ff2: {
        id: 'ff2',
        speaker: 'scene',
        text: 'Masayı devirdin, sandalyeyi duvara fırlattın. Dışarıdan bakan biri için yeterince gürültülü. Şimdi Ferhat\'ı Bora görmeden arka sokağın sonuna götür.',
      },
      fp: {
        id: 'fp',
        speaker: 'ferhat',
        text: 'Ne? Sen... sen kimsin?',
        next: 'fp2',
      },
      fp2: { id: 'fp2', speaker: 'scene', text: 'Kapı sertçe açıldı. Bora ve Kara Cemal içeri daldı. Silahlar çekilmişti.', effects: [evt('hostile', 'watchers')] },
    },
  },
  {
    id: 'ferhat_m4_after',
    start: 'a1',
    nodes: {
      a1: {
        id: 'a1',
        speaker: 'ferhat',
        text: 'Kurtardın beni. Al, şu kâğıtlara her şeyi yazdım. Tarihler, rakamlar, Selim\'in imzaları. Ben bu şehirden gidiyorum.',
        effects: [ev('ev_witness_ferhat', 'collect'), flag('story.ferhat_saved'), rep('police', 5)],
        choices: [{ text: 'Arkana bakmadan git.', effects: [evt('hide', 'ferhat')] }],
      },
    },
  },
  {
    id: 'bora_m4',
    start: 'b0',
    startIf: [
      { when: { flag: 'm.path.comply' }, node: 'bc' },
      { when: { flag: 'm.path.fake' }, node: 'bf' },
    ],
    nodes: {
      b0: { id: 'b0', speaker: 'bora', text: 'İşini bitirince gel. Selim beni sana bekçi koydu, sohbet için değil.' },
      bc: {
        id: 'bc',
        speaker: 'bora',
        text: 'Gördüm. Fena değil. Selim\'e anlatırım.',
        effects: [rep('mafia', 5), flag('m.reported')],
      },
      bf: {
        id: 'bf',
        speaker: 'bora',
        text: 'Muhasebeci nerede? İçerisi darmadağın ama kimse yok.',
        choices: [
          { text: 'Dersini aldı, şehri terk ediyor. Bir daha görmezsin.', effects: [rep('mafia', 6), rep('suspicion', 3), flag('m.reported')] },
          {
            text: 'Kaçtı ama borcunu ödeyecek. Kasaya yarın para gelecek, garanti ederim.',
            tag: '[İkna]',
            conditions: { skill: 'inv_talk' },
            lockedLabel: 'İkna becerisi gerekli',
            effects: [rep('mafia', 8), flag('m.reported')],
          },
          { text: 'Senin işin değil, Bora.', effects: [rep('suspicion', 8, 'Bora kuşkulandı'), flag('m.reported')] },
        ],
      },
    },
  },

  // ───────────────────────── MISSION 5 ─────────────────────────
  {
    id: 'haydar_m5',
    start: 'h1',
    nodes: {
      h1: {
        id: 'h1',
        speaker: 'haydar',
        text: 'Kapıyı kapat. Biri polisle konuşuyor, Murat. Dün gece liman baskını haberi geldi. Biri bizi satıyor.',
        next: 'h2',
      },
      h2: { id: 'h2', speaker: 'selim', text: 'Kimin sattığını biliyorum. (Gözlerini senden ayırmıyor.)', next: 'h3' },
      h3: {
        id: 'h3',
        speaker: 'haydar',
        text: 'Selim\'in fikri belli. Benimki değil. Sabaha kadar bana bir isim getir. Kanıtıyla. Getiremezsen Selim\'in fikri benim fikrim olur.',
        choices: [
          { text: 'İsmi getireceğim.', effects: [rep('mafia', 2)] },
          { text: 'Selim çok emin görünüyor. Belki de fazla emin.', effects: [rep('mafia', 2), rep('suspicion', 2), flag('story.challenged_selim')] },
          {
            text: 'Defteri polis aldıysa, depoya benden önce Sarıkaya\'nın adamları girmişti. Düşünün.',
            conditions: { flag: 'story.ledger_police' },
            effects: [rep('suspicion', -6, 'Mantıklı savunma')],
          },
        ],
      },
    },
  },
  {
    id: 'riza_m5',
    start: 'r1',
    startIf: [{ when: { flag: 'story.riza_hostile' }, node: 'r0' }],
    nodes: {
      r0: {
        id: 'r0',
        speaker: 'riza',
        text: 'Sana söyleyecek bir şeyim yok. ...Depo kameralarına bak. Her şeyi kaydeder. Şimdi git.',
        effects: [flag('m.lead_footage')],
      },
      r1: {
        id: 'r1',
        speaker: 'riza',
        text: 'Bu gece herkes birbirine bakıyor. Selim seni gösteriyor, biliyorsun.',
        next: 'r2',
      },
      r2: {
        id: 'r2',
        speaker: 'riza',
        text: 'Selim\'in geceleri limana gittiğini söylemiştim. Depo ofisindeki bilgisayar kamera kayıtlarını tutar. Bir de... dün arka ofiste bir şey yazdırıyordu. Senin adını duydum.',
        effects: [flag('m.lead_footage'), flag('m.lead_note')],
        choices: [{ text: 'Borçlandım, Rıza.', effects: [rep('integrity', 1)] }],
      },
    },
  },
  {
    id: 'haydar_m5_final',
    start: 'n1',
    nodes: {
      n1: {
        id: 'n1',
        speaker: 'haydar',
        text: 'Sabah oldu. İsim?',
        choices: [
          { text: 'Selim. Kanıtım var.', conditions: { evidence: 'ev_footage', status: ['collected', 'kept', 'submitted'] }, next: 'nf' },
          {
            text: 'Selim\'in sizi soyduğunu gösteren defter bende.',
            tag: '[Defter]',
            conditions: { evidenceHeld: 'ev_ledger' },
            next: 'nl',
            effects: [rep('mafia', 15)],
          },
          {
            text: 'Selim beni tuzağa düşürmek için sahte ihbar yazdı. İşte kâğıt.',
            conditions: { evidence: 'ev_frame_note', status: ['collected', 'kept'] },
            next: 'nn',
          },
          { text: 'Bilmiyorum. Ama ben değilim.', next: 'nx' },
        ],
      },
      nn: { id: 'nn', speaker: 'selim', text: 'Yalan! O kâğıdı kendisi yazdı!', next: 'nn2' },
      nn2: {
        id: 'nn2',
        speaker: 'haydar',
        text: 'Bir kâğıt kimseyi mezara sokmaz. Başka?',
        choices: [
          { text: 'Depo kaydı. Kendiniz izleyin.', conditions: { evidence: 'ev_footage', status: ['collected', 'kept', 'submitted'] }, next: 'nf' },
          { text: 'Başka bir şeyim yok.', next: 'nx' },
        ],
      },
      nf: {
        id: 'nf',
        speaker: 'scene',
        text: 'Telefonda kayıt oynuyor: gece yarısı, depo. Selim, Sarıkaya\'nın adamlarına bir çanta uzatıyor. Zaman damgası defterin kaybolduğu gece.',
        next: 'nf2',
      },
      nf2: {
        id: 'nf2',
        speaker: 'haydar',
        text: 'Selim...',
        choices: [
          {
            text: 'Defterdeki "S." imzalı çekimler de onun.',
            conditions: { any: [{ evidenceHeld: 'ev_ledger' }, { flag: 'story.ledger_copied' }] },
            next: 'ne',
            effects: [rep('mafia', 10)],
          },
          {
            text: 'Ferhat da aynısını söyledi. Selim kasayı boşalttı.',
            conditions: { evidence: 'ev_witness_ferhat', status: ['collected', 'kept', 'submitted'] },
            next: 'ne',
            effects: [rep('mafia', 6)],
          },
          { text: 'Gerisi size kalmış, Haydar Bey.', next: 'ne', effects: [rep('mafia', 4)] },
        ],
      },
      nl: { id: 'nl', speaker: 'haydar', text: 'Defter... "S." harfiyle imzalanmış çekimler. On iki yıl, Selim.', next: 'ne' },
      ne: { id: 'ne', speaker: 'selim', text: 'Haydar Bey, dinleyin, ben—', next: 'ne2' },
      ne2: {
        id: 'ne2',
        speaker: 'scene',
        text: 'Selim cümlesini bitirmedi. Ceketinin altından silahını çekti ve adamlarına bağırdı.',
        effects: [flag('m.selim_exposed'), evt('hide', 'selim'), evt('activate', 'selim_crew'), rep('suspicion', -20, 'Gerçek köstebek bulundu')],
      },
      nx: { id: 'nx', speaker: 'selim', text: '"Ben değilim." Herkes öyle der. Ben demiştim, Haydar Bey.', next: 'nx2' },
      nx2: {
        id: 'nx2',
        speaker: 'haydar',
        text: '...',
        choices: [
          { text: '(Sessiz kal ve Haydar\'ın gözlerine bak.)', conditions: { stat: 'suspicion', max: 59 }, next: 'nb' },
          { text: '(Sessiz kal.)', conditions: { stat: 'suspicion', min: 60 }, next: 'nz' },
        ],
      },
      nb: {
        id: 'nb',
        speaker: 'haydar',
        text: 'Sana da güvenmiyorum, Selim\'e de. Murat, git. Bir daha bu kapıdan girme. Canını bağışlıyorum, bunu unutma.',
        effects: [flag('m.banished'), rep('mafia', -40, 'Örgütten uzaklaştırıldın')],
      },
      nz: {
        id: 'nz',
        speaker: 'selim',
        text: 'Kartal\'da Ayhan Usta diye biri yok, Haydar Bey. Sordurdum. Bu adam polis.',
        next: 'nz2',
      },
      nz2: {
        id: 'nz2',
        speaker: 'haydar',
        text: '...Doğru mu?',
        choices: [
          { text: 'Evet. Ve bu bina şu an sarılı.', conditions: { stat: 'police', min: 50 }, effects: [flag('m.exposed'), flag('m.backup'), evt('hostile', 'org')] },
          { text: 'Hayır! Selim seni kandırıyor!', effects: [flag('m.exposed'), evt('hostile', 'org'), evt('activate', 'exposed_crew')] },
        ],
      },
    },
  },
  {
    id: 'haydar_m5_end',
    start: 'e1',
    nodes: {
      e1: {
        id: 'e1',
        speaker: 'haydar',
        text: 'On iki yıl ekmeğimi yedi. Sen bir haftada gördün. Sana borçluyum, Murat. Bundan sonra sağ kolum sensin.',
        choices: [
          { text: '(Elini sık.)', effects: [rep('mafia', 15), flag('story.right_hand')] },
          { text: 'Borcunuz yok. İşimi yaptım.', effects: [rep('mafia', 10), flag('story.right_hand')] },
        ],
      },
    },
  },
  {
    id: 'nermin_m5',
    start: 'n1',
    startIf: [
      { when: { flag: 'm.exposed' }, node: 'x1' },
      { when: { flag: 'm.banished' }, node: 'b1' },
    ],
    nodes: {
      n1: {
        id: 'n1',
        speaker: 'nermin',
        text: 'Selim bitti, Haydar sana borçlu. On beş yılda ulaştığımız en yakın nokta bu. Şimdi karar vermemiz lazım.',
        next: 'c1',
      },
      x1: {
        id: 'x1',
        speaker: 'nermin',
        text: 'Yaşıyorsun. Bu bile mucize. Kimliğin yandı, Emre. Elimizdekiyle dava açacağız, gerisini mahkeme söyler.',
        next: 'c1',
      },
      b1: {
        id: 'b1',
        speaker: 'nermin',
        text: 'Haydar seni kapı dışarı etti ama canlı bıraktı. İçeride gözümüz kalmadı. Elimizdekiyle yetinmek zorundayız.',
        next: 'c1',
      },
      c1: {
        id: 'c1',
        speaker: 'nermin',
        text: 'Elinde teslim etmediğin kanıt varsa şimdi ver.',
        choices: [
          { text: 'Elimdeki her şeyi teslim ediyorum.', conditions: { anyEvidenceHeld: true }, next: 'c2', effects: [evt('submitAll')] },
          { text: 'Hepsini zaten gönderdim.', conditions: { not: { anyEvidenceHeld: true } }, next: 'c2' },
          {
            text: 'Bazı şeyleri kendime saklıyorum.',
            conditions: { anyEvidenceHeld: true },
            next: 'c2',
            effects: [rep('police', -10, 'Kanıt saklandı'), rep('integrity', -5), flag('story.lied_hq')],
          },
        ],
      },
      c2: {
        id: 'c2',
        speaker: 'nermin',
        text: 'Son söz senin.',
        choices: [
          { text: 'Baskını başlatın. Bu gece.', effects: [flag('story.raid')] },
          {
            text: 'Biraz daha içeride kalmalıyım. Belediyedeki adamı bulacağım.',
            conditions: { all: [{ notFlag: 'm.exposed' }, { notFlag: 'm.banished' }] },
            effects: [flag('story.stay_deep')],
          },
        ],
      },
    },
  },

  // ───────────────────────── Handler (between missions) ─────────────────────────
  {
    id: 'nermin_report',
    start: 'r1',
    nodes: {
      r1: {
        id: 'r1',
        speaker: 'nermin',
        text: 'Kimse seni takip etmedi, değil mi? Ne getirdin?',
        choices: [
          { text: 'Elimdeki kanıtları teslim ediyorum.', conditions: { anyEvidenceHeld: true }, next: 'r2', effects: [evt('submitAll')] },
          {
            text: 'Bu hafta bir şey yok.',
            tag: '[Yalan]',
            conditions: { anyEvidenceHeld: true },
            next: 'r3',
            effects: [rep('integrity', -3), flag('story.lied_hq')],
          },
          { text: 'Şüphe seviyem yükseldi. Ne yapmalıyım?', conditions: { stat: 'suspicion', min: 30 }, next: 'r4' },
          { text: 'Sadece uğradım.' },
        ],
      },
      r2: { id: 'r2', speaker: 'nermin', text: 'İyi iş. Merkez bunları seviyor. Dikkatli ol, kazandıkça göze batarsın.' },
      r3: {
        id: 'r3',
        speaker: 'nermin',
        text: 'Peki. Ama bana bir şey sakladığını öğrenirsem bu oda kapanır, Emre.',
      },
      r4: {
        id: 'r4',
        speaker: 'nermin',
        text: 'Bir süre sessiz kal. Verdikleri işleri sorgusuz yap, yasak yerlere girme. Şüphe zamanla söner, yeter ki yeni kıvılcım verme.',
        effects: [rep('suspicion', -4, 'Soğuma')],
      },
    },
  },
  {
    id: 'civilian',
    start: 'c1',
    nodes: {
      c1: { id: 'c1', speaker: 'scene', text: 'Yoldan geçen biri omzunun üstünden sana bakıp adımlarını hızlandırıyor.' },
    },
  },
];

export const DIALOGUES: Record<string, DialogueDef> = Object.fromEntries(D.map((d) => [d.id, d]));
