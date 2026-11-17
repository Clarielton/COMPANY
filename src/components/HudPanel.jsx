import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  HUD_PANEL_BY_ID,
  HUD_SCALE_STEP,
  DEFAULT_PANEL_STATE,
  clampHudScale,
  clampPanelPosition,
  computeAutoHudScale,
  createDefaultHudLayout,
  loadHudLayout,
  saveHudLayout,
} from '../game/ui/hudLayout.js';

const getStorage = () => (typeof window !== 'undefined' ? window.localStorage : null);
const viewW = () => (typeof window !== 'undefined' ? window.innerWidth : 1680);
const viewH = () => (typeof window !== 'undefined' ? window.innerHeight : 940);

// =============================================================================
// HOOK: estado global do layout da HUD (escala, fixar, recolher, posição livre)
// =============================================================================
export function useHudLayout() {
  const [layout, setLayout] = useState(() => loadHudLayout(getStorage(), viewW()));
  const [autoScale, setAutoScale] = useState(() => computeAutoHudScale(viewW(), viewH()));

  useEffect(() => {
    const onResize = () => setAutoScale(computeAutoHudScale(viewW(), viewH()));
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onResize);
    };
  }, []);

  useEffect(() => {
    saveHudLayout(getStorage(), layout);
  }, [layout]);

  const updatePanel = useCallback((id, patch) => {
    setLayout((prev) => ({
      ...prev,
      [id]: { ...DEFAULT_PANEL_STATE, ...prev[id], ...patch },
    }));
  }, []);

  const resetPanel = useCallback((id) => {
    setLayout((prev) => ({ ...prev, [id]: { ...DEFAULT_PANEL_STATE } }));
  }, []);

  const resetAll = useCallback(() => setLayout(createDefaultHudLayout(viewW())), []);

  const setAllPinned = useCallback((pinned) => {
    setLayout((prev) => {
      const next = {};
      for (const id of Object.keys(prev)) next[id] = { ...prev[id], pinned };
      return next;
    });
  }, []);

  const allPinned = useMemo(() => Object.values(layout).every((p) => p.pinned), [layout]);

  return { layout, autoScale, updatePanel, resetPanel, resetAll, setAllPinned, allPinned };
}

// =============================================================================
// COMPONENTE: Painel da HUD com barra de controle (arrastar, −/+, fixar, recolher)
// =============================================================================
export function HudPanel({ id, className = '', layoutApi, children }) {
  const ref = useRef(null);
  const def = HUD_PANEL_BY_ID[id] || { title: id, grip: 'br' };
  const st = { ...DEFAULT_PANEL_STATE, ...(layoutApi.layout[id] || {}) };
  const zoom = Math.min(2, Math.max(0.4, st.scale * layoutApi.autoScale));
  const moved = st.x !== null && st.y !== null;

  // Com CSS zoom, os comprimentos do próprio elemento são multiplicados pelo zoom → dividimos
  const style = { zoom, '--hud-zoom': zoom };
  if (moved) {
    style.left = `${st.x / zoom}px`;
    style.top = `${st.y / zoom}px`;
    style.right = 'auto';
    style.bottom = 'auto';
    style.transform = 'none';
  }

  const changeScale = (delta) => {
    if (st.pinned) return;
    layoutApi.updatePanel(id, { scale: clampHudScale(st.scale + delta) });
  };

  // ARRASTAR PAINEL (Mouse + Touch via Pointer Events)
  const onDragStart = (e) => {
    if (st.pinned || !ref.current) return;
    if (e.target.closest('.hud-panel-ctrl')) return;
    e.preventDefault();
    e.stopPropagation();
    const el = ref.current;
    const rect = el.getBoundingClientRect();
    const startX = e.clientX;
    const startY = e.clientY;
    let last = { x: rect.left, y: rect.top };
    el.classList.add('hud-panel-dragging');
    e.currentTarget.setPointerCapture?.(e.pointerId);

    const onMove = (ev) => {
      last = clampPanelPosition(
        rect.left + (ev.clientX - startX),
        rect.top + (ev.clientY - startY),
        rect.width,
        rect.height,
        viewW(),
        viewH()
      );
      el.style.left = `${last.x / zoom}px`;
      el.style.top = `${last.y / zoom}px`;
      el.style.right = 'auto';
      el.style.bottom = 'auto';
      el.style.transform = 'none';
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      el.classList.remove('hud-panel-dragging');
      layoutApi.updatePanel(id, { x: last.x, y: last.y });
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
  };

  // REDIMENSIONAR MANUALMENTE PELA ALÇA DO CANTO (arrastar para aumentar/diminuir)
  const onResizeStart = (e) => {
    if (st.pinned) return;
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startY = e.clientY;
    const startScale = st.scale;
    const sx = def.grip.includes('r') ? 1 : -1;
    const sy = def.grip.includes('b') ? 1 : -1;
    e.currentTarget.setPointerCapture?.(e.pointerId);

    const onMove = (ev) => {
      const delta = ((ev.clientX - startX) * sx + (ev.clientY - startY) * sy) / 2;
      layoutApi.updatePanel(id, { scale: clampHudScale(startScale + delta / 260) });
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
  };

  const classes = [
    className,
    'hud-panel',
    st.pinned ? 'hud-panel-pinned' : '',
    st.collapsed ? 'hud-panel-collapsed' : '',
    moved ? 'hud-panel-moved' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div ref={ref} className={classes} style={style} data-hud-panel={id}>
      {st.pinned ? (
        <button
          type="button"
          className="hud-panel-pin-badge hud-panel-ctrl"
          onClick={() => layoutApi.updatePanel(id, { pinned: false })}
          title={`${def.title}: painel FIXADO — clique para soltar (mover/redimensionar)`}
        >
          📌
        </button>
      ) : (
        <div
          className="hud-panel-bar"
          onPointerDown={onDragStart}
          onDoubleClick={() => layoutApi.resetPanel(id)}
          title="Arraste para mover • Duplo clique para restaurar posição/tamanho"
        >
          <span className="hud-panel-title">⠿ {def.title}</span>
          <div className="hud-panel-ctrls">
            <button
              type="button"
              className="hud-panel-ctrl"
              onClick={() => changeScale(-HUD_SCALE_STEP)}
              title="Diminuir painel"
            >
              −
            </button>
            <span className="hud-panel-scale">{Math.round(st.scale * 100)}%</span>
            <button
              type="button"
              className="hud-panel-ctrl"
              onClick={() => changeScale(HUD_SCALE_STEP)}
              title="Aumentar painel"
            >
              +
            </button>
            <button
              type="button"
              className="hud-panel-ctrl"
              onClick={() => layoutApi.updatePanel(id, { collapsed: !st.collapsed })}
              title={st.collapsed ? 'Expandir painel' : 'Recolher painel'}
            >
              {st.collapsed ? '▸' : '▾'}
            </button>
            <button
              type="button"
              className="hud-panel-ctrl"
              onClick={() => layoutApi.resetPanel(id)}
              title="Restaurar posição e tamanho padrão"
            >
              ⟲
            </button>
            <button
              type="button"
              className="hud-panel-ctrl pin"
              onClick={() => layoutApi.updatePanel(id, { pinned: true })}
              title="Fixar painel (trava posição e tamanho)"
            >
              📌
            </button>
          </div>
        </div>
      )}

      {!st.collapsed && children}

      {!st.pinned && !st.collapsed && (
        <div
          className={`hud-panel-grip grip-${def.grip}`}
          onPointerDown={onResizeStart}
          title="Arraste para aumentar/diminuir o painel"
        />
      )}
    </div>
  );
}
