// supabase/functions/invite-accept/index.ts
// npx supabase functions deploy invite-accept
import { serve } from "https://deno.land/std@0.177.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
)

serve(async (req) => {
    // Handle CORS
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const { token, email, password, name, phone } = await req.json()

        if (!token || !email || !password || !name || !phone) {
            return new Response(
                JSON.stringify({ error: "Nicht alle Pflichtfelder sind ausgefüllt" }),
                {
                    status: 400,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                }
            )
        }

        // Einladungstoken prüfen
        const { data: invite, error: findErr } = await supabase
            .from("invites")
            .select("*")
            .eq("invite_token", token)
            .eq("used", false)
            .single()

        if (findErr || !invite) {
            return new Response(
                JSON.stringify({ error: "Ungültiger oder verwendeter Einladungstoken" }),
                {
                    status: 400,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                }
            )
        }

        // Gültigkeitsdauer prüfen
        if (new Date(invite.expires_at) < new Date()) {
            return new Response(
                JSON.stringify({ error: "Die Einladung ist abgelaufen" }),
                {
                    status: 400,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                }
            )
        }

        // Benutzer in Supabase Auth erstellen
        const { data: newUser, error: userErr } = await supabase.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
            user_metadata: {
                role: invite.role,
                name: name,
                phone: phone
            },
        })

        if (userErr) {
            console.error('Fehler beim Erstellen des Benutzers:', userErr)
            throw new Error(userErr.message)
        }

        // Zur 'users'-Tabelle hinzufügen
        const { error: insertErr } = await supabase.from("users").insert([
            {
                user_id: newUser.user.id,
                email: email,
                role: invite.role,
                display_name: name,
                phone: phone,
                active: true,
                created_at: new Date().toISOString()
            },
        ])

        if (insertErr) {
            console.error('Fehler beim Hinzufügen zur Tabelle users:', insertErr)
            // Versuche, den erstellten Auth-Benutzer zu löschen
            await supabase.auth.admin.deleteUser(newUser.user.id)
            throw new Error(insertErr.message)
        }

        // Token als verwendet markieren
        await supabase
            .from("invites")
            .update({
                used: true,
                used_at: new Date().toISOString(),
                used_by_email: email
            })
            .eq("id", invite.id)

        console.log('✅ Benutzer erfolgreich registriert:', email)

        return new Response(
            JSON.stringify({
                success: true,
                role: invite.role,
                message: "Registrierung erfolgreich!"
            }),
            {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
        )
    } catch (err) {
        console.error('Fehler:', err)
        return new Response(
            JSON.stringify({ error: err.message }),
            {
                status: 500,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            }
        )
    }
})