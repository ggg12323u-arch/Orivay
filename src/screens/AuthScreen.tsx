// ============================================================
// Orivay — AuthScreen.tsx
// ============================================================

import React, { useState } from 'react';
import { supabase } from '../config/supabaseClient';

const AuthScreen: React.FC = () => {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  const switchMode = (m: 'login' | 'register') => {
    setMode(m);
    setError('');
    setInfo('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setInfo('');

    if (!email.trim() || !password.trim()) {
      setError('Введите email и пароль');
      return;
    }
    if (password.length < 6) {
      setError('Пароль минимум 6 символов');
      return;
    }
    if (mode === 'register' && (!username.trim() || !displayName.trim())) {
      setError('Заполните никнейм и имя');
      return;
    }

    setLoading(true);

    try {
      if (mode === 'register') {
        const { data, error: err } = await supabase.auth.signUp({
          email: email.trim().toLowerCase(),
          password,
          options: {
            data: {
              username: username.trim().toLowerCase().replace(/[^a-z0-9_]/g, ''),
              display_name: displayName.trim(),
            },
          },
        });

        if (err) throw err;

        if (data.session) {
          // Авто-вход — email confirmation отключён, всё ок
          // App.tsx поймает сессию через onAuthStateChange
        } else {
          // Email confirmation включён
          setInfo('✉️ Письмо отправлено! Подтвердите email и войдите.');
          setMode('login');
        }
      } else {
        const { error: err } = await supabase.auth.signInWithPassword({
          email: email.trim().toLowerCase(),
          password,
        });

        if (err) {
          if (err.message.includes('Invalid login credentials')) {
            throw new Error('Неверный email или пароль');
          }
          if (err.message.includes('Email not confirmed')) {
            throw new Error('Сначала подтвердите email (проверьте почту)');
          }
          throw err;
        }
        // Сессия будет поймана через onAuthStateChange в App.tsx
      }
    } catch (err: any) {
      const msg: string = err?.message ?? String(err);
      if (msg.toLowerCase().includes('network') || msg.toLowerCase().includes('fetch')) {
        setError('❌ Ошибка сети. Проверьте интернет-соединение.');
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-screen">
      <div className="auth-bg-orb auth-bg-orb-1" />
      <div className="auth-bg-orb auth-bg-orb-2" />
      <div className="auth-bg-orb auth-bg-orb-3" />

      <div className="auth-card">
        <div className="auth-logo">Orivay</div>
        <p className="auth-subtitle">Современный мессенджер</p>

        <div className="auth-tabs">
          <button
            type="button"
            id="tab-login"
            className={`auth-tab ${mode === 'login' ? 'active' : ''}`}
            onClick={() => switchMode('login')}
          >
            Вход
          </button>
          <button
            type="button"
            id="tab-register"
            className={`auth-tab ${mode === 'register' ? 'active' : ''}`}
            onClick={() => switchMode('register')}
          >
            Регистрация
          </button>
        </div>

        <form className="auth-form" onSubmit={handleSubmit} noValidate>
          {mode === 'register' && (
            <>
              <div className="auth-field">
                <label className="auth-label" htmlFor="inp-username">Никнейм</label>
                <input
                  id="inp-username"
                  className="auth-input"
                  type="text"
                  placeholder="your_username"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  autoCapitalize="none"
                />
              </div>
              <div className="auth-field">
                <label className="auth-label" htmlFor="inp-name">Ваше имя</label>
                <input
                  id="inp-name"
                  className="auth-input"
                  type="text"
                  placeholder="Имя Фамилия"
                  value={displayName}
                  onChange={e => setDisplayName(e.target.value)}
                />
              </div>
            </>
          )}

          <div className="auth-field">
            <label className="auth-label" htmlFor="inp-email">Email</label>
            <input
              id="inp-email"
              className="auth-input"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              autoComplete="email"
            />
          </div>

          <div className="auth-field">
            <label className="auth-label" htmlFor="inp-password">Пароль</label>
            <input
              id="inp-password"
              className="auth-input"
              type="password"
              placeholder="Минимум 6 символов"
              value={password}
              onChange={e => setPassword(e.target.value)}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            />
          </div>

          {error && <div className="auth-error">{error}</div>}
          {info  && <div className="auth-success">{info}</div>}

          <button
            id="btn-submit"
            className="auth-submit"
            type="submit"
            disabled={loading}
          >
            {loading ? '⏳ Загрузка…' : mode === 'login' ? 'Войти' : 'Создать аккаунт'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default AuthScreen;
