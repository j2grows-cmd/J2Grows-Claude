// Cultivation department: growing rooms, climate control, and the propagation bench.

import { useMemo, useState } from 'react';
import {
  EQUIP, MEDIA_DEFS, POT_DEFS, autoTuneRoom, bestMedium, buildRoom, buyEquip, careRoom, effectiveSpecies, equipCost, expandRoom, firstFreeSlot, maxLight, maxRooms,
  discardPlant, feedById, nextRoomCost, placePropagule, plantValue, sellPlant, setFlag, treatById, waterById, propCap, propValue, renameRoom, roomExpandCost, roomSlotCap, sellProp, setRoom, WATER_COST, FEED_COST, TREAT_COST,
  type GameState, type MediumId, type PotId, type Propagule, type Room, type Plant,
} from '../../engine';
import { act, setTab, setUi, useGame, useUi } from '../../store';
import { Bar, Btn, Chip, Empty, Hint, Icon, Modal, PageHead, Panel, Slider, Stat, Tabs } from '../kit';
import { PlantCard, PropThumb } from '../plantbits';
import { cap, dur, money, pct } from '../format';
import { askConfirm, toast } from '../../store';

// ---------------------------------------------------------------------------------------------
// Finding things in a big collection: filter, sort and bulk actions. The choice is remembered per device.
// ---------------------------------------------------------------------------------------------

type PlantFilter = 'all' | 'mature' | 'thirsty' | 'hungry' | 'sick' | 'struggling' | 'hybrid' | 'keepers';
type PlantSort = 'slot' | 'health' | 'value' | 'growth' | 'name';
const FILTERS: { id: PlantFilter; label: string }[] = [
  { id: 'all', label: 'All' }, { id: 'mature', label: 'Mature' }, { id: 'thirsty', label: 'Thirsty' }, { id: 'hungry', label: 'Hungry' },
  { id: 'sick', label: 'Infected' }, { id: 'struggling', label: 'Struggling' }, { id: 'hybrid', label: 'Hybrids' }, { id: 'keepers', label: 'Keepers' },
];
const SORTS: { id: PlantSort; label: string }[] = [
  { id: 'slot', label: 'Room order' }, { id: 'health', label: 'Health (worst first)' }, { id: 'value', label: 'Value (highest first)' }, { id: 'growth', label: 'Growth (least first)' }, { id: 'name', label: 'Name' },
];

function usePersisted<T extends string>(key: string, fallback: T, allowed: readonly T[]): [T, (v: T) => void] {
  const [v, setV] = useState<T>(() => {
    try {
      const x = localStorage.getItem('j2grows.view.' + key) as T | null;
      return x && allowed.includes(x) ? x : fallback;
    } catch {
      return fallback;
    }
  });
  return [v, (n: T) => {
    setV(n);
    try {
      localStorage.setItem('j2grows.view.' + key, n);
    } catch {
      /* ignore */
    }
  }];
}

function matches(s: GameState, p: Plant, f: PlantFilter): boolean {
  const e = effectiveSpecies(p.sp, p.hy).env;
  switch (f) {
    case 'mature': return p.stage === 'mature';
    case 'thirsty': return p.hydration < e.dryBack + 4;
    case 'hungry': return p.nutrients < e.nutrient[0];
    case 'sick': return !!p.inf;
    case 'struggling': return p.health < 50;
    case 'hybrid': return !!p.hy;
    case 'keepers': return p.keeper || p.mother;
    default: return true;
  }
}

export function Cultivation() {
  const s = useGame();
  const ui = useUi();
  const tab = ui.tab.cult ?? 'rooms';
  return (
    <div className="page">
      <PageHead
        title="Cultivation"
        blurb="Grow rooms, climate and care. Match each room to the plants inside it — light, temperature, humidity and water decide how fast they grow and how healthy they stay."
        right={<Chip tone="muted">{s.plants.length} plants · {s.props.length}/{propCap(s)} in the bench</Chip>}
      />
      <Tabs
        value={tab}
        onChange={(t) => setTab('cult', t)}
        tabs={[
          { id: 'rooms', label: 'Growing rooms' },
          { id: 'bench', label: 'Propagation bench', badge: s.props.length || undefined },
        ]}
      />
      {tab === 'rooms' ? <Rooms s={s} roomId={ui.room} /> : <Bench s={s} />}
    </div>
  );
}

