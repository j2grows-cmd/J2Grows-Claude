// The market: shop, selling, collector contracts, price trends and the cultivar registry.

import { useState } from 'react';
import {
  availableSpecies, buy, describeReq, effectiveSpecies, fulfillContract, hasFlag, marketIdx, matchesContract, plantValue, propValue, royaltyRate, sellPlant, sellProp,
  shopOffer, speciesName, stockCap, repMult, type GameState, type ShopKind, type Species,
} from '../../engine';
import { act, setTab, setUi, toast, useGame, useUi } from '../../store';
import { Btn, Chip, Empty, Hint, Icon, PageHead, Panel, Stat, Tabs } from '../kit';
import { PlantArt } from '../PlantArt';
import { PlantThumb, PropThumb } from '../plantbits';
import { dur, money, pct } from '../format';

export function Market() {
  const s = useGame();
  const ui = useUi();
  const tab = ui.tab.market ?? 'shop';
  return (
    <div className="page">
      <PageHead
        title="Market"
        blurb="Buy stock, sell plants, take collector commissions and watch the price of every species. Demand swings with events — selling a lot of one species softens its price for a while."
        right={
          <>
            <Chip tone="gold">Reputation {s.market.rep}</Chip>
            <Chip tone="muted">Prices ×{repMult(s).toFixed(2)}</Chip>
          </>
        }
      />
      <Tabs
        value={tab}
        onChange={(t) => setTab('market', t)}
        tabs={[
          { id: 'shop', label: 'Shop' },
          { id: 'sell', label: 'Sell', badge: s.stock.length || undefined },
          { id: 'contracts', label: 'Collector contracts', badge: s.market.contracts.length || undefined, locked: !hasFlag(s, 'contracts') },
          { id: 'prices', label: 'Prices' },
          { id: 'cultivars', label: 'Cultivars', locked: !hasFlag(s, 'cultivars') },
        ]}
      />
      {tab === 'shop' && <Shop s={s} />}
      {tab === 'sell' && <Sell s={s} />}
      {tab === 'contracts' && <Contracts s={s} />}
      {tab === 'prices' && <Prices s={s} />}
      {tab === 'cultivars' && <Cultivars s={s} />}
    </div>
  );
}

// ---------------------------------------------------------------------------------------------

const stars = (n: number): string => '★'.repeat(n) + '☆'.repeat(5 - n);

function Shop({ s }: { s: GameState }) {
  const [q, setQ] = useState('');
  const [sort, setSort] = useState('rarity');
  const list = availableSpecies(s)
    .filter((sp) => !q || `${sp.common.join(' ')} ${sp.sci} ${sp.family}`.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => (sort === 'name' ? a.common[0].localeCompare(b.common[0]) : sort === 'price' ? a.baseValue - b.baseValue : a.rarity - b.rarity || a.baseValue - b.baseValue));
  const full = s.props.length >= 40 + s.mods.storage;
  return (
    <>
      <div className="row wrap" style={{ marginBottom: 14 }}>
        <input type="text" placeholder="Search species, family…" value={q} onChange={(e) => setQ(e.target.value)} style={{ minWidth: 260 }} aria-label="Search species" />
        <select value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort species">
          <option value="rarity">Sort by rarity</option>
          <option value="price">Sort by price</option>
          <option value="name">Sort by name</option>
        </select>
        <span className="muted">{s.props.length}/{40 + s.mods.storage} on the bench</span>
        {full && <Chip tone="red">Bench full</Chip>}
      </div>
      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(330px, 1fr))' }}>
        {list.map((sp) => (
          <ShopCard key={sp.id} s={s} sp={sp} />
        ))}
        {list.length === 0 && <Empty>No species match your search.</Empty>}
      </div>
    </>
  );
}

