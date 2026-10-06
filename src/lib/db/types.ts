
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {

  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "audit_log": {
                  Row: {
                    "action": Database["public"]['Enums']["audit_action"],"actor_id": string | null,"after": Json | null,"before": Json | null,"created_at": string,"id": string,"restaurant_id": string,"target_id": string | null,"target_table": string,"updated_at": string
                  }
                  Insert: {
                    "action": Database["public"]['Enums']["audit_action"],"actor_id"?: string | null,"after"?: Json | null,"before"?: Json | null,"created_at"?: string,"id"?: string,"restaurant_id": string,"target_id"?: string | null,"target_table": string,"updated_at"?: string
                  }
                  Update: {
                    "action"?: Database["public"]['Enums']["audit_action"],"actor_id"?: string | null,"after"?: Json | null,"before"?: Json | null,"created_at"?: string,"id"?: string,"restaurant_id"?: string,"target_id"?: string | null,"target_table"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "audit_log_restaurant_id_fkey"
      columns: ["restaurant_id"]
isOneToOne: false
      referencedRelation: "restaurants"
      referencedColumns: ["id"]
    }
                  ]
                },"cart_items": {
                  Row: {
                    "created_at": string,"id": string,"item_id": string,"modifiers": NonNullable<Json>,"participant_id": string | null,"qty": number,"restaurant_id": string,"shared": boolean,"tab_id": string,"updated_at": string
                  }
                  Insert: {
                    "created_at"?: string,"id"?: string,"item_id": string,"modifiers"?: NonNullable<Json>,"participant_id"?: string | null,"qty": number,"restaurant_id": string,"shared"?: boolean,"tab_id": string,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"item_id"?: string,"modifiers"?: NonNullable<Json>,"participant_id"?: string | null,"qty"?: number,"restaurant_id"?: string,"shared"?: boolean,"tab_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "cart_items_restaurant_id_fkey"
      columns: ["restaurant_id"]
isOneToOne: false
      referencedRelation: "restaurants"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "cart_items_restaurant_id_item_id_fkey"
      columns: ["restaurant_id","item_id"]
isOneToOne: false
      referencedRelation: "menu_items"
      referencedColumns: ["restaurant_id","id"]
    },{
      foreignKeyName: "cart_items_restaurant_id_participant_id_fkey"
      columns: ["restaurant_id","participant_id"]
isOneToOne: false
      referencedRelation: "tab_participants"
      referencedColumns: ["restaurant_id","id"]
    },{
      foreignKeyName: "cart_items_restaurant_id_tab_id_fkey"
      columns: ["restaurant_id","tab_id"]
isOneToOne: false
      referencedRelation: "tab_totals"
      referencedColumns: ["restaurant_id","tab_id"]
    },{
      foreignKeyName: "cart_items_restaurant_id_tab_id_fkey"
      columns: ["restaurant_id","tab_id"]
isOneToOne: false
      referencedRelation: "tabs"
      referencedColumns: ["restaurant_id","id"]
    }
                  ]
                },"daily_sales": {
                  Row: {
                    "ath_cents": number,"card_cents": number,"cash_cents": number,"covers": number,"created_at": string,"date": string,"hour": number,"id": string,"ivu_municipal_cents": number,"ivu_state_cents": number,"orders": number,"restaurant_id": string,"sales_cents": number,"tips_cents": number,"updated_at": string
                  }
                  Insert: {
                    "ath_cents"?: number,"card_cents"?: number,"cash_cents"?: number,"covers"?: number,"created_at"?: string,"date": string,"hour": number,"id"?: string,"ivu_municipal_cents"?: number,"ivu_state_cents"?: number,"orders"?: number,"restaurant_id": string,"sales_cents"?: number,"tips_cents"?: number,"updated_at"?: string
                  }
                  Update: {
                    "ath_cents"?: number,"card_cents"?: number,"cash_cents"?: number,"covers"?: number,"created_at"?: string,"date"?: string,"hour"?: number,"id"?: string,"ivu_municipal_cents"?: number,"ivu_state_cents"?: number,"orders"?: number,"restaurant_id"?: string,"sales_cents"?: number,"tips_cents"?: number,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "daily_sales_restaurant_id_fkey"
      columns: ["restaurant_id"]
isOneToOne: false
      referencedRelation: "restaurants"
      referencedColumns: ["id"]
    }
                  ]
                },"demo_requests": {
                  Row: {
                    "created_at": string,"email": string,"id": string,"locale": Database["public"]['Enums']["app_locale"],"message": string | null,"name": string,"phone": string | null,"restaurant_name": string | null,"updated_at": string
                  }
                  Insert: {
                    "created_at"?: string,"email": string,"id"?: string,"locale"?: Database["public"]['Enums']["app_locale"],"message"?: string | null,"name": string,"phone"?: string | null,"restaurant_name"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"email"?: string,"id"?: string,"locale"?: Database["public"]['Enums']["app_locale"],"message"?: string | null,"name"?: string,"phone"?: string | null,"restaurant_name"?: string | null,"updated_at"?: string
                  }
                  Relationships: [

                  ]
                },"devices": {
                  Row: {
                    "app_version": string | null,"created_at": string,"id": string,"kind": Database["public"]['Enums']["device_kind"],"last_seen_at": string | null,"name": string,"restaurant_id": string,"updated_at": string
                  }
                  Insert: {
                    "app_version"?: string | null,"created_at"?: string,"id"?: string,"kind": Database["public"]['Enums']["device_kind"],"last_seen_at"?: string | null,"name": string,"restaurant_id": string,"updated_at"?: string
                  }
                  Update: {
                    "app_version"?: string | null,"created_at"?: string,"id"?: string,"kind"?: Database["public"]['Enums']["device_kind"],"last_seen_at"?: string | null,"name"?: string,"restaurant_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "devices_restaurant_id_fkey"
      columns: ["restaurant_id"]
isOneToOne: false
      referencedRelation: "restaurants"
      referencedColumns: ["id"]
    }
                  ]
                },"dining_tables": {
                  Row: {
                    "area": string | null,"created_at": string,"id": string,"label": string,"pos_x": number | null,"pos_y": number | null,"qr_token_hash": string | null,"restaurant_id": string,"seats": number | null,"shape": string,"sort_order": number,"token_version": number,"updated_at": string
                  }
                  Insert: {
                    "area"?: string | null,"created_at"?: string,"id"?: string,"label": string,"pos_x"?: number | null,"pos_y"?: number | null,"qr_token_hash"?: string | null,"restaurant_id": string,"seats"?: number | null,"shape"?: string,"sort_order"?: number,"token_version"?: number,"updated_at"?: string
                  }
                  Update: {
                    "area"?: string | null,"created_at"?: string,"id"?: string,"label"?: string,"pos_x"?: number | null,"pos_y"?: number | null,"qr_token_hash"?: string | null,"restaurant_id"?: string,"seats"?: number | null,"shape"?: string,"sort_order"?: number,"token_version"?: number,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "dining_tables_restaurant_id_fkey"
      columns: ["restaurant_id"]
isOneToOne: false
      referencedRelation: "restaurants"
      referencedColumns: ["id"]
    }
                  ]
                },"exports": {
                  Row: {
                    "created_at": string,"created_by": string | null,"file_path": string,"id": string,"kind": Database["public"]['Enums']["export_kind"],"period": string | null,"restaurant_id": string,"updated_at": string
                  }
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"file_path": string,"id"?: string,"kind": Database["public"]['Enums']["export_kind"],"period"?: string | null,"restaurant_id": string,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"file_path"?: string,"id"?: string,"kind"?: Database["public"]['Enums']["export_kind"],"period"?: string | null,"restaurant_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "exports_restaurant_id_fkey"
      columns: ["restaurant_id"]
isOneToOne: false
      referencedRelation: "restaurants"
      referencedColumns: ["id"]
    }
                  ]
                },"guests": {
                  Row: {
                    "consent_at": string | null,"created_at": string,"id": string,"phone_e164": string | null,"preferred_language": Database["public"]['Enums']["app_locale"] | null,"restaurant_id": string,"updated_at": string
                  }
                  Insert: {
                    "consent_at"?: string | null,"created_at"?: string,"id"?: string,"phone_e164"?: string | null,"preferred_language"?: Database["public"]['Enums']["app_locale"] | null,"restaurant_id": string,"updated_at"?: string
                  }
                  Update: {
                    "consent_at"?: string | null,"created_at"?: string,"id"?: string,"phone_e164"?: string | null,"preferred_language"?: Database["public"]['Enums']["app_locale"] | null,"restaurant_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "guests_restaurant_id_fkey"
      columns: ["restaurant_id"]
isOneToOne: false
      referencedRelation: "restaurants"
      referencedColumns: ["id"]
    }
                  ]
                },"item_availability_events": {
                  Row: {
                    "back_at": string | null,"created_at": string,"id": string,"item_id": string,"restaurant_id": string,"sold_out_at": string,"updated_at": string
                  }
                  Insert: {
                    "back_at"?: string | null,"created_at"?: string,"id"?: string,"item_id": string,"restaurant_id": string,"sold_out_at": string,"updated_at"?: string
                  }
                  Update: {
                    "back_at"?: string | null,"created_at"?: string,"id"?: string,"item_id"?: string,"restaurant_id"?: string,"sold_out_at"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "item_availability_events_restaurant_id_fkey"
      columns: ["restaurant_id"]
isOneToOne: false
      referencedRelation: "restaurants"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "item_availability_events_restaurant_id_item_id_fkey"
      columns: ["restaurant_id","item_id"]
isOneToOne: false
      referencedRelation: "menu_items"
      referencedColumns: ["restaurant_id","id"]
    }
                  ]
                },"item_hotspots": {
                  Row: {
                    "created_at": string,"height": number,"id": string,"item_id": string,"page_id": string,"restaurant_id": string,"updated_at": string,"width": number,"x": number,"y": number
                  }
                  Insert: {
                    "created_at"?: string,"height": number,"id"?: string,"item_id": string,"page_id": string,"restaurant_id": string,"updated_at"?: string,"width": number,"x": number,"y": number
                  }
                  Update: {
                    "created_at"?: string,"height"?: number,"id"?: string,"item_id"?: string,"page_id"?: string,"restaurant_id"?: string,"updated_at"?: string,"width"?: number,"x"?: number,"y"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "item_hotspots_restaurant_id_fkey"
      columns: ["restaurant_id"]
isOneToOne: false
      referencedRelation: "restaurants"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "item_hotspots_restaurant_id_item_id_fkey"
      columns: ["restaurant_id","item_id"]
isOneToOne: false
      referencedRelation: "menu_items"
      referencedColumns: ["restaurant_id","id"]
    },{
      foreignKeyName: "item_hotspots_restaurant_id_page_id_fkey"
      columns: ["restaurant_id","page_id"]
isOneToOne: false
      referencedRelation: "original_menu_pages"
      referencedColumns: ["restaurant_id","id"]
    }
                  ]
                },"item_modifier_groups": {
                  Row: {
                    "created_at": string,"group_id": string,"id": string,"item_id": string,"restaurant_id": string,"sort_order": number,"updated_at": string
                  }
                  Insert: {
                    "created_at"?: string,"group_id": string,"id"?: string,"item_id": string,"restaurant_id": string,"sort_order"?: number,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"group_id"?: string,"id"?: string,"item_id"?: string,"restaurant_id"?: string,"sort_order"?: number,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "item_modifier_groups_restaurant_id_fkey"
      columns: ["restaurant_id"]
isOneToOne: false
      referencedRelation: "restaurants"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "item_modifier_groups_restaurant_id_group_id_fkey"
      columns: ["restaurant_id","group_id"]
isOneToOne: false
      referencedRelation: "modifier_groups"
      referencedColumns: ["restaurant_id","id"]
    },{
      foreignKeyName: "item_modifier_groups_restaurant_id_item_id_fkey"
      columns: ["restaurant_id","item_id"]
isOneToOne: false
      referencedRelation: "menu_items"
      referencedColumns: ["restaurant_id","id"]
    }
                  ]
                },"item_sales_daily": {
                  Row: {
                    "created_at": string,"date": string,"id": string,"item_id": string,"modifier_count": number,"restaurant_id": string,"revenue_cents": number,"units": number,"updated_at": string
                  }
                  Insert: {
                    "created_at"?: string,"date": string,"id"?: string,"item_id": string,"modifier_count"?: number,"restaurant_id": string,"revenue_cents"?: number,"units"?: number,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"date"?: string,"id"?: string,"item_id"?: string,"modifier_count"?: number,"restaurant_id"?: string,"revenue_cents"?: number,"units"?: number,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "item_sales_daily_restaurant_id_fkey"
      columns: ["restaurant_id"]
isOneToOne: false
      referencedRelation: "restaurants"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "item_sales_daily_restaurant_id_item_id_fkey"
      columns: ["restaurant_id","item_id"]
isOneToOne: false
      referencedRelation: "menu_items"
      referencedColumns: ["restaurant_id","id"]
    }
                  ]
                },"memberships": {
                  Row: {
                    "active": boolean,"created_at": string,"id": string,"pin_hash": string | null,"restaurant_id": string,"role": Database["public"]['Enums']["member_role"],"updated_at": string,"user_id": string
                  }
                  Insert: {
                    "active"?: boolean,"created_at"?: string,"id"?: string,"pin_hash"?: string | null,"restaurant_id": string,"role": Database["public"]['Enums']["member_role"],"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "active"?: boolean,"created_at"?: string,"id"?: string,"pin_hash"?: string | null,"restaurant_id"?: string,"role"?: Database["public"]['Enums']["member_role"],"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "memberships_restaurant_id_fkey"
      columns: ["restaurant_id"]
isOneToOne: false
      referencedRelation: "restaurants"
      referencedColumns: ["id"]
    }
                  ]
                },"menu_items": {
                  Row: {
                    "ai_confidence": number | null,"archived_at": string | null,"created_at": string,"description_en": string | null,"description_es": string | null,"id": string,"is_available": boolean,"name_en": string,"name_es": string,"photo_path": string | null,"price_cents": number,"restaurant_id": string,"section_id": string,"sold_out_since": string | null,"sort_order": number,"tags": (string)[],"updated_at": string
                  }
                  Insert: {
                    "ai_confidence"?: number | null,"archived_at"?: string | null,"created_at"?: string,"description_en"?: string | null,"description_es"?: string | null,"id"?: string,"is_available"?: boolean,"name_en": string,"name_es": string,"photo_path"?: string | null,"price_cents": number,"restaurant_id": string,"section_id": string,"sold_out_since"?: string | null,"sort_order"?: number,"tags"?: (string)[],"updated_at"?: string
                  }
                  Update: {
                    "ai_confidence"?: number | null,"archived_at"?: string | null,"created_at"?: string,"description_en"?: string | null,"description_es"?: string | null,"id"?: string,"is_available"?: boolean,"name_en"?: string,"name_es"?: string,"photo_path"?: string | null,"price_cents"?: number,"restaurant_id"?: string,"section_id"?: string,"sold_out_since"?: string | null,"sort_order"?: number,"tags"?: (string)[],"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "menu_items_restaurant_id_fkey"
      columns: ["restaurant_id"]
isOneToOne: false
      referencedRelation: "restaurants"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "menu_items_restaurant_id_section_id_fkey"
      columns: ["restaurant_id","section_id"]
isOneToOne: false
      referencedRelation: "menu_sections"
      referencedColumns: ["restaurant_id","id"]
    }
                  ]
                },"menu_sections": {
                  Row: {
                    "archived_at": string | null,"created_at": string,"id": string,"name_en": string,"name_es": string,"restaurant_id": string,"sort_order": number,"updated_at": string
                  }
                  Insert: {
                    "archived_at"?: string | null,"created_at"?: string,"id"?: string,"name_en": string,"name_es": string,"restaurant_id": string,"sort_order"?: number,"updated_at"?: string
                  }
                  Update: {
                    "archived_at"?: string | null,"created_at"?: string,"id"?: string,"name_en"?: string,"name_es"?: string,"restaurant_id"?: string,"sort_order"?: number,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "menu_sections_restaurant_id_fkey"
      columns: ["restaurant_id"]
isOneToOne: false
      referencedRelation: "restaurants"
      referencedColumns: ["id"]
    }
                  ]
                },"menu_themes": {
                  Row: {
                    "body_font": string,"created_at": string,"display_font": string,"id": string,"ornament": string | null,"palette": NonNullable<Json>,"paper_texture": Database["public"]['Enums']["paper_texture"],"restaurant_id": string,"updated_at": string
                  }
                  Insert: {
                    "body_font": string,"created_at"?: string,"display_font": string,"id"?: string,"ornament"?: string | null,"palette": NonNullable<Json>,"paper_texture"?: Database["public"]['Enums']["paper_texture"],"restaurant_id": string,"updated_at"?: string
                  }
                  Update: {
                    "body_font"?: string,"created_at"?: string,"display_font"?: string,"id"?: string,"ornament"?: string | null,"palette"?: NonNullable<Json>,"paper_texture"?: Database["public"]['Enums']["paper_texture"],"restaurant_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "menu_themes_restaurant_id_fkey"
      columns: ["restaurant_id"]
isOneToOne: true
      referencedRelation: "restaurants"
      referencedColumns: ["id"]
    }
                  ]
                },"menu_uploads": {
                  Row: {
                    "ai_result": Json | null,"created_at": string,"id": string,"mime_type": string,"published_at": string | null,"restaurant_id": string,"reviewed_by": string | null,"status": Database["public"]['Enums']["upload_status"],"storage_path": string,"updated_at": string
                  }
                  Insert: {
                    "ai_result"?: Json | null,"created_at"?: string,"id"?: string,"mime_type": string,"published_at"?: string | null,"restaurant_id": string,"reviewed_by"?: string | null,"status"?: Database["public"]['Enums']["upload_status"],"storage_path": string,"updated_at"?: string
                  }
                  Update: {
                    "ai_result"?: Json | null,"created_at"?: string,"id"?: string,"mime_type"?: string,"published_at"?: string | null,"restaurant_id"?: string,"reviewed_by"?: string | null,"status"?: Database["public"]['Enums']["upload_status"],"storage_path"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "menu_uploads_restaurant_id_fkey"
      columns: ["restaurant_id"]
isOneToOne: false
      referencedRelation: "restaurants"
      referencedColumns: ["id"]
    }
                  ]
                },"modifier_groups": {
                  Row: {
                    "created_at": string,"id": string,"max_select": number,"min_select": number,"name_en": string,"name_es": string,"restaurant_id": string,"updated_at": string
                  }
                  Insert: {
                    "created_at"?: string,"id"?: string,"max_select"?: number,"min_select"?: number,"name_en": string,"name_es": string,"restaurant_id": string,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"max_select"?: number,"min_select"?: number,"name_en"?: string,"name_es"?: string,"restaurant_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "modifier_groups_restaurant_id_fkey"
      columns: ["restaurant_id"]
isOneToOne: false
      referencedRelation: "restaurants"
      referencedColumns: ["id"]
    }
                  ]
                },"modifier_options": {
                  Row: {
                    "created_at": string,"group_id": string,"id": string,"name_en": string,"name_es": string,"price_cents": number,"restaurant_id": string,"sort_order": number,"updated_at": string
                  }
                  Insert: {
                    "created_at"?: string,"group_id": string,"id"?: string,"name_en": string,"name_es": string,"price_cents"?: number,"restaurant_id": string,"sort_order"?: number,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"group_id"?: string,"id"?: string,"name_en"?: string,"name_es"?: string,"price_cents"?: number,"restaurant_id"?: string,"sort_order"?: number,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "modifier_options_restaurant_id_fkey"
      columns: ["restaurant_id"]
isOneToOne: false
      referencedRelation: "restaurants"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "modifier_options_restaurant_id_group_id_fkey"
      columns: ["restaurant_id","group_id"]
isOneToOne: false
      referencedRelation: "modifier_groups"
      referencedColumns: ["restaurant_id","id"]
    }
                  ]
                },"order_items": {
                  Row: {
                    "created_at": string,"id": string,"item_id": string | null,"modifiers_snapshot": NonNullable<Json>,"name_snapshot_en": string,"name_snapshot_es": string,"note": string | null,"order_id": string,"participant_id": string | null,"qty": number,"restaurant_id": string,"shared": boolean,"status": Database["public"]['Enums']["order_status"],"unit_price_cents": number,"updated_at": string,"void_reason": string | null,"voided_at": string | null,"voided_by": string | null
                  }
                  Insert: {
                    "created_at"?: string,"id"?: string,"item_id"?: string | null,"modifiers_snapshot"?: NonNullable<Json>,"name_snapshot_en": string,"name_snapshot_es": string,"note"?: string | null,"order_id": string,"participant_id"?: string | null,"qty": number,"restaurant_id": string,"shared"?: boolean,"status"?: Database["public"]['Enums']["order_status"],"unit_price_cents": number,"updated_at"?: string,"void_reason"?: string | null,"voided_at"?: string | null,"voided_by"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"item_id"?: string | null,"modifiers_snapshot"?: NonNullable<Json>,"name_snapshot_en"?: string,"name_snapshot_es"?: string,"note"?: string | null,"order_id"?: string,"participant_id"?: string | null,"qty"?: number,"restaurant_id"?: string,"shared"?: boolean,"status"?: Database["public"]['Enums']["order_status"],"unit_price_cents"?: number,"updated_at"?: string,"void_reason"?: string | null,"voided_at"?: string | null,"voided_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "order_items_restaurant_id_fkey"
      columns: ["restaurant_id"]
isOneToOne: false
      referencedRelation: "restaurants"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "order_items_restaurant_id_item_id_fkey"
      columns: ["restaurant_id","item_id"]
isOneToOne: false
      referencedRelation: "menu_items"
      referencedColumns: ["restaurant_id","id"]
    },{
      foreignKeyName: "order_items_restaurant_id_order_id_fkey"
      columns: ["restaurant_id","order_id"]
isOneToOne: false
      referencedRelation: "orders"
      referencedColumns: ["restaurant_id","id"]
    },{
      foreignKeyName: "order_items_restaurant_id_participant_id_fkey"
      columns: ["restaurant_id","participant_id"]
isOneToOne: false
      referencedRelation: "tab_participants"
      referencedColumns: ["restaurant_id","id"]
    }
                  ]
                },"orders": {
                  Row: {
                    "created_at": string,"created_by": string | null,"device_id": string | null,"guest_language": Database["public"]['Enums']["app_locale"],"id": string,"idempotency_key": string,"number": number,"restaurant_id": string,"source": Database["public"]['Enums']["order_source"],"status": Database["public"]['Enums']["order_status"],"synced_at": string | null,"tab_id": string,"updated_at": string
                  }
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"device_id"?: string | null,"guest_language"?: Database["public"]['Enums']["app_locale"],"id"?: string,"idempotency_key": string,"number": number,"restaurant_id": string,"source": Database["public"]['Enums']["order_source"],"status"?: Database["public"]['Enums']["order_status"],"synced_at"?: string | null,"tab_id": string,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"device_id"?: string | null,"guest_language"?: Database["public"]['Enums']["app_locale"],"id"?: string,"idempotency_key"?: string,"number"?: number,"restaurant_id"?: string,"source"?: Database["public"]['Enums']["order_source"],"status"?: Database["public"]['Enums']["order_status"],"synced_at"?: string | null,"tab_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "orders_restaurant_id_device_id_fkey"
      columns: ["restaurant_id","device_id"]
isOneToOne: false
      referencedRelation: "devices"
      referencedColumns: ["restaurant_id","id"]
    },{
      foreignKeyName: "orders_restaurant_id_fkey"
      columns: ["restaurant_id"]
isOneToOne: false
      referencedRelation: "restaurants"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "orders_restaurant_id_tab_id_fkey"
      columns: ["restaurant_id","tab_id"]
isOneToOne: false
      referencedRelation: "tab_totals"
      referencedColumns: ["restaurant_id","tab_id"]
    },{
      foreignKeyName: "orders_restaurant_id_tab_id_fkey"
      columns: ["restaurant_id","tab_id"]
isOneToOne: false
      referencedRelation: "tabs"
      referencedColumns: ["restaurant_id","id"]
    }
                  ]
                },"original_menu_pages": {
                  Row: {
                    "created_at": string,"height": number,"id": string,"image_path": string,"page_number": number,"restaurant_id": string,"updated_at": string,"width": number
                  }
                  Insert: {
                    "created_at"?: string,"height": number,"id"?: string,"image_path": string,"page_number": number,"restaurant_id": string,"updated_at"?: string,"width": number
                  }
                  Update: {
                    "created_at"?: string,"height"?: number,"id"?: string,"image_path"?: string,"page_number"?: number,"restaurant_id"?: string,"updated_at"?: string,"width"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "original_menu_pages_restaurant_id_fkey"
      columns: ["restaurant_id"]
isOneToOne: false
      referencedRelation: "restaurants"
      referencedColumns: ["id"]
    }
                  ]
                },"payment_accounts": {
                  Row: {
                    "ath_keys_secret_id": string | null,"created_at": string,"id": string,"provider": Database["public"]['Enums']["payment_provider"],"restaurant_id": string,"status": Database["public"]['Enums']["provider_status"],"stripe_account_id": string | null,"updated_at": string
                  }
                  Insert: {
                    "ath_keys_secret_id"?: string | null,"created_at"?: string,"id"?: string,"provider": Database["public"]['Enums']["payment_provider"],"restaurant_id": string,"status"?: Database["public"]['Enums']["provider_status"],"stripe_account_id"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "ath_keys_secret_id"?: string | null,"created_at"?: string,"id"?: string,"provider"?: Database["public"]['Enums']["payment_provider"],"restaurant_id"?: string,"status"?: Database["public"]['Enums']["provider_status"],"stripe_account_id"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "payment_accounts_restaurant_id_fkey"
      columns: ["restaurant_id"]
isOneToOne: false
      referencedRelation: "restaurants"
      referencedColumns: ["id"]
    }
                  ]
                },"payments": {
                  Row: {
                    "amount_cents": number,"confirmed_by": string | null,"created_at": string,"fiscal_control_number": string | null,"id": string,"idempotency_key": string,"ivu_municipal_cents": number,"ivu_state_cents": number,"method": Database["public"]['Enums']["payment_method"],"paid_at": string | null,"participant_id": string | null,"provider_ref": string | null,"restaurant_id": string,"status": Database["public"]['Enums']["payment_status"],"tab_id": string,"tip_cents": number,"updated_at": string
                  }
                  Insert: {
                    "amount_cents": number,"confirmed_by"?: string | null,"created_at"?: string,"fiscal_control_number"?: string | null,"id"?: string,"idempotency_key": string,"ivu_municipal_cents"?: number,"ivu_state_cents"?: number,"method": Database["public"]['Enums']["payment_method"],"paid_at"?: string | null,"participant_id"?: string | null,"provider_ref"?: string | null,"restaurant_id": string,"status"?: Database["public"]['Enums']["payment_status"],"tab_id": string,"tip_cents"?: number,"updated_at"?: string
                  }
                  Update: {
                    "amount_cents"?: number,"confirmed_by"?: string | null,"created_at"?: string,"fiscal_control_number"?: string | null,"id"?: string,"idempotency_key"?: string,"ivu_municipal_cents"?: number,"ivu_state_cents"?: number,"method"?: Database["public"]['Enums']["payment_method"],"paid_at"?: string | null,"participant_id"?: string | null,"provider_ref"?: string | null,"restaurant_id"?: string,"status"?: Database["public"]['Enums']["payment_status"],"tab_id"?: string,"tip_cents"?: number,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "payments_restaurant_id_fkey"
      columns: ["restaurant_id"]
isOneToOne: false
      referencedRelation: "restaurants"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "payments_restaurant_id_participant_id_fkey"
      columns: ["restaurant_id","participant_id"]
isOneToOne: false
      referencedRelation: "tab_participants"
      referencedColumns: ["restaurant_id","id"]
    },{
      foreignKeyName: "payments_restaurant_id_tab_id_fkey"
      columns: ["restaurant_id","tab_id"]
isOneToOne: false
      referencedRelation: "tab_totals"
      referencedColumns: ["restaurant_id","tab_id"]
    },{
      foreignKeyName: "payments_restaurant_id_tab_id_fkey"
      columns: ["restaurant_id","tab_id"]
isOneToOne: false
      referencedRelation: "tabs"
      referencedColumns: ["restaurant_id","id"]
    }
                  ]
                },"platform_admins": {
                  Row: {
                    "created_at": string,"user_id": string
                  }
                  Insert: {
                    "created_at"?: string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"user_id"?: string
                  }
                  Relationships: [

                  ]
                },"print_jobs": {
                  Row: {
                    "created_at": string,"error": string | null,"id": string,"kind": Database["public"]['Enums']["ticket_kind"],"order_id": string,"printed_at": string | null,"printer_id": string | null,"restaurant_id": string,"status": Database["public"]['Enums']["print_status"],"updated_at": string
                  }
                  Insert: {
                    "created_at"?: string,"error"?: string | null,"id"?: string,"kind": Database["public"]['Enums']["ticket_kind"],"order_id": string,"printed_at"?: string | null,"printer_id"?: string | null,"restaurant_id": string,"status"?: Database["public"]['Enums']["print_status"],"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"error"?: string | null,"id"?: string,"kind"?: Database["public"]['Enums']["ticket_kind"],"order_id"?: string,"printed_at"?: string | null,"printer_id"?: string | null,"restaurant_id"?: string,"status"?: Database["public"]['Enums']["print_status"],"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "print_jobs_restaurant_id_fkey"
      columns: ["restaurant_id"]
isOneToOne: false
      referencedRelation: "restaurants"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "print_jobs_restaurant_id_order_id_fkey"
      columns: ["restaurant_id","order_id"]
isOneToOne: false
      referencedRelation: "orders"
      referencedColumns: ["restaurant_id","id"]
    },{
      foreignKeyName: "print_jobs_restaurant_id_printer_id_fkey"
      columns: ["restaurant_id","printer_id"]
isOneToOne: false
      referencedRelation: "printers"
      referencedColumns: ["restaurant_id","id"]
    }
                  ]
                },"printers": {
                  Row: {
                    "active": boolean,"created_at": string,"id": string,"ip_address": string | null,"model": string | null,"name": string,"protocol": Database["public"]['Enums']["printer_protocol"],"restaurant_id": string,"role": Database["public"]['Enums']["ticket_kind"],"updated_at": string,"width_chars": number
                  }
                  Insert: {
                    "active"?: boolean,"created_at"?: string,"id"?: string,"ip_address"?: string | null,"model"?: string | null,"name": string,"protocol"?: Database["public"]['Enums']["printer_protocol"],"restaurant_id": string,"role": Database["public"]['Enums']["ticket_kind"],"updated_at"?: string,"width_chars"?: number
                  }
                  Update: {
                    "active"?: boolean,"created_at"?: string,"id"?: string,"ip_address"?: string | null,"model"?: string | null,"name"?: string,"protocol"?: Database["public"]['Enums']["printer_protocol"],"restaurant_id"?: string,"role"?: Database["public"]['Enums']["ticket_kind"],"updated_at"?: string,"width_chars"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "printers_restaurant_id_fkey"
      columns: ["restaurant_id"]
isOneToOne: false
      referencedRelation: "restaurants"
      referencedColumns: ["id"]
    }
                  ]
                },"profiles": {
                  Row: {
                    "created_at": string,"full_name": string | null,"phone": string | null,"preferred_language": Database["public"]['Enums']["app_locale"] | null,"updated_at": string,"user_id": string
                  }
                  Insert: {
                    "created_at"?: string,"full_name"?: string | null,"phone"?: string | null,"preferred_language"?: Database["public"]['Enums']["app_locale"] | null,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"full_name"?: string | null,"phone"?: string | null,"preferred_language"?: Database["public"]['Enums']["app_locale"] | null,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [

                  ]
                },"qr_designs": {
                  Row: {
                    "bg": string,"created_at": string,"dot_style": Database["public"]['Enums']["qr_dot_style"],"eye_style": Database["public"]['Enums']["qr_eye_style"],"fg": string,"font": Database["public"]['Enums']["qr_font"],"frame": string,"frame_ink": string,"frame_text_en": string,"frame_text_es": string,"id": string,"logo_mode": Database["public"]['Enums']["qr_logo_mode"],"logo_path": string | null,"preset": string,"restaurant_id": string,"updated_at": string
                  }
                  Insert: {
                    "bg"?: string,"created_at"?: string,"dot_style"?: Database["public"]['Enums']["qr_dot_style"],"eye_style"?: Database["public"]['Enums']["qr_eye_style"],"fg"?: string,"font"?: Database["public"]['Enums']["qr_font"],"frame"?: string,"frame_ink"?: string,"frame_text_en"?: string,"frame_text_es"?: string,"id"?: string,"logo_mode"?: Database["public"]['Enums']["qr_logo_mode"],"logo_path"?: string | null,"preset"?: string,"restaurant_id": string,"updated_at"?: string
                  }
                  Update: {
                    "bg"?: string,"created_at"?: string,"dot_style"?: Database["public"]['Enums']["qr_dot_style"],"eye_style"?: Database["public"]['Enums']["qr_eye_style"],"fg"?: string,"font"?: Database["public"]['Enums']["qr_font"],"frame"?: string,"frame_ink"?: string,"frame_text_en"?: string,"frame_text_es"?: string,"id"?: string,"logo_mode"?: Database["public"]['Enums']["qr_logo_mode"],"logo_path"?: string | null,"preset"?: string,"restaurant_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "qr_designs_restaurant_id_fkey"
      columns: ["restaurant_id"]
isOneToOne: true
      referencedRelation: "restaurants"
      referencedColumns: ["id"]
    }
                  ]
                },"refunds": {
                  Row: {
                    "amount_cents": number,"approved_by": string | null,"created_at": string,"id": string,"payment_id": string,"reason": string,"restaurant_id": string,"updated_at": string
                  }
                  Insert: {
                    "amount_cents": number,"approved_by"?: string | null,"created_at"?: string,"id"?: string,"payment_id": string,"reason": string,"restaurant_id": string,"updated_at"?: string
                  }
                  Update: {
                    "amount_cents"?: number,"approved_by"?: string | null,"created_at"?: string,"id"?: string,"payment_id"?: string,"reason"?: string,"restaurant_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "refunds_restaurant_id_fkey"
      columns: ["restaurant_id"]
isOneToOne: false
      referencedRelation: "restaurants"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "refunds_restaurant_id_payment_id_fkey"
      columns: ["restaurant_id","payment_id"]
isOneToOne: false
      referencedRelation: "payments"
      referencedColumns: ["restaurant_id","id"]
    }
                  ]
                },"restaurants": {
                  Row: {
                    "address": string | null,"brand_color": string | null,"cover_path": string | null,"created_at": string,"default_language": Database["public"]['Enums']["app_locale"],"default_menu_style": Database["public"]['Enums']["menu_style"],"fiscal_mode": Database["public"]['Enums']["fiscal_mode"],"guest_ordering_paused": boolean,"id": string,"ivu_municipal_bps": number,"ivu_state_bps": number,"name": string,"next_order_number": number,"onboarding_step": number,"phone": string | null,"plan": string,"slug": string,"status": Database["public"]['Enums']["restaurant_status"],"timezone": string,"trial_ends_at": string | null,"updated_at": string
                  }
                  Insert: {
                    "address"?: string | null,"brand_color"?: string | null,"cover_path"?: string | null,"created_at"?: string,"default_language"?: Database["public"]['Enums']["app_locale"],"default_menu_style"?: Database["public"]['Enums']["menu_style"],"fiscal_mode"?: Database["public"]['Enums']["fiscal_mode"],"guest_ordering_paused"?: boolean,"id"?: string,"ivu_municipal_bps"?: number,"ivu_state_bps"?: number,"name": string,"next_order_number"?: number,"onboarding_step"?: number,"phone"?: string | null,"plan"?: string,"slug": string,"status"?: Database["public"]['Enums']["restaurant_status"],"timezone"?: string,"trial_ends_at"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "address"?: string | null,"brand_color"?: string | null,"cover_path"?: string | null,"created_at"?: string,"default_language"?: Database["public"]['Enums']["app_locale"],"default_menu_style"?: Database["public"]['Enums']["menu_style"],"fiscal_mode"?: Database["public"]['Enums']["fiscal_mode"],"guest_ordering_paused"?: boolean,"id"?: string,"ivu_municipal_bps"?: number,"ivu_state_bps"?: number,"name"?: string,"next_order_number"?: number,"onboarding_step"?: number,"phone"?: string | null,"plan"?: string,"slug"?: string,"status"?: Database["public"]['Enums']["restaurant_status"],"timezone"?: string,"trial_ends_at"?: string | null,"updated_at"?: string
                  }
                  Relationships: [

                  ]
                },"service_requests": {
                  Row: {
                    "created_at": string,"handled_at": string | null,"handled_by": string | null,"id": string,"kind": Database["public"]['Enums']["service_request_kind"],"restaurant_id": string,"status": Database["public"]['Enums']["service_request_status"],"tab_id": string,"updated_at": string
                  }
                  Insert: {
                    "created_at"?: string,"handled_at"?: string | null,"handled_by"?: string | null,"id"?: string,"kind": Database["public"]['Enums']["service_request_kind"],"restaurant_id": string,"status"?: Database["public"]['Enums']["service_request_status"],"tab_id": string,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"handled_at"?: string | null,"handled_by"?: string | null,"id"?: string,"kind"?: Database["public"]['Enums']["service_request_kind"],"restaurant_id"?: string,"status"?: Database["public"]['Enums']["service_request_status"],"tab_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "service_requests_restaurant_id_fkey"
      columns: ["restaurant_id"]
isOneToOne: false
      referencedRelation: "restaurants"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "service_requests_restaurant_id_tab_id_fkey"
      columns: ["restaurant_id","tab_id"]
isOneToOne: false
      referencedRelation: "tab_totals"
      referencedColumns: ["restaurant_id","tab_id"]
    },{
      foreignKeyName: "service_requests_restaurant_id_tab_id_fkey"
      columns: ["restaurant_id","tab_id"]
isOneToOne: false
      referencedRelation: "tabs"
      referencedColumns: ["restaurant_id","id"]
    }
                  ]
                },"subscriptions": {
                  Row: {
                    "created_at": string,"id": string,"plan": string,"restaurant_id": string,"status": Database["public"]['Enums']["subscription_status"],"stripe_customer_id": string | null,"trial_ends_at": string | null,"updated_at": string
                  }
                  Insert: {
                    "created_at"?: string,"id"?: string,"plan": string,"restaurant_id": string,"status"?: Database["public"]['Enums']["subscription_status"],"stripe_customer_id"?: string | null,"trial_ends_at"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"plan"?: string,"restaurant_id"?: string,"status"?: Database["public"]['Enums']["subscription_status"],"stripe_customer_id"?: string | null,"trial_ends_at"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "subscriptions_restaurant_id_fkey"
      columns: ["restaurant_id"]
isOneToOne: true
      referencedRelation: "restaurants"
      referencedColumns: ["id"]
    }
                  ]
                },"support_access_grants": {
                  Row: {
                    "approved_at": string | null,"approved_by": string | null,"created_at": string,"expires_at": string,"id": string,"reason": string,"requested_by": string | null,"restaurant_id": string,"updated_at": string
                  }
                  Insert: {
                    "approved_at"?: string | null,"approved_by"?: string | null,"created_at"?: string,"expires_at": string,"id"?: string,"reason": string,"requested_by"?: string | null,"restaurant_id": string,"updated_at"?: string
                  }
                  Update: {
                    "approved_at"?: string | null,"approved_by"?: string | null,"created_at"?: string,"expires_at"?: string,"id"?: string,"reason"?: string,"requested_by"?: string | null,"restaurant_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "support_access_grants_restaurant_id_fkey"
      columns: ["restaurant_id"]
isOneToOne: false
      referencedRelation: "restaurants"
      referencedColumns: ["id"]
    }
                  ]
                },"tab_participants": {
                  Row: {
                    "auth_user_id": string | null,"created_at": string,"display_name": string | null,"guest_id": string | null,"id": string,"restaurant_id": string,"tab_id": string,"updated_at": string
                  }
                  Insert: {
                    "auth_user_id"?: string | null,"created_at"?: string,"display_name"?: string | null,"guest_id"?: string | null,"id"?: string,"restaurant_id": string,"tab_id": string,"updated_at"?: string
                  }
                  Update: {
                    "auth_user_id"?: string | null,"created_at"?: string,"display_name"?: string | null,"guest_id"?: string | null,"id"?: string,"restaurant_id"?: string,"tab_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "tab_participants_restaurant_id_fkey"
      columns: ["restaurant_id"]
isOneToOne: false
      referencedRelation: "restaurants"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "tab_participants_restaurant_id_guest_id_fkey"
      columns: ["restaurant_id","guest_id"]
isOneToOne: false
      referencedRelation: "guests"
      referencedColumns: ["restaurant_id","id"]
    },{
      foreignKeyName: "tab_participants_restaurant_id_tab_id_fkey"
      columns: ["restaurant_id","tab_id"]
isOneToOne: false
      referencedRelation: "tab_totals"
      referencedColumns: ["restaurant_id","tab_id"]
    },{
      foreignKeyName: "tab_participants_restaurant_id_tab_id_fkey"
      columns: ["restaurant_id","tab_id"]
isOneToOne: false
      referencedRelation: "tabs"
      referencedColumns: ["restaurant_id","id"]
    }
                  ]
                },"tabs": {
                  Row: {
                    "bill_municipal_bps": number | null,"bill_revision": number,"bill_state_bps": number | null,"closed_at": string | null,"created_at": string,"id": string,"opened_at": string,"party_size": number | null,"pos_closed_at": string | null,"pos_closed_by": string | null,"restaurant_id": string,"split_count": number | null,"split_mode": Database["public"]['Enums']["split_mode"],"staff_managed": boolean,"status": Database["public"]['Enums']["tab_status"],"table_id": string,"updated_at": string
                  }
                  Insert: {
                    "bill_municipal_bps"?: number | null,"bill_revision"?: number,"bill_state_bps"?: number | null,"closed_at"?: string | null,"created_at"?: string,"id"?: string,"opened_at"?: string,"party_size"?: number | null,"pos_closed_at"?: string | null,"pos_closed_by"?: string | null,"restaurant_id": string,"split_count"?: number | null,"split_mode"?: Database["public"]['Enums']["split_mode"],"staff_managed"?: boolean,"status"?: Database["public"]['Enums']["tab_status"],"table_id": string,"updated_at"?: string
                  }
                  Update: {
                    "bill_municipal_bps"?: number | null,"bill_revision"?: number,"bill_state_bps"?: number | null,"closed_at"?: string | null,"created_at"?: string,"id"?: string,"opened_at"?: string,"party_size"?: number | null,"pos_closed_at"?: string | null,"pos_closed_by"?: string | null,"restaurant_id"?: string,"split_count"?: number | null,"split_mode"?: Database["public"]['Enums']["split_mode"],"staff_managed"?: boolean,"status"?: Database["public"]['Enums']["tab_status"],"table_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "tabs_restaurant_id_fkey"
      columns: ["restaurant_id"]
isOneToOne: false
      referencedRelation: "restaurants"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "tabs_restaurant_id_table_id_fkey"
      columns: ["restaurant_id","table_id"]
isOneToOne: false
      referencedRelation: "dining_tables"
      referencedColumns: ["restaurant_id","id"]
    }
                  ]
                },"usage_fees": {
                  Row: {
                    "ath_volume_cents": number,"card_volume_cents": number,"created_at": string,"fee_cents": number,"id": string,"period": string,"restaurant_id": string,"updated_at": string
                  }
                  Insert: {
                    "ath_volume_cents"?: number,"card_volume_cents"?: number,"created_at"?: string,"fee_cents"?: number,"id"?: string,"period": string,"restaurant_id": string,"updated_at"?: string
                  }
                  Update: {
                    "ath_volume_cents"?: number,"card_volume_cents"?: number,"created_at"?: string,"fee_cents"?: number,"id"?: string,"period"?: string,"restaurant_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "usage_fees_restaurant_id_fkey"
      columns: ["restaurant_id"]
isOneToOne: false
      referencedRelation: "restaurants"
      referencedColumns: ["id"]
    }
                  ]
                },"webhook_events": {
                  Row: {
                    "created_at": string,"event_id": string,"id": string,"payload": NonNullable<Json>,"processed_at": string | null,"provider": string,"updated_at": string
                  }
                  Insert: {
                    "created_at"?: string,"event_id": string,"id"?: string,"payload": NonNullable<Json>,"processed_at"?: string | null,"provider": string,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"event_id"?: string,"id"?: string,"payload"?: NonNullable<Json>,"processed_at"?: string | null,"provider"?: string,"updated_at"?: string
                  }
                  Relationships: [

                  ]
                }
          }
          Views: {
            "ivu_monthly": {
                  Row: {
                    "ivu_municipal_cents": number | null,"ivu_state_cents": number | null,"month": string | null,"restaurant_id": string | null,"sales_cents": number | null,"tips_cents": number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "daily_sales_restaurant_id_fkey"
      columns: ["restaurant_id"]
isOneToOne: false
      referencedRelation: "restaurants"
      referencedColumns: ["id"]
    }
                  ]
                },"tab_totals": {
                  Row: {
                    "line_count": number | null,"restaurant_id": string | null,"status": Database["public"]['Enums']["tab_status"] | null,"subtotal_cents": number | null,"tab_id": string | null,"table_id": string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "tabs_restaurant_id_fkey"
      columns: ["restaurant_id"]
isOneToOne: false
      referencedRelation: "restaurants"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "tabs_restaurant_id_table_id_fkey"
      columns: ["restaurant_id","table_id"]
isOneToOne: false
      referencedRelation: "dining_tables"
      referencedColumns: ["restaurant_id","id"]
    }
                  ]
                }
          }
          Functions: {
            "create_restaurant_with_owner":
{ Args: { "p_language"?: Database["public"]['Enums']["app_locale"],"p_name": string,"p_owner_id": string,"p_phone"?: string,"p_slug": string }; Returns: string
                           },
"has_role":
{ Args: { "p_restaurant_id": string,"p_roles": (Database["public"]['Enums']["member_role"])[] }; Returns: boolean
                           },
"is_platform_admin":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"place_order":
{ Args: { "p_client_order_id": string,"p_created_by"?: string,"p_device_id"?: string,"p_guest_language"?: Database["public"]['Enums']["app_locale"],"p_lines": Json,"p_restaurant_id": string,"p_source": Database["public"]['Enums']["order_source"],"p_table_id": string }; Returns: Json
                           },
"publish_menu_import":
{ Args: { "p_payload": Json,"p_reviewed_by"?: string,"p_upload_id": string }; Returns: Json
                           },
"publish_original_menu_image":
{ Args: { "p_height": number,"p_reviewed_by": string,"p_upload_id": string,"p_width": number }; Returns: string
                           },
"record_refund":
{ Args: { "p_amount_cents": number,"p_payment_id": string,"p_reason": string }; Returns: string
                           },
"refresh_sales_summaries":
{ Args: { "p_from": string,"p_restaurant_id": string,"p_to": string }; Returns: undefined
                           },
"report_summary":
{ Args: { "p_from": string,"p_restaurant_id": string,"p_to": string }; Returns: Json
                           },
"set_item_availability":
{ Args: { "p_available": boolean,"p_item_id": string }; Returns: undefined
                           },
"set_order_status":
{ Args: { "p_order_id": string,"p_status": Database["public"]['Enums']["order_status"] }; Returns: undefined
                           },
"storage_restaurant_id":
{ Args: { "p_name": string }; Returns: string
                           },
"visit_claim_recovery":
{ Args: { "p_receipt_hash": string,"p_secret_hash": string,"p_table": string,"p_ticket_hash": string }; Returns: Json
                           },
"visit_financial_summary":
{ Args: { "p_actor": string,"p_from": string,"p_restaurant": string,"p_to": string }; Returns: Json
                           },
"visit_private_receipts":
{ Args: { "p_hash": string,"p_table": string }; Returns: Json
                           },
"visit_rate_limit":
{ Args: { "p_key": string,"p_max": number,"p_seconds": number }; Returns: boolean
                           },
"visit_snapshot":
{ Args: { "p_tab": string }; Returns: Json
                           },
"visit_workflow":
{ Args: { "p_actor"?: string,"p_data"?: Json,"p_op": string,"p_secret_hash"?: string,"p_tab"?: string,"p_table"?: string }; Returns: Json
                           },
"void_order":
{ Args: { "p_order_id": string,"p_order_item_id"?: string,"p_reason": string }; Returns: undefined
                           }
          }
          Enums: {
            "app_locale": "es"|"en","audit_action": "void"|"refund"|"price_change"|"pin_reset"|"support_access"|"bill_workflow","device_kind": "server"|"kitchen"|"register","export_kind": "ivu_monthly_pdf"|"ivu_monthly_csv"|"sales_csv"|"sales_xlsx"|"qr_pdf","fiscal_mode": "sit_beside"|"processor","member_role": "owner"|"manager"|"server"|"kitchen","menu_style": "house"|"original"|"simple","order_source": "qr"|"staff","order_status": "new"|"in_kitchen"|"ready"|"served"|"void","paper_texture": "none"|"linen"|"kraft"|"parchment","payment_method": "card"|"ath"|"cash","payment_provider": "stripe"|"ath","payment_status": "pending"|"paid"|"failed"|"refunded"|"partially_refunded","print_status": "queued"|"printed"|"failed","printer_protocol": "browser"|"epson_epos"|"star_webprnt","provider_status": "not_connected"|"pending"|"connected"|"unavailable","qr_dot_style": "square"|"rounded"|"dots","qr_eye_style": "square"|"rounded"|"circle","qr_font": "menu"|"modern","qr_logo_mode": "none"|"mono"|"upload","restaurant_status": "trial"|"active"|"paused"|"cancelled","service_request_kind": "call_server"|"bring_check","service_request_status": "open"|"handled","split_mode": "one"|"even"|"items","subscription_status": "trial"|"active"|"past_due"|"cancelled","tab_status": "open"|"paying"|"closed","ticket_kind": "kitchen"|"receipt","upload_status": "processing"|"review"|"published"|"failed"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R
    }
    ? R
    : never
  : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Insert: infer I
    }
    ? I
    : never
  : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Update: infer U
    }
    ? U
    : never
  : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
  ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {

          }
        },"public": {
          Enums: {
            "app_locale": ["es", "en"],"audit_action": ["void", "refund", "price_change", "pin_reset", "support_access", "bill_workflow"],"device_kind": ["server", "kitchen", "register"],"export_kind": ["ivu_monthly_pdf", "ivu_monthly_csv", "sales_csv", "sales_xlsx", "qr_pdf"],"fiscal_mode": ["sit_beside", "processor"],"member_role": ["owner", "manager", "server", "kitchen"],"menu_style": ["house", "original", "simple"],"order_source": ["qr", "staff"],"order_status": ["new", "in_kitchen", "ready", "served", "void"],"paper_texture": ["none", "linen", "kraft", "parchment"],"payment_method": ["card", "ath", "cash"],"payment_provider": ["stripe", "ath"],"payment_status": ["pending", "paid", "failed", "refunded", "partially_refunded"],"print_status": ["queued", "printed", "failed"],"printer_protocol": ["browser", "epson_epos", "star_webprnt"],"provider_status": ["not_connected", "pending", "connected", "unavailable"],"qr_dot_style": ["square", "rounded", "dots"],"qr_eye_style": ["square", "rounded", "circle"],"qr_font": ["menu", "modern"],"qr_logo_mode": ["none", "mono", "upload"],"restaurant_status": ["trial", "active", "paused", "cancelled"],"service_request_kind": ["call_server", "bring_check"],"service_request_status": ["open", "handled"],"split_mode": ["one", "even", "items"],"subscription_status": ["trial", "active", "past_due", "cancelled"],"tab_status": ["open", "paying", "closed"],"ticket_kind": ["kitchen", "receipt"],"upload_status": ["processing", "review", "published", "failed"]
          }
        }
} as const
