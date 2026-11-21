import React, { useState } from 'react';
import { networkManager } from '../game/net/NetworkManager.js';

export default function AuthGate() {
  const [mode, setMode] = useState('login'); // 'login' | 'register'
  const [callsign, setCallsign] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e?.preventDefault?.();
    setError('');
    if (mode === 'register' && callsign.trim().length < 2) {
      setError('Informe um Nome de Comandante com pelo menos 2 caracteres.');
      return;
    }
    setBusy(true);
    const res =
      mode === 'register'
        ? await networkManager.registerWithEmail(email.trim(), password, callsign.trim())
        : await networkManager.loginWithEmail(email.trim(), password);
    setBusy(false);
    if (!res.ok) setError(res.error || 'Erro de autenticação.');
  };

  const switchMode = (nextMode) => {
    setMode(nextMode);
    setError('');
  };

  return (
    <div className="mil-menu-overlay auth-gate-overlay">
      <div className="auth-gate-card">
        <div className="auth-gate-head">
          <span className="mp-kicker">COMPANY OF FRONTLINE • ACESSO RESTRITO</span>
          <h1>{mode === 'register' ? 'REGISTRO DE COMANDANTE' : 'LOGIN DE COMANDANTE'}</h1>
          <p>
            {mode === 'register'
              ? 'Crie sua conta militar com nome, e-mail e senha para jogar online.'
              : 'Entre com seu e-mail e senha para acessar o Teatro de Operações.'}
          </p>
        </div>

        <form className="auth-gate-form" onSubmit={handleSubmit}>
          {mode === 'register' && (
            <label>
              <span>NOME DE COMANDANTE</span>
              <input
                type="text"
                className="mil-input"
                value={callsign}
                onChange={(e) => setCallsign(e.target.value)}
                maxLength={24}
                placeholder="Ex: Cap_Nascimento"
                required
              />
            </label>
          )}

          <label>
            <span>E-MAIL MILITAR</span>
            <input
              type="email"
              className="mil-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="comandante@frontline.com"
              required
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
              required
            />
          </label>

          {error && <div className="auth-gate-error">{error}</div>}

          <button type="submit" className="mil-btn-primary" disabled={busy}>
            {busy
              ? 'AUTENTICANDO...'
              : mode === 'register'
                ? 'REGISTRAR CONTA'
                : 'ENTRAR'}
          </button>

          <button
            type="button"
            className="mil-btn-secondary"
            disabled={busy}
            onClick={() => switchMode(mode === 'register' ? 'login' : 'register')}
          >
            {mode === 'register'
              ? '← JÁ TENHO CONTA (VOLTAR AO LOGIN)'
              : 'CRIAR CONTA (REGISTRAR)'}
          </button>
        </form>
      </div>
    </div>
  );
}
