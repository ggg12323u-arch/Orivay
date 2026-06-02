// ============================================================
// Orivay — TypeScript Types
// ============================================================

export type ChatType = 'personal_chat' | 'channel' | 'group';
export type SpaceMode = 'personal' | 'work';

export interface Profile {
  id: string;
  username: string;
  display_name: string;
  occupation: string;
  avatar_url: string;
  created_at: string;
  updated_at: string;
}

export interface Chat {
  id: string;
  name: string;
  type: ChatType;
  created_at: string;
}

export interface ChatParticipant {
  id: string;
  chat_id: string;
  profile_id: string;
  space_mode: SpaceMode;
  joined_at: string;
}

export interface Message {
  id: string;
  chat_id: string;
  sender_id: string;
  text: string;
  created_at: string;
}

export interface ChatListItem extends Chat {
  space_mode: SpaceMode;
  last_message?: Message | null;
  unread_count?: number;
  participant_display_name?: string;
}

export interface Contact {
  id: string;
  user_id: string;
  contact_id: string;
  created_at: string;
  profile?: Profile;
}
