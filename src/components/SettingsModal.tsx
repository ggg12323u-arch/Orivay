// ============================================================
// Orivay — SettingsModal
// Настройки профиля + выход
// ============================================================

import React, { useState, useEffect } from 'react';
import { supabase } from '../config/supabaseClient';
import type { Profile } from '../types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  onProfileUpdate: (profile: Profile) => void;
}

const SettingsModal: React.FC<Props> = ({ isOpen, onClose, userId, onProfileUpdate }) => {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [occupation, setOccupation] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (isOpen) loadProfile();
  }, [isOpen]);

  if (!isOpen) return null;

  const loadProfile = async () => {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (data) {
      const p = data as Profile;
      setProfile(p);
      setDisplayName(p.display_name);
      setUsername(p.username);
      setOccupation(p.occupation || '');
    }
  };

  const handleSave = async () => {
    if (!displayName.trim() || !username.trim()) {
      setMessage('Имя и никнейм обязательны');
      return;
    }

    setSaving(true);
    setMessage('');

    // Проверяем уникальность username если он изменился
    if (username.trim().toLowerCase() !== profile?.username) {
      const { data: existing } = await supabase
        .from('profiles')
        .select('id')
        .eq('username', username.trim().toLowerCase())
        .neq('id', userId)
        .maybeSingle();

      if (existing) {
        setMessage('Этот никнейм уже занят');
        setSaving(false);
        return;
      }
    }

    const { data, error } = await supabase
      .from('profiles')
      .update({
        display_name: displayName.trim(),
        username: username.trim().toLowerCase(),
        occupation: occupation.trim(),
      })
      .eq('id', userId)
      .select()
      .single();

    if (error) {
      setMessage('Ошибка: ' + error.message);
    } else if (data) {
      setMessage('✓ Сохранено!');
      onProfileUpdate(data as Profile);
      setProfile(data as Profile);
    }
    setSaving(false);
  };

  const handleSignOut = async () => {
    if (window.confirm('Вы уверены, что хотите выйти?')) {
      await supabase.auth.signOut();
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card modal-md" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">⚙ Настройки</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body">
          {/* Аватар */}
          <div className="settings-avatar-section">
            <div className="settings-avatar-large">
              {profile?.display_name?.[0]?.toUpperCase() || '?'}
            </div>
            <div className="settings-avatar-info">
              <div className="settings-avatar-name">{profile?.display_name}</div>
              <div className="settings-avatar-username">@{profile?.username}</div>
            </div>
          </div>

          <div className="modal-divider" />

          <div className="modal-field">
            <label className="modal-label">Имя</label>
            <input
              className="modal-input"
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
              placeholder="Ваше имя"
            />
          </div>

          <div className="modal-field">
            <label className="modal-label">Никнейм</label>
            <input
              className="modal-input"
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder="your_username"
            />
          </div>

          <div className="modal-field">
            <label className="modal-label">О себе / Профессия</label>
            <input
              className="modal-input"
              value={occupation}
              onChange={e => setOccupation(e.target.value)}
              placeholder="Чем вы занимаетесь?"
            />
          </div>

          {message && (
            <div className={`modal-message ${message.startsWith('✓') ? 'success' : ''}`}>
              {message}
            </div>
          )}

          <button
            className="modal-btn-primary modal-btn-full"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? '⏳ Сохранение…' : 'Сохранить'}
          </button>

          <div className="modal-divider" />

          <button
            className="modal-btn-danger modal-btn-full"
            onClick={handleSignOut}
          >
            🚪 Выйти из аккаунта
          </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;
