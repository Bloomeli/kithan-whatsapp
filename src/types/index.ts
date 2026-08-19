export type TicketPriority = 'emergency' | 'urgent' | 'standard'

export type TicketStatus = 'open' | 'in_progress' | 'waiting' | 'done'

export type MediaType = 'image' | 'video'

export type User = {
  id: string
  name: string
  created_at: string
}

export type Ticket = {
  id: string
  title: string
  remarks: string | null
  priority: TicketPriority
  status: TicketStatus[]
  archived: boolean
  created_by: string
  created_at: string
  updated_at: string
}

export type TicketMember = {
  id: string
  ticket_id: string
  user_id: string
  added_at: string
}

export type Message = {
  id: string
  ticket_id: string
  user_id: string
  content: string
  media_url: string | null
  media_type: MediaType | null
  created_at: string
}

export type UserInsert = {
  id?: string
  name: string
  created_at?: string
}

export type UserUpdate = {
  name?: string
}

export type TicketInsert = {
  id?: string
  title: string
  remarks?: string | null
  priority?: TicketPriority
  status?: TicketStatus[]
  archived?: boolean
  created_by: string
  created_at?: string
  updated_at?: string
}

export type TicketUpdate = {
  title?: string
  remarks?: string | null
  priority?: TicketPriority
  status?: TicketStatus[]
  archived?: boolean
  updated_at?: string
}

export type TicketMemberInsert = {
  id?: string
  ticket_id: string
  user_id: string
  added_at?: string
}

export type TicketMemberUpdate = {
  ticket_id?: string
  user_id?: string
}

export type MessageInsert = {
  id?: string
  ticket_id: string
  user_id: string
  content?: string
  media_url?: string | null
  media_type?: MediaType | null
  created_at?: string
}

export type MessageUpdate = {
  content?: string
  media_url?: string | null
  media_type?: MediaType | null
}

export type Database = {
  public: {
    Tables: {
      users: {
        Row: User
        Insert: UserInsert
        Update: UserUpdate
        Relationships: []
      }
      tickets: {
        Row: Ticket
        Insert: TicketInsert
        Update: TicketUpdate
        Relationships: [
          {
            foreignKeyName: 'tickets_created_by_fkey'
            columns: ['created_by']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
        ]
      }
      ticket_members: {
        Row: TicketMember
        Insert: TicketMemberInsert
        Update: TicketMemberUpdate
        Relationships: [
          {
            foreignKeyName: 'ticket_members_ticket_id_fkey'
            columns: ['ticket_id']
            isOneToOne: false
            referencedRelation: 'tickets'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'ticket_members_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
        ]
      }
      messages: {
        Row: Message
        Insert: MessageInsert
        Update: MessageUpdate
        Relationships: [
          {
            foreignKeyName: 'messages_ticket_id_fkey'
            columns: ['ticket_id']
            isOneToOne: false
            referencedRelation: 'tickets'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'messages_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      ticket_priority: TicketPriority
      ticket_status: TicketStatus
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

export const CURRENT_USER_STORAGE_KEY = 'kithan.currentUser'

export const PRIORITY_COLORS: Record<TicketPriority, string> = {
  emergency: '#FF1A1A',
  urgent: '#FF5F1F',
  standard: '#FFE500',
}

/** Archiv-Markierung: Neongrün aus dem Kithan-Vermietungslogo. */
export const ARCHIVE_COLOR = '#AFF903'

export const PRIMARY_COLOR = '#1A6BFF'

export const CHAT_MEDIA_BUCKET = 'chat-media'
