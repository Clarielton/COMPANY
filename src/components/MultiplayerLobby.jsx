import React, { useEffect, useState } from 'react';
import { BATTLEFIELD_MAPS } from '../game/data/rtsData.js';
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

  const handleAutoMatchmake = async () => {
    setBusy(true);
    setStatusMsg('');
    const res = await networkManager.autoMatchmake({
      mapId: selectedMapId,
      startingResources: 600,
    });
    setBusy(false);
    if (res.createdNew) {
      setStatusMsg('Nenhuma sala aberta encontrada — sala pública criada e aguardando oponente!');
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
            <div className="mp-slot-card ally">
              <span className="mp-slot-tag">COMANDANTE 1 • ALIADOS (SUL/OESTE)</span>
              <strong>{room.host?.name || 'Host'}</strong>
              <small className="mp-ready-ok">✓ PRONTO {net.localSlot === 1 ? '(VOCÊ)' : ''}</small>
            </div>

            <div className="mp-slot-vs">VS</div>

            <div className={`mp-slot-card axis ${room.guest ? 'filled' : ''}`}>
              <span className="mp-slot-tag">COMANDANTE 2 • EIXO (NORTE/LESTE)</span>
              <strong>{room.guest ? room.guest.name : 'Aguardando oponente...'}</strong>
              <small className={room.guest ? 'mp-ready-ok' : 'mp-ready-wait'}>
                {room.guest
                  ? `✓ PRONTO ${net.localSlot === 2 ? '(VOCÊ)' : ''}`
                  : '⏳ Sala visível na Lista de Salas Abertas'}
              </small>
            </div>
          </div>

          <div className="mp-form-row">
            <label>MAPA DA OPERAÇÃO</label>
            <div className="mil-pill-row">
              {BATTLEFIELD_MAPS.map((m) => (
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
    <div className="mp-lobby-wrap">
      {/* Barra Superior de Ações Rápidas */}
      <div className="mp-top-actions">
        <button
          type="button"
          className="mil-btn-primary"
          disabled={busy}
          onClick={handleAutoMatchmake}
        >
          🔍 MATCHMAKING AUTOMÁTICO
        </button>
        <button
          type="button"
          className="mil-btn-secondary"
          onClick={() => setShowCreateForm((v) => !v)}
        >
          ➕ CRIAR NOVA SALA
        </button>
        <div className="mp-join-inline">
          <input
            type="text"
            className="mil-input mp-code-input"
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
            placeholder="#FRT-849"
            maxLength={8}
          />
          <button
            type="button"
            className="mil-btn-secondary"
            disabled={busy || joinCode.trim().length < 4}
            onClick={() => handleJoinRoom(joinCode, false)}
          >
            🔑 ENTRAR POR CÓDIGO
          </button>
        </div>
      </div>

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
              <label>MODO & PRIVACIDADE</label>
              <div className="mil-pill-row">
                {['1v1', '2v2'].map((m) => (
                  <button
                    key={m}
                    type="button"
                    className={`mil-pill ${selectedMode === m ? 'active' : ''}`}
                    onClick={() => setSelectedMode(m)}
                  >
                    {m.toUpperCase()}
                  </button>
                ))}
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
            <label>MAPA</label>
            <div className="mil-map-grid">
              {BATTLEFIELD_MAPS.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  className={`mil-map-card ${selectedMapId === m.id ? 'active' : ''}`}
                  onClick={() => setSelectedMapId(m.id)}
                >
                  <strong>{m.name}</strong>
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

      {/* Tabela ao Vivo de Salas Abertas (Server Browser) */}
      <div className="mp-card">
        <div className="mp-card-head">
          <div>
            <span className="mp-kicker">SERVER BROWSER EM TEMPO REAL</span>
            <h3>SALAS ABERTAS ({openRooms.length})</h3>
          </div>
          <div className={`mp-status-pill ${net.isOnline ? 'online' : 'offline'}`}>
            {net.isOnline
              ? '🟢 ONLINE — Firebase + Local Sync'
              : '⚪ MODO LOCAL — 2 Abas (COF_ACTIVE_ROOMS)'}
          </div>
        </div>

        {openRooms.length === 0 ? (
          <div className="mil-empty-box">
            Nenhuma sala aberta no momento. Clique em <strong>➕ CRIAR NOVA SALA</strong> ou{' '}
            <strong>🔍 MATCHMAKING AUTOMÁTICO</strong> para iniciar!
          </div>
        ) : (
          <div className="mp-server-table">
            <div className="mp-server-row mp-server-head">
              <span>SALA</span>
              <span>HOST</span>
              <span>MAPA</span>
              <span>JOGADORES</span>
              <span>PING</span>
              <span>AÇÃO</span>
            </div>
            {openRooms.map((r) => {
              const mapObj = BATTLEFIELD_MAPS.find((m) => m.id === r.mapId);
              return (
                <div key={r.roomId} className="mp-server-row">
                  <strong>
                    {r.isPrivate ? '🔒 ' : ''}
                    {r.roomName || r.codeFormatted}
                  </strong>
                  <span>{r.host?.name || 'Host'}</span>
                  <span>{mapObj?.name || r.mapId}</span>
                  <span>
                    {r.playersCount || 1}/{r.maxPlayers || 2}
                  </span>
                  <span>{r.pingMs || net.pingMs} ms</span>
                  <button
                    type="button"
                    className="mil-btn-primary mp-join-row-btn"
                    disabled={busy}
                    onClick={() => handleJoinRoom(r.roomId, r.isPrivate)}
                  >
                    ⚔️ ENTRAR NA SALA
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
