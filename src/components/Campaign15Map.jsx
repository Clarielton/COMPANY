import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  CONTINENT_MAP_W,
  CONTINENT_MAP_H,
  CONTINENTAL_EDGES,
  CONTINENTAL_TERRITORIES,
  MARCH_UNIT_CATEGORIES,
  TERRITORY_BY_ID,
  calculateMarchDurationMs,
  formatCountdownMs,
  formatRemainingDaysHours,
  getTerritoryNeighbors,
} from '../game/data/campaign15Data.js';

const KIND_META = {
  capital: { badge: '★', label: 'Capital', color: '#facc15' },
  industrial: { badge: '⚙', label: 'Centro Industrial (+SUP/h)', color: '#60a5fa' },
  arsenal: { badge: '✦', label: 'Arsenal (+MUN/h)', color: '#f97316' },
  refinery: { badge: '⛽', label: 'Refinaria (+COMB/h)', color: '#38bdf8' },
  airbase: { badge: '✈', label: 'Base Aérea', color: '#a78bfa' },
  fortress: { badge: '⛨', label: 'Fortaleza de Fronteira', color: '#cbd5e1' },
};

const BIOME_LABELS = {
  normandy_fields: 'Campos da Normandia',
  el_alamein_ridge: 'Deserto de El Alamein',
  bastogne_winter: 'Inverno de Bastogne',
};

const RES_SHORT = {
  supplies: 'SUP/h',
  ammo: 'MUN/h',
  fuel: 'COMB/h',
};

const MIN_ZOOM = 0.6;
const MAX_ZOOM = 2.8;

