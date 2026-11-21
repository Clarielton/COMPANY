// =============================================================================
// LAYOUT DOS MENUS DA HUD (Responsivo + Redimensionável + Fixável + Persistente)
// Lógica pura (sem React/DOM obrigatório) para poder ser testada no Node.
// =============================================================================

export const HUD_LAYOUT_STORAGE_KEY = 'cof_hud_layout_v2';

export const HUD_SCALE_MIN = 0.5;
export const HUD_SCALE_MAX = 1.8;
export const HUD_SCALE_STEP = 0.1;

// Painéis da HUD controláveis pelo jogador
export const HUD_PANELS = [
  { id: 'theater', title: 'MAPA & TEATRO', grip: 'br' },
  { id: 'speed', title: 'RITMO TÁTICO', grip: 'br' },
  { id: 'command', title: 'COMANDO & BASE', grip: 'bl' },
  { id: 'hotbar', title: 'BARRA DE AÇÕES', grip: 'tr' },
  { id: 'squad', title: 'COMANDO DE ESQUADRÃO', grip: 'tl' },
];

export const HUD_PANEL_BY_ID = Object.fromEntries(HUD_PANELS.map((p) => [p.id, p]));

export const DEFAULT_PANEL_STATE = Object.freeze({
  scale: 1,
  pinned: true,
  collapsed: false,
  x: null, // posição livre (px na tela) após arrastar; null = posição padrão ancorada
  y: null,
});

export function clampHudScale(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 1;
  return Math.round(Math.min(HUD_SCALE_MAX, Math.max(HUD_SCALE_MIN, n)) * 100) / 100;
}

// Escala automática responsiva com base no tamanho da janela (referência 1680x940)
export function computeAutoHudScale(width, height) {
  const w = Number(width) || 1680;
  const h = Number(height) || 940;
  const s = Math.min(w / 1680, h / 940) * 1.08;
  return Math.round(Math.min(1.16, Math.max(0.68, s)) * 100) / 100;
}

export function sanitizePanelState(raw) {
  const src = raw && typeof raw === 'object' ? raw : {};
  const x = Number.isFinite(src.x) ? Math.round(src.x) : null;
  const y = Number.isFinite(src.y) ? Math.round(src.y) : null;
  return {
    scale: clampHudScale(src.scale ?? 1),
    pinned: Boolean(src.pinned),
    collapsed: Boolean(src.collapsed),
    x: x !== null && y !== null ? x : null,
    y: x !== null && y !== null ? y : null,
  };
}

export function createDefaultHudLayout(viewportWidth = 1680) {
  const layout = {};
  for (const p of HUD_PANELS) layout[p.id] = { ...DEFAULT_PANEL_STATE };
  // Celular: começa com o painel grande de Comando & Base recolhido para liberar a tela
  if (viewportWidth < 760) layout.command.collapsed = true;
  return layout;
}

export function sanitizeHudLayout(raw, viewportWidth = 1680) {
  const base = createDefaultHudLayout(viewportWidth);
  if (!raw || typeof raw !== 'object') return base;
  for (const p of HUD_PANELS) {
    if (raw[p.id]) base[p.id] = sanitizePanelState(raw[p.id]);
  }
  return base;
}

// Mantém um painel arrastado dentro da tela visível
export function clampPanelPosition(x, y, panelW, panelH, viewW, viewH, margin = 4) {
  const maxX = Math.max(margin, viewW - panelW - margin);
  const maxY = Math.max(margin, viewH - panelH - margin);
  return {
    x: Math.round(Math.min(maxX, Math.max(margin, x))),
    y: Math.round(Math.min(maxY, Math.max(margin, y))),
  };
}

export function loadHudLayout(storage, viewportWidth = 1680) {
  try {
    const txt = storage?.getItem?.(HUD_LAYOUT_STORAGE_KEY);
    return sanitizeHudLayout(txt ? JSON.parse(txt) : null, viewportWidth);
  } catch {
    return createDefaultHudLayout(viewportWidth);
  }
}

export function saveHudLayout(storage, layout) {
  try {
    storage?.setItem?.(HUD_LAYOUT_STORAGE_KEY, JSON.stringify(layout));
    return true;
  } catch {
    return false;
  }
}