function ShopCard({ s, sp }: { s: GameState; sp: Species }) {
  const idx = marketIdx(s, sp.id);
  const kinds: { k: ShopKind; label: string }[] = [
    { k: 'seed', label: 'Seeds' },
    { k: 'young', label: 'Young plant' },
    { k: 'cutting', label: 'Cutting' },
    { k: 'flask', label: 'Flask' },
  ];
  return (
    <Panel pad={false}>
      <div className="panel-b" style={{ display: 'grid', gridTemplateColumns: '112px 1fr', gap: 14 }}>
        <div style={{ height: 112, display: 'grid', alignItems: 'end' }}>
          <PlantArt sp={sp.id} growth={0.85} seed={sp.id.length * 13} height={112} />
        </div>
        <div style={{ minWidth: 0 }}>
          <div className="item-title">{sp.common[0]}</div>
          <div className="sci" style={{ fontSize: 12 }}>{sp.sci}</div>
          <div className="row wrap gap-s mt-s">
            <Chip tone="gold" title="Rarity">{stars(sp.rarity)}</Chip>
            <Chip tone={idx > 1.08 ? 'green' : idx < 0.92 ? 'red' : 'muted'} title="Current market index">Demand {pct(idx)}</Chip>
            {(s.seen[sp.id] ?? 0) > 0 && <Chip tone="olive">grown {s.seen[sp.id]}</Chip>}
          </div>
          <div className="faint" style={{ fontSize: 11.5, marginTop: 6 }}>
            {sp.env.temp[0]}–{sp.env.temp[1]}°C · {sp.env.rh[0]}–{sp.env.rh[1]}% RH · light {sp.env.light[0]}–{sp.env.light[1]}
          </div>
        </div>
      </div>
      <div style={{ padding: '0 16px 14px', display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 6 }}>
        {kinds.map(({ k, label }) => {
          const o = shopOffer(s, sp.id, k);
          return (
            <Btn key={k} small disabled={!o.available || s.money < o.price} onClick={() => act((g) => buy(g, sp.id, k), true)} title={o.available ? `${o.units} × ${label.toLowerCase()}` : o.why}>
              {label}
              {o.units > 1 ? ` ×${o.units}` : ''} · {money(o.price)}
            </Btn>
          );
        })}
      </div>
    </Panel>
  );
}

// ---------------------------------------------------------------------------------------------

