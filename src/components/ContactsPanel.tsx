// ============================================================
// Orivay — ContactsPanel
// Список контактов + начать чат
// ============================================================

import React, { useState, useEffect } from 'react';
import { supabase } from '../config/supabaseClient';
import type { Contact, Profile, SpaceMode } from '../types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  spaceMode: SpaceMode;
  onChatOpened: (chatId: string) => void;
}

const ContactsPanel: React.FC<Props> = ({ isOpen, onClose, userId, spaceMode, onChatOpened }) => {
  const [contacts, setContacts] = useState<(Contact & { profile: Profile })[]>([]);
  const [loading, setLoading] = useState(false);
  const [starting, setStarting] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) loadContacts();
  }, [isOpen]);

  if (!isOpen) return null;

  const loadContacts = async () => {
    setLoading(true);
    // Load contacts then fetch profiles separately to avoid FK alias issues
    const { data: contactRows } = await supabase
      .from('contacts')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (!contactRows || contactRows.length === 0) {
      setContacts([]);
      setLoading(false);
      return;
    }

    const profileIds = contactRows.map((c: any) => c.contact_id);
    const { data: profileRows } = await supabase
      .from('profiles')
      .select('*')
      .in('id', profileIds);

    const profileMap: Record<string, Profile> = {};
    (profileRows ?? []).forEach((p: any) => { profileMap[p.id] = p; });

    const merged = contactRows.map((c: any) => ({
      ...c,
      profile: profileMap[c.contact_id] ?? null,
    }));

    setContacts(merged as any[]);
    setLoading(false);
  };

  const startChat = async (contact: Contact & { profile: Profile }) => {
    setStarting(contact.contact_id);

    try {
      // Проверяем, есть ли уже личный чат с этим контактом
      const { data: myChats } = await supabase
        .from('chat_participants')
        .select('chat_id')
        .eq('profile_id', userId);

      const { data: theirChats } = await supabase
        .from('chat_participants')
        .select('chat_id')
        .eq('profile_id', contact.contact_id);

      if (myChats && theirChats) {
        const myIds = new Set(myChats.map(c => c.chat_id));
        const common = theirChats.filter(c => myIds.has(c.chat_id)).map(c => c.chat_id);

        if (common.length > 0) {
          // Проверяем, что это personal_chat
          const { data: existingChat } = await supabase
            .from('chats')
            .select('*')
            .in('id', common)
            .eq('type', 'personal_chat')
            .limit(1)
            .maybeSingle();

          if (existingChat) {
            onChatOpened(existingChat.id);
            onClose();
            setStarting(null);
            return;
          }
        }
      }

      // Создаём новый личный чат
      const { data: newChat, error: chatErr } = await supabase
        .from('chats')
        .insert({
          name: contact.profile.display_name,
          type: 'personal_chat' as const,
        })
        .select()
        .single();

      if (chatErr || !newChat) throw chatErr || new Error('Ошибка');

      // Добавляем обоих участников
      await supabase.from('chat_participants').insert([
        { chat_id: newChat.id, profile_id: userId, space_mode: spaceMode },
        { chat_id: newChat.id, profile_id: contact.contact_id, space_mode: 'personal' as const },
      ]);

      onChatOpened(newChat.id);
      onClose();
    } catch (err: any) {
      alert('Ошибка: ' + (err.message || 'Не удалось начать чат'));
    } finally {
      setStarting(null);
    }
  };

  const removeContact = async (contactId: string) => {
    if (!window.confirm('Удалить контакт?')) return;

    await supabase
      .from('contacts')
      .delete()
      .eq('user_id', userId)
      .eq('contact_id', contactId);

    setContacts(prev => prev.filter(c => c.contact_id !== contactId));
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card modal-lg" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">📋 Контакты</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body">
          {loading ? (
            <div className="modal-empty">⏳ Загрузка…</div>
          ) : contacts.length === 0 ? (
            <div className="modal-empty">
              <div style={{ fontSize: 40, marginBottom: 12 }}>📇</div>
              <div>У вас пока нет контактов</div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
                Нажмите + → Добавить контакт
              </div>
            </div>
          ) : (
            <div className="modal-contacts-list">
              {contacts.map(c => (
                <div key={c.id} className="contact-list-item">
                  <div className="contact-result-avatar">
                    {c.profile?.display_name?.[0]?.toUpperCase() || '?'}
                  </div>
                  <div className="contact-result-info">
                    <div className="contact-result-name">{c.profile?.display_name}</div>
                    <div className="contact-result-username">@{c.profile?.username}</div>
                    {c.profile?.occupation && (
                      <div className="contact-result-occupation">{c.profile.occupation}</div>
                    )}
                  </div>
                  <div className="contact-actions">
                    <button
                      className="modal-btn-primary modal-btn-sm"
                      onClick={() => startChat(c)}
                      disabled={starting === c.contact_id}
                    >
                      {starting === c.contact_id ? '…' : '💬'}
                    </button>
                    <button
                      className="modal-btn-ghost modal-btn-sm"
                      onClick={() => removeContact(c.contact_id)}
                      title="Удалить контакт"
                    >
                      🗑
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ContactsPanel;
