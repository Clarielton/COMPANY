import React, { useState } from 'react';
import { networkManager } from '../game/net/NetworkManager.js';

export default function AuthGate() {
  const [callsign, setCallsign] = useState('Comandante');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const handleGuest = async () => {
    setBusy(true);
    setError('');
    const res = await networkManager.loginAsGuest(callsign);
    setBusy(false);
    if (!res.ok) setError(res.error || 'Falha no acesso rápido.');
  };

  const handleGoogle = async () => {
    setBusy(true);
    setError('');
    const res = await networkManager.loginWithGoogle(callsign);
    setBusy(false);
    if (!res.ok) setError(res.error || 'Falha ao entrar com Google.');
  };

  const handleEmailAuth = async (isRegister) => {
    setBusy(true);
    setError('');
    const res = isRegister
      ? await networkManager.registerWithEmail(email, password, callsign)
      : await networkManager.loginWithEmail(email, password, callsign);
    setBusy(false);
    if (!res.ok) setError(res.error || 'Erro de autenticação.');
  };

  return (
    <div className="mil-menu-overlay auth-gate-overlay">
      <div className="auth-gate-card">
        <div className="auth-gate-head">
          <span className="mp-kicker">COMPANY OF FRONTLINE • ACESSO RESTRITO</span>
          <h1>LOGIN DE COMANDANTE</h1>
          <p>Autentique-se para acessar o Teatro de Operações Multiplayer Online.</p>
        </div>

        <div className="auth-gate-form">
          <label>
            <span>NOME DE GUERRA (CALLSIGN)</span>
            <input
              type="text"
              className="mil-input"
              value={callsign}
              onChange={(e) => setCallsign(e.target.value)}
              maxLength={24}
              placeholder="Ex: Cap_Nascimento"
            />
          </label>

          <label>
            <span>E-MAIL MILITAR</span>
            <input
              type="email"
              className="mil-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="comandante@frontline.com"
            />
          </label>

          <label>
            <span>SENHA</span>
            <input
              type="password"
              className="mil-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Mínimo 6 caracteres"
            />
          </label>

          {error && <div className="auth-gate-error">{error}</div>}

          <div className="auth-gate-pair">
            <button
              type="button"
              className="mil-btn-primary"
              disabled={busy}
              onClick={() => handleEmailAuth(false)}
            >
              ENTRAR
            </button>
            <button
              type="button"
              className="mil-btn-secondary"
              disabled={busy}
              onClick={() => handleEmailAuth(true)}
            >
              CRIAR CONTA
            </button>
          </div>

          <div className="auth-gate-divider">OU ACESSO RÁPIDO</div>

          <button
            type="button"
            className="mil-btn-secondary"
            disabled={busy}
            onClick={handleGoogle}
          >
            🌐 ENTRAR COM GOOGLE
          </button>

          <button
            type="button"
            className="mil-btn-primary auth-guest-btn"
            disabled={busy}
            onClick={handleGuest}
          >
            ⚡ ACESSO RÁPIDO (COMANDANTE CONVIDADO)
          </button>
        </div>
      </div>
    </div>
  );
}
