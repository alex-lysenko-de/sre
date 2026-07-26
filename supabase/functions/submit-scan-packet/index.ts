// supabase/functions/submit-scan-packet/index.ts
// npx supabase functions deploy submit-scan-packet
import { serve } from "https://deno.land/std@0.177.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const TYPE_CODE = { BUS: 1, GROUP: 2, CHECKIN: 3 }

function json(status: number, body: unknown) {
    return new Response(JSON.stringify(body), {
        status,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
    })
}

// Admin client für die privilegierte Speicherung (RLS betrifft ihn nicht)
const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
)

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        // 1. Token → Auth-Benutzer (Anon-Client), wie in delete-user/invite-generate
        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL')!,
            Deno.env.get('SUPABASE_ANON_KEY')!
        )

        const authHeader = req.headers.get("Authorization")
        if (!authHeader) {
            return json(401, { error: "Missing Authorization header" })
        }

        const token = authHeader.replace("Bearer ", "")
        const { data: { user }, error: userErr } = await supabaseClient.auth.getUser(token)

        if (userErr || !user) {
            console.error('Auth Error:', userErr)
            return json(401, { error: "Invalid user token" })
        }

        // 2. uuid → prikladen users.id + active (service_role-Client)
        //    Prüfung "active", nicht "role === admin" - Pakete senden normale
        //    Betreuer, nicht nur Admins (Abweichung vom delete-user/invite-generate
        //    Vorbild, siehe tickets/122/IMPLEMENTATION_PLAN.md, "Analyse...").
        const { data: profile } = await supabaseAdmin
            .from("users")
            .select("id, active")
            .eq("user_id", user.id)
            .single()

        if (!profile?.active) {
            return json(403, { error: "Account inactive" })
        }

        // 3. Body-Validierung
        const body = await req.json()
        if (!body.client_packet_id || !TYPE_CODE[body.type] || !body.date || !body.finished_at) {
            return json(400, { error: "Missing required packet fields" })
        }
        if (body.type === 'BUS' && !body.bus_id) {
            return json(400, { error: "bus_id required for BUS packet" })
        }
        if (body.type === 'GROUP' && !body.group_id) {
            return json(400, { error: "group_id required for GROUP packet" })
        }

        // 4. author_id - IMMER aus Schritt 2, der Wert aus body wird ignoriert
        const payload = { ...body, type_code: TYPE_CODE[body.type], author_id: profile.id }

        // 5. Atomare Aufnahme über den service_role-Client
        const { data, error } = await supabaseAdmin.rpc('submit_scan_packet', { payload })
        if (error) throw error

        return json(200, { packet_id: data[0].packet_id, created: data[0].created })

    } catch (err) {
        console.error('Function Error:', err)
        return json(500, { error: err.message })
    }
})
