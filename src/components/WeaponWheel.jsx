import React from 'react';
import { WEAPON_CATEGORIES, WEAPONS_BY_SLOT } from '../game/data/weapons.js';

export default function WeaponWheel({ hud, onSelectWeapon, onClose }) {
  if (!hud) return null;

  return (
    <div className="wheel-backdrop" onClick={onClose}>
      <div className="wheel-container" onClick={(e) => e.stopPropagation()}>
        <div className="wheel-center">
          <div className="wheel-title">ARSENAL</div>
          <div className="wheel-equipped">{hud.weaponName}</div>
          {hud.magSize > 0 ? (
            <div className="wheel-ammo">
              {hud.mag} / {hud.reserve}
            </div>
          ) : (
            <div className="wheel-ammo">CORPO A CORPO</div>
          )}
        </div>

        {WEAPON_CATEGORIES.map((cat, idx) => {
          const angle = (idx / WEAPON_CATEGORIES.length) * Math.PI * 2 - Math.PI / 2;
          const r = 148;
          const x = Math.cos(angle) * r;
          const y = Math.sin(angle) * r;
          const list = WEAPONS_BY_SLOT[cat.slot].filter((w) => hud.inventory[w.id]?.owned);
          const active = hud.weaponSlot === cat.slot;

          return (
            <div
              key={cat.slot}
              className={`wheel-slice ${active ? 'active' : ''} ${list.length === 0 ? 'empty' : ''}`}
              style={{ transform: `translate(${x}px, ${y}px)` }}
            >
              <div className="slice-key">[{cat.key}] {cat.short}</div>
              <div className="slice-weapons">
                {list.length === 0 ? (
                  <span className="slice-none">Sem arma</span>
                ) : (
                  list.map((w) => {
                    const st = hud.inventory[w.id];
                    const isCur = hud.equippedId === w.id;
                    return (
                      <button
                        key={w.id}
                        type="button"
                        className={`slice-btn ${isCur ? 'selected' : ''}`}
                        onClick={() => onSelectWeapon(w.id)}
                      >
                        <span>{w.name}</span>
                        {w.magSize > 0 && (
                          <small>{st.mag + st.reserve}</small>
                        )}
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