export function Campaign15Map({
  campaign,
  uid,
  networkManager,
  onLaunchTerritory3D,
  onClose,
}) {
  const [selectedId, setSelectedId] = useState(null);
  const [unitCategory, setUnitCategory] = useState('mechanized');
  const [marchTargetId, setMarchTargetId] = useState('');
  const [marchOriginId, setMarchOriginId] = useState('');
  const [marchCount, setMarchCount] = useState(1);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [zoom, setZoom] = useState(1.35);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');

  const viewportRef = useRef(null);
  const panRef = useRef(pan);
  const zoomRef = useRef(zoom);
  panRef.current = pan;
  zoomRef.current = zoom;

  const dragRef = useRef({ active: false, startX: 0, startY: 0, origX: 0, origY: 0 });
  const pinchRef = useRef({ active: false, dist: 0, midX: 0, midY: 0 });

  const territories = campaign?.territories || {};
  const marches = campaign?.marches || [];
  const remainingMs = Math.max(0, (campaign?.endsAt || nowMs) - nowMs);
  const { days, hours } = formatRemainingDaysHours(remainingMs);
  const opShort = (campaign?.id || 'OP').slice(-6).toUpperCase();

  const playerCapital = useMemo(() => {
    const capId = campaign?.players?.[uid]?.capitalId;
    if (capId && TERRITORY_BY_ID[capId]) return TERRITORY_BY_ID[capId];
    const owned = CONTINENTAL_TERRITORIES.find((t) => territories[t.id]?.ownerUid === uid);
    return owned || TERRITORY_BY_ID.cap_01;
  }, [campaign, territories, uid]);

  const centerOnTerritory = useCallback((terr, targetZoom = 1.35) => {
    if (!terr) return;
    const vw =
      viewportRef.current?.clientWidth ||
      (typeof window !== 'undefined' ? window.innerWidth - 360 : 960);
    const vh =
      viewportRef.current?.clientHeight ||
      (typeof window !== 'undefined' ? window.innerHeight - 96 : 640);
    const z = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, targetZoom));
    setZoom(z);
    setPan({
      x: Math.round(vw * 0.5 - terr.x * z),
      y: Math.round(vh * 0.5 - terr.y * z),
    });
  }, []);

  const showOverview = useCallback(() => {
    const vw =
      viewportRef.current?.clientWidth ||
      (typeof window !== 'undefined' ? window.innerWidth - 380 : 960);
    const vh =
      viewportRef.current?.clientHeight ||
      (typeof window !== 'undefined' ? window.innerHeight - 96 : 640);
    const z = MIN_ZOOM;
    setZoom(z);
    setPan({
      x: Math.round((vw - CONTINENT_MAP_W * z) * 0.5),
      y: Math.round((vh - CONTINENT_MAP_H * z) * 0.5),
    });
  }, []);

  useEffect(() => {
    if (playerCapital) {
      setSelectedId((prev) => prev || playerCapital.id);
      centerOnTerritory(playerCapital, 1.35);
    }
  }, [playerCapital, centerOnTerritory]);

  useEffect(() => {
    const id = setInterval(() => {
      const t = Date.now();
      setNowMs(t);
      networkManager?.tickCloudCampaignMarches?.(t);
    }, 1000);
    return () => clearInterval(id);
  }, [networkManager]);

  const { ownedCount, supPerHour, munPerHour, combPerHour } = useMemo(() => {
    let cnt = 0;
    let sup = 0;
    let mun = 0;
    let comb = 0;
    for (const t of CONTINENTAL_TERRITORIES) {
      if (territories[t.id]?.ownerUid === uid) {
        cnt += 1;
        if (t.resourceType === 'ammo') mun += t.hourlyBonus || 0;
        else if (t.resourceType === 'fuel') comb += t.hourlyBonus || 0;
        else sup += t.hourlyBonus || 0;
      }
    }
    return { ownedCount: cnt, supPerHour: sup, munPerHour: mun, combPerHour: comb };
  }, [territories, uid]);

  const selectedTerritory = selectedId ? TERRITORY_BY_ID[selectedId] : null;
  const selectedState = selectedId ? territories[selectedId] : null;
  const isSelectedMine = selectedState?.ownerUid === uid;

  const neighborsOfSelected = useMemo(() => {
    if (!selectedId) return [];
    return getTerritoryNeighbors(selectedId).map((n) => ({
      ...n,
      meta: TERRITORY_BY_ID[n.id],
      state: territories[n.id],
    }));
  }, [selectedId, territories]);

  const adjacentOwned = useMemo(
    () =>
      neighborsOfSelected.filter(
        (n) => n.state?.ownerUid === uid && (n.state?.garrison || 0) >= 1
      ),
    [neighborsOfSelected, uid]
  );

  const isSelectedScouted = useMemo(() => {
    if (!selectedId) return false;
    if (isSelectedMine) return true;
    return neighborsOfSelected.some((n) => n.state?.ownerUid === uid);
  }, [selectedId, isSelectedMine, neighborsOfSelected, uid]);

  useEffect(() => {
    if (isSelectedMine) {
      if (
        neighborsOfSelected.length > 0 &&
        !neighborsOfSelected.some((n) => n.id === marchTargetId)
      ) {
        setMarchTargetId(neighborsOfSelected[0].id);
      }
    } else if (adjacentOwned.length > 0 && !adjacentOwned.some((a) => a.id === marchOriginId)) {
      setMarchOriginId(adjacentOwned[0].id);
    } else if (adjacentOwned.length === 0) {
      setMarchOriginId('');
    }
  }, [isSelectedMine, neighborsOfSelected, adjacentOwned, marchTargetId, marchOriginId]);

  const activeOriginId = isSelectedMine ? selectedId : marchOriginId;
  const activeDestId = isSelectedMine ? marchTargetId : selectedId;

  const previewDurationMs = useMemo(() => {
    if (!activeOriginId || !activeDestId) return 0;
    return calculateMarchDurationMs(activeOriginId, activeDestId, unitCategory);
  }, [activeOriginId, activeDestId, unitCategory]);

  const zoomAtPoint = useCallback((nextZoom, clientX, clientY) => {
    const rect = viewportRef.current?.getBoundingClientRect();
    const clamped = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, Number(nextZoom.toFixed(2))));
    if (!rect) {
      setZoom(clamped);
      return;
    }
    const curZ = zoomRef.current;
    const curPan = panRef.current;
    const wx = (clientX - rect.left - curPan.x) / curZ;
    const wy = (clientY - rect.top - curPan.y) / curZ;
    setZoom(clamped);
    setPan({
      x: Math.round(clientX - rect.left - wx * clamped),
      y: Math.round(clientY - rect.top - wy * clamped),
    });
  }, []);

  const handleWheel = (e) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.12 : 0.89;
    zoomAtPoint(zoomRef.current * factor, e.clientX, e.clientY);
  };

  const handleMouseDown = (e) => {
    if (e.target.closest('[data-terr-node="1"]')) return;
    setIsDragging(true);
    dragRef.current = {
      active: true,
      startX: e.clientX,
      startY: e.clientY,
      origX: panRef.current.x,
      origY: panRef.current.y,
    };
  };

  const handleMouseMove = (e) => {
    if (!dragRef.current.active) return;
    setPan({
      x: dragRef.current.origX + (e.clientX - dragRef.current.startX),
      y: dragRef.current.origY + (e.clientY - dragRef.current.startY),
    });
  };

  const handleMouseUp = () => {
    dragRef.current.active = false;
    setIsDragging(false);
  };

  const handleTouchStart = (e) => {
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      pinchRef.current = {
        active: true,
        dist: Math.hypot(dx, dy) || 1,
        midX: (e.touches[0].clientX + e.touches[1].clientX) * 0.5,
        midY: (e.touches[0].clientY + e.touches[1].clientY) * 0.5,
      };
      dragRef.current.active = false;
    } else if (e.touches.length === 1 && !e.target.closest('[data-terr-node="1"]')) {
      dragRef.current = {
        active: true,
        startX: e.touches[0].clientX,
        startY: e.touches[0].clientY,
        origX: panRef.current.x,
        origY: panRef.current.y,
      };
    }
  };

  const handleTouchMove = (e) => {
    if (e.touches.length === 2 && pinchRef.current.active) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const newDist = Math.hypot(dx, dy) || 1;
      const ratio = newDist / pinchRef.current.dist;
      pinchRef.current.dist = newDist;
      zoomAtPoint(zoomRef.current * ratio, pinchRef.current.midX, pinchRef.current.midY);
    } else if (e.touches.length === 1 && dragRef.current.active) {
      setPan({
        x: dragRef.current.origX + (e.touches[0].clientX - dragRef.current.startX),
        y: dragRef.current.origY + (e.touches[0].clientY - dragRef.current.startY),
      });
    }
  };

  const handleTouchEnd = () => {
    pinchRef.current.active = false;
    dragRef.current.active = false;
  };

  const handleDispatchMarch = async () => {
    if (!activeOriginId || !activeDestId) return;
    const res = await networkManager.dispatchStrategicMarch({
      fromId: activeOriginId,
      toId: activeDestId,
      unitCategory,
      count: Math.max(1, Number(marchCount) || 1),
    });
    if (!res?.ok) {
      setStatusMsg(res?.error || 'Não foi possível enviar a marcha.');
    } else {
      setStatusMsg(
        `Marcha enviada: ${TERRITORY_BY_ID[activeOriginId]?.name} ➔ ${TERRITORY_BY_ID[activeDestId]?.name}!`
      );
    }
  };

  const handleBuildDefense = async (type) => {
    if (!selectedTerritory || !isSelectedMine) return;
    const curForts = selectedState?.fortifications || { walls: 0, bunkers: 0, trenches: 0 };
    const nextForts = { ...curForts, [type]: (curForts[type] || 0) + 1 };
    await networkManager?.syncCampaignTerritoryFortifications?.(selectedTerritory.id, {
      fortifications: nextForts,
    });
    setStatusMsg(
      `${type === 'walls' ? 'Muralha' : type === 'bunkers' ? 'Bunker .50cal' : 'Trincheira'} adicionado em ${selectedTerritory.name} (salvo na nuvem)!`
    );
  };

  const getTroopBreakdown = (st) => {
    const gar = st?.garrison || 0;
    const inf = st?.troops?.infantry ?? Math.ceil(gar * 0.65);
    const arm = st?.troops?.armor ?? Math.max(0, gar - inf);
    const forts = st?.fortifications || {};
    const defCount = (forts.walls || 0) + (forts.bunkers || 0) + (forts.trenches || 0);
    return { gar, inf, arm, defCount };
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        width: '100vw',
        height: '100vh',
        zIndex: 9500,
        display: 'flex',
        flexDirection: 'column',
        background: '#090e09',
        color: '#f1f5f9',
      }}
    >
      {/* 2. Barra Superior Completa de Comando do Mapa Continental */}
      <div
        style={{
          background: 'rgba(13, 19, 13, 0.98)',
          borderBottom: '1px solid rgba(250, 204, 21, 0.35)',
          padding: '10px 16px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 10,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          {onClose && (
            <button type="button" className="mil-btn-secondary" onClick={onClose}>
              ⬅️ VOLTAR AO HUB
            </button>
          )}
          <button
            type="button"
            className="mil-btn-primary"
            onClick={() => {
              setSelectedId(playerCapital.id);
              centerOnTerritory(playerCapital, 1.35);
            }}
          >
            🎯 MINHA CAPITAL
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <button
              type="button"
              className="mil-pill"
              onClick={() => setZoom((z) => Math.max(MIN_ZOOM, Number((z - 0.15).toFixed(2))))}
            >
              🔍 −
            </button>
            <span className="mp-ping-badge">{Math.round(zoom * 100)}%</span>
            <button
              type="button"
              className="mil-pill"
              onClick={() => setZoom((z) => Math.min(MAX_ZOOM, Number((z + 0.15).toFixed(2))))}
            >
              🔍 +
            </button>
            <button type="button" className="mil-pill" onClick={showOverview}>
              🌐 Visão Geral
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span className="mp-ping-badge">📦 {supPerHour} SUP/h</span>
          <span className="mp-ping-badge">💣 {munPerHour} MUN/h</span>
          <span className="mp-ping-badge">⛽ {combPerHour} COMB/h</span>
          <span
            className="mp-ping-badge"
            style={{
              borderColor: ownedCount >= 3 ? '#4ade80' : '#facc15',
              color: ownedCount >= 3 ? '#86efac' : '#fde047',
            }}
          >
            🚩 Territórios: {ownedCount}/40 (QG Nível 3 requer 3)
          </span>
          <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
            Op. #{opShort} • {days}d {hours}h
          </span>
        </div>
      </div>

      {/* Área Principal: Mapa + Painel Lateral */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>
        <div
          ref={viewportRef}
          onWheel={handleWheel}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          style={{
            position: 'relative',
            flex: 1,
            overflow: 'hidden',
            background: '#0f2332',
            cursor: isDragging ? 'grabbing' : 'grab',
            userSelect: 'none',
            touchAction: 'none',
          }}
        >
          <div
            style={{
              position: 'absolute',
              left: pan.x,
              top: pan.y,
              width: CONTINENT_MAP_W,
              height: CONTINENT_MAP_H,
              transform: `scale(${zoom})`,
              transformOrigin: '0 0',
            }}
          >
            {/* Mapa Geográfico Continental Realista */}
            <svg
              width={CONTINENT_MAP_W}
              height={CONTINENT_MAP_H}
              style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
            >
              <defs>
                <linearGradient id="landGrad" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#35462b" />
                  <stop offset="55%" stopColor="#454d2d" />
                  <stop offset="100%" stopColor="#584b2c" />
                </linearGradient>
              </defs>

              <path
                d="M 85,120 L 660,70 L 1220,65 L 1820,85 L 2290,120 L 2340,560 L 2320,980 L 2290,1410 L 1760,1435 L 1240,1445 L 690,1430 L 160,1410 L 90,990 L 75,540 Z"
                fill="url(#landGrad)"
                stroke="#7c734e"
                strokeWidth="8"
              />
              <ellipse cx="1450" cy="720" rx="520" ry="360" fill="rgba(118, 102, 58, 0.28)" />
              <ellipse cx="520" cy="640" rx="340" ry="280" fill="rgba(52, 78, 44, 0.35)" />

              <path
                d="M 1180,65 C 1220,340 1280,580 1210,820 C 1150,1040 1290,1240 1260,1445"
                fill="none"
                stroke="#2563eb"
                strokeWidth="16"
                opacity="0.55"
              />
              <path
                d="M 110,610 C 480,560 820,680 1210,820"
                fill="none"
                stroke="#2563eb"
                strokeWidth="11"
                opacity="0.48"
              />

              {[
                [1340, 460],
                [1390, 485],
                [1440, 460],
                [960, 1240],
                [1020, 1260],
                [1080, 1235],
                [1980, 740],
                [2030, 765],
              ].map(([mx, my], idx) => (
                <polygon
                  key={idx}
                  points={`${mx},${my - 28} ${mx - 24},${my + 16} ${mx + 24},${my + 16}`}
                  fill="#44403c"
                  stroke="#a8a29e"
                  strokeWidth="2"
                  opacity="0.72"
                />
              ))}

              {CONTINENTAL_EDGES.map((e) => {
                const a = TERRITORY_BY_ID[e.from];
                const b = TERRITORY_BY_ID[e.to];
                if (!a || !b) return null;
                const isConnectedToSelected =
                  selectedId && (e.from === selectedId || e.to === selectedId);
                const stroke = isConnectedToSelected
                  ? '#fde047'
                  : e.roadType === 'rail'
                    ? '#cbd5e1'
                    : e.roadType === 'bridge'
                      ? '#38bdf8'
                      : '#d6b47c';
                return (
                  <line
                    key={`${e.from}-${e.to}`}
                    x1={a.x}
                    y1={a.y}
                    x2={b.x}
                    y2={b.y}
                    stroke={stroke}
                    strokeWidth={isConnectedToSelected ? 8 : e.roadType === 'rail' ? 4 : 5}
                    strokeDasharray={
                      isConnectedToSelected
                        ? undefined
                        : e.roadType === 'rail'
                          ? '12 7'
                          : e.roadType === 'bridge'
                            ? '8 5'
                            : undefined
                    }
                    opacity={isConnectedToSelected ? 1 : 0.68}
                  />
                );
              })}

              {marches.map((m) => {
                const a = TERRITORY_BY_ID[m.fromId];
                const b = TERRITORY_BY_ID[m.toId];
                if (!a || !b) return null;
                const total = Math.max(1, (m.arrivalTimestamp || 0) - (m.startTimestamp || 0));
                const prog = Math.max(0, Math.min(1, (nowMs - (m.startTimestamp || nowMs)) / total));
                const mx = a.x + (b.x - a.x) * prog;
                const my = a.y + (b.y - a.y) * prog;
                const rem = Math.max(0, (m.arrivalTimestamp || nowMs) - nowMs);
                const cat = MARCH_UNIT_CATEGORIES.find((c) => c.id === m.unitCategory);
                const col = cat?.color || '#fde047';
                return (
                  <g key={m.id}>
                    <line
                      x1={a.x}
                      y1={a.y}
                      x2={b.x}
                      y2={b.y}
                      stroke={col}
                      strokeWidth={7}
                      strokeDasharray="14 8"
                      opacity={0.95}
                    />
                    <circle cx={mx} cy={my} r={16} fill={col} stroke="#090d09" strokeWidth={3} />
                    <rect
                      x={mx - 108}
                      y={my - 48}
                      width={216}
                      height={26}
                      rx={6}
                      fill="rgba(10,14,10,0.95)"
                      stroke={col}
                      strokeWidth={2}
                    />
                    <text
                      x={mx}
                      y={my - 30}
                      textAnchor="middle"
                      fill="#f8fafc"
                      fontSize="13"
                      fontWeight="800"
                    >
                      {`⏱ Chegada em: ${formatCountdownMs(rem)}`}
                    </text>
                  </g>
                );
              })}
            </svg>

            {/* 3. Cartões de Território Sem Texto Cortado (Dynamic LOD Cards) */}
            {CONTINENTAL_TERRITORIES.map((t) => {
              const st = territories[t.id] || {};
              const isMine = st.ownerUid === uid;
              const isNeutral = !st.ownerUid;
              const isCap = t.id === playerCapital?.id;
              const km = KIND_META[t.kind] || KIND_META.fortress;
              const borderCol = isCap ? '#facc15' : isMine ? '#38bdf8' : isNeutral ? '#94a3b8' : '#ef4444';
              const isSelected = selectedId === t.id;
              const { gar, defCount } = getTroopBreakdown(st);
              const isAttackable =
                !isMine &&
                getTerritoryNeighbors(t.id).some(
                  (n) => territories[n.id]?.ownerUid === uid && (territories[n.id]?.garrison || 0) >= 1
                );
              return (
                <button
                  key={t.id}
                  type="button"
                  data-terr-node="1"
                  onMouseDown={(e) => e.stopPropagation()}
                  onTouchStart={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedId(t.id);
                  }}
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    if (isMine || isAttackable) {
                      onLaunchTerritory3D?.(t, st);
                    } else {
                      setSelectedId(t.id);
                      setStatusMsg('⚠️ Conquiste um território vizinho conectado para poder invadir aqui.');
                    }
                  }}
                  style={{
                    position: 'absolute',
                    left: t.x - 104,
                    top: t.y - 44,
                    minWidth: 208,
                    maxWidth: 232,
                    padding: '7px 10px',
                    borderRadius: 8,
                    zIndex: isSelected ? 40 : 30,
                    pointerEvents: 'auto',
                    background: isSelected
                      ? 'rgba(30, 58, 95, 0.98)'
                      : isMine
                        ? 'rgba(14, 44, 66, 0.95)'
                        : isNeutral
                          ? 'rgba(26, 32, 24, 0.94)'
                          : 'rgba(66, 20, 20, 0.95)',
                    border: `2.5px solid ${isSelected ? '#ffffff' : borderCol}`,
                    color: '#f8fafc',
                    cursor: 'pointer',
                    textAlign: 'left',
                    boxShadow: isSelected
                      ? '0 0 24px rgba(250, 204, 21, 0.85)'
                      : isCap
                        ? '0 0 24px rgba(250, 204, 21, 0.72)'
                        : '0 4px 12px rgba(0,0,0,0.65)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 800, gap: 6 }}>
                    <span style={{ color: km.color }}>
                      {km.badge} +{t.hourlyBonus} {RES_SHORT[t.resourceType] || 'SUP/h'}
                    </span>
                    <span>🪖 {gar} | 🛡️ {defCount}</span>
                  </div>
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 800,
                      marginTop: 3,
                      lineHeight: 1.2,
                      whiteSpace: 'normal',
                      wordBreak: 'break-word',
                    }}
                  >
                    {t.name}
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: borderCol, marginTop: 2 }}>
                    {isMine ? '🔵 Você (Aliados)' : isNeutral ? '⚪ Neutro' : `🔴 ${st.ownerName || 'Inimigo'}`}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Legenda Fixa no Canto Inferior Esquerdo */}
          <div
            style={{
              position: 'absolute',
              left: 14,
              bottom: 14,
              zIndex: 50,
              padding: '8px 12px',
              borderRadius: 8,
              background: 'rgba(10, 15, 10, 0.9)',
              border: '1px solid rgba(148, 163, 184, 0.35)',
              fontSize: '0.82rem',
              fontWeight: 600,
              color: '#e2e8f0',
              pointerEvents: 'none',
            }}
          >
            🔵 Azul = Seu Território | 🔴 Vermelho = Inimigos (14 Comandantes) | ⚫ Cinza = Zona Neutra | Clique: Inspecionar | Duplo Clique: Entrar 3D
          </div>
        </div>

        {/* 4. Painel Lateral de Inspeção & Ação (360px) */}
        {selectedTerritory && (
          <aside
            style={{
              width: 360,
              background: 'rgba(14, 19, 14, 0.98)',
              borderLeft: '1px solid rgba(148, 163, 184, 0.3)',
              padding: 16,
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
              zIndex: 60,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
              <div>
                <span className="mp-kicker">{KIND_META[selectedTerritory.kind]?.label}</span>
                <h3 style={{ margin: '4px 0', fontSize: '1.15rem' }}>{selectedTerritory.name}</h3>
                <div style={{ fontSize: '0.84rem', color: '#cbd5e1', lineHeight: 1.45 }}>
                  <div>Bioma: <strong>{BIOME_LABELS[selectedTerritory.biome] || 'Normandia'}</strong></div>
                  <div>Proprietário: <strong>{isSelectedMine ? 'Você (Aliados)' : selectedState?.ownerName || 'Neutro'}</strong></div>
                  <div>
                    Produção/Hora:{' '}
                    <strong>
                      +{selectedTerritory.hourlyBonus} {RES_SHORT[selectedTerritory.resourceType] || 'SUP/h'}
                    </strong>
                  </div>
                </div>
              </div>
              <button
                type="button"
                className="mil-pill"
                onClick={() => setSelectedId(null)}
                title="Fechar Painel"
              >
                ✕
              </button>
            </div>

            {/* Relatório Detalhado de Tropas Estacionadas */}
            <div
              style={{
                padding: 12,
                borderRadius: 8,
                background: 'rgba(20, 27, 20, 0.9)',
                border: '1px solid rgba(148, 163, 184, 0.25)',
                fontSize: '0.86rem',
                lineHeight: 1.55,
              }}
            >
              <div className="mp-kicker" style={{ marginBottom: 6 }}>
                RELATÓRIO DE TROPAS ESTACIONADAS
              </div>
              {isSelectedScouted ? (
                (() => {
                  const { inf, arm, defCount } = getTroopBreakdown(selectedState);
                  const f = selectedState?.fortifications || {};
                  return (
                    <>
                      <div>🪖 <strong>Infantaria</strong> (Fuzileiros, Assalto, Snipers, Engenheiros): <strong>{inf}</strong> esquadrões</div>
                      <div>🚜 <strong>Blindados & Veículos</strong> (Humvee, APC Stryker, Tanque MBT): <strong>{arm}</strong> unidades</div>
                      <div>🧱 <strong>Defesas Construídas</strong> ({f.walls || 0} Muralhas, {f.bunkers || 0} Bunkers, {f.trenches || 0} Trincheiras): <strong>{defCount}</strong> estruturas</div>
                    </>
                  );
                })()
              ) : (
                <div style={{ color: '#fde047' }}>
                  📡 Inteligência Limitada — Aproxime tropas ou use Reconhecimento Aéreo para revelar o efetivo exato.
                </div>
              )}
            </div>

            {/* Botões de Ação Direta no Topo do Painel */}
            {isSelectedMine ? (
              <>
                <button
                  type="button"
                  className="mil-btn-primary"
                  style={{ width: '100%', padding: '13px 14px', fontSize: '0.96rem' }}
                  onClick={() => onLaunchTerritory3D?.(selectedTerritory, selectedState)}
                >
                  {selectedTerritory.id === playerCapital?.id
                    ? '🏗️ ENTRAR NA MINHA CAPITAL (3D)'
                    : '🏗️ ENTRAR NESTE TERRITÓRIO (CAMPO 3D)'}
                </button>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <span className="mp-kicker">CONSTRUIR DEFESAS 3D SALVAS NA NUVEM</span>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      type="button"
                      className="mil-btn-secondary"
                      style={{ flex: 1, fontSize: '0.78rem' }}
                      onClick={() => handleBuildDefense('walls')}
                    >
                      🧱 +1 Muralha
                    </button>
                    <button
                      type="button"
                      className="mil-btn-secondary"
                      style={{ flex: 1, fontSize: '0.78rem' }}
                      onClick={() => handleBuildDefense('bunkers')}
                    >
                      🛡 +1 Bunker
                    </button>
                    <button
                      type="button"
                      className="mil-btn-secondary"
                      style={{ flex: 1, fontSize: '0.78rem' }}
                      onClick={() => handleBuildDefense('trenches')}
                    >
                      ⛓ +1 Trincheira
                    </button>
                  </div>
                </div>

                {neighborsOfSelected.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, borderTop: '1px solid rgba(148,163,184,0.2)', paddingTop: 10 }}>
                    <span className="mp-kicker">➡️ ENVIAR TROPAS PARA TERRITÓRIO VIZINHO</span>
                    <select
                      className="mil-input"
                      value={marchTargetId}
                      onChange={(e) => setMarchTargetId(e.target.value)}
                    >
                      {neighborsOfSelected.map((n) => (
                        <option key={n.id} value={n.id}>
                          Destino: {n.meta?.name} ({n.state?.ownerUid === uid ? 'Aliado' : n.state?.ownerName || 'Neutro'})
                        </option>
                      ))}
                    </select>
                    <select
                      className="mil-input"
                      value={unitCategory}
                      onChange={(e) => setUnitCategory(e.target.value)}
                    >
                      {MARCH_UNIT_CATEGORIES.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <label style={{ fontSize: '0.82rem' }}>Divisões:</label>
                      <input
                        type="number"
                        min={1}
                        max={Math.max(1, selectedState?.garrison || 1)}
                        value={marchCount}
                        onChange={(e) => setMarchCount(Number(e.target.value))}
                        className="mil-input"
                        style={{ width: 80 }}
                      />
                      <span className="mp-ping-badge" style={{ flex: 1, textAlign: 'center' }}>
                        ⏱ {formatCountdownMs(previewDurationMs)}
                      </span>
                    </div>
                    <button type="button" className="mil-btn-secondary" onClick={handleDispatchMarch}>
                      🚩 Despachar Tropas Agora
                    </button>
                  </div>
                )}
              </>
            ) : adjacentOwned.length > 0 ? (
              <>
                <button
                  type="button"
                  className="mil-btn-primary"
                  style={{
                    width: '100%',
                    padding: '13px 14px',
                    fontSize: '0.96rem',
                    background: 'linear-gradient(135deg, #b91c1c, #7f1d1d)',
                    borderColor: '#f87171',
                  }}
                  onClick={() => onLaunchTerritory3D?.(selectedTerritory, selectedState)}
                >
                  ⚔️ INVADIR TERRITÓRIO (BATALHA 3D)
                </button>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, borderTop: '1px solid rgba(148,163,184,0.2)', paddingTop: 10 }}>
                  <span className="mp-kicker">DESTACAMENTO ATACANTE (MARCHA EM TEMPO REAL)</span>
                  <select
                    className="mil-input"
                    value={marchOriginId}
                    onChange={(e) => setMarchOriginId(e.target.value)}
                  >
                    {adjacentOwned.map((a) => (
                      <option key={a.id} value={a.id}>
                        Atacar de: {a.meta?.name} (🛡 {a.state?.garrison})
                      </option>
                    ))}
                  </select>
                  <select
                    className="mil-input"
                    value={unitCategory}
                    onChange={(e) => setUnitCategory(e.target.value)}
                  >
                    {MARCH_UNIT_CATEGORIES.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                  <div className="mp-ping-badge" style={{ textAlign: 'center' }}>
                    ⏱ Chegada em: {formatCountdownMs(previewDurationMs)}
                  </div>
                  <button type="button" className="mil-btn-secondary" onClick={handleDispatchMarch}>
                    ⚔️ Enviar Coluna de Invasão
                  </button>
                </div>
              </>
            ) : (
              <div
                className="mp-status-note"
                style={{ borderColor: 'rgba(250, 204, 21, 0.45)', color: '#fde047' }}
              >
                ⚠️ Conquiste um território vizinho conectado para poder invadir aqui.
              </div>
            )}

            {statusMsg && (
              <div className="mp-status-note" style={{ fontSize: '0.84rem' }}>
                {statusMsg}
              </div>
            )}
          </aside>
        )}
      </div>
    </div>
  );
}