// ---------------------------------------------------------------------------------------------

function plantsIn(s: GameState, r: Room): Plant[] {
  return r.slots.map((id) => s.plants.find((p) => p.id === id)).filter(Boolean) as Plant[];
}

function idealRange(ps: Plant[], key: 'light' | 'temp' | 'rh' | 'air'): [number, number] | null {
  if (!ps.length) return null;
  let lo = 0;
  let hi = 0;
  for (const p of ps) {
    const e = effectiveSpecies(p.sp, p.hy).env[key];
    lo += e[0];
    hi += e[1];
  }
  return [lo / ps.length, hi / ps.length];
}

function Rooms({ s, roomId }: { s: GameState; roomId: number | null }) {
  const room = s.rooms.find((r) => r.id === roomId) ?? s.rooms[0];
  const [pick, setPick] = useState<number | null>(null);
  const [filter, setFilter] = usePersisted<PlantFilter>('filter', 'all', FILTERS.map((x) => x.id));
  const [sort, setSort] = usePersisted<PlantSort>('sort', 'slot', SORTS.map((x) => x.id));
  const [query, setQuery] = useState('');
  const [selecting, setSelecting] = useState(false);
  const [chosen, setChosen] = useState<Set<number>>(new Set());
  const here = plantsIn(s, room);
  const narrowed = filter !== 'all' || query.trim() !== '' || sort !== 'slot';
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = here.filter((p) => matches(s, p, filter) && (!q || p.name.toLowerCase().includes(q) || effectiveSpecies(p.sp, p.hy).common[0].toLowerCase().includes(q)));
    const by: Record<PlantSort, (a: Plant, b: Plant) => number> = {
      slot: (a, b) => a.slot - b.slot,
      health: (a, b) => a.health - b.health,
      value: (a, b) => plantValue(s, b) - plantValue(s, a),
      growth: (a, b) => a.growth - b.growth,
      name: (a, b) => a.name.localeCompare(b.name),
    };
    return list.sort(by[sort]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s, room.id, filter, sort, query, Math.floor(s.time / 2)]);
  const chosenPlants = shown.filter((p) => chosen.has(p.id));
  const toggle = (id: number): void => setChosen((c) => { const n = new Set(c); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const bulk = (what: 'water' | 'feed' | 'treat' | 'keep' | 'sell' | 'discard'): void => {
    const ids = chosenPlants.map((p) => p.id);
    if (!ids.length) return;
    if (what === 'discard') {
      askConfirm(`Discard ${ids.length} plant${ids.length > 1 ? 's' : ''}? They cannot be recovered.`, () => { act((g) => { for (const id of ids) discardPlant(g, id); }, true); setChosen(new Set()); }, { title: 'Discard plants?', confirm: 'Discard', danger: true });
      return;
    }
    let n = 0;
    let total = 0;
    act((g) => {
      for (const id of ids) {
        const p = g.plants.find((x) => x.id === id);
        if (!p) continue;
        if (what === 'water') n += waterById(g, id).ok ? 1 : 0;
        else if (what === 'feed') n += feedById(g, id).ok ? 1 : 0;
        else if (what === 'treat') n += treatById(g, id).ok ? 1 : 0;
        else if (what === 'keep') { setFlag(g, id, 'keeper'); n++; }
        else if (what === 'sell' && !p.keeper && !p.mother) { const v = plantValue(g, p); if (sellPlant(g, p).ok) { n++; total += v; } }
      }
    }, true);
    toast(n ? (what === 'sell' ? `Sold ${n} for ${money(total)}.` : `Done for ${n} plant${n > 1 ? 's' : ''}.`) : 'Nothing to do.', n ? 'good' : 'bad');
    if (what === 'sell') setChosen(new Set());
  };
  const slotCap = roomSlotCap(s);
  const avgHealth = here.length ? here.reduce((a, p) => a + p.health, 0) / here.length : 0;
  const needWater = here.filter((p) => p.hydration < effectiveSpecies(p.sp, p.hy).env.dryBack + 4).length;
  const sick = here.filter((p) => p.inf).length;

  return (
    <>
      <div className="room-tabs">
        {s.rooms.map((r) => {
          const n = plantsIn(s, r).length;
          return (
            <button key={r.id} type="button" className={`room-tab${r.id === room.id ? ' on' : ''}`} onClick={() => setUi({ room: r.id })}>
              <b>{r.name}</b>
              <span>
                {n}/{r.slots.length} slots
              </span>
            </button>
          );
        })}
        {s.rooms.length < maxRooms(s) && (
          <Btn icon="plant" onClick={() => act((g) => buildRoom(g))} disabled={s.money < nextRoomCost(s)} title="Build another grow room">
            New room · {money(nextRoomCost(s))}
          </Btn>
        )}
      </div>

      <div className="grid g-main">
        <div className="stack">
          <Panel
            title={
              <input
                type="text"
                defaultValue={room.name}
                key={room.id}
                aria-label="Room name"
                maxLength={28}
                onBlur={(e) => act((g) => renameRoom(g, room.id, e.target.value), true)}
                style={{ background: 'transparent', border: '1px solid transparent', color: 'inherit', textTransform: 'uppercase', letterSpacing: '0.09em', fontWeight: 600, fontSize: 13 }}
              />
            }
            icon="grow"
            right={
              <>
                <Btn small icon="drop" disabled={!here.length} onClick={() => act((g) => careRoom(g, room.id, 'water'))} title={`Water every plant (${money(WATER_COST)} each)`}>
                  Water all
                </Btn>
                <Btn small icon="plant" disabled={!here.length} onClick={() => act((g) => careRoom(g, room.id, 'feed'))} title={`Feed every plant (${money(FEED_COST)} each)`}>
                  Feed all
                </Btn>
                <Btn small icon="heart" disabled={!sick} onClick={() => act((g) => careRoom(g, room.id, 'treat'))} title={`Treat every infected plant (${money(TREAT_COST)} each)`}>
                  Treat all
                </Btn>
              </>
            }
          >
            <div className="stats-row" style={{ marginBottom: 14 }}>
              <Stat label="Plants" value={`${here.length}/${room.slots.length}`} />
              <Stat label="Avg health" value={here.length ? avgHealth.toFixed(0) : '—'} tone={avgHealth < 50 && here.length ? undefined : 'green'} />
              <Stat label="Need water" value={needWater} sub={needWater ? 'check the bars' : 'all good'} tone={needWater ? 'blue' : undefined} />
              <Stat label="Infected" value={sick} tone={sick ? 'gold' : undefined} />
            </div>
            {here.length > 3 && (
              <div className="toolbar" role="group" aria-label="Filter and sort plants">
                <input type="search" placeholder="Find a plant…" aria-label="Find a plant" value={query} onChange={(e) => setQuery(e.target.value)} />
                <div className="chips-row">
                  {FILTERS.map((f) => (
                    <button key={f.id} type="button" className={`chip-btn${filter === f.id ? ' on' : ''}`} aria-pressed={filter === f.id} onClick={() => setFilter(f.id)}>
                      {f.label}
                    </button>
                  ))}
                </div>
                <label className="sort">
                  <span className="muted">Sort</span>
                  <select value={sort} onChange={(e) => setSort(e.target.value as PlantSort)} aria-label="Sort plants">
                    {SORTS.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}
                  </select>
                </label>
                <Btn small kind={selecting ? 'primary' : 'default'} onClick={() => { setSelecting(!selecting); setChosen(new Set()); }}>
                  {selecting ? 'Done selecting' : 'Select'}
                </Btn>
              </div>
            )}
            {selecting && (
              <div className="bulkbar" role="group" aria-label="Actions for selected plants">
                <b>{chosenPlants.length} selected</b>
                <Btn small onClick={() => setChosen(new Set(shown.map((p) => p.id)))}>All shown</Btn>
                <Btn small kind="ghost" onClick={() => setChosen(new Set())}>None</Btn>
                <span className="grow-1" />
                <Btn small icon="drop" disabled={!chosenPlants.length} onClick={() => bulk('water')}>Water</Btn>
                <Btn small icon="plant" disabled={!chosenPlants.length} onClick={() => bulk('feed')}>Feed</Btn>
                <Btn small icon="heart" disabled={!chosenPlants.length} onClick={() => bulk('treat')}>Treat</Btn>
                <Btn small icon="star" disabled={!chosenPlants.length} onClick={() => bulk('keep')} title="Toggle the keeper mark: keepers are never auto-sold">Keeper</Btn>
                <Btn small kind="gold" icon="coin" disabled={!chosenPlants.length} onClick={() => bulk('sell')}>Sell</Btn>
                <Btn small kind="danger" icon="trash" disabled={!chosenPlants.length} onClick={() => bulk('discard')}>Discard</Btn>
              </div>
            )}
            {narrowed && shown.length === 0 && <Empty icon="plant">No plants match. Clear the filter or search to see everything.</Empty>}
            <div className="slot-grid">
              {narrowed && shown.map((p) => <PlantCard key={p.id} p={p} s={s} selected={selecting && chosen.has(p.id)} onClick={() => (selecting ? toggle(p.id) : setUi({ plant: p.id }))} />)}
              {!narrowed && room.slots.map((id, i) => {
                const p = id == null ? null : s.plants.find((x) => x.id === id);
                if (p) return <PlantCard key={p.id} p={p} s={s} selected={selecting && chosen.has(p.id)} onClick={() => (selecting ? toggle(p.id) : setUi({ plant: p.id }))} />;
                return (
                  <button key={`e${i}`} type="button" className="slot-empty" onClick={() => setPick(i)}>
                    <Icon name="plant" size={26} />
                    <span>Empty slot {i + 1}</span>
                    <span className="chip chip-green">Plant something</span>
                  </button>
                );
              })}
              {!narrowed && (room.slots.length < slotCap ? (
                <div className="slot-locked">
                  <Icon name="lock" size={20} />
                  <span>Another slot</span>
                  <Btn small onClick={() => act((g) => expandRoom(g, room.id))} disabled={s.money < roomExpandCost(room.slots.length)}>
                    Add · {money(roomExpandCost(room.slots.length))}
                  </Btn>
                </div>
              ) : (
                room.slots.length < 30 && (
                  <div className="slot-locked">
                    <Icon name="lock" size={20} />
                    <span>Room is at capacity ({slotCap}). Raise the Cultivation department level or advance the facility stage for more.</span>
                  </div>
                )
              ))}
            </div>
          </Panel>
        </div>

        <div className="stack">
          <Climate room={room} ps={here} />
          <Equipment s={s} room={room} />
        </div>
      </div>

      {pick != null && <PlantPicker s={s} room={room} slot={pick} onClose={() => setPick(null)} />}
    </>
  );
}

function Climate({ room, ps }: { room: Room; ps: Plant[] }) {
  const light = idealRange(ps, 'light');
  const temp = idealRange(ps, 'temp');
  const rh = idealRange(ps, 'rh');
  const air = idealRange(ps, 'air');
  const cap = maxLight(room.equip.lighting);
  const set = (patch: Parameters<typeof setRoom>[2]) => act((g) => void setRoom(g, room.id, patch), true);
  const lightIdeal: [number, number] | null = light ? [(light[0] * 12) / room.set.photoperiod, (light[1] * 12) / room.set.photoperiod] : null;
  return (
    <Panel
      title="Climate control"
      icon="sun"
      right={
        <Btn small disabled={!ps.length} onClick={() => act((g) => void autoTuneRoom(g, room.id), true)} title="Set every dial to the average preference of the plants in this room">
          Match to plants
        </Btn>
      }
    >
      <Slider label="Light intensity" icon="sun" value={room.set.light} min={0} max={100} unit="%" onChange={(v) => set({ light: v })} range={lightIdeal} hint={`Lamps cap at ${cap}% — better lighting raises the cap.`} />
      <Slider label="Photoperiod" icon="sun" value={room.set.photoperiod} min={8} max={20} unit="h" onChange={(v) => set({ photoperiod: v })} hint={`Effective light ${room.act.light.toFixed(0)} = intensity × hours ÷ 12.`} />
      <Slider label="Temperature" icon="temp" value={room.set.temp} min={10} max={35} step={0.5} unit="°C" actual={room.act.temp} range={temp} onChange={(v) => set({ temp: v })} />
      <Slider label="Humidity" icon="drop" value={room.set.humidity} min={20} max={95} unit="%" actual={room.act.humidity} range={rh} onChange={(v) => set({ humidity: v })} />
      <Slider label="Airflow" icon="wind" value={room.set.airflow} min={0} max={100} actual={room.act.airflow} range={air} onChange={(v) => set({ airflow: v })} hint="More air cuts infection risk but dries the room." />
      <Slider label="Feed strength" icon="plant" value={room.set.feed} min={0} max={100} onChange={(v) => set({ feed: v })} hint="Used by nutrient dosing equipment." />
      <div className="row between" style={{ fontSize: 12 }}>
        <span className="muted">Stability</span>
        <span className="num">{pct(room.act.stability)}</span>
      </div>
      <Bar value={room.act.stability} max={1} thin tone="blue" />
      <Hint>The shaded band on each slider is what the plants in this room prefer. Equipment decides how tightly the room follows your settings.</Hint>
    </Panel>
  );
}

function Equipment({ s, room }: { s: GameState; room: Room }) {
  return (
    <Panel title="Room equipment" icon="gear">
      <div className="list">
        {EQUIP.map((e) => {
          const lvl = room.equip[e.id];
          const full = lvl >= e.max;
          const cost = equipCost(e, lvl);
          return (
            <div className="item" key={e.id}>
              <div className="grow-1">
                <div className="item-title">
                  {e.name} <span className="muted num">· {lvl}/{e.max}</span>
                </div>
                <div className="item-sub">{e.desc}</div>
                <Bar value={lvl} max={e.max} thin tone="olive" />
              </div>
              <Btn small disabled={full || s.money < cost} onClick={() => act((g) => buyEquip(g, room.id, e.id))}>
                {full ? 'Max' : money(cost)}
              </Btn>
            </div>
          );
        })}
      </div>
    </Panel>
  );
}

// ---------------------------------------------------------------------------------------------

export function PlantPicker({ s, room, slot, onClose }: { s: GameState; room: Room; slot: number; onClose: () => void }) {
  const [sel, setSel] = useState<number | null>(s.props[0]?.id ?? null);
  const pr = s.props.find((p) => p.id === sel) ?? null;
  const sp = pr ? effectiveSpecies(pr.sp, pr.hy) : null;
  const [medium, setMedium] = useState<MediumId | ''>('');
  const [pot, setPot] = useState<PotId>('standard');
  const useMedium: MediumId = (medium || (sp ? bestMedium(sp, s) : 'aroidMix')) as MediumId;
  return (
    <Modal
      title={`Plant in ${room.name}, slot ${slot + 1}`}
      onClose={onClose}
      footer={
        <>
          <Btn kind="ghost" onClick={onClose}>
            Cancel
          </Btn>
          <Btn
            kind="primary"
            disabled={!pr}
            onClick={() => {
              const r = act((g) => placePropagule(g, pr!.id, room.id, slot, useMedium, pot));
              if (r?.ok || (r && r.msg.includes('germinate'))) onClose();
            }}
          >
            Plant it
          </Btn>
        </>
      }
    >
      {s.props.length === 0 ? (
        <Empty>
          Nothing to plant yet. Buy seeds or young plants at the Market, or take cuttings from a mature plant.
          <br />
          <Btn kind="primary" onClick={() => { setUi({ view: 'market' }); onClose(); }}>
            Open the market
          </Btn>
        </Empty>
      ) : (
        <>
          <div className="list" style={{ maxHeight: 280, overflowY: 'auto' }}>
            {s.props.map((p) => (
              <PropRow key={p.id} p={p} s={s} on={p.id === sel} onClick={() => setSel(p.id)} />
            ))}
          </div>
          {sp && (
            <div className="row wrap mt">
              <label className="muted">Medium</label>
              <select value={medium} onChange={(e) => setMedium(e.target.value as MediumId | '')}>
                <option value="">Best match ({MEDIA_DEFS[bestMedium(sp, s)].name})</option>
                {Object.values(MEDIA_DEFS).map((m) => (
                  <option key={m.id} value={m.id} disabled={!!m.needs && !s.mods.flags[m.needs]}>
                    {m.name} · {money(m.cost)}
                  </option>
                ))}
              </select>
              <label className="muted">Pot</label>
              <select value={pot} onChange={(e) => setPot(e.target.value as PotId)}>
                {Object.values(POT_DEFS).map((m) => (
                  <option key={m.id} value={m.id} disabled={!!m.needs && !s.mods.flags[m.needs]}>
                    {m.name} {m.cost ? `· ${money(m.cost)}` : ''}
                  </option>
                ))}
              </select>
            </div>
          )}
          {sp && pr && (
            <Hint>
              {sp.common[0]} wants {sp.env.light[0]}–{sp.env.light[1]} effective light, {sp.env.temp[0]}–{sp.env.temp[1]}°C and {sp.env.rh[0]}–{sp.env.rh[1]}% humidity. This room currently measures light {room.act.light.toFixed(0)}, {room.act.temp.toFixed(1)}°C, {room.act.humidity.toFixed(0)}%.
              {pr.kind === 'seed' && ` Seeds germinate about ${pct(Math.min(0.98, 0.55 + 0.4 * pr.q * Math.max(0.4, sp.prop.seed + 0.4) + s.mods.germination))} of the time.`}
            </Hint>
          )}
        </>
      )}
    </Modal>
  );
}

function PropRow({ p, s, on, onClick }: { p: Propagule; s: GameState; on?: boolean; onClick?: () => void }) {
  const sp = effectiveSpecies(p.sp, p.hy);
  return (
    <div className={`item${on ? ' on' : ''}`} onClick={onClick} style={{ cursor: onClick ? 'pointer' : undefined }}>
      <div className="item-art">
        <PropThumb pr={p} />
      </div>
      <div className="grow-1">
        <div className="item-title">
          {sp.common[0]} <span className="muted">· {cap(p.kind)}</span>
        </div>
        <div className="item-sub">
          Gen {p.gen} · {cap(p.origin)}
          {p.kind === 'seed' && ` · viability ${pct(p.q)}`}
          {p.sport && ' · bud sport'}
        </div>
      </div>
      <Chip tone="gold">{money(propValue(s, p))}</Chip>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------

function Bench({ s }: { s: GameState }) {
  const [pick, setPick] = useState<number | null>(null);
  const free = firstFreeSlot(s);
  const sorted = useMemo(() => [...s.props].sort((a, b) => a.sp.localeCompare(b.sp)), [s.props]);
  return (
    <div className="grid g-main">
      <Panel title="Seeds, cuttings & plantlets" icon="scissors" sub={`${s.props.length}/${propCap(s)}`}>
        {sorted.length === 0 ? (
          <Empty>
            The bench is empty. Take cuttings from mature plants, collect seed from crosses, or buy stock at the Market.
          </Empty>
        ) : (
          <div className="list">
            {sorted.map((p) => (
              <div className="item" key={p.id}>
                <div className="item-art">
                  <PropThumb pr={p} />
                </div>
                <div className="grow-1">
                  <div className="item-title">
                    {effectiveSpecies(p.sp, p.hy).common[0]} <span className="muted">· {cap(p.kind)}</span>
                  </div>
                  <div className="item-sub">
                    Gen {p.gen} · {cap(p.origin)}
                    {p.kind === 'seed' && ` · viability ${pct(p.q)}`}
                    {p.sport && ' · bud sport'}
                  </div>
                </div>
                <div className="item-r">
                  <Btn
                    small
                    kind="primary"
                    disabled={!free}
                    onClick={() => {
                      if (!free) return;
                      const sp = effectiveSpecies(p.sp, p.hy);
                      act((g) => placePropagule(g, p.id, free.room, free.slot, bestMedium(sp, g), g.mods.flags.selfWatering && sp.env.wetCap >= 70 ? 'selfWatering' : 'standard'));
                    }}
                    title={free ? 'Plant in the first free slot' : 'No free slots'}
                  >
                    Plant
                  </Btn>
                  <Btn small onClick={() => setPick(p.id)}>
                    Choose slot
                  </Btn>
                  <Btn small kind="ghost" onClick={() => act((g) => sellProp(g, p))} title="Sell (needs research for seeds and plantlets)">
                    {money(propValue(s, p))}
                  </Btn>
                </div>
              </div>
            ))}
          </div>
        )}
      </Panel>
      <div className="stack">
        <Panel title="Cloning chambers" icon="flask">
          {s.jobs.cloning.length === 0 ? (
            <Hint>No clones running. Start one from a mature plant&apos;s Propagate tab once Clonal Propagation is researched.</Hint>
          ) : (
            <div className="list">
              {s.jobs.cloning.map((j) => (
                <div className="item" key={j.id}>
                  <div className="grow-1">
                    <div className="item-title">{j.name}</div>
                    <div className="item-sub">{j.n} clone{j.n > 1 ? 's' : ''} · {dur(j.total - j.progress)} left</div>
                    <Bar value={j.progress} max={j.total} thin tone="blue" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Panel>
        <Panel title="Running jobs" icon="bolt">
          <dl className="kv">
            <dt>Breeding</dt>
            <dd>{s.jobs.breeding.length}</dd>
            <dt>Analysis</dt>
            <dd>{s.jobs.analysis.length}</dd>
            <dt>Tissue culture</dt>
            <dd>{s.jobs.tissue.length}</dd>
          </dl>
        </Panel>
      </div>
      {pick != null && (
        <SlotChooser
          s={s}
          propId={pick}
          onClose={() => setPick(null)}
        />
      )}
    </div>
  );
}

function SlotChooser({ s, propId, onClose }: { s: GameState; propId: number; onClose: () => void }) {
  const pr = s.props.find((p) => p.id === propId);
  const [v, setV] = useState('');
  const options: { room: number; slot: number; label: string }[] = [];
  for (const r of s.rooms) r.slots.forEach((id, i) => id == null && options.push({ room: r.id, slot: i, label: `${r.name} · slot ${i + 1}` }));
  if (!pr) return null;
  return (
    <Modal
      title="Choose a slot"
      onClose={onClose}
      footer={
        <Btn
          kind="primary"
          disabled={!v}
          onClick={() => {
            const [room, slot] = v.split(':').map(Number);
            const sp = effectiveSpecies(pr.sp, pr.hy);
            const r = act((g) => placePropagule(g, pr.id, room, slot, bestMedium(sp, g), 'standard'));
            if (r) onClose();
          }}
        >
          Plant
        </Btn>
      }
    >
      {options.length === 0 ? (
        <Empty>No free slots. Add slots or sell a plant.</Empty>
      ) : (
        <select value={v} onChange={(e) => setV(e.target.value)} style={{ width: '100%' }}>
          <option value="">Select…</option>
          {options.map((o) => (
            <option key={`${o.room}:${o.slot}`} value={`${o.room}:${o.slot}`}>
              {o.label}
            </option>
          ))}
        </select>
      )}
    </Modal>
  );
}
