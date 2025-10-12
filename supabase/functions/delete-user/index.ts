// supabase/functions/delete-user/index.ts
import { serve } from "https://deno.land/std@0.177.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Admin client для операций с auth.users
const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
)

serve(async (req) => {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        // 1. Проверка авторизации
        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL')!,
            Deno.env.get('SUPABASE_ANON_KEY')!
        )

        const authHeader = req.headers.get("Authorization")
        if (!authHeader) {
            return new Response(
                JSON.stringify({ error: "Missing Authorization header" }), 
                {
                    status: 401,
                    headers: { ...corsHeaders, "Content-Type": "application/json" }
                }
            )
        }

        const token = authHeader.replace("Bearer ", "")
        const { data: { user }, error: userErr } = await supabaseClient.auth.getUser(token)

        if (userErr || !user) {
            console.error('Auth Error:', userErr)
            return new Response(
                JSON.stringify({ error: "Invalid user token" }), 
                {
                    status: 401,
                    headers: { ...corsHeaders, "Content-Type": "application/json" }
                }
            )
        }

        // 2. Проверка роли админа
        const { data: profile } = await supabaseAdmin
            .from("users")
            .select("role")
            .eq("user_id", user.id)
            .single()

        if (profile?.role !== "admin") {
            return new Response(
                JSON.stringify({ error: "Access denied: only admins can delete users" }), 
                {
                    status: 403,
                    headers: { ...corsHeaders, "Content-Type": "application/json" }
                }
            )
        }

        // 3. Получить ID пользователя для удаления
        const { userIdToDelete } = await req.json()

        if (!userIdToDelete) {
            return new Response(
                JSON.stringify({ error: "userIdToDelete is required" }), 
                {
                    status: 400,
                    headers: { ...corsHeaders, "Content-Type": "application/json" }
                }
            )
        }

        // 4. Проверка: нельзя удалить самого себя
        if (userIdToDelete === user.id) {
            return new Response(
                JSON.stringify({ error: "You cannot delete yourself" }), 
                {
                    status: 400,
                    headers: { ...corsHeaders, "Content-Type": "application/json" }
                }
            )
        }

        // 5. Удаление пользователя из auth.users
        // Благодаря ON DELETE CASCADE, запись из public.users удалится автоматически
        const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(
            userIdToDelete
        )

        if (deleteError) {
            console.error('Delete Error:', deleteError)
            throw new Error(deleteError.message)
        }

        console.log(`✅ User ${userIdToDelete} successfully deleted from auth.users (and public.users via CASCADE)`)

        return new Response(
            JSON.stringify({ 
                success: true, 
                message: "User deleted successfully",
                deletedUserId: userIdToDelete
            }), 
            {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
        )

    } catch (err) {
        console.error('Function Error:', err)
        return new Response(
            JSON.stringify({ error: err.message }), 
            {
                status: 500,
                headers: { ...corsHeaders, "Content-Type": "application/json" }
            }
        )
    }
})
