export type TicketPriority = 'emergency' | 'urgent' | 'standard'

export type TicketStatus =
  | 'open'
  | 'under_review'
  | 'in_progress'
  | 'needs_consultation'
  | 'waiting'
  | 'waiting_for_tenant'
  | 'waiting_for_parts'
  | 'done'

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
  archived_at: string | null
  building_id: string | null
  building_label: string | null
  unit_location: string | null
  tenant_name: string | null
  occurred_at: string | null
  reported_by: string | null
  insurance_damage: boolean
  situation: string | null
}

export type TicketMember = {
  id: string
  ticket_id: string
  user_id: string
  added_at: string
  last_read_at?: string
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
  archived_at?: string | null
  building_id?: string | null
  building_label?: string | null
  unit_location?: string | null
  tenant_name?: string | null
  occurred_at?: string | null
  reported_by?: string | null
  insurance_damage?: boolean
  situation?: string | null
}

export type TicketUpdate = {
  title?: string
  remarks?: string | null
  priority?: TicketPriority
  status?: TicketStatus[]
  archived?: boolean
  updated_at?: string
  archived_at?: string | null
  building_id?: string | null
  building_label?: string | null
  unit_location?: string | null
  tenant_name?: string | null
  occurred_at?: string | null
  reported_by?: string | null
  insurance_damage?: boolean
  situation?: string | null
}

export type TicketMemberInsert = {
  id?: string
  ticket_id: string
  user_id: string
  added_at?: string
  last_read_at?: string
}

export type TicketMemberUpdate = {
  ticket_id?: string
  user_id?: string
  last_read_at?: string
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

export type PushSubscriptionRow = {
  id: string
  user_id: string
  endpoint: string
  p256dh: string
  auth: string
  created_at: string
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
      push_subscriptions: {
        Row: PushSubscriptionRow
        Insert: {
          id?: string
          user_id: string
          endpoint: string
          p256dh: string
          auth: string
          created_at?: string
        }
        Update: {
          user_id?: string
          endpoint?: string
          p256dh?: string
          auth?: string
        }
        Relationships: [
          {
            foreignKeyName: 'push_subscriptions_user_id_fkey'
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
      purge_expired_chat_media: {
        Args: Record<string, never>
        Returns: number
      }
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
  emergency: '#C4002E',
  urgent: '#FF5F1F',
  standard: '#FFE500',
}

/** Archiv-Markierung: Neongrün aus dem Kithan-Vermietungslogo. */
export const ARCHIVE_COLOR = '#AFF903'

export const PRIMARY_COLOR = '#1A6BFF'

export const CHAT_MEDIA_BUCKET = 'chat-media'
