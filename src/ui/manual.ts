// The in-game manual. Plain data so it can be searched, tested and translated.

export interface HelpTopic {
  id: string;
  title: string;
  /** Paragraphs; a line starting with "- " is a bullet. */
  body: string[];
}

export const HELP: HelpTopic[] = [
  {
    id: 'start', title: 'How the game works',
    body: [
      'You run a plant business that grows into a research institution. Buy plants, grow them, sell them, and spend the money on better equipment, research and eventually genetics.',
      'The game runs in real time and keeps going while you are away (up to a limit, at reduced efficiency). The Goals page always has a suggestion for what to do next.',
    ],
  },
  {
    id: 'care', title: 'Looking after plants',
    body: [
      'Every plant has hydration, nutrients, roots and health. Hydration and nutrients fall steadily; water and feed before they run out. Health rises when conditions suit the species and falls when they do not.',
      'Click a plant to open its card. The "Why is this struggling?" section compares what the plant is getting with what its species wants, and tells you what to change, worst problem first.',
      '- Light, temperature, humidity and airflow are set per room. Each species has an ideal range, shown as a green band on the sliders.',
      '- Too wet rots roots; too dry stunts growth; too much fertiliser burns.',
      '- Infections: fungus likes wet still air, pests like hot dry air, rot comes from waterlogged pots. Treat them early.',
    ],
  },
  {
    id: 'selling', title: 'Selling and the market',
    body: [
      'Mature, healthy plants sell for the most. Prices move with demand: events make a species briefly fashionable, and rarer species are worth far more.',
      'Collector commissions ask for a specific plant (a trait, a hybrid) and pay a premium plus research points and reputation. Reputation raises every sale price a little.',
      'Plant shows open every half hour or so. Enter your best plant for the theme; prizes are a share of its value plus reputation.',
    ],
  },
  {
    id: 'propagation', title: 'Propagation',
    body: [
      'Once researched, you can take cuttings, divide plants and grow from leaves. Each method has a different success rate and cost, and takes time to recover.',
      'Clones are exact copies. Tissue culture makes many plantlets from one plant, at the risk of contamination, and can sometimes produce a surprise mutation.',
    ],
  },
  {
    id: 'genetics', title: 'Genetics, simply',
    body: [
      'Every plant has twelve genes, such as growth rate, leaf size, variegation and disease resistance. Each gene comes in two copies (alleles), one from each parent.',
      'Each allele has a value (how strong the trait is) and a dominance (how much it wins when the two copies disagree). What you see on the plant is the blended result, so a plant can carry a trait it does not show.',
      '- A recessive allele hides behind a dominant one. Two plants that both carry it can have offspring that show it.',
      '- Breeding mixes the parents’ alleles at random, with a chance of mutation. Breeding many offspring and keeping the best is how traits improve over generations.',
      '- Crossing different species makes a hybrid. Hybrids are harder to make and can combine the best of both parents.',
      '- Gene editing, available late, changes alleles directly for money and research points.',
    ],
  },
  {
    id: 'analysis', title: 'Analysis levels',
    body: [
      'Analysis reveals what a plant really carries. Level 0 shows only the visible traits. Higher levels show the genes, then the individual alleles, then the full genome including hidden carriers.',
      'Analysing is also how discoveries are found: rare traits and novel alleles are credited when you can see them. Each discovery pays research points once per species.',
    ],
  },
  {
    id: 'research', title: 'Research and stages',
    body: [
      'Research projects cost points and money, run on a timer (even while you are away) and unlock techniques, equipment, automation and expeditions that bring back new species.',
      'Facility stages unlock new departments. Each stage asks for money, a number of mature plants, discoveries and a key technology. The Laboratory page lists exactly what is missing.',
    ],
  },
  {
    id: 'automation', title: 'Automation',
    body: [
      'Researching automation, or hiring staff, takes the routine chores off your hands: watering, feeding, treatment, climate, analysis, planting, propagation, harvesting and selling. Each can be switched off, and selling follows rules you set.',
      'Automation works from a shared action budget per second, so bigger collections need more staff and better systems.',
    ],
  },
  {
    id: 'legacy', title: 'Legacy resets and challenges',
    body: [
      'When you have reached the last stage, finished the research tree and earned enough, you can hand on your legacy: the facility starts over, and you keep your discoveries, collection and cultivars and gain Legacy Points to spend on permanent upgrades.',
      'After the first reset you can start a run under a challenge. It makes the run harder in one specific way, and clearing it pays bonus legacy points once and is remembered forever.',
    ],
  },
  {
    id: 'saving', title: 'Saving',
    body: [
      'The game saves to this browser every 15 seconds, and keeps three older copies as backups. If a save ever fails to load, the newest readable backup is used.',
      'Export your save from Settings to keep a copy of your own, or sign in with an email code to keep a cloud copy that follows you between devices.',
    ],
  },
];