function Sell({ s }: { s: GameState }) {
  const sellable = s.props.filter((p) => (p.kind === 'seed' ? hasFlag(s, 'seedSales') : p.kind === 'tissue' ? hasFlag(s, 'sellTissue') : false));
  const matureInRooms = s.plants.filter((p) => p.stage === 'mature');
  const stockValue = s.stock.reduce((a, p) => a + plantValue(s, p), 0);
  return (
    <div className="grid g2">
      <Panel
        title="Sales stock"
        icon="coin"
        sub={`${s.stock.length}/${stockCap(s)} · ${money(stockValue)}`}
        right={
          <Btn small kind="gold" disabled={!s.stock.length} onClick={() => {
            let total = 0;
            let n = 0;
            act((g) => { for (const p of [...g.stock]) { const v = plantValue(g, p); if (sellPlant(g, p).ok) { total += v; n++; } } }, true);
            toast(`Sold ${n} plant${n === 1 ? '' : 's'} for ${money(total)}.`, 'good');
          }}>
            Sell all
          </Btn>
        }
      >
        {s.stock.length === 0 ? (
          <Empty icon="coin">Harvest a mature plant to hold it here until prices are right.</Empty>
        ) : (
          <div className="list">
            {s.stock.map((p) => (
              <div className="item" key={p.id}>
                <div className="item-art"><PlantThumb p={p} height={56} /></div>
                <div className="grow-1">
                  <div className="item-title">{p.name}</div>
                  <div className="item-sub">{speciesName(p.sp, p.hy)} · demand {pct(marketIdx(s, effectiveSpecies(p.sp, p.hy).id))}</div>
                </div>
                <Btn small kind="gold" onClick={() => act((g) => sellPlant(g, p), true)}>{money(plantValue(s, p))}</Btn>
              </div>
            ))}
          </div>
        )}
      </Panel>
      <div className="stack">
        <Panel title="Mature plants in your rooms" icon="grow" sub={`${matureInRooms.length}`}>
          {matureInRooms.length === 0 ? (
            <Empty>Nothing is ready yet.</Empty>
          ) : (
            <div className="list" style={{ maxHeight: 340, overflowY: 'auto' }}>
              {matureInRooms.map((p) => (
                <div className="item" key={p.id}>
                  <div className="item-art"><PlantThumb p={p} height={56} /></div>
                  <div className="grow-1">
                    <div className="item-title">{p.name}</div>
                    <div className="item-sub">{p.mother ? 'Mother plant' : p.keeper ? 'Keeper' : `Demand ${pct(marketIdx(s, effectiveSpecies(p.sp, p.hy).id))}`}</div>
                  </div>
                  <div className="item-r">
                    <Btn small onClick={() => setUi({ plant: p.id })}>Details</Btn>
                    <Btn small kind="gold" onClick={() => act((g) => sellPlant(g, p), true)}>{money(plantValue(s, p))}</Btn>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Panel>
        <Panel title="Seeds & plantlets" icon="scissors">
          {sellable.length === 0 ? (
            <Hint>Commercial Seed Lines and the Wholesale Liners Programme (Research → Commercial) let you sell home-grown seed and tissue-culture plantlets in bulk.</Hint>
          ) : (
            <div className="list" style={{ maxHeight: 280, overflowY: 'auto' }}>
              {sellable.map((p) => (
                <div className="item" key={p.id}>
                  <div className="item-art"><PropThumb pr={p} /></div>
                  <div className="grow-1"><div className="item-title">{speciesName(p.sp, p.hy)} · {p.kind}</div></div>
                  <Btn small onClick={() => act((g) => sellProp(g, p), true)}>{money(propValue(s, p))}</Btn>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------

function Contracts({ s }: { s: GameState }) {
  if (!hasFlag(s, 'contracts')) {
    return (
      <Panel title="Collector contracts" icon="lock">
        <Empty icon="lock">Research the Collector Network (Commercial Production) to receive commissions for plants with specific traits.</Empty>
        <div className="row" style={{ justifyContent: 'center' }}><Btn onClick={() => setUi({ view: 'research' })}>Open research</Btn></div>
      </Panel>
    );
  }
  return (
    <div className="stack">
      <Hint>Commissions ask for a mature, healthy plant of one species whose expressed traits meet a minimum. Fulfilling one pays far above market price, adds research points and builds reputation.</Hint>
      {s.market.contracts.length === 0 ? (
        <Panel><Empty icon="star">No commissions right now. New ones arrive every few minutes (up to {s.mods.contractSlots} at a time).</Empty></Panel>
      ) : (
        <div className="grid g2">
          {s.market.contracts.map((c) => {
            const matches = [...s.plants, ...s.stock].filter((p) => matchesContract(c, p));
            return (
              <Panel key={c.id} title={c.buyer} icon="star" right={<Chip tone="muted">{dur(c.expires - s.time)} left</Chip>}>
                <div className="row top">
                  <div style={{ width: 100, height: 100, display: 'grid', alignItems: 'end' }}>
                    <PlantArt sp={c.sp} growth={1} seed={c.id} height={100} />
                  </div>
                  <div className="grow-1">
                    <div className="item-title">{speciesName(c.sp)}</div>
                    <div className="row wrap gap-s mt-s">
                      {c.reqs.map((r, i) => <Chip key={i} tone="purple">{describeReq(r)}</Chip>)}
                    </div>
                    <div className="row wrap gap-s mt-s">
                      <Chip tone="gold">{money(c.reward)}</Chip>
                      <Chip tone="blue">+{c.rp} RP</Chip>
                      <Chip tone="olive">+{c.rep} rep</Chip>
                    </div>
                  </div>
                </div>
                <div className="divider" />
                {matches.length === 0 ? (
                  <span className="muted">You have no plant that meets this request yet.</span>
                ) : (
                  <div className="list">
                    {matches.slice(0, 3).map((p) => (
                      <div className="item" key={p.id}>
                        <div className="grow-1"><span className="item-title">{p.name}</span> <span className="muted">· value {money(plantValue(s, p))}</span></div>
                        <Btn small kind="primary" onClick={() => act((g) => fulfillContract(g, c.id, p.id))}>Fulfil</Btn>
                      </div>
                    ))}
                  </div>
                )}
              </Panel>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------------------------

function Spark({ values, tone }: { values: number[]; tone: string }) {
  if (values.length < 2) return <svg className="spark" viewBox="0 0 100 34" />;
  const lo = Math.min(0.5, ...values);
  const hi = Math.max(1.5, ...values);
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * 100},${34 - ((v - lo) / (hi - lo)) * 30 - 2}`).join(' ');
  const base = 34 - ((1 - lo) / (hi - lo)) * 30 - 2;
  return (
    <svg className="spark" viewBox="0 0 100 34" preserveAspectRatio="none" aria-hidden>
      <line x1="0" x2="100" y1={base} y2={base} stroke="rgba(255,255,255,.15)" strokeDasharray="2 3" vectorEffect="non-scaling-stroke" />
      <polyline points={pts} fill="none" stroke={tone} strokeWidth="1.6" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

function Prices({ s }: { s: GameState }) {
  const sp = availableSpecies(s);
  return (
    <div className="grid g-main">
      <Panel title="Species prices" icon="market">
        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: 10 }}>
          {sp.map((x) => {
            const idx = marketIdx(s, x.id);
            const tone = idx > 1.05 ? '#5fd08e' : idx < 0.95 ? '#e2776b' : '#8da596';
            return (
              <div key={x.id} className="codex">
                <div className="row between">
                  <span className="item-title" style={{ fontSize: 13 }}>{x.common[0]}</span>
                  <span style={{ color: tone, fontWeight: 600 }} className="num">{pct(idx)}</span>
                </div>
                <Spark values={s.market.hist[x.id] ?? []} tone={tone} />
                <div className="faint" style={{ fontSize: 11 }}>base {money(x.baseValue)}</div>
              </div>
            );
          })}
        </div>
      </Panel>
      <Panel title="Market events" icon="warn">
        {s.market.events.length === 0 ? (
          <Empty icon="check">Quiet markets. Events appear every few minutes.</Empty>
        ) : (
          <div className="list">
            {s.market.events.map((e) => (
              <div className="item" key={e.id}>
                <Icon name="warn" className={e.mag >= 1 ? 'green' : 'red'} />
                <div className="grow-1">
                  <div>{e.msg}</div>
                  <div className="item-sub">{dur(e.until - s.time)} remaining</div>
                </div>
              </div>
            ))}
          </div>
        )}
        <Hint>Each plant you sell nudges that species&apos; price down a little; prices drift back toward normal over time. Holding stock through a downturn is often wiser than dumping it.</Hint>
      </Panel>
    </div>
  );
}

function Cultivars({ s }: { s: GameState }) {
  return (
    <div className="grid g-main">
      <Panel title="Registered cultivars" icon="star" sub={`${s.cultivars.length}`}>
        {s.cultivars.length === 0 ? (
          <Empty icon="star">Open a mature, analysed plant that carries at least one discovery and choose “Register cultivar”. Each registered line earns royalties as long as you keep it. A species can hold up to three lines, and each trait line can be registered once.</Empty>
        ) : (
          <div className="list">
            {s.cultivars.map((c) => (
              <div className="item" key={c.id}>
                <Icon name="star" className="gold" />
                <div className="grow-1">
                  <div className="item-title">{c.name}</div>
                  <div className="item-sub">{speciesName(c.sp, c.hy)} · {c.tags.length} trait{c.tags.length === 1 ? '' : 's'} · registered {dur(s.time - c.t)} ago</div>
                </div>
                <Chip tone="gold">{money(c.royalty * s.mods.royalty)}/s</Chip>
              </div>
            ))}
          </div>
        )}
      </Panel>
      <div className="stack">
        <Stat label="Royalty income" value={`${money(royaltyRate(s))}/s`} tone="gold" />
        <Hint>Registered cultivars also sell for 50% more. Cultivar names are permanent, so choose a good one.</Hint>
      </div>
    </div>
  );
}
