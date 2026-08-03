import { BUILD_SLOTS, Build, BuildSlot, Sheet } from '@exile/sim';
import { pool } from '../store';

const SLOT_LABEL: Record<BuildSlot, string> = {
  weapon: 'Weapon', offhand: 'Off-hand', helmet: 'Helmet', body: 'Body',
  gloves: 'Gloves', boots: 'Boots', belt: 'Belt', ring1: 'Ring', ring2: 'Ring',
  amulet: 'Amulet', flask1: 'Flask', flask2: 'Flask',
};

const CAT_CLASS: Record<string, string> = {
  unique: 'u', skill: 'g', support: 's', keystone: 'k', ascendancy: 'a',
};

function Row({ slot, id, corruptions }: { slot: string; id?: string; corruptions?: Build['corruptions'] }) {
  const entity = id ? pool.byId.get(id) : undefined;
  const corrupt = id && corruptions?.[id];
  const cls = entity
    ? `val ${CAT_CLASS[entity.category]}${corrupt === 'brick' ? ' bricked' : corrupt === 'upgrade' ? ' upgraded' : ''}`
    : 'val empty';
  return (
    <li>
      <span className="slot">{slot}</span>
      <span className={cls}>
        {entity ? entity.name : '—'}
        {corrupt === 'upgrade' ? ' ◆' : ''}
      </span>
    </li>
  );
}

export function BuildDoll({ build, sheet, name }: { build: Build; sheet: Sheet | null; name: string }) {
  const fmt = (n: number) => n.toLocaleString('en-US');
  return (
    <aside className="doll" aria-label="Your build in progress">
      <h2>The Exile</h2>
      <div className="build-name">{name || 'as yet unnamed'}</div>
      <ul>
        <Row slot="Skill" id={build.skill} corruptions={build.corruptions} />
        {Array.from({ length: 4 }, (_, i) => (
          <Row key={i} slot={`Support ${i + 1}`} id={build.supports[i]} corruptions={build.corruptions} />
        ))}
        <Row slot="Ascendancy" id={build.ascendancy} />
        <Row slot="Keystone" id={build.keystones[0]} />
        <Row slot="Keystone" id={build.keystones[1]} />
      </ul>
      <div className="rule smallcaps">Gear</div>
      <ul>
        {BUILD_SLOTS.map((s) => (
          <Row key={s} slot={SLOT_LABEL[s]} id={build.gear[s]} corruptions={build.corruptions} />
        ))}
      </ul>
      {sheet && (
        <>
          <div className="rule smallcaps">The Sheet</div>
          <div className="sheet-row"><span>DPS</span><strong>{fmt(sheet.dps)}</strong></div>
          <div className="sheet-row"><span>Effective HP</span><strong>{fmt(sheet.ehp)}</strong></div>
          <div className="sheet-row"><span>Resistances</span><strong>{sheet.resists}%</strong></div>
          <div className="sheet-row"><span>Synergy</span><strong>+{sheet.synergyBonusPct}%</strong></div>
          {sheet.combos.map((c) => (
            <div key={c.name} className="combo-line">✦ {c.name} ×{c.multiplier}</div>
          ))}
        </>
      )}
    </aside>
  );
}
