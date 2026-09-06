import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, "Content-Type": "application/json" },
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ success: false, error: "POST requests only" }, 405);

  try {
    const authHeader = req.headers.get("Authorization") || "";
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user || user.email?.toLowerCase() !== "epp.mand@gmail.com") {
      return json({ success: false, error: "Unauthorized" }, 401);
    }

    const refreshToken = Deno.env.get("LHV_REFRESH_TOKEN");
    if (!refreshToken) return json({ success: false, error: "LHV_REFRESH_TOKEN is not configured" }, 503);

    const tokenResponse = await fetch("https://auth.lhv.ai/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: refreshToken, client_id: "api-access" }),
    });
    if (!tokenResponse.ok) throw new Error(`LHV token refresh failed: ${tokenResponse.status}`);
    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;
    if (!accessToken) throw new Error("LHV access token missing");

    const headers = { Authorization: `Bearer ${accessToken}` };
    const accountsResponse = await fetch("https://api.lhv.ai/api/v1/accounts", { headers });
    if (!accountsResponse.ok) throw new Error(`LHV accounts failed: ${accountsResponse.status}`);
    const accounts = await accountsResponse.json();

    const today = new Date();
    const from = new Date(today);
    from.setDate(from.getDate() - 90);
    const dateTo = today.toISOString().slice(0, 10);
    const dateFrom = from.toISOString().slice(0, 10);
    const transactions: any[] = [];

    for (const account of (Array.isArray(accounts) ? accounts : accounts.accounts || [])) {
      const url = new URL(`https://api.lhv.ai/api/v1/accounts/${encodeURIComponent(account.iban)}/statement`);
      url.searchParams.set("dateFrom", dateFrom);
      url.searchParams.set("dateTo", dateTo);
      url.searchParams.set("limit", "500");
      url.searchParams.set("includeReservations", "false");
      const response = await fetch(url, { headers });
      if (!response.ok) throw new Error(`LHV statement failed: ${response.status}`);
      const payload = await response.json();
      const statement = payload.statement || payload;
      for (const tx of (statement.transactions || [])) {
        const date = String(tx.settlementDtime || tx.date || "").slice(0, 10);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
        const amount = Number(tx.amount || 0);
        const rawDirection = String(tx.direction || "").toUpperCase();
        const direction = ["DEBIT", "DBIT", "D"].includes(rawDirection) || amount < 0
          ? "DEBIT"
          : "CREDIT";
        const rawKey = [account.iban, tx.settlementDtime, tx.amount, tx.currency, tx.description, tx.transactionType].join("|");
        const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(rawKey));
        const sourceId = Array.from(new Uint8Array(digest)).map(byte => byte.toString(16).padStart(2, "0")).join("");
        transactions.push({
          sourceId, date, amount, currency: tx.currency || account.currency,
          direction,
          description: tx.description || "", merchant: tx.counterpartyName || tx.merchantName || "",
        });
      }
    }

    return json({ success: true, accounts: accounts.length || accounts.accounts?.length || 0, transactions });
  } catch (error) {
    console.error(error);
    return json({ success: false, error: String(error) }, 500);
  }
});
