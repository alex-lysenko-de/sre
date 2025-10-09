// supabase/functions/auth/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
// CORS headers - allows requests from your frontend
const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS'
};
serve(async (req)=>{
    // 1. Handle CORS preflight requests
    if (req.method === 'OPTIONS') {
        return new Response('ok', {
            headers: corsHeaders
        });
    }
    try {
        const url = new URL(req.url);
        const path = url.pathname;
        // 2. Route to different handlers based on path
        if (path.includes('/register/prepare')) {
            return await handleRegisterPrepare(req);
        } else if (path.includes('/register/finish')) {
            return await handleRegisterFinish(req);
        } else if (path.includes('/login/prepare')) {
            return await handleLoginPrepare(req);
        } else if (path.includes('/login/finish')) {
            return await handleLoginFinish(req);
        } else {
            return new Response(JSON.stringify({
                error: 'Not found'
            }), {
                status: 404,
                headers: {
                    ...corsHeaders,
                    'Content-Type': 'application/json'
                }
            });
        }
    } catch (error) {
        console.error('Error:', error);
        return new Response(JSON.stringify({
            error: error.message
        }), {
            status: 500,
            headers: {
                ...corsHeaders,
                'Content-Type': 'application/json'
            }
        });
    }
});
// ===== REGISTER PREPARE =====
// This endpoint is PUBLIC - no authentication required!
async function handleRegisterPrepare(req) {
    try {
        const { inviteToken, displayName } = await req.json();
        // Validate input
        if (!inviteToken || !displayName) {
            return new Response(JSON.stringify({
                error: 'Missing inviteToken or displayName'
            }), {
                status: 400,
                headers: {
                    ...corsHeaders,
                    'Content-Type': 'application/json'
                }
            });
        }
        // Create Supabase admin client
        const supabaseUrl = Deno.env.get('SUPABASE_URL');
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
        const supabase = createClient(supabaseUrl, supabaseKey);
        // Verify invite token exists and is valid
        const { data: invite, error: inviteError } = await supabase.from('invites').select('*').eq('token', inviteToken).eq('used', false).single();
        if (inviteError || !invite) {
            return new Response(JSON.stringify({
                error: 'Invalid or expired invite token'
            }), {
                status: 401,
                headers: {
                    ...corsHeaders,
                    'Content-Type': 'application/json'
                }
            });
        }
        // Generate WebAuthn challenge
        const challenge = crypto.getRandomValues(new Uint8Array(32));
        const challengeBase64 = bufferToBase64url(challenge);
        // Store challenge in database with expiry
        const challengeId = crypto.randomUUID();
        const expiresAt = new Date(Date.now() + 5 * 60 * 1000) // 5 minutes
        ;
        const { error: challengeError } = await supabase.from('webauthn_challenges').insert({
            id: challengeId,
            challenge: challengeBase64,
            type: 'registration',
            user_data: {
                displayName,
                inviteToken
            },
            expires_at: expiresAt.toISOString()
        });
        if (challengeError) {
            console.error('Challenge storage error:', challengeError);
            throw new Error('Failed to create challenge');
        }
        // Generate user ID for WebAuthn
        const userId = crypto.randomUUID();
        const userIdBytes = new TextEncoder().encode(userId);
        const userIdBase64 = bufferToBase64url(userIdBytes);
        // Return WebAuthn credential creation options
        return new Response(JSON.stringify({
            challengeId,
            publicKey: {
                challenge: challengeBase64,
                rp: {
                    name: 'WebAuthn Auth App',
                    id: Deno.env.get('WEBAUTHN_RP_ID') || 'localhost'
                },
                user: {
                    id: userIdBase64,
                    name: displayName,
                    displayName: displayName
                },
                pubKeyCredParams: [
                    {
                        alg: -7,
                        type: 'public-key'
                    },
                    {
                        alg: -257,
                        type: 'public-key'
                    }
                ],
                timeout: 60000,
                attestation: 'none',
                authenticatorSelection: {
                    authenticatorAttachment: 'platform',
                    requireResidentKey: false,
                    userVerification: 'required'
                }
            }
        }), {
            status: 200,
            headers: {
                ...corsHeaders,
                'Content-Type': 'application/json'
            }
        });
    } catch (error) {
        console.error('Register prepare error:', error);
        return new Response(JSON.stringify({
            error: error.message
        }), {
            status: 500,
            headers: {
                ...corsHeaders,
                'Content-Type': 'application/json'
            }
        });
    }
}
// ===== REGISTER FINISH =====
async function handleRegisterFinish(req) {
    try {
        const { challengeId, attestation, displayName } = await req.json();
        const supabaseUrl = Deno.env.get('SUPABASE_URL');
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
        const supabase = createClient(supabaseUrl, supabaseKey);
        // Verify challenge
        const { data: challenge, error: challengeError } = await supabase.from('webauthn_challenges').select('*').eq('id', challengeId).eq('type', 'registration').single();
        if (challengeError || !challenge) {
            return new Response(JSON.stringify({
                error: 'Invalid challenge'
            }), {
                status: 400,
                headers: {
                    ...corsHeaders,
                    'Content-Type': 'application/json'
                }
            });
        }
        // Check if challenge expired
        if (new Date(challenge.expires_at) < new Date()) {
            return new Response(JSON.stringify({
                error: 'Challenge expired'
            }), {
                status: 400,
                headers: {
                    ...corsHeaders,
                    'Content-Type': 'application/json'
                }
            });
        }
        // Create user
        const userId = crypto.randomUUID();
        const { data: user, error: userError } = await supabase.from('users').insert({
            id: userId,
            display_name: displayName,
            role: 'user'
        }).select().single();
        if (userError) {
            console.error('User creation error:', userError);
            throw new Error('Failed to create user');
        }
        // Store credential
        const { error: credError } = await supabase.from('webauthn_credentials').insert({
            id: crypto.randomUUID(),
            user_id: userId,
            credential_id: attestation.id,
            public_key: attestation.response.attestationObject,
            counter: 0
        });
        if (credError) {
            console.error('Credential storage error:', credError);
            throw new Error('Failed to store credential');
        }
        // Mark invite as used
        const inviteToken = challenge.user_data.inviteToken;
        await supabase.from('invites').update({
            used: true,
            used_at: new Date().toISOString(),
            used_by: userId
        }).eq('token', inviteToken);
        // Delete challenge
        await supabase.from('webauthn_challenges').delete().eq('id', challengeId);
        // Generate JWT token
        const token = await generateJWT(userId);
        return new Response(JSON.stringify({
            token,
            user: {
                id: user.id,
                displayName: user.display_name,
                role: user.role
            }
        }), {
            status: 200,
            headers: {
                ...corsHeaders,
                'Content-Type': 'application/json'
            }
        });
    } catch (error) {
        console.error('Register finish error:', error);
        return new Response(JSON.stringify({
            error: error.message
        }), {
            status: 500,
            headers: {
                ...corsHeaders,
                'Content-Type': 'application/json'
            }
        });
    }
}
// ===== LOGIN PREPARE =====
async function handleLoginPrepare(req) {
    try {
        const { userId } = await req.json();
        const supabaseUrl = Deno.env.get('SUPABASE_URL');
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
        const supabase = createClient(supabaseUrl, supabaseKey);
        // Generate challenge
        const challenge = crypto.getRandomValues(new Uint8Array(32));
        const challengeBase64 = bufferToBase64url(challenge);
        const challengeId = crypto.randomUUID();
        // Store challenge
        await supabase.from('webauthn_challenges').insert({
            id: challengeId,
            challenge: challengeBase64,
            type: 'authentication',
            expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString()
        });
        // Get user's credentials if userId provided
        let allowCredentials = undefined;
        if (userId) {
            const { data: credentials } = await supabase.from('webauthn_credentials').select('credential_id').eq('user_id', userId);
            if (credentials && credentials.length > 0) {
                allowCredentials = credentials.map((c)=>({
                    id: c.credential_id,
                    type: 'public-key'
                }));
            }
        }
        return new Response(JSON.stringify({
            challengeId,
            publicKey: {
                challenge: challengeBase64,
                timeout: 60000,
                rpId: Deno.env.get('WEBAUTHN_RP_ID') || 'localhost',
                allowCredentials,
                userVerification: 'required'
            }
        }), {
            status: 200,
            headers: {
                ...corsHeaders,
                'Content-Type': 'application/json'
            }
        });
    } catch (error) {
        console.error('Login prepare error:', error);
        return new Response(JSON.stringify({
            error: error.message
        }), {
            status: 500,
            headers: {
                ...corsHeaders,
                'Content-Type': 'application/json'
            }
        });
    }
}
// ===== LOGIN FINISH =====
async function handleLoginFinish(req) {
    try {
        const { challengeId, assertion } = await req.json();
        const supabaseUrl = Deno.env.get('SUPABASE_URL');
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
        const supabase = createClient(supabaseUrl, supabaseKey);
        // Verify challenge
        const { data: challenge } = await supabase.from('webauthn_challenges').select('*').eq('id', challengeId).eq('type', 'authentication').single();
        if (!challenge || new Date(challenge.expires_at) < new Date()) {
            return new Response(JSON.stringify({
                error: 'Invalid or expired challenge'
            }), {
                status: 400,
                headers: {
                    ...corsHeaders,
                    'Content-Type': 'application/json'
                }
            });
        }
        // Find credential and user
        const { data: credential } = await supabase.from('webauthn_credentials').select('*, users(*)').eq('credential_id', assertion.id).single();
        if (!credential) {
            return new Response(JSON.stringify({
                error: 'Credential not found'
            }), {
                status: 401,
                headers: {
                    ...corsHeaders,
                    'Content-Type': 'application/json'
                }
            });
        }
        // Delete challenge
        await supabase.from('webauthn_challenges').delete().eq('id', challengeId);
        // Generate JWT
        const token = await generateJWT(credential.user_id);
        return new Response(JSON.stringify({
            token,
            user: {
                id: credential.users.id,
                displayName: credential.users.display_name,
                role: credential.users.role
            }
        }), {
            status: 200,
            headers: {
                ...corsHeaders,
                'Content-Type': 'application/json'
            }
        });
    } catch (error) {
        console.error('Login finish error:', error);
        return new Response(JSON.stringify({
            error: error.message
        }), {
            status: 500,
            headers: {
                ...corsHeaders,
                'Content-Type': 'application/json'
            }
        });
    }
}
// ===== UTILITY FUNCTIONS =====
function bufferToBase64url(buffer) {
    const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
    let binary = '';
    for(let i = 0; i < bytes.length; i++){
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}
async function generateJWT(userId) {
    const secret = Deno.env.get('JWT_SECRET') || 'your-secret-key';
    const header = {
        alg: 'HS256',
        typ: 'JWT'
    };
    const payload = {
        sub: userId,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60
    };
    const headerBase64 = btoa(JSON.stringify(header)).replace(/=/g, '');
    const payloadBase64 = btoa(JSON.stringify(payload)).replace(/=/g, '');
    const data = `${headerBase64}.${payloadBase64}`;
    const encoder = new TextEncoder();
    const keyData = encoder.encode(secret);
    const key = await crypto.subtle.importKey('raw', keyData, {
        name: 'HMAC',
        hash: 'SHA-256'
    }, false, [
        'sign'
    ]);
    const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(data));
    const signatureBase64 = bufferToBase64url(signature);
    return `${data}.${signatureBase64}`;
}