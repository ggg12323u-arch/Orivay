// ============================================================
// Orivay — MainLayout.tsx
// Основной layout: сайдбар + чат + все модалки
// ============================================================

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../config/supabaseClient';
import AddContactModal from '../components/AddContactModal';
import CreateChatModal from '../components/CreateChatModal';
import SettingsModal from '../components/SettingsModal';
import ContactsPanel from '../components/ContactsPanel';
import type { ChatListItem, SpaceMode, Profile, Message } from '../types';
import type { Session } from '@supabase/supabase-js';

interface Props {
  session: Session;
}

const MainLayout: React.FC<Props> = ({ session }) => {
  const userId = session.user.id;

  // ── State ───────────────────────────────────────────────────
  const [profile, setProfile] = useState<Profile | null>(null);
  const [chats, setChats] = useState<ChatListItem[]>([]);
  const [spaceMode, setSpaceMode] = useState<SpaceMode>('personal');
  const [searchQuery, setSearchQuery] = useState('');

  const [selectedChat, setSelectedChat] = useState<ChatListItem | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [sendingMsg, setSendingMsg] = useState(false);

  const [contextMsg, setContextMsg] = useState<Message | null>(null);
  const [spaceMenuOpen, setSpaceMenuOpen] = useState(false);
  const [actionMenuOpen, setActionMenuOpen] = useState(false);

  const [showAddContact, setShowAddContact] = useState(false);
  const [showCreateChannel, setShowCreateChannel] = useState(false);
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showContacts, setShowContacts] = useState(false);

  const [isMobile, setIsMobile] = useState(window.innerWidth <= 680);
  const [showChatPanel, setShowChatPanel] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // ── Responsive ──────────────────────────────────────────────
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth <= 680);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);

  // ── Load Profile ────────────────────────────────────────────
  useEffect(() => {
    supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()
      .then(({ data }) => {
        if (data) setProfile(data as Profile);
      });
  }, [userId]);

  // ── Load Chats ──────────────────────────────────────────────
  const loadChats = useCallback(async () => {
    // Получаем чаты пользователя через chat_participants
    const { data: parts, error } = await supabase
      .from('chat_participants')
      .select('chat_id, space_mode')
      .eq('profile_id', userId);

    if (error || !parts || parts.length === 0) {
      setChats([]);
      return;
    }

    const chatIds = parts.map((p: any) => p.chat_id);
    const spaceMap: Record<string, SpaceMode> = {};
    parts.forEach((p: any) => { spaceMap[p.chat_id] = p.space_mode; });

    // Загружаем данные чатов
    const { data: chatData } = await supabase
      .from('chats')
      .select('*')
      .in('id', chatIds);

    if (!chatData) { setChats([]); return; }

    // Для каждого чата — последнее сообщение
    const result: ChatListItem[] = [];
    for (const chat of chatData) {
      const { data: lastMsgArr } = await supabase
        .from('messages')
        .select('*')
        .eq('chat_id', chat.id)
        .order('created_at', { ascending: false })
        .limit(1);

      const lastMessage = lastMsgArr?.[0] ?? null;

      // Для личного чата — имя собеседника
      let partnerName = '';
      if (chat.type === 'personal_chat') {
        const { data: otherPart } = await supabase
          .from('chat_participants')
          .select('profile_id')
          .eq('chat_id', chat.id)
          .neq('profile_id', userId)
          .limit(1);

        if (otherPart?.[0]) {
          const { data: partnerProfile } = await supabase
            .from('profiles')
            .select('display_name')
            .eq('id', otherPart[0].profile_id)
            .single();
          partnerName = partnerProfile?.display_name ?? '';
        }
      }

      result.push({
        ...chat,
        space_mode: spaceMap[chat.id] ?? 'personal',
        last_message: lastMessage,
        participant_display_name: partnerName,
      });
    }

    // Сортируем по времени последнего сообщения
    result.sort((a, b) => {
      const ta = a.last_message?.created_at ?? a.created_at;
      const tb = b.last_message?.created_at ?? b.created_at;
      return new Date(tb).getTime() - new Date(ta).getTime();
    });

    setChats(result);
  }, [userId]);

  useEffect(() => {
    loadChats();
  }, [loadChats]);

  // Realtime — обновляем список при новых сообщениях
  useEffect(() => {
    const channel = supabase
      .channel('sidebar-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, () => {
        loadChats();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_participants' }, () => {
        loadChats();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [loadChats]);

  // ── Load Messages ────────────────────────────────────────────
  useEffect(() => {
    if (!selectedChat) { setMessages([]); return; }

    const load = async () => {
      const { data } = await supabase
        .from('messages')
        .select('*')
        .eq('chat_id', selectedChat.id)
        .order('created_at', { ascending: true });
      setMessages((data as Message[]) ?? []);
    };
    load();

    const channel = supabase
      .channel(`chat-msgs-${selectedChat.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `chat_id=eq.${selectedChat.id}`,
      }, (payload) => {
        setMessages(prev => [...prev, payload.new as Message]);
      })
      .on('postgres_changes', {
        event: 'DELETE',
        schema: 'public',
        table: 'messages',
        filter: `chat_id=eq.${selectedChat.id}`,
      }, (payload) => {
        const oldId = (payload.old as any)?.id;
        if (oldId) setMessages(prev => prev.filter(m => m.id !== oldId));
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [selectedChat]);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ── Send Message ─────────────────────────────────────────────
  const sendMessage = async () => {
    const text = inputText.trim();
    if (!text || !selectedChat || sendingMsg) return;

    setInputText('');
    setSendingMsg(true);

    const { error } = await supabase.from('messages').insert({
      chat_id: selectedChat.id,
      sender_id: userId,
      text,
    });

    if (error) {
      setInputText(text);
      alert('Ошибка отправки: ' + error.message);
    }
    setSendingMsg(false);
    textareaRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // ── Delete Message ───────────────────────────────────────────
  const deleteMessage = async () => {
    if (!contextMsg) return;
    if (!window.confirm('Удалить сообщение для всех?')) { setContextMsg(null); return; }
    await supabase.from('messages').delete().eq('id', contextMsg.id);
    setContextMsg(null);
  };

  // ── Open Chat ────────────────────────────────────────────────
  const openChat = useCallback((chat: ChatListItem) => {
    setSelectedChat(chat);
    if (isMobile) setShowChatPanel(true);
  }, [isMobile]);

  const openChatById = useCallback(async (chatId: string) => {
    const { data } = await supabase.from('chats').select('*').eq('id', chatId).single();
    if (data) {
      await loadChats();
      const found = chats.find(c => c.id === chatId);
      if (found) {
        openChat(found);
      } else {
        // Если не найден в списке — открываем с базовыми данными
        openChat({ ...data, space_mode: spaceMode, last_message: null });
      }
    }
  }, [chats, spaceMode, openChat, loadChats]);

  const closeChat = () => {
    if (isMobile) {
      setShowChatPanel(false);
    } else {
      setSelectedChat(null);
    }
  };

  // ── Filters ──────────────────────────────────────────────────
  const filteredChats = chats.filter(c => {
    if (c.space_mode !== spaceMode) return false;
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const name = (c.type === 'personal_chat' ? c.participant_display_name : c.name) ?? c.name;
    return name.toLowerCase().includes(q);
  });

  // ── Helpers ──────────────────────────────────────────────────
  const chatDisplayName = (c: ChatListItem) =>
    c.type === 'personal_chat' ? (c.participant_display_name || c.name) : c.name;

  const chatTypeLabel = (t: string) => ({ personal_chat: '@', channel: 'C', group: 'G' }[t] ?? '?');
  const chatTypeClass = (t: string) => ({ personal_chat: 'personal', channel: 'channel', group: 'group' }[t] ?? 'personal');

  const fmtTime = (iso: string) =>
    new Date(iso).toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' });

  // ══════════════════════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════════════════════
  return (
    <div className="app-layout">

      {/* ═══════════════ SIDEBAR ═══════════════ */}
      <aside className={`sidebar${isMobile && showChatPanel ? ' hidden' : ''}`}>

        {/* Top Bar */}
        <div className="top-bar">
          <span className="logo">Orivay</span>
          <div className="search-container">
            <span className="search-icon">⌕</span>
            <input
              className="search-input"
              placeholder="Поиск…"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>
          <button className="avatar-btn" onClick={() => setSpaceMenuOpen(v => !v)}>
            <div className="avatar-placeholder">
              {profile?.display_name?.[0]?.toUpperCase() ?? '?'}
            </div>
            <div className="space-dot" style={{
              background: spaceMode === 'personal' ? 'var(--neon-cyan)' : 'var(--neon-purple)'
            }} />
          </button>
        </div>

        {/* Space Indicator */}
        <div className="space-indicator">
          <div className="space-indicator-dot" style={{
            background: spaceMode === 'personal' ? 'var(--neon-cyan)' : 'var(--neon-purple)'
          }} />
          <span className="space-indicator-text">
            {spaceMode === 'personal' ? 'Личное пространство' : 'Рабочее пространство'}
          </span>
        </div>

        {/* Space Switcher Menu */}
        {spaceMenuOpen && (
          <>
            <div className="space-menu-overlay" onClick={() => setSpaceMenuOpen(false)} />
            <div className="space-menu">
              <div className="space-menu-title">Пространство</div>
              <div className="space-menu-divider" />
              {(['personal', 'work'] as SpaceMode[]).map(sm => (
                <button key={sm} className={`space-menu-item${spaceMode === sm ? ' active' : ''}`}
                  onClick={() => { setSpaceMode(sm); setSpaceMenuOpen(false); }}>
                  <span className="space-menu-item-icon">{sm === 'personal' ? '🌊' : '💼'}</span>
                  <div className="space-menu-item-info">
                    <div className="space-menu-item-name">
                      {sm === 'personal' ? 'Личный профиль' : 'Рабочий профиль'}
                    </div>
                    <div className="space-menu-item-desc">
                      {sm === 'personal' ? 'Друзья, семья, личные чаты' : 'Команда, проекты, задачи'}
                    </div>
                  </div>
                  {spaceMode === sm && <span className="space-menu-check">✓</span>}
                </button>
              ))}
            </div>
          </>
        )}

        {/* Chat List */}
        <div className="chat-list">
          {filteredChats.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">💬</div>
              <div className="empty-title">Пока пусто</div>
              <div className="empty-subtitle">Нажмите + чтобы начать</div>
            </div>
          ) : (
            filteredChats.map(chat => (
              <div
                key={chat.id}
                id={`chat-${chat.id}`}
                className={`chat-item${selectedChat?.id === chat.id ? ' selected' : ''}`}
                onClick={() => openChat(chat)}
              >
                <div className={`chat-type-icon ${chatTypeClass(chat.type)}`}>
                  {chatTypeLabel(chat.type)}
                </div>
                <div className="chat-item-content">
                  <div className="chat-item-header">
                    <span className="chat-item-name">{chatDisplayName(chat)}</span>
                    {chat.last_message && (
                      <span className="chat-item-time">{fmtTime(chat.last_message.created_at)}</span>
                    )}
                  </div>
                  <div className="chat-item-message">
                    {chat.last_message?.text ?? 'Нет сообщений'}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Action Popup Menu */}
        {actionMenuOpen && (
          <>
            <div className="action-backdrop" onClick={() => setActionMenuOpen(false)} />
            <div className="action-menu">
              {[
                { id: 'btn-add-contact',    icon: '👤', label: 'Добавить контакт',  color: 'rgba(0,210,255,0.12)',  action: () => { setActionMenuOpen(false); setShowAddContact(true); } },
                { id: 'btn-create-channel', icon: '📢', label: 'Создать канал',     color: 'rgba(123,97,255,0.12)', action: () => { setActionMenuOpen(false); setShowCreateChannel(true); } },
                { id: 'btn-create-group',   icon: '👥', label: 'Создать группу',    color: 'rgba(0,230,118,0.12)',  action: () => { setActionMenuOpen(false); setShowCreateGroup(true); } },
              ].map(item => (
                <button key={item.id} id={item.id} className="action-menu-item" onClick={item.action}>
                  <div className="action-menu-item-icon" style={{ background: item.color }}>{item.icon}</div>
                  <span className="action-menu-item-text">{item.label}</span>
                </button>
              ))}
            </div>
          </>
        )}

        {/* Bottom Bar */}
        <div className="bottom-bar">
          <button id="btn-settings" className="bottom-bar-btn" onClick={() => setShowSettings(true)}>
            <span className="bottom-bar-icon">⚙</span>
            <span className="bottom-bar-label">Настройки</span>
          </button>
          <button id="btn-fab" className="fab" onClick={() => setActionMenuOpen(v => !v)}>
            <span className={`fab-icon${actionMenuOpen ? ' open' : ''}`}>+</span>
          </button>
          <button id="btn-contacts" className="bottom-bar-btn" onClick={() => setShowContacts(true)}>
            <span className="bottom-bar-icon">📋</span>
            <span className="bottom-bar-label">Контакты</span>
          </button>
        </div>
      </aside>

      {/* ═══════════════ CHAT PANEL ═══════════════ */}
      <main className={`chat-panel${isMobile && !showChatPanel ? ' hidden' : ''}`}>
        {!selectedChat ? (
          <div className="chat-panel-empty">
            <div className="chat-panel-empty-icon">🌊</div>
            <div className="chat-panel-empty-title">Orivay</div>
            <div className="chat-panel-empty-subtitle">Выберите чат слева или создайте новый</div>
          </div>
        ) : (
          <>
            {/* Chat Header */}
            <div className="chat-header">
              <button className="chat-back-btn" onClick={closeChat}>←</button>
              <div className={`chat-type-icon ${chatTypeClass(selectedChat.type)}`} style={{ width: 32, height: 32, fontSize: 12 }}>
                {chatTypeLabel(selectedChat.type)}
              </div>
              <span className="chat-header-title">{chatDisplayName(selectedChat)}</span>
            </div>

            {/* Messages */}
            <div className="messages-list">
              {messages.length === 0 && (
                <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)', fontSize: 14 }}>
                  Сообщений пока нет. Напишите первым!
                </div>
              )}
              {messages.map(msg => (
                <div key={msg.id} className={`message-row ${msg.sender_id === userId ? 'own' : 'other'}`}>
                  <div
                    className={`message-bubble ${msg.sender_id === userId ? 'own' : 'other'}`}
                    onContextMenu={e => { e.preventDefault(); setContextMsg(msg); }}
                  >
                    <div className="message-text">{msg.text}</div>
                    <div className="message-time">{fmtTime(msg.created_at)}</div>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Bar */}
            <div className="input-bar">
              <textarea
                ref={textareaRef}
                className="input-field"
                placeholder="Напишите сообщение…"
                value={inputText}
                onChange={e => setInputText(e.target.value)}
                onKeyDown={handleKeyDown}
                rows={1}
              />
              <button
                id="btn-send"
                className="send-btn"
                onClick={sendMessage}
                disabled={!inputText.trim() || sendingMsg}
              >
                <span className="send-btn-icon">↑</span>
              </button>
            </div>
          </>
        )}
      </main>

      {/* ═══════════════ CONTEXT MENU ═══════════════ */}
      {contextMsg && (
        <div className="context-overlay" onClick={() => setContextMsg(null)}>
          <div className="context-menu" onClick={e => e.stopPropagation()}>
            <div className="context-preview">{contextMsg.text}</div>
            <div className="context-divider" />
            <button className="context-item" onClick={() => {
              navigator.clipboard.writeText(contextMsg.text);
              setContextMsg(null);
            }}>
              <span className="context-item-icon">📋</span>
              <span className="context-item-text">Копировать</span>
            </button>
            <div className="context-divider" />
            <button className="context-item" onClick={deleteMessage}>
              <span className="context-item-icon">🗑️</span>
              <span className="context-item-text danger">Удалить для всех</span>
            </button>
          </div>
        </div>
      )}

      {/* ═══════════════ MODALS ═══════════════ */}
      <AddContactModal
        isOpen={showAddContact}
        onClose={() => setShowAddContact(false)}
        userId={userId}
        onContactAdded={() => {}}
      />
      <CreateChatModal
        isOpen={showCreateChannel}
        onClose={() => setShowCreateChannel(false)}
        userId={userId}
        mode="channel"
        spaceMode={spaceMode}
        onChatCreated={async (chatId) => { await loadChats(); openChatById(chatId); }}
      />
      <CreateChatModal
        isOpen={showCreateGroup}
        onClose={() => setShowCreateGroup(false)}
        userId={userId}
        mode="group"
        spaceMode={spaceMode}
        onChatCreated={async (chatId) => { await loadChats(); openChatById(chatId); }}
      />
      <SettingsModal
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        userId={userId}
        onProfileUpdate={p => setProfile(p)}
      />
      <ContactsPanel
        isOpen={showContacts}
        onClose={() => setShowContacts(false)}
        userId={userId}
        spaceMode={spaceMode}
        onChatOpened={openChatById}
      />
    </div>
  );
};

export default MainLayout;
