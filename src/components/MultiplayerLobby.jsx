import React, { useEffect, useState } from 'react';
import { getAvailableBattlefieldMaps } from '../game/data/rtsData.js';
import { formatRoomCode, networkManager } from '../game/net/NetworkManager.js';

export default function MultiplayerLobby({ onStartOnlineMatch }) {
  const [net, setNet] = useState(() => networkManager.getStatusSnapshot());
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [roomName, setRoomName] = useState('');
  const [selectedMapId, setSelectedMapId] = useState('normandy_fields');
  const [selectedMode, setSelectedMode] = useState('1v1');
  const [isPrivate, setIsPrivate] = useState(false);
  const [roomPassword, setRoomPassword] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [statusMsg, setStatusMsg] = useState('');
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const unsub = networkManager.subscribe(setNet);
    const unsubStart = networkManager.onMatchStart((room) => {
      onStartOnlineMatch?.({
        networkManager,
        room,
        localSlot: networkManager.localSlot,
      });
    });
    return () => {
      unsub();
      unsubStart();
    };
  }, [onStartOnlineMatch]);

  const handleAutoMatchmake = async (mode = '1v1') => {
    setBusy(true);
    setStatusMsg('');
    const res = await networkManager.autoMatchmake({
      mode,
      mapId: selectedMapId,
      startingResources: 600,
    });
    setBusy(false);
    if (res.createdNew) {
      setStatusMsg(
        `Nenhuma sala ${mode.toUpperCase()} aberta encontrada — sala pública criada e aguardando oponentes!`
      );
    }
  };

  const handleCreateRoom = async () => {
    setBusy(true);
    setStatusMsg('');
    await networkManager.createRoom({
      roomName,
      mapId: selectedMapId,
      mode: selectedMode,
      isPrivate,
      password: roomPassword,
      startingResources: 600,
    });
    setBusy(false);
    setShowCreateForm(false);
  };

  const handleJoinRoom = async (roomId, needsPwd = false) => {
    let pwd = '';
    if (needsPwd) {
      pwd = window.prompt('Digite a senha da sala privada:') || '';
    }
    setBusy(true);
    setStatusMsg('');
    const res = await networkManager.joinRoom(roomId, pwd);
    setBusy(false);
    if (!res.ok) setStatusMsg(res.error || 'Não foi possível entrar na sala.');
  };

  const handleCopyCode = async () => {
    const code = net.room?.codeFormatted || formatRoomCode(net.roomId);
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setStatusMsg(`Código da sala: ${code}`);
    }
  };

  const availableMaps = getAvailableBattlefieldMaps();
  const room = net.room;
  const openRooms = net.openRooms || [];

  if (room) {
    return (
      <div className="mp-lobby-wrap">
        <div className="mp-card mp-waiting-room">
          <div className="mp-card-head">
            <div>
              <span className="mp-kicker">
                SALA DE ESPERA ({room.mode?.toUpperCase() || '1V1'}) • SEED {room.mapSeed}
              </span>
              <h3>
                {room.roomName || 'Operação'} — {room.codeFormatted || formatRoomCode(room.roomId)}
              </h3>
            </div>
            <div className="mp-room-meta">
              <span className="mp-ping-badge">📡 {net.pingMs} ms</span>
              <button type="button" className="mil-btn-secondary" onClick={handleCopyCode}>
                {copied ? '✓ COPIADO!' : '📋 Copiar Código'}
              </button>
            </div>
          </div>

          <div className="mp-slots-grid">
            {(room.mode === '2v2'
              ? [1, 3, 2, 4]
              : room.mode === '4p'
                ? [1, 2, 3, 4]
                : room.mode === '3p'
                  ? [1, 2, 3]
                  : [1, 2]
            ).map((slotNum) => {
              const slotColors = {
                1: { hex: '#38bdf8', name: 'AZUL' },
                2: { hex: '#ef4444', name: 'VERMELHO' },
                3: { hex: '#f59e0b', name: 'ÂMBAR' },
                4: { hex: '#10b981', name: 'ESMERALDA' },
              };
              const cMeta = slotColors[slotNum] || slotColors[1];
              const isAlly = room.mode === '2v2' ? slotNum === 1 || slotNum === 3 : slotNum === 1;
              const humanUid = room.slots?.[slotNum];
              const bot = room.bots?.[slotNum];
              const isFfa = room.mode === '3p' || room.mode === '4p';
              const label = isFfa
                ? `COMANDANTE ${slotNum} • ${cMeta.name} (FFA)`
                : slotNum === 1
                  ? `COMANDANTE 1 • ALIADOS (${cMeta.name})`
                  : slotNum === 3
                    ? `COMANDANTE 3 • ALIADOS (${cMeta.name})`
                    : slotNum === 2
                      ? `COMANDANTE 2 • EIXO (${cMeta.name})`
                      : `COMANDANTE 4 • EIXO (${cMeta.name})`;
              const displayName =
                slotNum === 1
                  ? room.host?.name || 'Host'
                  : humanUid
                    ? room.slotNames?.[slotNum] ||
                      (slotNum === 2 && room.guest?.uid === humanUid
                        ? room.guest.name
                        : `Comandante #${slotNum}`)
                    : bot
                      ? bot.name
                      : 'Vaga Aberta...';
              const badges = humanUid ? room.slotLoadouts?.[slotNum] || [] : [];
              return (
                <div
                  key={slotNum}
                  className={`mp-slot-card ${isAlly ? 'ally' : 'axis'} ${humanUid || bot ? 'filled' : ''}`}
                  style={{ borderColor: cMeta.hex }}
                >
                  <span className="mp-slot-tag" style={{ color: cMeta.hex }}>
                    {label}
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <strong>{displayName}</strong>
                    {badges.map((bg) => (
                      <span
                        key={bg}
                        style={{
                          fontSize: '0.68rem',
                          padding: '1px 6px',
                          borderRadius: 4,
                          background: 'rgba(250, 204, 21, 0.14)',
                          border: '1px solid rgba(250, 204, 21, 0.35)',
                          color: '#fde047',
                        }}
                      >
                        {bg}
                      </span>
                    ))}
                  </div>
                  <small className={humanUid || bot ? 'mp-ready-ok' : 'mp-ready-wait'}>
                    {humanUid
                      ? `✓ PRONTO ${net.localSlot === slotNum ? '(VOCÊ)' : ''}`
                      : bot
                        ? '🤖 BOT IA ATIVO (DIFÍCIL)'
                        : '⏳ Aguardando jogador ou Bot IA'}
                  </small>
                  {net.localSlot === 1 && !humanUid && slotNum !== 1 && (
                    <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {!bot ? (
                        <button
                          type="button"
                          className="mil-pill"
                          onClick={() => networkManager.setRoomBot(slotNum, true)}
                        >
                          + Adicionar IA (Difícil)
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="mil-pill"
                          style={{ borderColor: 'rgba(239,68,68,0.45)', color: '#fca5a5' }}
                          onClick={() => networkManager.setRoomBot(slotNum, false)}
                        >
                          ✕ Remover Bot IA
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="mp-form-row">
            <label>MAPA DA OPERAÇÃO</label>
            <div className="mil-pill-row">
              {availableMaps.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  disabled={net.localSlot !== 1}
                  className={`mil-pill ${room.mapId === m.id ? 'active' : ''}`}
                  onClick={() => networkManager.updateRoomMap(m.id)}
                >
                  {m.name}
                </button>
              ))}
            </div>
          </div>

          <div className="mp-waiting-footer">
            <button
              type="button"
              className="mil-btn-secondary"
              onClick={() => networkManager.leaveRoom()}
            >
              🚪 SAIR DA SALA
            </button>
            {net.localSlot === 1 ? (
              <button
                type="button"
                className="mil-btn-primary"
                onClick={() => networkManager.startMatch()}
              >
                🚀 INICIAR PARTIDA
              </button>
            ) : (
              <div className="mp-wait-host">⏳ Aguardando o Host iniciar a partida...</div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mp-lobby-wrap" style={{ gap: 10 }}>
      {/* Cabeçalho Interno CRT Outlive + 2 Botões Largos */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <span style={{ fontSize: '0.78rem', fontWeight: 900, letterSpacing: '0.1em', color: '#00e5ff' }}>
          BATALHA MULTIPLAYER • SELEÇÃO DE OPERAÇÃO
        </span>
        <span style={{ fontSize: '0.68rem', color: net.isOnline ? '#4ade80' : '#94a3b8', fontWeight: 700 }}>
          {net.isOnline ? '● REDE ONLINE' : '○ MODO LOCAL'}
        </span>
      </div>

      <div className="mp-outlive-actions">
        <button
          type="button"
          className={`mp-outlive-wide-btn ${showCreateForm ? 'primary' : ''}`}
          onClick={() => setShowCreateForm((v) => !v)}
        >
          {showCreateForm ? '✕ FECHAR CRIAÇÃO' : 'CRIAR NOVA OPERAÇÃO'}
        </button>
        <button
          type="button"
          className="mp-outlive-wide-btn"
          disabled={busy}
          onClick={() => handleAutoMatchmake('1v1')}
        >
          BUSCA RÁPIDA
        </button>
      </div>

      {/* Filtros rápidos de Matchmaking + Entrar por Código */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <button type="button" className="mil-pill" disabled={busy} onClick={() => handleAutoMatchmake('1v1')}>
            ⚡ 1v1
          </button>
          <button type="button" className="mil-pill" disabled={busy} onClick={() => handleAutoMatchmake('2v2')}>
            ⚡ 2v2
          </button>
          <button type="button" className="mil-pill" disabled={busy} onClick={() => handleAutoMatchmake('3p_4p')}>
            ⚡ 3P / 4P FFA
          </button>
        </div>
        <div className="mp-join-inline">
          <input
            type="text"
            className="mil-input mp-code-input"
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
            placeholder="#FRT-849"
            maxLength={12}
          />
          <button
            type="button"
            className="mil-btn-secondary"
            disabled={busy || joinCode.trim().length < 3}
            onClick={() => handleJoinRoom(joinCode, false)}
          >
            🔑 CÓDIGO
          </button>
        </div>
      </div>

      {!net.isOnline && (
        <div className="mp-status-note">
          ⚠️ Modo Local ativo ({net.currentUser?.provider === 'guest_local' ? 'Convidado' : 'Offline'}). Salas criadas aqui só aparecem neste navegador. Para jogar online entre dispositivos, saia e entre com E-mail e Senha.
        </div>
      )}
      {net.isOnline && net.lastSyncError && (
        <div className="mp-status-note">⚠️ {net.lastSyncError}</div>
      )}
      {statusMsg && <div className="mp-status-note">{statusMsg}</div>}

      {/* Formulário de Criação Rápida */}
      {showCreateForm && (
        <div className="mp-card">
          <div className="mp-card-head">
            <div>
              <span className="mp-kicker">NOVA OPERAÇÃO ONLINE</span>
              <h3>CONFIGURAR SALA</h3>
            </div>
            <button
              type="button"
              className="mil-pill"
              onClick={() => setShowCreateForm(false)}
            >
              ✕
            </button>
          </div>

          <div className="mp-grid">
            <div className="mp-form-row">
              <label>NOME DA SALA</label>
              <input
                type="text"
                className="mil-input"
                value={roomName}
                onChange={(e) => setRoomName(e.target.value)}
                maxLength={32}
                placeholder={`Operação ${net.commanderName}`}
              />
            </div>
            <div className="mp-form-row">
              <label>PRIVACIDADE</label>
              <div className="mil-pill-row">
                <button
                  type="button"
                  className={`mil-pill ${!isPrivate ? 'active' : ''}`}
                  onClick={() => setIsPrivate(false)}
                >
                  PÚBLICA
                </button>
                <button
                  type="button"
                  className={`mil-pill ${isPrivate ? 'active' : ''}`}
                  onClick={() => setIsPrivate(true)}
                >
                  🔒 PRIVADA
                </button>
              </div>
              {isPrivate && (
                <input
                  type="password"
                  className="mil-input"
                  value={roomPassword}
                  onChange={(e) => setRoomPassword(e.target.value)}
                  placeholder="Senha da sala"
                  style={{ marginTop: 6 }}
                />
              )}
            </div>
          </div>

          <div className="mp-form-row">
            <label>MODO DE JOGO</label>
            <div className="mil-pill-row">
              {[
                { id: '1v1', label: '1v1 (2 Jogadores)' },
                { id: '2v2', label: '2v2 (Duplas — 4 Jogadores)' },
                { id: '3p', label: '3 Jogadores (1v1v1 FFA)' },
                { id: '4p', label: '4 Jogadores (1v1v1v1 FFA)' },
              ].map((md) => (
                <button
                  key={md.id}
                  type="button"
                  className={`mil-pill ${selectedMode === md.id ? 'active' : ''}`}
                  onClick={() => setSelectedMode(md.id)}
                >
                  {md.label}
                </button>
              ))}
            </div>
          </div>

          <div className="mp-form-row">
            <label>MAPA (PADRÃO & GRANDES 16–20 SETORES)</label>
            <div className="mil-map-grid">
              {availableMaps.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  className={`mil-map-card ${selectedMapId === m.id ? 'active' : ''}`}
                  onClick={() => setSelectedMapId(m.id)}
                >
                  <div className="mil-map-card-head">
                    <strong>{m.name}</strong>
                    <span className="mp-ping-badge">
                      {m.isCustom ? 'CUSTOM' : m.group === 'large' ? 'GRANDE' : 'PADRÃO'}
                    </span>
                  </div>
                  <small>{m.subtitle}</small>
                </button>
              ))}
            </div>
          </div>

          <div className="mp-waiting-footer">
            <span className="mp-desc">A sala ficará visível imediatamente na lista abaixo.</span>
            <button
              type="button"
              className="mil-btn-primary"
              disabled={busy}
              onClick={handleCreateRoom}
            >
              ✓ PUBLICAR SALA
            </button>
          </div>
        </div>
      )}

      {/* Lista de Salas Abertas (Server Browser Estilo Outlive) */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {openRooms.length === 0 ? (
          <div className="mil-empty-box" style={{ padding: '14px 16px' }}>
            Nenhuma sala aberta no momento. Clique em <strong>CRIAR NOVA OPERAÇÃO</strong> ou{' '}
            <strong>BUSCA RÁPIDA</strong> para iniciar!
          </div>
        ) : (
          openRooms.map((r) => {
            const mapObj = availableMaps.find((m) => m.id === r.mapId);
            const modeLabel =
              r.mode === '4p'
                ? '4P FFA'
                : r.mode === '3p'
                  ? '3P FFA'
                  : (r.mode || '1v1').toUpperCase();
            return (
              <div key={r.roomId} className="mp-outlive-row">
                <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
                  <span className="mp-outlive-row-title">
                    {r.isPrivate ? '🔒 ' : ''}[{modeLabel}] {mapObj?.name || r.mapId}
                  </span>
                  <span className="mp-outlive-row-meta">
                    • {r.roomName || r.codeFormatted} • {r.playersCount || 1}/{r.maxPlayers || 2} vagas • {r.pingMs || net.pingMs} ms
                  </span>
                </div>
                <button
                  type="button"
                  className="mp-outlive-enter-btn"
                  disabled={busy}
                  onClick={() => handleJoinRoom(r.roomId, r.isPrivate)}
                >
                  ENTRAR
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
