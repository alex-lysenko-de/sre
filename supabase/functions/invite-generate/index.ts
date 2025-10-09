import { serve } from "https://deno.land/std@0.177.0/http/server.ts"
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2"
import { v4 as uuidv4 } from "https://esm.sh/uuid@9.0.1"

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Verwenden Sie den service_role_key für interne Datenbankoperationen
const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
)

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        // 1. Client mit ANON_KEY zur Überprüfung des Benutzertokens erstellen
        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL')!,
            Deno.env.get('SUPABASE_ANON_KEY')!
        )

        // 2. Token aus dem Header extrahieren
        const authHeader = req.headers.get("Authorization")!
        const token = authHeader.replace("Bearer ", "")

        // 3. Token zur Authentifizierung an getUser-Methode übergeben
        const { data: { user }, error: userErr } = await supabaseClient.auth.getUser(token)

        if (userErr || !user) {
            console.error('Auth Error:', userErr)
            return new Response(JSON.stringify({ error: "Invalid user token" }), {
                status: 401,
                headers: { ...corsHeaders, "Content-Type": "application/json" }
            })
        }

        // 4. Benutzerrolle mit dem Administrator-Client überprüfen
        const { data: profile } = await supabaseAdmin
            .from("users")
            .select("role")
            .eq("user_id", user.id)
            .single()

        if (profile?.role !== "admin") {
            return new Response(JSON.stringify({ error: "Access denied: user is not an admin" }), {
                status: 403,
                headers: { ...corsHeaders, "Content-Type": "application/json" }
            })
        }

        // Logik zur Einladungsgenerierung bleibt unverändert
        const { role, expiresInHours } = await req.json()
        if (!role || !["admin", "user"].includes(role)) {
            return new Response(JSON.stringify({ error: "Invalid role provided" }), {
                status: 400,
                headers: { ...corsHeaders, "Content-Type": "application/json" }
            })
        }

        const inviteToken = uuidv4()
        const expiresAt = new Date(Date.now() + expiresInHours * 60 * 60 * 1000).toISOString()

        const { error: insertError } = await supabaseAdmin
            .from("invites")
            .insert([{ invite_token: inviteToken, role, expires_at: expiresAt }])

        if (insertError) throw insertError

        return new Response(JSON.stringify({ inviteToken, expiresAt }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        })

    } catch (err) {
        console.error('Function Error:', err)
        return new Response(JSON.stringify({ error: err.message }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" }
        })
    }
})