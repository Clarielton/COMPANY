import React, { useEffect, useState } from 'react';
import { BATTLEFIELD_MAPS } from '../game/data/rtsData.js';
import { formatRoomCode, networkManager } from '../game/net/NetworkManager.js';

export default function MultiplayerLobby({ onStartOnlineMatch, onOpenFirebaseConfig }) {
  const [net, setNet] = useState(() => networkManager.getStatusSnapshot());
  const [nameInput, setNameInput] = useState(net.commanderName || 'Comandante');
  const [selectedMapId, setSelectedMapId] = useState('normandy_fields');
  const [startingRes, setStartingRes] = useState(600);
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

  const handleSaveName = () => {
    networkManager.setCommanderName(nameInput);
  };

  const handleQuickLogin = async (provider) => {
    setBusy(true);
    setStatusMsg('');
    handleSaveName();
    const res =
      provider === 'google'
        ? await networkManager.loginGoogle()
        : await networkManager.loginAnonymous();
    setBusy(false);
    setStatusMsg(
      res.mode === 'firebase'
        ? 'Conectado ao servidor Firebase.'
        : 'Sessão local ativa (pronto para testar em 2 abas via BroadcastChannel).'
    );
  };

  const handleQuickMatch = async () => {
    setBusy(true);
    setStatusMsg('');
    handleSaveName();
    const res = await networkManager.findOrCreateQuickMatch({
      mapId: selectedMapId,
      startingResources: startingRes,
    });
    setBusy(false);
    if (!res.ok) setStatusMsg(res.error || 'Falha no matchmaking.');
  };

  const handleCreatePrivate = async () => {
    setBusy(true);
    setStatusMsg('');
    handleSaveName();
    await networkManager.createPrivateRoom({
      mapId: selectedMapId,
      startingResources: startingRes,
    });
    setBusy(false);
  };

  const handleJoinCode = async () => {
    setBusy(true);
    setStatusMsg('');
    handleSaveName();
    const res = await networkManager.joinRoomByCode(joinCode);
    setBusy(false);
    if (!res.ok) setStatusMsg(res.error || 'Sala não encontrada.');
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

  return (
    <div className="mp-lobby-wrap">
      {/* 1. Perfil Rápido & Status de Conexão */}
      <div className="mp-card">
        <div className="mp-card-head">
          <div>
            <span className="mp-kicker">REDE TÁTICA • MULTIPLAYER 1v1</span>
            <h3>PERFIL DE COMANDANTE & CONEXÃO</h3>
          </div>
          <div className={`mp-status-pill ${net.isOnline ? 'online' : 'offline'}`}>
            {net.isOnline
              ? '🟢 ONLINE — Servidor Firebase'
              : '⚪ MODO OFFLINE LOCAL (2 ABAS)'}
          </div>
        </div>

        <div className="mp-profile-row">
          <input
            type="text"
            className="mil-input"
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            onBlur={handleSaveName}
            maxLength={24}
            placeholder="Nome de Comandante"
          />
          <button
            type="button"
            className="mil-btn-secondary"
            disabled={busy}
            onClick={() => handleQuickLogin('anon')}
          >
            ⚡ LOGIN RÁPIDO (ANÔNIMO)
          </button>
          <button
            type="button"
            className="mil-btn-secondary"
            disabled={busy}
            onClick={() => handleQuickLogin('google')}
          >
            G LOGIN GOOGLE
          </button>
          <button
            type="button"
            className="mil-btn-secondary"
            onClick={() => onOpenFirebaseConfig?.()}
            title="Configurar chaves do projeto Firebase"
          >
            ⚙️ Chaves Firebase
          </button>
        </div>
        {statusMsg && <div className="mp-status-note">{statusMsg}</div>}
      </div>

      {/* 2. Opções de Sala OU Sala de Espera */}
      {!room ? (
        <div className="mp-grid">
          <div className="mp-card">
            <span className="mp-kicker">OPERAÇÃO RÁPIDA</span>
            <h3>BUSCAR OU CRIAR SALA</h3>

            <div className="mp-form-row">
              <label>TEATRO DE OPERAÇÕES</label>
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

            <div className="mp-form-row">
              <label>RECURSOS INICIAIS</label>
              <div className="mil-pill-row">
                {[400, 600, 1000].map((val) => (
                  <button
                    key={val}
                    type="button"
                    className={`mil-pill ${startingRes === val ? 'active' : ''}`}
                    onClick={() => setStartingRes(val)}
                  >
                    {val} SUP
                  </button>
                ))}
              </div>
            </div>

            <div className="mp-actions-col">
              <button
                type="button"
                className="mil-btn-primary"
                disabled={busy}
                onClick={handleQuickMatch}
              >
                ⚡ BUSCAR PARTIDA RÁPIDA (MATCHMAKING 1v1)
              </button>
              <button
                type="button"
                className="mil-btn-secondary"
                disabled={busy}
                onClick={handleCreatePrivate}
              >
                ➕ CRIAR SALA PRIVADA / CAMPANHA
              </button>
            </div>
          </div>

          <div className="mp-card">
            <span className="mp-kicker">CONEXÃO DIRETA</span>
            <h3>ENTRAR COM CÓDIGO</h3>
            <p className="mp-desc">
              Digite o código de 6 dígitos enviado pelo seu amigo (ex: <strong>#FRT-849</strong>) ou abra uma segunda aba no mesmo navegador para testar instantaneamente.
            </p>
            <div className="mp-join-row">
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
                className="mil-btn-primary"
                disabled={busy || joinCode.trim().length < 4}
                onClick={handleJoinCode}
              >
                🔑 ENTRAR COM CÓDIGO
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="mp-card mp-waiting-room">
          <div className="mp-card-head">
            <div>
              <span className="mp-kicker">SALA DE ESPERA • SEED {room.mapSeed}</span>
              <h3>CÓDIGO DE OPERAÇÃO: {room.codeFormatted || formatRoomCode(room.roomId)}</h3>
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
                  : '⏳ Compartilhe o código ou aguarde na fila'}
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
                ⚔️ INICIAR BATALHA ONLINE
              </button>
            ) : (
              <div className="mp-wait-host">⏳ Aguardando o Host iniciar a batalha...</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
