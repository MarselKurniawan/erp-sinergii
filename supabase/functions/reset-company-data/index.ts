import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create user client to verify identity
    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create admin client for operations
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Verify user is admin
    const { data: roleData } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .single();

    if (!roleData) {
      return new Response(JSON.stringify({ error: "Admin access required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { company_id, modules } = await req.json();

    if (!company_id || !modules || !Array.isArray(modules) || modules.length === 0) {
      return new Response(JSON.stringify({ error: "company_id and modules are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify company exists
    const { data: company } = await supabaseAdmin
      .from("companies")
      .select("id, name")
      .eq("id", company_id)
      .single();

    if (!company) {
      return new Response(JSON.stringify({ error: "Company not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const results: Record<string, { deleted: number; tables: string[] }> = {};
    const errors: string[] = [];

    const deleteFromTable = async (table: string, filter: Record<string, any>) => {
      const { data, error } = await supabaseAdmin
        .from(table)
        .delete()
        .match(filter)
        .select("id");
      
      if (error) {
        errors.push(`${table}: ${error.message}`);
        return 0;
      }
      return data?.length || 0;
    };

    const deleteWithSubquery = async (table: string, column: string, parentTable: string, parentCompanyFilter: Record<string, any>) => {
      // Get parent IDs first
      const { data: parents } = await supabaseAdmin
        .from(parentTable)
        .select("id")
        .match(parentCompanyFilter);
      
      if (!parents || parents.length === 0) return 0;
      
      const parentIds = parents.map((p: any) => p.id);
      const { data, error } = await supabaseAdmin
        .from(table)
        .delete()
        .in(column, parentIds)
        .select("id");
      
      if (error) {
        errors.push(`${table}: ${error.message}`);
        return 0;
      }
      return data?.length || 0;
    };

    const nullifyColumn = async (table: string, column: string, companyFilter: Record<string, any>) => {
      const { error } = await supabaseAdmin
        .from(table)
        .update({ [column]: null })
        .match(companyFilter);
      
      if (error) {
        errors.push(`${table} nullify ${column}: ${error.message}`);
      }
    };

    // Process modules in dependency order
    const selectedModules = new Set(modules);

    // 1. POS Module
    if (selectedModules.has("pos")) {
      const tables: string[] = [];
      let total = 0;

      // Delete POS transaction payments & items
      let count = await deleteWithSubquery("pos_transaction_payments", "pos_transaction_id", "pos_transactions", { company_id });
      if (count > 0) { total += count; tables.push("pos_transaction_payments"); }

      count = await deleteWithSubquery("pos_transaction_items", "pos_transaction_id", "pos_transactions", { company_id });
      if (count > 0) { total += count; tables.push("pos_transaction_items"); }

      // Delete open table items
      count = await deleteWithSubquery("pos_open_table_items", "open_table_id", "pos_open_tables", { company_id });
      if (count > 0) { total += count; tables.push("pos_open_table_items"); }

      // Delete POS deposits
      count = await deleteFromTable("pos_deposits", { company_id });
      if (count > 0) { total += count; tables.push("pos_deposits"); }

      // Delete POS transactions
      count = await deleteFromTable("pos_transactions", { company_id });
      if (count > 0) { total += count; tables.push("pos_transactions"); }

      // Delete open tables
      count = await deleteFromTable("pos_open_tables", { company_id });
      if (count > 0) { total += count; tables.push("pos_open_tables"); }

      // Delete cash sessions
      count = await deleteFromTable("pos_cash_sessions", { company_id });
      if (count > 0) { total += count; tables.push("pos_cash_sessions"); }

      results.pos = { deleted: total, tables };
    }

    // 2. Sales Module
    if (selectedModules.has("sales")) {
      const tables: string[] = [];
      let total = 0;

      // Delete payment allocations for invoices
      let count = await deleteWithSubquery("payment_allocations", "invoice_id", "invoices", { company_id });
      if (count > 0) { total += count; tables.push("payment_allocations (sales)"); }

      // Delete sales order items
      count = await deleteWithSubquery("sales_order_items", "sales_order_id", "sales_orders", { company_id });
      if (count > 0) { total += count; tables.push("sales_order_items"); }

      // Delete down payments (sales)
      const { data: salesDPs } = await supabaseAdmin
        .from("down_payments")
        .select("id")
        .eq("company_id", company_id)
        .not("sales_order_id", "is", null);
      if (salesDPs && salesDPs.length > 0) {
        const { data: deleted } = await supabaseAdmin
          .from("down_payments")
          .delete()
          .eq("company_id", company_id)
          .not("sales_order_id", "is", null)
          .select("id");
        count = deleted?.length || 0;
        if (count > 0) { total += count; tables.push("down_payments (sales)"); }
      }

      // Delete invoices
      count = await deleteFromTable("invoices", { company_id });
      if (count > 0) { total += count; tables.push("invoices"); }

      // Delete sales payments
      const { data: salesPayments } = await supabaseAdmin
        .from("payments")
        .delete()
        .eq("company_id", company_id)
        .eq("payment_type", "receive")
        .select("id");
      count = salesPayments?.length || 0;
      if (count > 0) { total += count; tables.push("payments (sales)"); }

      // Delete sales orders
      count = await deleteFromTable("sales_orders", { company_id });
      if (count > 0) { total += count; tables.push("sales_orders"); }

      results.sales = { deleted: total, tables };
    }

    // 3. Purchases Module
    if (selectedModules.has("purchases")) {
      const tables: string[] = [];
      let total = 0;

      // Delete payment allocations for bills
      let count = await deleteWithSubquery("payment_allocations", "bill_id", "bills", { company_id });
      if (count > 0) { total += count; tables.push("payment_allocations (purchases)"); }

      // Delete purchase order items
      count = await deleteWithSubquery("purchase_order_items", "purchase_order_id", "purchase_orders", { company_id });
      if (count > 0) { total += count; tables.push("purchase_order_items"); }

      // Delete goods receipt items
      count = await deleteWithSubquery("goods_receipt_items", "receipt_id", "goods_receipts", { company_id });
      if (count > 0) { total += count; tables.push("goods_receipt_items"); }

      // Delete down payments (purchases)
      const { data: purchaseDPs } = await supabaseAdmin
        .from("down_payments")
        .delete()
        .eq("company_id", company_id)
        .not("purchase_order_id", "is", null)
        .select("id");
      count = purchaseDPs?.length || 0;
      if (count > 0) { total += count; tables.push("down_payments (purchases)"); }

      // Delete bills
      count = await deleteFromTable("bills", { company_id });
      if (count > 0) { total += count; tables.push("bills"); }

      // Delete goods receipts
      count = await deleteFromTable("goods_receipts", { company_id });
      if (count > 0) { total += count; tables.push("goods_receipts"); }

      // Delete purchase payments
      const { data: purchasePayments } = await supabaseAdmin
        .from("payments")
        .delete()
        .eq("company_id", company_id)
        .eq("payment_type", "send")
        .select("id");
      count = purchasePayments?.length || 0;
      if (count > 0) { total += count; tables.push("payments (purchases)"); }

      // Delete purchase orders
      count = await deleteFromTable("purchase_orders", { company_id });
      if (count > 0) { total += count; tables.push("purchase_orders"); }

      results.purchases = { deleted: total, tables };
    }

    // 4. Assets Module (before journals since depreciations reference journal entries)
    if (selectedModules.has("assets")) {
      const tables: string[] = [];
      let total = 0;

      let count = await deleteWithSubquery("asset_depreciations", "asset_id", "fixed_assets", { company_id });
      if (count > 0) { total += count; tables.push("asset_depreciations"); }

      count = await deleteFromTable("fixed_assets", { company_id });
      if (count > 0) { total += count; tables.push("fixed_assets"); }

      results.assets = { deleted: total, tables };
    }

    // 5. Journals Module
    if (selectedModules.has("journals")) {
      const tables: string[] = [];
      let total = 0;

      // Nullify journal references in pos_deposits if POS not selected
      if (!selectedModules.has("pos")) {
        await nullifyColumn("pos_deposits", "journal_entry_id", { company_id });
      }

      // Nullify journal references in asset_depreciations if assets not selected
      if (!selectedModules.has("assets")) {
        // Get fixed asset IDs for this company
        const { data: assets } = await supabaseAdmin
          .from("fixed_assets")
          .select("id")
          .eq("company_id", company_id);
        if (assets && assets.length > 0) {
          for (const asset of assets) {
            await supabaseAdmin
              .from("asset_depreciations")
              .update({ journal_entry_id: null })
              .eq("asset_id", asset.id);
          }
        }
      }

      // Delete journal entry tags
      let count = await deleteWithSubquery("journal_entry_tags", "journal_entry_id", "journal_entries", { company_id });
      if (count > 0) { total += count; tables.push("journal_entry_tags"); }

      // Delete journal entry lines
      count = await deleteWithSubquery("journal_entry_lines", "journal_entry_id", "journal_entries", { company_id });
      if (count > 0) { total += count; tables.push("journal_entry_lines"); }

      // Delete journal entries
      count = await deleteFromTable("journal_entries", { company_id });
      if (count > 0) { total += count; tables.push("journal_entries"); }

      // Delete opening balances
      count = await deleteFromTable("opening_balances", { company_id });
      if (count > 0) { total += count; tables.push("opening_balances"); }

      // Delete period closings
      count = await deleteFromTable("period_closings", { company_id });
      if (count > 0) { total += count; tables.push("period_closings"); }

      // Reset document sequences
      const { error: seqError } = await supabaseAdmin
        .from("document_sequences")
        .update({ current_number: 0 })
        .eq("company_id", company_id);
      if (!seqError) { tables.push("document_sequences (reset)"); }

      results.journals = { deleted: total, tables };
    }

    // 6. Inventory Module
    if (selectedModules.has("inventory")) {
      const tables: string[] = [];
      let total = 0;

      let count = await deleteWithSubquery("stock_opname_items", "opname_id", "stock_opname", { company_id });
      if (count > 0) { total += count; tables.push("stock_opname_items"); }

      count = await deleteFromTable("stock_opname", { company_id });
      if (count > 0) { total += count; tables.push("stock_opname"); }

      count = await deleteWithSubquery("stock_transfer_items", "transfer_id", "stock_transfers", { company_id });
      if (count > 0) { total += count; tables.push("stock_transfer_items"); }

      count = await deleteFromTable("stock_transfers", { company_id });
      if (count > 0) { total += count; tables.push("stock_transfers"); }

      // Reset inventory stock to 0
      const { data: stocks } = await supabaseAdmin
        .from("inventory_stock")
        .select("id, warehouse_id")
        .in("warehouse_id", 
          (await supabaseAdmin.from("warehouses").select("id").eq("company_id", company_id)).data?.map((w: any) => w.id) || []
        );
      
      if (stocks && stocks.length > 0) {
        for (const stock of stocks) {
          await supabaseAdmin
            .from("inventory_stock")
            .update({ quantity: 0 })
            .eq("id", stock.id);
        }
        total += stocks.length;
        tables.push("inventory_stock (reset to 0)");
      }

      results.inventory = { deleted: total, tables };
    }

    // 7. Activity Logs
    if (selectedModules.has("logs")) {
      const tables: string[] = [];
      const count = await deleteFromTable("activity_logs", { company_id });
      results.logs = { deleted: count, tables: count > 0 ? ["activity_logs"] : [] };
    }

    // Log this action
    await supabaseAdmin.from("activity_logs").insert({
      company_id,
      user_id: user.id,
      entity_type: "system",
      action: "data_reset",
      description: `Data reset for modules: ${modules.join(", ")}`,
      changes: results,
    });

    return new Response(
      JSON.stringify({ 
        success: true, 
        company: company.name,
        results, 
        errors: errors.length > 0 ? errors : undefined 
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
