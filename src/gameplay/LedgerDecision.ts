import type { Condition, Effect } from '../game/GameTypes';

export interface DecisionOption {
  id: string;
  title: string;
  description: string;
  conditions?: Condition;
  lockedLabel?: string;
  effects: Effect[];
}

/** The mission 3 evidence decision. Pure data; applied through GameSession.apply. */
export const LEDGER_DECISION: DecisionOption[] = [
  {
    id: 'submit',
    title: 'Merkeze gönder',
    description: 'Defterin aslı kurye ile emniyete gider. Dava güçlenir ama Haydar defteri asla görmez; Selim sorgulamaya başlar.',
    effects: [
      { type: 'evidence', id: 'ev_ledger', action: 'submit' },
      { type: 'takeItem', item: 'ledger' },
      { type: 'rep', stat: 'mafia', delta: -10, reason: 'Defter kayıp' },
      { type: 'rep', stat: 'suspicion', delta: 18, reason: 'Defter ortadan kayboldu' },
      { type: 'flag', flag: 'story.ledger_police' },
      { type: 'flag', flag: 'm.ledger_decided' },
    ],
  },
  {
    id: 'copy',
    title: 'Fotoğrafla, aslını iade et',
    description: 'Kritik sayfaları çek, defteri Haydar\'a götür. Merkez daha zayıf bir kanıt alır ama kimliğin güvende kalır.',
    conditions: { all: [{ skill: 'inv_eye' }, { hasItem: 'camera' }] },
    lockedLabel: 'Göz Hafızası becerisi ve kamera gerekli',
    effects: [
      { type: 'evidence', id: 'ev_ledger', action: 'return' },
      { type: 'evidence', id: 'ev_ledger_copy', action: 'collect' },
      { type: 'takeItem', item: 'ledger' },
      { type: 'rep', stat: 'mafia', delta: 10, reason: 'Defter teslim edildi' },
      { type: 'flag', flag: 'story.ledger_returned' },
      { type: 'flag', flag: 'story.ledger_copied' },
      { type: 'flag', flag: 'm.ledger_decided' },
    ],
  },
  {
    id: 'return',
    title: 'Örgüte iade et',
    description: 'Defteri dokunmadan Haydar\'a götür. Örgütün güveni artar; merkez bu fırsatı kaçırdığın için memnun olmaz.',
    effects: [
      { type: 'evidence', id: 'ev_ledger', action: 'return' },
      { type: 'takeItem', item: 'ledger' },
      { type: 'rep', stat: 'mafia', delta: 14, reason: 'Defter teslim edildi' },
      { type: 'rep', stat: 'police', delta: -8, reason: 'Kanıt örgüte verildi' },
      { type: 'flag', flag: 'story.ledger_returned' },
      { type: 'flag', flag: 'm.ledger_decided' },
    ],
  },
  {
    id: 'keep',
    title: 'Sakla, kararı sonra ver',
    description: 'Defteri yanında tut. Haydar sabırsızlanır ama son hamlede bu defter kozun olabilir. Dilediğin zaman günlükten merkeze gönderebilirsin.',
    effects: [
      { type: 'evidence', id: 'ev_ledger', action: 'keep' },
      { type: 'rep', stat: 'suspicion', delta: 8, reason: 'Defter gecikti' },
      { type: 'flag', flag: 'story.ledger_kept' },
      { type: 'flag', flag: 'm.ledger_decided' },
    ],
  },
];
