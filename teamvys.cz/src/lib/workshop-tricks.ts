// Skill-tree trick catalogue (mirrors vys-aplikace/lib/participant-content.ts
// skillTreeLevels). Used to let an admin pick workshop tricks from the offering
// of tricks that exist across all bracelet levels, instead of free text.

export type WorkshopTrickLevel = {
  level: number;
  title: string;
  bracelet: string;
  tricks: string[];
};

export const WORKSHOP_TRICK_LEVELS: WorkshopTrickLevel[] = [
  {
    level: 1,
    title: 'Základy',
    bracelet: 'Béžová',
    tricks: ['Safety roll', 'Safety vault', 'Precision jump', 'Wall run', 'Cartwheel', 'Roundhouse kick', 'Backward roll', 'Reverse vault'],
  },
  {
    level: 2,
    title: 'Mírně pokročilý',
    bracelet: 'Růžová',
    tricks: ['Tic-tac', 'Kong vault', 'Lazy vault', 'Butterfly kick', 'Tornado kick', 'Macaco', 'Wall spin', 'Frontflip'],
  },
  {
    level: 3,
    title: 'Pokročilý',
    bracelet: 'Fialová',
    tricks: ['Backflip', 'Full twist', 'Sideflip', 'Wall flip', 'Aerial', '540 kick', 'Dash vault', 'Webster'],
  },
  {
    level: 4,
    title: 'Expert',
    bracelet: 'Tmavě fialová',
    tricks: ['Corkscrew', 'Shuriken twist', 'Butterfly twist', 'Raiz', 'Gainer', 'Cheat 720 kick', 'Double Kong', 'Flashkick'],
  },
  {
    level: 5,
    title: 'Master',
    bracelet: 'Černá',
    tricks: ['Double Full', 'Double Cork', 'Touchdown Raiz / TDR', 'Double B-twist', 'Cheat 1080 kick', 'Jackknife', 'Snapuswipe', 'Palm flip', 'Double Backflip', 'Cartwheel Full'],
  },
];

/** Flat list of every trick title across all levels. */
export const WORKSHOP_TRICKS: string[] = WORKSHOP_TRICK_LEVELS.flatMap((level) => level.tricks);
