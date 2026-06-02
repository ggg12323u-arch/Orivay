// ============================================================
// Orivay — AddContactModal
// Поиск по username и добавление в контакты
// ============================================================

import React, { useState } from 'react';
import { supabase } from '../config/supabaseClient';
import type { Profile } from '../types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  onContactAdded: () => void;
}

const AddContactModal: React.FC<Props> = ({ isOpen, onClose, userId, onContactAdded }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Profile[]>([]);
  const [searching, setSearching] = useState(false);
  const [adding, setAdding] = useState<string | null>(null);
  const [message, setMessage] = useState('');

  if (!isOpen) return null;

  const handleSearch = async () => {
    if (!query.trim()) return;
    setSearching(true);
    setMessage('');
    setResults([]);

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .or(`username.ilike.%${query.trim()}%,display_name.ilike.%${query.trim()}%`)
      .neq('id', userId)
      .limit(20);

    if (error) {
      setMessage('Ошибка поиска');
    } else if (!data || data.length === 0) {
      setMessage('Никого не найдено');
    } else {
      setResults(data as Profile[]);
    }
    setSearching(false);
  };

  const handleAdd = async (contactId: string) => {
    setAdding(contactId);
    setMessage('');

    // Проверяем, не добавлен ли уже
    const { data: existing } = await supabase
      .from('contacts')
      .select('id')
      .eq('user_id', userId)
      .eq('contact_id', contactId)
      .maybeSingle();

    if (existing) {
      setMessage('Контакт уже добавлен');
      setAdding(null);
      return;
    }

    const { error } = await supabase.from('contacts').insert({
      user_id: userId,
      contact_id: contactId,
    });

    if (error) {
      setMessage('Не удалось добавить: ' + error.message);
    } else {
      setMessage('✓ Контакт добавлен!');
      onContactAdded();
    }
    setAdding(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSearch();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card modal-md" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">Добавить контакт</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body">
          <div className="modal-search-row">
            <input
              className="modal-input"
              placeholder="Поиск по никнейму или имени…"
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              autoFocus
            />
            <button
              className="modal-btn-primary modal-search-btn"
              onClick={handleSearch}
              disabled={searching || !query.trim()}
            >
              {searching ? '⏳' : '🔍'}
            </button>
          </div>

          {message && (
            <div className={`modal-message ${message.startsWith('✓') ? 'success' : ''}`}>
              {message}
            </div>
          )}

          <div className="modal-results">
            {results.map(profile => (
              <div key={profile.id} className="contact-result-item">
                <div className="contact-result-avatar">
                  {profile.display_name[0]?.toUpperCase() || '?'}
                </div>
                <div className="contact-result-info">
                  <div className="contact-result-name">{profile.display_name}</div>
                  <div className="contact-result-username">@{profile.username}</div>
                </div>
                <button
                  className="modal-btn-primary modal-btn-sm"
                  onClick={() => handleAdd(profile.id)}
                  disabled={adding === profile.id}
                >
                  {adding === profile.id ? '…' : '+ Добавить'}
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AddContactModal;
