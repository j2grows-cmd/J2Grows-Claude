// Saves made before the collection became the 99 aroids refer to the old 35 species by id.
// Each old species is mapped to the closest new one (same role, rarity and difficulty) so those saves still load.

export const LEGACY_SPECIES: Record<string, string> = {
  epipremnum_aureum: 'philodendron-brasil',
  tradescantia_zebrina: 'philodendron-micans',
  chlorophytum_comosum: 'alocasia-cucullata',
  dracaena_trifasciata: 'alocasia-odora',
  peperomia_obtusifolia: 'monstera-adansonii',
  syngonium_podophyllum: 'philodendron-lemon-lime',
  philodendron_hederaceum: 'philodendron-micans',
  ficus_elastica: 'alocasia-wentii',
  zamioculcas_zamiifolia: 'alocasia-macrorrhizos',
  pilea_peperomioides: 'monstera-dubia',
  crassula_ovata: 'philodendron-imperial-green',
  echeveria_elegans: 'philodendron-silver-sword',
  monstera_deliciosa: 'monstera-standleyana',
  maranta_leuconeura: 'philodendron-red-emerald',
  hoya_carnosa: 'philodendron-congo-rojo',
  begonia_maculata: 'alocasia-black-velvet',
  tillandsia_ionantha: 'anthurium-hookeri',
  monstera_adansonii: 'monstera-adansonii',
  scindapsus_pictus: 'monstera-siltepecana',
  rhaphidophora_tetrasperma: 'philodendron-florida-green',
  ceropegia_woodii: 'anthurium-radicans',
  ficus_lyrata: 'alocasia-calidora',
  goeppertia_orbifolia: 'anthurium-crystallinum',
  alocasia_zebrina: 'alocasia-zebrina',
  platycerium_bifurcatum: 'anthurium-clavigerum',
  phalaenopsis_amabilis: 'philodendron-white-princess',
  anthurium_clarinervium: 'anthurium-clarinervium',
  philodendron_gloriosum: 'philodendron-gloriosum',
  nepenthes_ventricosa: 'alocasia-melo',
  anthurium_warocqueanum: 'anthurium-warocqueanum',
  monstera_obliqua: 'monstera-obliqua',
  philodendron_spiritus_sancti: 'philodendron-tortum',
  philodendron_patriciae: 'philodendron-gigas',
  alocasia_azlanii: 'alocasia-azlanii',
  nepenthes_rajah: 'anthurium-balaoanum',
};

const PATTERN = new RegExp(Object.keys(LEGACY_SPECIES).sort((a, b) => b.length - a.length).join('|'), 'g');

/**
 * Rewrite every old species id in a save's JSON text, in values, record keys (`seen`, prices, discoveries as
 * `<discovery>|<species>`) and hybrid keys (`<a>x<b>`) alike. Old ids are long and specific enough that a plain
 * text replacement cannot touch anything else. Text with no old ids comes back unchanged.
 */
export function migrateLegacySpecies(json: string): string {
  return json.replace(PATTERN, (id) => LEGACY_SPECIES[id]);
}
