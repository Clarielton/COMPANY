import React from 'react';
import { WEAPONS } from '../game/data/weapons.js';

const SHOP_LIST = ['bat', 'knife', 'pistol', 'uzi', 'mp5', 'shotgun', 'ak47', 'm4', 'grenade'];

export default function AmmuNationModal({ hud, poiName, onBuyWeapon, onBuyAmmo, onBuyArmor, onBuyMedkit, onBribe, onClose }) {
  if (!hud) return null;

  return (
    <div className="modal-backdrop">
      <div className="shop-modal">
        <div className="shop-header">
          <div>
            <h2>{poiName || 'AMMU-NATION'}</h2>
            <p className="shop-sub">Equipamento tático, armamento pesado e proteção balística</p>
          </div>
          <div className="shop-balance">
            <span>SALDO:</span>
            <strong>${hud.money.toLocaleString()}</strong>
          </div>
        </div>

        <div className="shop-support-row">
          <button
            type="button"
            className="support-btn"
            disabled={hud.money < 500 || hud.armor >= hud.maxArmor}
            onClick={onBuyArmor}
          >
            <div>
              <strong>Colete Balístico (100%)</strong>
              <span>Atual: {hud.armor}/{hud.maxArmor}</span>
            </div>
            <span className="price-tag">$500</span>
          </button>

          <button
            type="button"
            className="support-btn"
            disabled={hud.money < 250 || hud.hp >= hud.maxHp}
            onClick={onBuyMedkit}
          >
            <div>
              <strong>Kit Médico Completo</strong>
              <span>Vida: {hud.hp}/{hud.maxHp}</span>
            </div>
            <span className="price-tag">$250</span>
          </button>

          <button
            type="button"
            className="support-btn bribe"
            disabled={hud.wanted.stars === 0 || hud.money < hud.wanted.bribeCost}
            onClick={onBribe}
          >
            <div>
              <strong>Subornar Polícia</strong>
              <span>{hud.wanted.stars > 0 ? `${hud.wanted.stars} Estrela(s)` : 'Ficha Limpa'}</span>
            </div>
            <span className="price-tag">
              {hud.wanted.stars > 0 ? `$${hud.wanted.bribeCost}` : '---'}
            </span>
          </button>
        </div>

        <div className="shop-grid">
          {SHOP_LIST.map((id) => {
            const w = WEAPONS[id];
            const st = hud.inventory[id];
            const owned = st?.owned;
            const fullAmmo = w.maxReserve > 0 && st.reserve >= w.maxReserve;

            return (
              <div key={id} className={`shop-item ${owned ? 'owned' : ''}`}>
                <div className="shop-item-top">
                  <strong>{w.name}</strong>
                  <span className="badge">{owned ? 'POSSUI' : `$${w.price}`}</span>
                </div>
                <div className="shop-item-stats">
                  Dano: {w.damage}{w.pellets > 1 ? `×${w.pellets}` : ''} • Alcance: {w.range}
                </div>
                <div className="shop-item-actions">
                  {!owned ? (
                    <button
                      type="button"
                      className="buy-btn"
                      disabled={hud.money < w.price}
                      onClick={() => onBuyWeapon(id)}
                    >
                      Comprar (${w.price})
                    </button>
                  ) : w.ammoPrice > 0 ? (
                    <button
                      type="button"
                      className="ammo-btn"
                      disabled={hud.money < w.ammoPrice || fullAmmo}
                      onClick={() => onBuyAmmo(id)}
                    >
                      {fullAmmo ? 'Munição Cheia' : `+${w.ammoPack} Munição ($${w.ammoPrice})`}
                    </button>
                  ) : (
                    <span className="owned-note">Equipada no Slot 1</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div className="shop-footer">
          <button type="button" className="close-btn" onClick={onClose}>
            Voltar às Ruas [ESC]
          </button>
        </div>
      </div>
    </div>
  );
}
