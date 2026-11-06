// Laboratory management: facility stages, departments and their upgrades, rooms and staff.

import {
  MAX_STAFF_LEVEL, ROLES, STAGES, advanceStage, currentStaffCap, deptStatus, fireStaff, hire, hireCost, maxRooms, roomSlotCap, stageRequirements, totalWages, trainCost,
  trainStaff, wageOf, buildRoom, nextRoomCost, type DeptId, type GameState, type StaffRole,
} from '../../engine';
import { act, askConfirm, setTab, setUi, useGame, useUi } from '../../store';
import { Btn, Chip, Empty, Hint, Icon, PageHead, Panel, Req, Stat, Tabs } from '../kit';
import { UpgradeList } from '../upgrades';
import { money } from '../format';

const DEPTS: { id: DeptId; name: string; icon: string; blurb: string }[] = [
  { id: 'cultivation', name: 'Cultivation', icon: 'grow', blurb: 'Rooms, slots and growing infrastructure.' },
  { id: 'tissue', name: 'Tissue Culture', icon: 'flask', blurb: 'Sterile mass propagation benches.' },
  { id: 'genetics', name: 'Genetics', icon: 'dna', blurb: 'Analysis, breeding and sequencing.' },
  { id: 'research', name: 'Research', icon: 'research', blurb: 'Benches, libraries and project offices.' },
];

export function Laboratory() {
  const s = useGame();
  const ui = useUi();
  const tab = ui.tab.lab ?? 'stage';
  return (
    <div className="page">
      <PageHead title="Laboratory" blurb="Expand your facility, upgrade each department independently and hire the people who keep it running." />
      <Tabs
        value={tab}
        onChange={(t) => setTab('lab', t)}
        tabs={[
          { id: 'stage', label: 'Facility' },
          { id: 'depts', label: 'Departments' },
          { id: 'staff', label: 'Staff', badge: s.staff.length || undefined },
        ]}
      />
      {tab === 'stage' && <Stage s={s} />}
      {tab === 'depts' && <Depts s={s} />}
      {tab === 'staff' && <Staff s={s} />}
    </div>
  );
}

