export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      activity_logs: {
        Row: {
          action: string
          changes: Json | null
          company_id: string
          created_at: string
          description: string | null
          entity_id: string | null
          entity_number: string | null
          entity_type: string
          id: string
          ip_address: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          changes?: Json | null
          company_id: string
          created_at?: string
          description?: string | null
          entity_id?: string | null
          entity_number?: string | null
          entity_type: string
          id?: string
          ip_address?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          changes?: Json | null
          company_id?: string
          created_at?: string
          description?: string | null
          entity_id?: string | null
          entity_number?: string | null
          entity_type?: string
          id?: string
          ip_address?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "activity_logs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      asset_depreciations: {
        Row: {
          accumulated_total: number
          amount: number
          asset_id: string
          created_at: string
          depreciation_date: string
          id: string
          journal_entry_id: string | null
        }
        Insert: {
          accumulated_total: number
          amount: number
          asset_id: string
          created_at?: string
          depreciation_date: string
          id?: string
          journal_entry_id?: string | null
        }
        Update: {
          accumulated_total?: number
          amount?: number
          asset_id?: string
          created_at?: string
          depreciation_date?: string
          id?: string
          journal_entry_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "asset_depreciations_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "fixed_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_depreciations_journal_entry_id_fkey"
            columns: ["journal_entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      bills: {
        Row: {
          bill_date: string
          bill_number: string
          company_id: string
          created_at: string
          created_by: string | null
          due_date: string
          id: string
          notes: string | null
          outstanding_amount: number | null
          paid_amount: number | null
          purchase_order_id: string | null
          status: Database["public"]["Enums"]["invoice_status"]
          subtotal: number | null
          supplier_id: string
          tax_amount: number | null
          total_amount: number | null
          updated_at: string
        }
        Insert: {
          bill_date?: string
          bill_number: string
          company_id: string
          created_at?: string
          created_by?: string | null
          due_date: string
          id?: string
          notes?: string | null
          outstanding_amount?: number | null
          paid_amount?: number | null
          purchase_order_id?: string | null
          status?: Database["public"]["Enums"]["invoice_status"]
          subtotal?: number | null
          supplier_id: string
          tax_amount?: number | null
          total_amount?: number | null
          updated_at?: string
        }
        Update: {
          bill_date?: string
          bill_number?: string
          company_id?: string
          created_at?: string
          created_by?: string | null
          due_date?: string
          id?: string
          notes?: string | null
          outstanding_amount?: number | null
          paid_amount?: number | null
          purchase_order_id?: string | null
          status?: Database["public"]["Enums"]["invoice_status"]
          subtotal?: number | null
          supplier_id?: string
          tax_amount?: number | null
          total_amount?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bills_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bills_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bills_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      chart_of_accounts: {
        Row: {
          account_type: Database["public"]["Enums"]["account_type"]
          balance: number | null
          code: string
          company_id: string
          created_at: string
          id: string
          is_active: boolean | null
          name: string
          parent_id: string | null
          updated_at: string
        }
        Insert: {
          account_type: Database["public"]["Enums"]["account_type"]
          balance?: number | null
          code: string
          company_id: string
          created_at?: string
          id?: string
          is_active?: boolean | null
          name: string
          parent_id?: string | null
          updated_at?: string
        }
        Update: {
          account_type?: Database["public"]["Enums"]["account_type"]
          balance?: number | null
          code?: string
          company_id?: string
          created_at?: string
          id?: string
          is_active?: boolean | null
          name?: string
          parent_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "chart_of_accounts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chart_of_accounts_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "chart_of_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          address: string | null
          business_type: string | null
          code: string
          created_at: string
          email: string | null
          id: string
          name: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          business_type?: string | null
          code: string
          created_at?: string
          email?: string | null
          id?: string
          name: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          business_type?: string | null
          code?: string
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      customers: {
        Row: {
          address: string | null
          code: string
          company_id: string
          created_at: string
          credit_limit: number | null
          email: string | null
          id: string
          name: string
          phone: string | null
          receivable_account_id: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          code: string
          company_id: string
          created_at?: string
          credit_limit?: number | null
          email?: string | null
          id?: string
          name: string
          phone?: string | null
          receivable_account_id?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          code?: string
          company_id?: string
          created_at?: string
          credit_limit?: number | null
          email?: string | null
          id?: string
          name?: string
          phone?: string | null
          receivable_account_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customers_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customers_receivable_account_id_fkey"
            columns: ["receivable_account_id"]
            isOneToOne: false
            referencedRelation: "chart_of_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      document_sequences: {
        Row: {
          company_id: string
          created_at: string
          current_number: number
          document_type: string
          id: string
          last_reset_date: string
          prefix: string
          reset_period: string
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          current_number?: number
          document_type: string
          id?: string
          last_reset_date?: string
          prefix: string
          reset_period?: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          current_number?: number
          document_type?: string
          id?: string
          last_reset_date?: string
          prefix?: string
          reset_period?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_sequences_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      down_payments: {
        Row: {
          amount: number
          cash_account_id: string | null
          company_id: string
          created_at: string
          created_by: string | null
          dp_date: string
          dp_number: string
          id: string
          notes: string | null
          payment_type: string
          purchase_order_id: string | null
          sales_order_id: string | null
        }
        Insert: {
          amount: number
          cash_account_id?: string | null
          company_id: string
          created_at?: string
          created_by?: string | null
          dp_date?: string
          dp_number: string
          id?: string
          notes?: string | null
          payment_type: string
          purchase_order_id?: string | null
          sales_order_id?: string | null
        }
        Update: {
          amount?: number
          cash_account_id?: string | null
          company_id?: string
          created_at?: string
          created_by?: string | null
          dp_date?: string
          dp_number?: string
          id?: string
          notes?: string | null
          payment_type?: string
          purchase_order_id?: string | null
          sales_order_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "down_payments_cash_account_id_fkey"
            columns: ["cash_account_id"]
            isOneToOne: false
            referencedRelation: "chart_of_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "down_payments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "down_payments_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "down_payments_sales_order_id_fkey"
            columns: ["sales_order_id"]
            isOneToOne: false
            referencedRelation: "sales_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      features: {
        Row: {
          created_at: string
          description: string | null
          key: string
          label: string
          module: string
          sort_order: number | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          key: string
          label: string
          module: string
          sort_order?: number | null
        }
        Update: {
          created_at?: string
          description?: string | null
          key?: string
          label?: string
          module?: string
          sort_order?: number | null
        }
        Relationships: []
      }
      fixed_assets: {
        Row: {
          accumulated_depreciation: number | null
          accumulated_depreciation_account_id: string | null
          asset_account_id: string | null
          asset_code: string
          company_id: string
          created_at: string
          created_by: string | null
          current_value: number | null
          depreciation_expense_account_id: string | null
          depreciation_method: Database["public"]["Enums"]["depreciation_method"]
          description: string | null
          id: string
          name: string
          purchase_date: string
          purchase_price: number
          salvage_value: number | null
          status: Database["public"]["Enums"]["asset_status"]
          updated_at: string
          useful_life_months: number
        }
        Insert: {
          accumulated_depreciation?: number | null
          accumulated_depreciation_account_id?: string | null
          asset_account_id?: string | null
          asset_code: string
          company_id: string
          created_at?: string
          created_by?: string | null
          current_value?: number | null
          depreciation_expense_account_id?: string | null
          depreciation_method?: Database["public"]["Enums"]["depreciation_method"]
          description?: string | null
          id?: string
          name: string
          purchase_date: string
          purchase_price: number
          salvage_value?: number | null
          status?: Database["public"]["Enums"]["asset_status"]
          updated_at?: string
          useful_life_months: number
        }
        Update: {
          accumulated_depreciation?: number | null
          accumulated_depreciation_account_id?: string | null
          asset_account_id?: string | null
          asset_code?: string
          company_id?: string
          created_at?: string
          created_by?: string | null
          current_value?: number | null
          depreciation_expense_account_id?: string | null
          depreciation_method?: Database["public"]["Enums"]["depreciation_method"]
          description?: string | null
          id?: string
          name?: string
          purchase_date?: string
          purchase_price?: number
          salvage_value?: number | null
          status?: Database["public"]["Enums"]["asset_status"]
          updated_at?: string
          useful_life_months?: number
        }
        Relationships: [
          {
            foreignKeyName: "fixed_assets_accumulated_depreciation_account_id_fkey"
            columns: ["accumulated_depreciation_account_id"]
            isOneToOne: false
            referencedRelation: "chart_of_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fixed_assets_asset_account_id_fkey"
            columns: ["asset_account_id"]
            isOneToOne: false
            referencedRelation: "chart_of_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fixed_assets_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fixed_assets_depreciation_expense_account_id_fkey"
            columns: ["depreciation_expense_account_id"]
            isOneToOne: false
            referencedRelation: "chart_of_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      goods_receipt_items: {
        Row: {
          billed_quantity: number | null
          created_at: string
          id: string
          product_id: string
          purchase_order_item_id: string | null
          quantity_ordered: number
          quantity_received: number
          receipt_id: string
          unit_cost: number | null
          warehouse_id: string | null
        }
        Insert: {
          billed_quantity?: number | null
          created_at?: string
          id?: string
          product_id: string
          purchase_order_item_id?: string | null
          quantity_ordered?: number
          quantity_received?: number
          receipt_id: string
          unit_cost?: number | null
          warehouse_id?: string | null
        }
        Update: {
          billed_quantity?: number | null
          created_at?: string
          id?: string
          product_id?: string
          purchase_order_item_id?: string | null
          quantity_ordered?: number
          quantity_received?: number
          receipt_id?: string
          unit_cost?: number | null
          warehouse_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "goods_receipt_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goods_receipt_items_receipt_id_fkey"
            columns: ["receipt_id"]
            isOneToOne: false
            referencedRelation: "goods_receipts"
            referencedColumns: ["id"]
          },
        ]
      }
      goods_receipts: {
        Row: {
          company_id: string
          created_at: string
          created_by: string | null
          id: string
          notes: string | null
          purchase_order_id: string
          receipt_date: string
          receipt_number: string
          updated_at: string
          warehouse_id: string | null
        }
        Insert: {
          company_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          purchase_order_id: string
          receipt_date?: string
          receipt_number: string
          updated_at?: string
          warehouse_id?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          purchase_order_id?: string
          receipt_date?: string
          receipt_number?: string
          updated_at?: string
          warehouse_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "goods_receipts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goods_receipts_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_movements: {
        Row: {
          balance_after: number | null
          company_id: string
          created_at: string
          created_by: string | null
          id: string
          movement_date: string
          movement_type: string
          notes: string | null
          product_id: string
          quantity: number
          reference_id: string | null
          reference_number: string | null
          reference_type: string | null
          unit_cost: number | null
          warehouse_id: string | null
        }
        Insert: {
          balance_after?: number | null
          company_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          movement_date?: string
          movement_type: string
          notes?: string | null
          product_id: string
          quantity: number
          reference_id?: string | null
          reference_number?: string | null
          reference_type?: string | null
          unit_cost?: number | null
          warehouse_id?: string | null
        }
        Update: {
          balance_after?: number | null
          company_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          movement_date?: string
          movement_type?: string
          notes?: string | null
          product_id?: string
          quantity?: number
          reference_id?: string | null
          reference_number?: string | null
          reference_type?: string | null
          unit_cost?: number | null
          warehouse_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_movements_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_stock: {
        Row: {
          created_at: string
          id: string
          product_id: string
          quantity: number | null
          updated_at: string
          warehouse_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          product_id: string
          quantity?: number | null
          updated_at?: string
          warehouse_id: string
        }
        Update: {
          created_at?: string
          id?: string
          product_id?: string
          quantity?: number | null
          updated_at?: string
          warehouse_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_stock_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_stock_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          company_id: string
          created_at: string
          created_by: string | null
          customer_id: string
          due_date: string
          id: string
          invoice_date: string
          invoice_number: string
          notes: string | null
          outstanding_amount: number | null
          paid_amount: number | null
          sales_order_id: string | null
          status: Database["public"]["Enums"]["invoice_status"]
          subtotal: number | null
          tax_amount: number | null
          total_amount: number | null
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          created_by?: string | null
          customer_id: string
          due_date: string
          id?: string
          invoice_date?: string
          invoice_number: string
          notes?: string | null
          outstanding_amount?: number | null
          paid_amount?: number | null
          sales_order_id?: string | null
          status?: Database["public"]["Enums"]["invoice_status"]
          subtotal?: number | null
          tax_amount?: number | null
          total_amount?: number | null
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by?: string | null
          customer_id?: string
          due_date?: string
          id?: string
          invoice_date?: string
          invoice_number?: string
          notes?: string | null
          outstanding_amount?: number | null
          paid_amount?: number | null
          sales_order_id?: string | null
          status?: Database["public"]["Enums"]["invoice_status"]
          subtotal?: number | null
          tax_amount?: number | null
          total_amount?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_sales_order_id_fkey"
            columns: ["sales_order_id"]
            isOneToOne: false
            referencedRelation: "sales_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      journal_entries: {
        Row: {
          company_id: string
          created_at: string
          created_by: string | null
          description: string | null
          entry_date: string
          entry_number: string
          id: string
          is_posted: boolean | null
          reference_id: string | null
          reference_type: string | null
        }
        Insert: {
          company_id: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          entry_date?: string
          entry_number: string
          id?: string
          is_posted?: boolean | null
          reference_id?: string | null
          reference_type?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          entry_date?: string
          entry_number?: string
          id?: string
          is_posted?: boolean | null
          reference_id?: string | null
          reference_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "journal_entries_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      journal_entry_lines: {
        Row: {
          account_id: string
          created_at: string
          credit_amount: number | null
          debit_amount: number | null
          description: string | null
          id: string
          journal_entry_id: string
        }
        Insert: {
          account_id: string
          created_at?: string
          credit_amount?: number | null
          debit_amount?: number | null
          description?: string | null
          id?: string
          journal_entry_id: string
        }
        Update: {
          account_id?: string
          created_at?: string
          credit_amount?: number | null
          debit_amount?: number | null
          description?: string | null
          id?: string
          journal_entry_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "journal_entry_lines_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "chart_of_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_entry_lines_journal_entry_id_fkey"
            columns: ["journal_entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      journal_entry_tags: {
        Row: {
          created_at: string
          id: string
          journal_entry_id: string
          tag_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          journal_entry_id: string
          tag_id: string
        }
        Update: {
          created_at?: string
          id?: string
          journal_entry_id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "journal_entry_tags_journal_entry_id_fkey"
            columns: ["journal_entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_entry_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "transaction_tags"
            referencedColumns: ["id"]
          },
        ]
      }
      opening_balances: {
        Row: {
          account_id: string
          balance_date: string
          company_id: string
          created_at: string
          credit_balance: number | null
          debit_balance: number | null
          id: string
          period_closing_id: string | null
        }
        Insert: {
          account_id: string
          balance_date: string
          company_id: string
          created_at?: string
          credit_balance?: number | null
          debit_balance?: number | null
          id?: string
          period_closing_id?: string | null
        }
        Update: {
          account_id?: string
          balance_date?: string
          company_id?: string
          created_at?: string
          credit_balance?: number | null
          debit_balance?: number | null
          id?: string
          period_closing_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "opening_balances_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "chart_of_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opening_balances_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opening_balances_period_closing_id_fkey"
            columns: ["period_closing_id"]
            isOneToOne: false
            referencedRelation: "period_closings"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_allocations: {
        Row: {
          amount: number
          bill_id: string | null
          created_at: string
          id: string
          invoice_id: string | null
          payment_id: string
        }
        Insert: {
          amount: number
          bill_id?: string | null
          created_at?: string
          id?: string
          invoice_id?: string | null
          payment_id: string
        }
        Update: {
          amount?: number
          bill_id?: string | null
          created_at?: string
          id?: string
          invoice_id?: string | null
          payment_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_allocations_bill_id_fkey"
            columns: ["bill_id"]
            isOneToOne: false
            referencedRelation: "bills"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_allocations_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_allocations_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          cash_account_id: string | null
          company_id: string
          created_at: string
          created_by: string | null
          customer_id: string | null
          id: string
          notes: string | null
          payment_date: string
          payment_number: string
          payment_type: Database["public"]["Enums"]["payment_type"]
          supplier_id: string | null
        }
        Insert: {
          amount: number
          cash_account_id?: string | null
          company_id: string
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          id?: string
          notes?: string | null
          payment_date?: string
          payment_number: string
          payment_type: Database["public"]["Enums"]["payment_type"]
          supplier_id?: string | null
        }
        Update: {
          amount?: number
          cash_account_id?: string | null
          company_id?: string
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          id?: string
          notes?: string | null
          payment_date?: string
          payment_number?: string
          payment_type?: Database["public"]["Enums"]["payment_type"]
          supplier_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_cash_account_id_fkey"
            columns: ["cash_account_id"]
            isOneToOne: false
            referencedRelation: "chart_of_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      period_closings: {
        Row: {
          closed_at: string
          closed_by: string | null
          company_id: string
          created_at: string
          id: string
          notes: string | null
          period_end: string
          period_start: string
          status: string | null
        }
        Insert: {
          closed_at?: string
          closed_by?: string | null
          company_id: string
          created_at?: string
          id?: string
          notes?: string | null
          period_end: string
          period_start: string
          status?: string | null
        }
        Update: {
          closed_at?: string
          closed_by?: string | null
          company_id?: string
          created_at?: string
          id?: string
          notes?: string | null
          period_end?: string
          period_start?: string
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "period_closings_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      pos_cash_sessions: {
        Row: {
          closed_at: string | null
          closed_by: string | null
          closing_balance: number | null
          company_id: string
          difference: number | null
          expected_balance: number | null
          id: string
          notes: string | null
          opened_at: string
          opened_by: string | null
          opening_balance: number
          status: string
        }
        Insert: {
          closed_at?: string | null
          closed_by?: string | null
          closing_balance?: number | null
          company_id: string
          difference?: number | null
          expected_balance?: number | null
          id?: string
          notes?: string | null
          opened_at?: string
          opened_by?: string | null
          opening_balance?: number
          status?: string
        }
        Update: {
          closed_at?: string | null
          closed_by?: string | null
          closing_balance?: number | null
          company_id?: string
          difference?: number | null
          expected_balance?: number | null
          id?: string
          notes?: string | null
          opened_at?: string
          opened_by?: string | null
          opening_balance?: number
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "pos_cash_sessions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      pos_deposits: {
        Row: {
          cash_account_id: string | null
          company_id: string
          company_name: string | null
          created_at: string
          created_by: string | null
          customer_id: string | null
          customer_name: string
          customer_phone: string | null
          deposit_amount: number
          deposit_number: string
          event_date: string
          event_name: string
          folio_number: string | null
          id: string
          journal_entry_id: string | null
          notes: string | null
          open_table_id: string | null
          payment_method_id: string | null
          pos_transaction_id: string | null
          remaining_amount: number | null
          status: string
          total_estimated: number | null
          updated_at: string
        }
        Insert: {
          cash_account_id?: string | null
          company_id: string
          company_name?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          customer_name: string
          customer_phone?: string | null
          deposit_amount: number
          deposit_number: string
          event_date: string
          event_name: string
          folio_number?: string | null
          id?: string
          journal_entry_id?: string | null
          notes?: string | null
          open_table_id?: string | null
          payment_method_id?: string | null
          pos_transaction_id?: string | null
          remaining_amount?: number | null
          status?: string
          total_estimated?: number | null
          updated_at?: string
        }
        Update: {
          cash_account_id?: string | null
          company_id?: string
          company_name?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          customer_name?: string
          customer_phone?: string | null
          deposit_amount?: number
          deposit_number?: string
          event_date?: string
          event_name?: string
          folio_number?: string | null
          id?: string
          journal_entry_id?: string | null
          notes?: string | null
          open_table_id?: string | null
          payment_method_id?: string | null
          pos_transaction_id?: string | null
          remaining_amount?: number | null
          status?: string
          total_estimated?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pos_deposits_cash_account_id_fkey"
            columns: ["cash_account_id"]
            isOneToOne: false
            referencedRelation: "chart_of_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pos_deposits_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pos_deposits_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pos_deposits_journal_entry_id_fkey"
            columns: ["journal_entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pos_deposits_open_table_id_fkey"
            columns: ["open_table_id"]
            isOneToOne: false
            referencedRelation: "pos_open_tables"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pos_deposits_payment_method_id_fkey"
            columns: ["payment_method_id"]
            isOneToOne: false
            referencedRelation: "pos_payment_methods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pos_deposits_pos_transaction_id_fkey"
            columns: ["pos_transaction_id"]
            isOneToOne: false
            referencedRelation: "pos_transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      pos_open_table_items: {
        Row: {
          cost_price: number
          created_at: string
          discount_amount: number | null
          discount_percent: number | null
          id: string
          notes: string | null
          open_table_id: string
          product_id: string
          quantity: number
          served_at: string | null
          tax_amount: number | null
          tax_percent: number | null
          total: number
          unit_price: number
        }
        Insert: {
          cost_price?: number
          created_at?: string
          discount_amount?: number | null
          discount_percent?: number | null
          id?: string
          notes?: string | null
          open_table_id: string
          product_id: string
          quantity?: number
          served_at?: string | null
          tax_amount?: number | null
          tax_percent?: number | null
          total: number
          unit_price: number
        }
        Update: {
          cost_price?: number
          created_at?: string
          discount_amount?: number | null
          discount_percent?: number | null
          id?: string
          notes?: string | null
          open_table_id?: string
          product_id?: string
          quantity?: number
          served_at?: string | null
          tax_amount?: number | null
          tax_percent?: number | null
          total?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "pos_open_table_items_open_table_id_fkey"
            columns: ["open_table_id"]
            isOneToOne: false
            referencedRelation: "pos_open_tables"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pos_open_table_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      pos_open_tables: {
        Row: {
          closed_at: string | null
          company_id: string
          created_by: string | null
          customer_name: string | null
          customer_phone: string | null
          discount_amount: number | null
          id: string
          notes: string | null
          opened_at: string
          status: string
          subtotal: number | null
          table_name: string
          tax_amount: number | null
          total_amount: number | null
          total_cogs: number | null
        }
        Insert: {
          closed_at?: string | null
          company_id: string
          created_by?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          discount_amount?: number | null
          id?: string
          notes?: string | null
          opened_at?: string
          status?: string
          subtotal?: number | null
          table_name: string
          tax_amount?: number | null
          total_amount?: number | null
          total_cogs?: number | null
        }
        Update: {
          closed_at?: string | null
          company_id?: string
          created_by?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          discount_amount?: number | null
          id?: string
          notes?: string | null
          opened_at?: string
          status?: string
          subtotal?: number | null
          table_name?: string
          tax_amount?: number | null
          total_amount?: number | null
          total_cogs?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "pos_open_tables_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      pos_payment_methods: {
        Row: {
          account_id: string | null
          code: string
          company_id: string
          created_at: string
          id: string
          is_active: boolean | null
          name: string
        }
        Insert: {
          account_id?: string | null
          code: string
          company_id: string
          created_at?: string
          id?: string
          is_active?: boolean | null
          name: string
        }
        Update: {
          account_id?: string | null
          code?: string
          company_id?: string
          created_at?: string
          id?: string
          is_active?: boolean | null
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "pos_payment_methods_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "chart_of_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pos_payment_methods_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      pos_promotions: {
        Row: {
          applies_to: string | null
          applies_to_ids: string[] | null
          company_id: string
          created_at: string
          created_by: string | null
          description: string | null
          discount_type: string
          discount_value: number
          end_date: string
          id: string
          is_active: boolean | null
          max_discount: number | null
          min_purchase: number | null
          name: string
          promo_code: string | null
          start_date: string
          updated_at: string
          usage_limit: number | null
          used_count: number | null
        }
        Insert: {
          applies_to?: string | null
          applies_to_ids?: string[] | null
          company_id: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          discount_type?: string
          discount_value?: number
          end_date: string
          id?: string
          is_active?: boolean | null
          max_discount?: number | null
          min_purchase?: number | null
          name: string
          promo_code?: string | null
          start_date?: string
          updated_at?: string
          usage_limit?: number | null
          used_count?: number | null
        }
        Update: {
          applies_to?: string | null
          applies_to_ids?: string[] | null
          company_id?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          discount_type?: string
          discount_value?: number
          end_date?: string
          id?: string
          is_active?: boolean | null
          max_discount?: number | null
          min_purchase?: number | null
          name?: string
          promo_code?: string | null
          start_date?: string
          updated_at?: string
          usage_limit?: number | null
          used_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "pos_promotions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      pos_tax_rates: {
        Row: {
          account_id: string | null
          apply_order: number | null
          calculation_method: string | null
          category: string
          company_id: string
          created_at: string
          display_name: string | null
          id: string
          is_active: boolean | null
          is_default: boolean | null
          name: string
          rate: number
          show_on_receipt: boolean | null
        }
        Insert: {
          account_id?: string | null
          apply_order?: number | null
          calculation_method?: string | null
          category?: string
          company_id: string
          created_at?: string
          display_name?: string | null
          id?: string
          is_active?: boolean | null
          is_default?: boolean | null
          name: string
          rate?: number
          show_on_receipt?: boolean | null
        }
        Update: {
          account_id?: string | null
          apply_order?: number | null
          calculation_method?: string | null
          category?: string
          company_id?: string
          created_at?: string
          display_name?: string | null
          id?: string
          is_active?: boolean | null
          is_default?: boolean | null
          name?: string
          rate?: number
          show_on_receipt?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "pos_tax_rates_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "chart_of_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pos_tax_rates_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      pos_transaction_items: {
        Row: {
          cost_price: number
          created_at: string
          discount_amount: number | null
          discount_percent: number | null
          id: string
          pos_transaction_id: string
          product_id: string
          quantity: number
          tax_amount: number | null
          tax_percent: number | null
          total: number
          unit_price: number
        }
        Insert: {
          cost_price?: number
          created_at?: string
          discount_amount?: number | null
          discount_percent?: number | null
          id?: string
          pos_transaction_id: string
          product_id: string
          quantity?: number
          tax_amount?: number | null
          tax_percent?: number | null
          total: number
          unit_price: number
        }
        Update: {
          cost_price?: number
          created_at?: string
          discount_amount?: number | null
          discount_percent?: number | null
          id?: string
          pos_transaction_id?: string
          product_id?: string
          quantity?: number
          tax_amount?: number | null
          tax_percent?: number | null
          total?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "pos_transaction_items_pos_transaction_id_fkey"
            columns: ["pos_transaction_id"]
            isOneToOne: false
            referencedRelation: "pos_transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pos_transaction_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      pos_transaction_payments: {
        Row: {
          amount: number
          created_at: string
          id: string
          payment_method_id: string | null
          pos_transaction_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          payment_method_id?: string | null
          pos_transaction_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          payment_method_id?: string | null
          pos_transaction_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pos_transaction_payments_payment_method_id_fkey"
            columns: ["payment_method_id"]
            isOneToOne: false
            referencedRelation: "pos_payment_methods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pos_transaction_payments_pos_transaction_id_fkey"
            columns: ["pos_transaction_id"]
            isOneToOne: false
            referencedRelation: "pos_transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      pos_transactions: {
        Row: {
          amount_paid: number | null
          cash_account_id: string | null
          cash_session_id: string | null
          change_amount: number | null
          cogs_account_id: string | null
          company_id: string
          created_at: string
          created_by: string | null
          customer_name: string | null
          customer_phone: string | null
          discount_amount: number | null
          guest_count: number | null
          id: string
          invoice_number: string | null
          notes: string | null
          revenue_account_id: string | null
          rounding_amount: number | null
          service_amount: number | null
          status: string | null
          subtotal: number | null
          tax_amount: number | null
          total_amount: number | null
          total_cogs: number | null
          transaction_date: string
          transaction_number: string
        }
        Insert: {
          amount_paid?: number | null
          cash_account_id?: string | null
          cash_session_id?: string | null
          change_amount?: number | null
          cogs_account_id?: string | null
          company_id: string
          created_at?: string
          created_by?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          discount_amount?: number | null
          guest_count?: number | null
          id?: string
          invoice_number?: string | null
          notes?: string | null
          revenue_account_id?: string | null
          rounding_amount?: number | null
          service_amount?: number | null
          status?: string | null
          subtotal?: number | null
          tax_amount?: number | null
          total_amount?: number | null
          total_cogs?: number | null
          transaction_date?: string
          transaction_number: string
        }
        Update: {
          amount_paid?: number | null
          cash_account_id?: string | null
          cash_session_id?: string | null
          change_amount?: number | null
          cogs_account_id?: string | null
          company_id?: string
          created_at?: string
          created_by?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          discount_amount?: number | null
          guest_count?: number | null
          id?: string
          invoice_number?: string | null
          notes?: string | null
          revenue_account_id?: string | null
          rounding_amount?: number | null
          service_amount?: number | null
          status?: string | null
          subtotal?: number | null
          tax_amount?: number | null
          total_amount?: number | null
          total_cogs?: number | null
          transaction_date?: string
          transaction_number?: string
        }
        Relationships: [
          {
            foreignKeyName: "pos_transactions_cash_account_id_fkey"
            columns: ["cash_account_id"]
            isOneToOne: false
            referencedRelation: "chart_of_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pos_transactions_cash_session_id_fkey"
            columns: ["cash_session_id"]
            isOneToOne: false
            referencedRelation: "pos_cash_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pos_transactions_cogs_account_id_fkey"
            columns: ["cogs_account_id"]
            isOneToOne: false
            referencedRelation: "chart_of_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pos_transactions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pos_transactions_revenue_account_id_fkey"
            columns: ["revenue_account_id"]
            isOneToOne: false
            referencedRelation: "chart_of_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      printer_settings: {
        Row: {
          company_id: string
          connection_type: string
          created_at: string
          device_name: string | null
          id: string
          ip_address: string | null
          is_active: boolean | null
          is_cashier_printer: boolean | null
          is_kitchen_printer: boolean | null
          last_connected_at: string | null
          name: string
          paper_width: string | null
          port: number | null
          printer_type: string
          product_id: string | null
          updated_at: string
          vendor_id: string | null
        }
        Insert: {
          company_id: string
          connection_type?: string
          created_at?: string
          device_name?: string | null
          id?: string
          ip_address?: string | null
          is_active?: boolean | null
          is_cashier_printer?: boolean | null
          is_kitchen_printer?: boolean | null
          last_connected_at?: string | null
          name: string
          paper_width?: string | null
          port?: number | null
          printer_type?: string
          product_id?: string | null
          updated_at?: string
          vendor_id?: string | null
        }
        Update: {
          company_id?: string
          connection_type?: string
          created_at?: string
          device_name?: string | null
          id?: string
          ip_address?: string | null
          is_active?: boolean | null
          is_cashier_printer?: boolean | null
          is_kitchen_printer?: boolean | null
          last_connected_at?: string | null
          name?: string
          paper_width?: string | null
          port?: number | null
          printer_type?: string
          product_id?: string | null
          updated_at?: string
          vendor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "printer_settings_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      product_categories: {
        Row: {
          company_id: string
          created_at: string
          description: string | null
          id: string
          name: string
        }
        Insert: {
          company_id: string
          created_at?: string
          description?: string | null
          id?: string
          name: string
        }
        Update: {
          company_id?: string
          created_at?: string
          description?: string | null
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_categories_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      product_suppliers: {
        Row: {
          cost_price: number | null
          created_at: string
          id: string
          is_primary: boolean | null
          product_id: string
          supplier_id: string
        }
        Insert: {
          cost_price?: number | null
          created_at?: string
          id?: string
          is_primary?: boolean | null
          product_id: string
          supplier_id: string
        }
        Update: {
          cost_price?: number | null
          created_at?: string
          id?: string
          is_primary?: boolean | null
          product_id?: string
          supplier_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_suppliers_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_suppliers_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      product_tax_rates: {
        Row: {
          created_at: string
          id: string
          product_id: string
          tax_rate_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          product_id: string
          tax_rate_id: string
        }
        Update: {
          created_at?: string
          id?: string
          product_id?: string
          tax_rate_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_tax_rates_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_tax_rates_tax_rate_id_fkey"
            columns: ["tax_rate_id"]
            isOneToOne: false
            referencedRelation: "pos_tax_rates"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          category_id: string | null
          cogs_account_id: string | null
          company_id: string
          cost_price: number
          created_at: string
          id: string
          is_active: boolean | null
          name: string
          product_type: Database["public"]["Enums"]["product_type"]
          revenue_account_id: string | null
          sku: string
          stock_quantity: number | null
          unit: string
          unit_price: number
          updated_at: string
        }
        Insert: {
          category_id?: string | null
          cogs_account_id?: string | null
          company_id: string
          cost_price?: number
          created_at?: string
          id?: string
          is_active?: boolean | null
          name: string
          product_type?: Database["public"]["Enums"]["product_type"]
          revenue_account_id?: string | null
          sku: string
          stock_quantity?: number | null
          unit?: string
          unit_price?: number
          updated_at?: string
        }
        Update: {
          category_id?: string | null
          cogs_account_id?: string | null
          company_id?: string
          cost_price?: number
          created_at?: string
          id?: string
          is_active?: boolean | null
          name?: string
          product_type?: Database["public"]["Enums"]["product_type"]
          revenue_account_id?: string | null
          sku?: string
          stock_quantity?: number | null
          unit?: string
          unit_price?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "product_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_cogs_account_id_fkey"
            columns: ["cogs_account_id"]
            isOneToOne: false
            referencedRelation: "chart_of_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_revenue_account_id_fkey"
            columns: ["revenue_account_id"]
            isOneToOne: false
            referencedRelation: "chart_of_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          password_changed_at: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          password_changed_at?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          password_changed_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      purchase_order_items: {
        Row: {
          created_at: string
          discount_percent: number | null
          id: string
          invoiced_quantity: number | null
          product_id: string
          purchase_order_id: string
          quantity: number
          received_quantity: number | null
          tax_percent: number | null
          total: number
          unit_price: number
        }
        Insert: {
          created_at?: string
          discount_percent?: number | null
          id?: string
          invoiced_quantity?: number | null
          product_id: string
          purchase_order_id: string
          quantity?: number
          received_quantity?: number | null
          tax_percent?: number | null
          total: number
          unit_price: number
        }
        Update: {
          created_at?: string
          discount_percent?: number | null
          id?: string
          invoiced_quantity?: number | null
          product_id?: string
          purchase_order_id?: string
          quantity?: number
          received_quantity?: number | null
          tax_percent?: number | null
          total?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "purchase_order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_order_items_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_orders: {
        Row: {
          company_id: string
          created_at: string
          created_by: string | null
          dp_amount: number | null
          dp_paid: number | null
          due_date: string | null
          id: string
          notes: string | null
          order_date: string
          order_number: string
          status: Database["public"]["Enums"]["order_status"]
          subtotal: number | null
          supplier_id: string
          tax_amount: number | null
          total_amount: number | null
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          created_by?: string | null
          dp_amount?: number | null
          dp_paid?: number | null
          due_date?: string | null
          id?: string
          notes?: string | null
          order_date?: string
          order_number: string
          status?: Database["public"]["Enums"]["order_status"]
          subtotal?: number | null
          supplier_id: string
          tax_amount?: number | null
          total_amount?: number | null
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by?: string | null
          dp_amount?: number | null
          dp_paid?: number | null
          due_date?: string | null
          id?: string
          notes?: string | null
          order_date?: string
          order_number?: string
          status?: Database["public"]["Enums"]["order_status"]
          subtotal?: number | null
          supplier_id?: string
          tax_amount?: number | null
          total_amount?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchase_orders_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      receipt_settings: {
        Row: {
          company_id: string
          created_at: string
          footer_text: string | null
          header_text: string | null
          id: string
          is_active: boolean | null
          logo_url: string | null
          name: string
          paper_size: string | null
          printer_setting_id: string | null
          receipt_type: string
          show_company_address: boolean | null
          show_company_name: boolean | null
          show_company_phone: boolean | null
          show_customer_info: boolean | null
          show_item_details: boolean | null
          show_logo: boolean | null
          show_payment_info: boolean | null
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          footer_text?: string | null
          header_text?: string | null
          id?: string
          is_active?: boolean | null
          logo_url?: string | null
          name: string
          paper_size?: string | null
          printer_setting_id?: string | null
          receipt_type?: string
          show_company_address?: boolean | null
          show_company_name?: boolean | null
          show_company_phone?: boolean | null
          show_customer_info?: boolean | null
          show_item_details?: boolean | null
          show_logo?: boolean | null
          show_payment_info?: boolean | null
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          footer_text?: string | null
          header_text?: string | null
          id?: string
          is_active?: boolean | null
          logo_url?: string | null
          name?: string
          paper_size?: string | null
          printer_setting_id?: string | null
          receipt_type?: string
          show_company_address?: boolean | null
          show_company_name?: boolean | null
          show_company_phone?: boolean | null
          show_customer_info?: boolean | null
          show_item_details?: boolean | null
          show_logo?: boolean | null
          show_payment_info?: boolean | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "receipt_settings_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receipt_settings_printer_setting_id_fkey"
            columns: ["printer_setting_id"]
            isOneToOne: false
            referencedRelation: "printer_settings"
            referencedColumns: ["id"]
          },
        ]
      }
      receipt_split_rules: {
        Row: {
          category_id: string | null
          category_name: string | null
          company_id: string
          created_at: string
          id: string
          receipt_setting_id: string
        }
        Insert: {
          category_id?: string | null
          category_name?: string | null
          company_id: string
          created_at?: string
          id?: string
          receipt_setting_id: string
        }
        Update: {
          category_id?: string | null
          category_name?: string | null
          company_id?: string
          created_at?: string
          id?: string
          receipt_setting_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "receipt_split_rules_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "product_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receipt_split_rules_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receipt_split_rules_receipt_setting_id_fkey"
            columns: ["receipt_setting_id"]
            isOneToOne: false
            referencedRelation: "receipt_settings"
            referencedColumns: ["id"]
          },
        ]
      }
      recipe_items: {
        Row: {
          created_at: string
          id: string
          notes: string | null
          product_id: string
          quantity: number
          recipe_id: string
          unit: string
        }
        Insert: {
          created_at?: string
          id?: string
          notes?: string | null
          product_id: string
          quantity?: number
          recipe_id: string
          unit?: string
        }
        Update: {
          created_at?: string
          id?: string
          notes?: string | null
          product_id?: string
          quantity?: number
          recipe_id?: string
          unit?: string
        }
        Relationships: [
          {
            foreignKeyName: "recipe_items_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
        ]
      }
      recipes: {
        Row: {
          company_id: string
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          output_quantity: number
          product_id: string
          recipe_code: string
          unit: string
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          output_quantity?: number
          product_id: string
          recipe_code: string
          unit?: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          output_quantity?: number
          product_id?: string
          recipe_code?: string
          unit?: string
          updated_at?: string
        }
        Relationships: []
      }
      sales_order_items: {
        Row: {
          created_at: string
          discount_percent: number | null
          id: string
          invoiced_quantity: number | null
          product_id: string
          quantity: number
          sales_order_id: string
          tax_percent: number | null
          total: number
          unit_price: number
        }
        Insert: {
          created_at?: string
          discount_percent?: number | null
          id?: string
          invoiced_quantity?: number | null
          product_id: string
          quantity?: number
          sales_order_id: string
          tax_percent?: number | null
          total: number
          unit_price: number
        }
        Update: {
          created_at?: string
          discount_percent?: number | null
          id?: string
          invoiced_quantity?: number | null
          product_id?: string
          quantity?: number
          sales_order_id?: string
          tax_percent?: number | null
          total?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "sales_order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_order_items_sales_order_id_fkey"
            columns: ["sales_order_id"]
            isOneToOne: false
            referencedRelation: "sales_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_orders: {
        Row: {
          company_id: string
          created_at: string
          created_by: string | null
          customer_id: string
          dp_amount: number | null
          dp_paid: number | null
          due_date: string | null
          id: string
          notes: string | null
          order_date: string
          order_number: string
          status: Database["public"]["Enums"]["order_status"]
          subtotal: number | null
          tax_amount: number | null
          total_amount: number | null
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          created_by?: string | null
          customer_id: string
          dp_amount?: number | null
          dp_paid?: number | null
          due_date?: string | null
          id?: string
          notes?: string | null
          order_date?: string
          order_number: string
          status?: Database["public"]["Enums"]["order_status"]
          subtotal?: number | null
          tax_amount?: number | null
          total_amount?: number | null
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by?: string | null
          customer_id?: string
          dp_amount?: number | null
          dp_paid?: number | null
          due_date?: string | null
          id?: string
          notes?: string | null
          order_date?: string
          order_number?: string
          status?: Database["public"]["Enums"]["order_status"]
          subtotal?: number | null
          tax_amount?: number | null
          total_amount?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_orders_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_opname: {
        Row: {
          company_id: string
          completed_at: string | null
          created_at: string
          created_by: string | null
          id: string
          notes: string | null
          opname_date: string
          opname_number: string
          status: Database["public"]["Enums"]["opname_status"]
          updated_at: string
          warehouse_id: string
        }
        Insert: {
          company_id: string
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          opname_date?: string
          opname_number: string
          status?: Database["public"]["Enums"]["opname_status"]
          updated_at?: string
          warehouse_id: string
        }
        Update: {
          company_id?: string
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          opname_date?: string
          opname_number?: string
          status?: Database["public"]["Enums"]["opname_status"]
          updated_at?: string
          warehouse_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_opname_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_opname_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_opname_items: {
        Row: {
          actual_quantity: number | null
          created_at: string
          difference: number | null
          id: string
          notes: string | null
          opname_id: string
          product_id: string
          system_quantity: number | null
        }
        Insert: {
          actual_quantity?: number | null
          created_at?: string
          difference?: number | null
          id?: string
          notes?: string | null
          opname_id: string
          product_id: string
          system_quantity?: number | null
        }
        Update: {
          actual_quantity?: number | null
          created_at?: string
          difference?: number | null
          id?: string
          notes?: string | null
          opname_id?: string
          product_id?: string
          system_quantity?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_opname_items_opname_id_fkey"
            columns: ["opname_id"]
            isOneToOne: false
            referencedRelation: "stock_opname"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_opname_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_transfer_items: {
        Row: {
          created_at: string
          id: string
          product_id: string
          quantity: number
          transfer_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          product_id: string
          quantity?: number
          transfer_id: string
        }
        Update: {
          created_at?: string
          id?: string
          product_id?: string
          quantity?: number
          transfer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_transfer_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_transfer_items_transfer_id_fkey"
            columns: ["transfer_id"]
            isOneToOne: false
            referencedRelation: "stock_transfers"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_transfers: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          company_id: string
          created_at: string
          from_warehouse_id: string
          id: string
          notes: string | null
          requested_by: string | null
          status: Database["public"]["Enums"]["transfer_status"]
          to_warehouse_id: string
          transfer_date: string
          transfer_number: string
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          company_id: string
          created_at?: string
          from_warehouse_id: string
          id?: string
          notes?: string | null
          requested_by?: string | null
          status?: Database["public"]["Enums"]["transfer_status"]
          to_warehouse_id: string
          transfer_date?: string
          transfer_number: string
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          company_id?: string
          created_at?: string
          from_warehouse_id?: string
          id?: string
          notes?: string | null
          requested_by?: string | null
          status?: Database["public"]["Enums"]["transfer_status"]
          to_warehouse_id?: string
          transfer_date?: string
          transfer_number?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_transfers_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_transfers_from_warehouse_id_fkey"
            columns: ["from_warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_transfers_to_warehouse_id_fkey"
            columns: ["to_warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          address: string | null
          code: string
          company_id: string
          created_at: string
          email: string | null
          id: string
          name: string
          payable_account_id: string | null
          phone: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          code: string
          company_id: string
          created_at?: string
          email?: string | null
          id?: string
          name: string
          payable_account_id?: string | null
          phone?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          code?: string
          company_id?: string
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          payable_account_id?: string | null
          phone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "suppliers_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "suppliers_payable_account_id_fkey"
            columns: ["payable_account_id"]
            isOneToOne: false
            referencedRelation: "chart_of_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      transaction_tags: {
        Row: {
          category: string
          color: string | null
          company_id: string
          created_at: string
          id: string
          is_system: boolean | null
          name: string
        }
        Insert: {
          category?: string
          color?: string | null
          company_id: string
          created_at?: string
          id?: string
          is_system?: boolean | null
          name: string
        }
        Update: {
          category?: string
          color?: string | null
          company_id?: string
          created_at?: string
          id?: string
          is_system?: boolean | null
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "transaction_tags_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      user_companies: {
        Row: {
          company_id: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_companies_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      user_permissions: {
        Row: {
          can_create: boolean
          can_delete: boolean
          can_edit: boolean
          can_view: boolean
          created_at: string
          feature_key: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          can_create?: boolean
          can_delete?: boolean
          can_edit?: boolean
          can_view?: boolean
          created_at?: string
          feature_key: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          can_create?: boolean
          can_delete?: boolean
          can_edit?: boolean
          can_view?: boolean
          created_at?: string
          feature_key?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_permissions_feature_key_fkey"
            columns: ["feature_key"]
            isOneToOne: false
            referencedRelation: "features"
            referencedColumns: ["key"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      warehouses: {
        Row: {
          address: string | null
          code: string
          company_id: string
          created_at: string
          id: string
          is_active: boolean | null
          location: string | null
          name: string
          pic_user_id: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          code: string
          company_id: string
          created_at?: string
          id?: string
          is_active?: boolean | null
          location?: string | null
          name: string
          pic_user_id?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          code?: string
          company_id?: string
          created_at?: string
          id?: string
          is_active?: boolean | null
          location?: string | null
          name?: string
          pic_user_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "warehouses_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      _record_inventory_movement: {
        Args: {
          p_company_id: string
          p_movement_date?: string
          p_movement_type: string
          p_product_id: string
          p_quantity: number
          p_reference_id: string
          p_reference_number: string
          p_reference_type: string
          p_unit_cost: number
          p_update_stock?: boolean
          p_warehouse_id: string
        }
        Returns: undefined
      }
      check_period_closed: {
        Args: { p_company_id: string; p_date: string }
        Returns: undefined
      }
      create_bill_from_goods_receipt: {
        Args: { p_bill_date?: string; p_due_date?: string; p_gr_id: string }
        Returns: string
      }
      create_invoice_from_sales_order: {
        Args: {
          p_due_date?: string
          p_invoice_date?: string
          p_quantities?: Json
          p_sales_order_id: string
        }
        Returns: string
      }
      generate_document_number: {
        Args: { p_company_id: string; p_document_type: string }
        Returns: string
      }
      has_permission: {
        Args: { _action: string; _feature_key: string; _user_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_superadmin: { Args: { _user_id: string }; Returns: boolean }
      user_has_company_access: {
        Args: { _company_id: string; _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      account_type:
        | "asset"
        | "liability"
        | "equity"
        | "revenue"
        | "expense"
        | "cash_bank"
        | "other_income"
        | "other_expenses"
      app_role: "admin" | "user" | "cashier" | "superadmin"
      asset_status: "active" | "disposed" | "fully_depreciated"
      depreciation_method: "straight_line" | "declining_balance"
      invoice_status:
        | "draft"
        | "sent"
        | "partial"
        | "paid"
        | "overdue"
        | "cancelled"
      opname_status: "draft" | "in_progress" | "completed"
      order_status:
        | "draft"
        | "confirmed"
        | "received"
        | "invoiced"
        | "paid"
        | "cancelled"
      payment_type: "incoming" | "outgoing"
      product_type: "stockable" | "service" | "raw_material"
      transfer_status:
        | "draft"
        | "pending"
        | "approved"
        | "rejected"
        | "completed"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

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
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
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
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
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
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
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
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      account_type: [
        "asset",
        "liability",
        "equity",
        "revenue",
        "expense",
        "cash_bank",
        "other_income",
        "other_expenses",
      ],
      app_role: ["admin", "user", "cashier", "superadmin"],
      asset_status: ["active", "disposed", "fully_depreciated"],
      depreciation_method: ["straight_line", "declining_balance"],
      invoice_status: [
        "draft",
        "sent",
        "partial",
        "paid",
        "overdue",
        "cancelled",
      ],
      opname_status: ["draft", "in_progress", "completed"],
      order_status: [
        "draft",
        "confirmed",
        "received",
        "invoiced",
        "paid",
        "cancelled",
      ],
      payment_type: ["incoming", "outgoing"],
      product_type: ["stockable", "service", "raw_material"],
      transfer_status: [
        "draft",
        "pending",
        "approved",
        "rejected",
        "completed",
      ],
    },
  },
} as const
