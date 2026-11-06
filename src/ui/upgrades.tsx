// Department and facility upgrades, shared by the Laboratory and the department pages.

import { UPGRADES, buyUpgrade, upgradeStatus, type DeptId, type GameState } from '../engine';
import { act } from '../store';
import { Bar, Btn, Chip } from './kit';
import { money } from './format';

export function UpgradeList({ s, dept }: { s: GameState; dept: DeptId | 'facility' }) {
  const list = UPGRADES.filter((u) => u.dept === dept);
  return (
    <div className="list">
      {list.map((u) => {
        const st = upgradeStatus(s, u.id);
        const maxed = st.level >= st.max;
        return (
          <div className={`item${!st.ok && !maxed ? ' dim' : ''}`} key={u.id}>
            <div className="grow-1">
              <div className="row between">
                <span className="item-title">{u.name}</span>
                <span className="muted num" style={{ fontSize: 12 }}>
                  {st.level}/{st.max}
                </span>
              </div>
              <div className="item-sub">{u.desc}</div>
              <Bar value={st.level} max={st.max} thin tone="olive" />
              {!st.ok && !maxed && st.why && (
                <div style={{ marginTop: 4 }}>
                  <Chip tone="muted">{st.why}</Chip>
                </div>
              )}
            </div>
            <Btn small kind={st.ok ? 'primary' : 'default'} disabled={!st.ok || s.money < st.cost} onClick={() => act((g) => buyUpgrade(g, u.id))}>
              {maxed ? 'Max' : money(st.cost)}
            </Btn>
          </div>
        );
      })}
    </div>
  );
}