function Stage({ s }: { s: GameState }) {
  const reqs = stageRequirements(s);
  const met = !!reqs && reqs.every((r) => r.met);
  return (
    <div className="grid g-main">
      <div className="stack">
        <Panel title="Facility stages" icon="lab">
          <div className="list">
            {STAGES.map((st) => {
              const cur = st.n === s.stage;
              const done = st.n < s.stage;
              return (
                <div className={`item${cur ? ' on' : ''}${!cur && !done ? ' dim' : ''}`} key={st.n} style={{ alignItems: 'flex-start' }}>
                  <Chip tone={done ? 'green' : cur ? 'gold' : 'muted'}>{done ? '✓' : st.n}</Chip>
                  <div className="grow-1">
                    <div className="item-title">{st.name}</div>
                    <div className="item-sub">{st.blurb}</div>
                    <div className="row wrap gap-s mt-s">
                      {st.perks.map((p) => (
                        <Chip key={p} tone={done || cur ? 'olive' : 'muted'}>
                          {p}
                        </Chip>
                      ))}
                    </div>
                  </div>
                  <div className="r muted" style={{ fontSize: 12, minWidth: 90 }}>
                    {st.baseRooms} rooms
                    <br />
                    {st.baseSlots} slots each
                  </div>
                </div>
              );
            })}
          </div>
        </Panel>
      </div>
      <div className="stack">
        <Panel title="Next expansion" icon="arrow">
          {reqs ? (
            <>
              <h2 style={{ marginBottom: 8 }}>{STAGES[s.stage].name}</h2>
              <ul className="reqs">
                {reqs.map((r) => (
                  <Req key={r.label} ok={r.met} have={r.have}>
                    {r.label}
                  </Req>
                ))}
              </ul>
              <div className="mt">
                <Btn kind="primary" disabled={!met} icon="arrow" onClick={() => act((g) => advanceStage(g))}>
                  Expand facility
                </Btn>
              </div>
            </>
          ) : (
            <Empty icon="star">You operate the largest botanical research institution there is.</Empty>
          )}
        </Panel>
        <Panel title="Rooms" icon="grow" sub={`${s.rooms.length}/${maxRooms(s)}`}>
          <div className="list">
            {s.rooms.map((r) => (
              <div className="item" key={r.id}>
                <div className="grow-1">
                  <div className="item-title">{r.name}</div>
                  <div className="item-sub">
                    {r.slots.filter((x) => x != null).length}/{r.slots.length} slots used · cap {roomSlotCap(s)}
                  </div>
                </div>
                <Btn small onClick={() => setUi({ view: 'cultivation', room: r.id })}>
                  Open
                </Btn>
              </div>
            ))}
          </div>
          {s.rooms.length < maxRooms(s) && (
            <div className="mt-s">
              <Btn small icon="plant" disabled={s.money < nextRoomCost(s)} onClick={() => act((g) => buildRoom(g))}>
                Build a room · {money(nextRoomCost(s))}
              </Btn>
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}

function Depts({ s }: { s: GameState }) {
  const ui = useUi();
  const cur = (ui.tab.dept ?? 'cultivation') as DeptId | 'facility';
  return (
    <>
      <div className="grid g4" style={{ marginBottom: 16 }}>
        {DEPTS.map((d) => {
          const st = deptStatus(s, d.id);
          const lvl = s.upgrades[`lvl_${d.id}`] ?? 0;
          return (
            <button key={d.id} type="button" className={`room-tab${cur === d.id ? ' on' : ''}`} onClick={() => setTab('dept', d.id)} style={{ opacity: st.unlocked ? 1 : 0.6 }}>
              <b>
                <Icon name={st.unlocked ? d.icon : 'lock'} size={14} /> {d.name}
              </b>
              <span>
                {st.unlocked ? `Level ${lvl}` : st.why}
                <br />
                {d.blurb}
              </span>
            </button>
          );
        })}
      </div>
      <Panel title={cur === 'facility' ? 'Facility upgrades' : `${DEPTS.find((d) => d.id === cur)?.name} upgrades`} icon="gear" right={
        <Btn small kind={cur === 'facility' ? 'primary' : 'ghost'} onClick={() => setTab('dept', cur === 'facility' ? 'cultivation' : 'facility')}>
          {cur === 'facility' ? 'Show departments' : 'Facility upgrades'}
        </Btn>
      }>
        <UpgradeList s={s} dept={cur} />
      </Panel>
    </>
  );
}

function Staff({ s }: { s: GameState }) {
  const cap = currentStaffCap(s);
  return (
    <div className="grid g-main">
      <Panel title="Your team" icon="users" sub={`${s.staff.length}/${cap}`}>
        {s.staff.length === 0 ? (
          <Empty icon="users">{s.stage < 3 ? 'Staff become available at Stage 3 (Genetics Laboratory).' : 'No staff yet. Hire your first team member.'}</Empty>
        ) : (
          <div className="list">
            {s.staff.map((m) => (
              <div className="item" key={m.id}>
                <Icon name="users" />
                <div className="grow-1">
                  <div className="item-title">
                    {m.name} <span className="muted">· {ROLES[m.role].name}</span>
                  </div>
                  <div className="item-sub">
                    Level {m.level}/{MAX_STAFF_LEVEL} · wage {money(wageOf(m.role, m.level))}/s
                  </div>
                </div>
                <div className="item-r">
                  <Btn small disabled={m.level >= MAX_STAFF_LEVEL || s.money < trainCost(m.role, m.level)} onClick={() => act((g) => trainStaff(g, m.id))}>
                    Train · {m.level >= MAX_STAFF_LEVEL ? 'max' : money(trainCost(m.role, m.level))}
                  </Btn>
                  <Btn small kind="ghost" onClick={() => askConfirm(`${m.name} will leave the team. You can hire a replacement at any time.`, () => act((g) => void fireStaff(g, m.id), true), { title: `Let ${m.name} go?`, confirm: 'Release', danger: true })}>
                    Release
                  </Btn>
                </div>
              </div>
            ))}
          </div>
        )}
        <Hint>Total wages: {money(totalWages(s))} per second.</Hint>
      </Panel>
      <Panel title="Hire" icon="plant">
        <div className="list">
          {(Object.keys(ROLES) as StaffRole[]).map((r) => (
            <div className="item" key={r}>
              <div className="grow-1">
                <div className="item-title">{ROLES[r].name}</div>
                <div className="item-sub">{ROLES[r].desc}</div>
              </div>
              <Btn small kind="primary" disabled={s.staff.length >= cap || s.money < hireCost(r, s.staff.length)} onClick={() => act((g) => hire(g, r))}>
                {money(hireCost(r, s.staff.length))}
              </Btn>
            </div>
          ))}
        </div>
        <Stat label="Wage bill" value={`${money(totalWages(s))}/s`} />
      </Panel>
    </div>
  );
}
