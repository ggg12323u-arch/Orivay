// ============================================================
// Orivay — CreateChatModal
// Создание канала или группы
// ============================================================

import React, { useState, useEffect } from 'react';
import { supabase } from '../config/supabaseClient';
import type { ChatType, Contact, Profile, SpaceMode } from '../types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  mode: 'channel' | 'group';
  spaceMode: SpaceMode;
  onChatCreated: (chatId: string) => void;
}

const CreateChatModal: React.FC<Props> = ({ isOpen, onClose, userId, mode, spaceMode, onChatCreated }) => {
  const [name, setName] = useState('');
  const [contacts, setContacts] = useState<(Contact & { profile: Profile })[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen && mode === 'group') {
      loadContacts();
    }
  }, [isOpen, mode]);

  if (!isOpen) return null;

  const loadContacts = async () => {
    const { data } = await supabase
      .from('contacts')
      .select('*, profile:profiles!contacts_contact_id_fkey(*)')
      .eq('user_id', userId);

    if (data) setContacts(data as any[]);
  };

  const toggleContact = (contactId: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(contactId)) next.delete(contactId);
      else next.add(contactId);
      return next;
    });
  };

  const handleCreate = async () => {
    if (!name.trim()) {
      setError('Введите название');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // 1. Создаём чат
      const chatType: ChatType = mode === 'channel' ? 'channel' : 'group';
      const { data: chat, error: chatError } = await supabase
        .from('chats')
        .insert({ name: name.trim(), type: chatType })
        .select()
        .single();

      if (chatError || !chat) throw chatError || new Error('Не удалось создать чат');

      // 2. Добавляем создателя как участника
      const participants = [
        { chat_id: chat.id, profile_id: userId, space_mode: spaceMode },
      ];

      // 3. Для группы — добавляем выбранных контактов
      if (mode === 'group') {
        for (const contactId of selected) {
          participants.push({
            chat_id: chat.id,
            profile_id: contactId,
            space_mode: 'personal', // По умолчанию в личное пространство
          });
        }
      }

      const { error: partError } = await supabase
        .from('chat_participants')
        .insert(participants);

      if (partError) throw partError;

      // 4. Отправляем приветственное сообщение
      await supabase.from('messages').insert({
        chat_id: chat.id,
        sender_id: userId,
        text: mode === 'channel'
          ? `📢 Канал «${name.trim()}» создан`
          : `👥 Группа «${name.trim()}» создана`,
      });

      onChatCreated(chat.id);
      onClose();
      setName('');
      setSelected(new Set());
    } catch (err: any) {
      setError(err.message || 'Ошибка создания');
    } finally {
      setLoading(false);
    }
  };

  const title = mode === 'channel' ? 'Создать канал' : 'Создать группу';
  const icon = mode === 'channel' ? '📢' : '👥';

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card modal-md" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">{icon} {title}</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body">
          <div className="modal-field">
            <label className="modal-label">Название</label>
            <input
              className="modal-input"
              placeholder={mode === 'channel' ? 'Название канала…' : 'Название группы…'}
              value={name}
              onChange={e => setName(e.target.value)}
              autoFocus
            />
          </div>

          {mode === 'group' && (
            <div className="modal-field">
              <label className="modal-label">
                Участники {selected.size > 0 && `(${selected.size})`}
              </label>
              <div className="modal-contacts-list">
                {contacts.length === 0 ? (
                  <div className="modal-empty">Нет контактов. Сначала добавьте контакты.</div>
                ) : (
                  contacts.map(c => (
                    <button
                      key={c.contact_id}
                      className={`modal-contact-item ${selected.has(c.contact_id) ? 'selected' : ''}`}
                      onClick={() => toggleContact(c.contact_id)}
                    >
                      <div className="contact-result-avatar">
                        {c.profile?.display_name?.[0]?.toUpperCase() || '?'}
                      </div>
                      <div className="contact-result-info">
                        <div className="contact-result-name">{c.profile?.display_name}</div>
                        <div className="contact-result-username">@{c.profile?.username}</div>
                      </div>
                      <div className={`modal-checkbox ${selected.has(c.contact_id) ? 'checked' : ''}`}>
                        {selected.has(c.contact_id) ? '✓' : ''}
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          )}

          {error && <div className="modal-message">{error}</div>}

          <button
            className="modal-btn-primary modal-btn-full"
            onClick={handleCreate}
            disabled={loading || !name.trim()}
          >
            {loading ? '⏳ Создание…' : title}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CreateChatModal;
