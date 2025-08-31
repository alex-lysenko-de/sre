// supabase/functions/auth/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import * as base64url from "https://deno.land/std@0.168.0/encoding/base64url.ts";
import { create, verify } from "https://deno.land/x/djwt@v3.0.1/mod.ts";

// WebAuthn verification utilities
const COSE_ALG_ES256 = -7;
const COSE_ALG_RS256 = -257;

interface RegisterPrepareRequest {
  inviteToken: string;
  displayName?: string;
}

interface RegisterFinishRequest {
  challengeId: string;
  attestation: {
    id: string;
    rawId: string;
    response: {
      clientDataJSON: string;
      attestationObject: string;
    };
    type: string;
  };
  displayName: string;
}

interface LoginPrepareRequest {
  userId?: string;
}

interface LoginFinishRequest {
  challengeId: string;
  assertion: {
    id: string;
    rawId: string;
    response: {
      clientDataJSON: string;
      authenticatorData: string;
      signature: string;
      userHandle?: string;
    };
    type: string;
  };
}

// Утилиты
function hashToken(token: string): string {
  const encoder = new TextEncoder();
  const data = encoder.encode(token);
  const hashBuffer = crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
}

async function generateChallenge(): Promise<string> {
  const challenge = new Uint8Array(32);
  crypto.getRandomValues(challenge);
  return base64url.encode(challenge);
}

async function generateToken(): Promise<string> {
  const token = new Uint8Array(32);
  crypto.getRandomValues(token);
  return base64url.encode(token);
}

async function createJWT(userId: string, role: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(Deno.env.get("JWT_SECRET")!),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const payload = {
    sub: userId,
    role: role,
    exp: Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60), // 30 дней
    iat: Math.floor(Date.now() / 1000),
  };

  return await create({ alg: "HS256", typ: "JWT" }, payload, key);
}

function parseClientDataJSON(clientDataJSON: string): any {
  const decoded = base64url.decode(clientDataJSON);
  return JSON.parse(new TextDecoder().decode(decoded));
}

function parseAuthenticatorData(authData: string): {
  rpIdHash: Uint8Array;
  flags: number;
  counter: number;
  attestedCredentialData?: Uint8Array;
} {
  const buffer = base64url.decode(authData);
  const view = new DataView(buffer.buffer);
  
  return {
    rpIdHash: buffer.slice(0, 32),
    flags: view.getUint8(32),
    counter: view.getUint32(33, false),
    attestedCredentialData: buffer.length > 37 ? buffer.slice(37) : undefined,
  };
}

async function verifySignature(
  publicKeyData: string,
  signature: string,
  data: Uint8Array
): Promise<boolean> {
  try {
    const publicKeyBytes = base64url.decode(publicKeyData);
    const signatureBytes = base64url.decode(signature);

    // Парсинг COSE key (упрощённая версия для ES256)
    // В продакшене используй полноценную библиотеку CBOR
    const publicKey = await crypto.subtle.importKey(
      "spki",
      publicKeyBytes,
      { name: "ECDSA", namedCurve: "P-256" },
      false,
      ["verify"]
    );

    return await crypto.subtle.verify(
      { name: "ECDSA", hash: "SHA-256" },
      publicKey,
      signatureBytes,
      data
    );
  } catch (error) {
    console.error("Signature verification error:", error);
    return false;
  }
}

// Handlers
async function handleRegisterPrepare(
  req: Request,
  supabase: any
): Promise<Response> {
  const { inviteToken, displayName }: RegisterPrepareRequest = await req.json();

  // Хешируем токен
  const tokenHash = await hashToken(inviteToken);

  // Проверяем invite
  const { data: invite, error: inviteError } = await supabase
    .from("invites")
    .select("*")
    .eq("token_hash", tokenHash)
    .eq("used", false)
    .gt("expires_at", new Date().toISOString())
    .single();

  if (inviteError || !invite) {
    return new Response(
      JSON.stringify({ error: "Invalid or expired invite token" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  // Генерируем challenge
  const challenge = await generateChallenge();
  const challengeId = crypto.randomUUID();

  // Сохраняем challenge
  await supabase.from("webauthn_challenges").insert({
    id: challengeId,
    challenge,
    invite_id: invite.id,
    type: "registration",
    expires_at: new Date(Date.now() + 2 * 60 * 1000).toISOString(), // 2 минуты
  });

  // Возвращаем параметры для WebAuthn
  return new Response(
    JSON.stringify({
      challengeId,
      publicKey: {
        challenge,
        rp: {
          name: "MyApp",
          id: new URL(req.url).hostname,
        },
        user: {
          id: crypto.randomUUID(),
          name: displayName || "User",
          displayName: displayName || "User",
        },
        pubKeyCredParams: [
          { alg: COSE_ALG_ES256, type: "public-key" },
          { alg: COSE_ALG_RS256, type: "public-key" },
        ],
        authenticatorSelection: {
          authenticatorAttachment: "platform",
          userVerification: "required",
          requireResidentKey: false,
        },
        timeout: 60000,
        attestation: "none",
      },
      role: invite.role,
    }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
}

async function handleRegisterFinish(
  req: Request,
  supabase: any
): Promise<Response> {
  const { challengeId, attestation, displayName }: RegisterFinishRequest =
    await req.json();

  // Получаем challenge
  const { data: challengeData, error: challengeError } = await supabase
    .from("webauthn_challenges")
    .select("*, invites(*)")
    .eq("id", challengeId)
    .eq("type", "registration")
    .gt("expires_at", new Date().toISOString())
    .single();

  if (challengeError || !challengeData) {
    return new Response(
      JSON.stringify({ error: "Invalid or expired challenge" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  // Парсим clientDataJSON
  const clientData = parseClientDataJSON(attestation.response.clientDataJSON);

  // Верифицируем challenge
  if (clientData.challenge !== challengeData.challenge) {
    return new Response(
      JSON.stringify({ error: "Challenge mismatch" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  // Верифицируем origin
  const expectedOrigin = new URL(req.url).origin;
  if (clientData.origin !== expectedOrigin) {
    return new Response(
      JSON.stringify({ error: "Origin mismatch" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  // Создаём пользователя
  const { data: user, error: userError } = await supabase
    .from("users")
    .insert({
      display_name: displayName,
      role: challengeData.invites.role,
      last_seen_date: new Date().toISOString().split("T")[0],
    })
    .select()
    .single();

  if (userError) {
    return new Response(
      JSON.stringify({ error: "Failed to create user" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  // Сохраняем device (credential)
  const { error: deviceError } = await supabase.from("devices").insert({
    user_id: user.id,
    credential_id: attestation.id,
    public_key: attestation.response.attestationObject, // Упрощение: нужно извлечь pubkey из attestation
    counter: 0,
    name: "Default Device",
    last_used: new Date().toISOString(),
  });

  if (deviceError) {
    return new Response(
      JSON.stringify({ error: "Failed to save device" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  // Помечаем invite как использованный
  await supabase
    .from("invites")
    .update({ used: true, used_by: user.id, used_at: new Date().toISOString() })
    .eq("id", challengeData.invites.id);

  // Удаляем challenge
  await supabase.from("webauthn_challenges").delete().eq("id", challengeId);

  // Создаём JWT
  const jwt = await createJWT(user.id, user.role);

  return new Response(
    JSON.stringify({
      success: true,
      user: {
        id: user.id,
        displayName: user.display_name,
        role: user.role,
      },
      token: jwt,
    }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
}

async function handleLoginPrepare(
  req: Request,
  supabase: any
): Promise<Response> {
  const { userId }: LoginPrepareRequest = await req.json();

  // Генерируем challenge
  const challenge = await generateChallenge();
  const challengeId = crypto.randomUUID();

  // Сохраняем challenge
  await supabase.from("webauthn_challenges").insert({
    id: challengeId,
    challenge,
    user_id: userId || null,
    type: "authentication",
    expires_at: new Date(Date.now() + 2 * 60 * 1000).toISOString(),
  });

  // Получаем credentials пользователя (если userId указан)
  let allowCredentials = [];
  if (userId) {
    const { data: devices } = await supabase
      .from("devices")
      .select("credential_id, transports")
      .eq("user_id", userId)
      .eq("revoked", false);

    allowCredentials = devices?.map((d: any) => ({
      id: d.credential_id,
      type: "public-key",
      transports: d.transports || [],
    })) || [];
  }

  return new Response(
    JSON.stringify({
      challengeId,
      publicKey: {
        challenge,
        timeout: 60000,
        rpId: new URL(req.url).hostname,
        userVerification: "required",
        allowCredentials: allowCredentials.length > 0 ? allowCredentials : undefined,
      },
    }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
}

async function handleLoginFinish(
  req: Request,
  supabase: any
): Promise<Response> {
  const { challengeId, assertion }: LoginFinishRequest = await req.json();

  // Получаем challenge
  const { data: challengeData, error: challengeError } = await supabase
    .from("webauthn_challenges")
    .select("*")
    .eq("id", challengeId)
    .eq("type", "authentication")
    .gt("expires_at", new Date().toISOString())
    .single();

  if (challengeError || !challengeData) {
    return new Response(
      JSON.stringify({ error: "Invalid or expired challenge" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  // Получаем device по credential_id
  const { data: device, error: deviceError } = await supabase
    .from("devices")
    .select("*, users(*)")
    .eq("credential_id", assertion.id)
    .eq("revoked", false)
    .single();

  if (deviceError || !device) {
    return new Response(
      JSON.stringify({ error: "Device not found" }),
      { status: 404, headers: { "Content-Type": "application/json" } }
    );
  }

  // Проверяем активность пользователя
  if (!device.users.active) {
    return new Response(
      JSON.stringify({ error: "User is deactivated" }),
      { status: 403, headers: { "Content-Type": "application/json" } }
    );
  }

  // Парсим clientDataJSON
  const clientData = parseClientDataJSON(assertion.response.clientDataJSON);

  // Верифицируем challenge
  if (clientData.challenge !== challengeData.challenge) {
    return new Response(
      JSON.stringify({ error: "Challenge mismatch" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  // Парсим authenticatorData
  const authData = parseAuthenticatorData(assertion.response.authenticatorData);

  // Проверяем counter (защита от replay)
  if (authData.counter <= device.counter) {
    return new Response(
      JSON.stringify({ error: "Invalid counter" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  // Верифицируем подпись
  const clientDataHash = await crypto.subtle.digest(
    "SHA-256",
    base64url.decode(assertion.response.clientDataJSON)
  );
  const dataToVerify = new Uint8Array([
    ...base64url.decode(assertion.response.authenticatorData),
    ...new Uint8Array(clientDataHash),
  ]);

  const isValid = await verifySignature(
    device.public_key,
    assertion.response.signature,
    dataToVerify
  );

  if (!isValid) {
    return new Response(
      JSON.stringify({ error: "Signature verification failed" }),
      { status: 401, headers: { "Content-Type": "application/json" } }
    );
  }

  // Обновляем counter и last_used
  await supabase
    .from("devices")
    .update({
      counter: authData.counter,
      last_used: new Date().toISOString(),
    })
    .eq("id", device.id);

  // Обновляем last_seen_date
  await supabase
    .from("users")
    .update({ last_seen_date: new Date().toISOString().split("T")[0] })
    .eq("id", device.user_id);

  // Удаляем challenge
  await supabase.from("webauthn_challenges").delete().eq("id", challengeId);

  // Создаём JWT
  const jwt = await createJWT(device.users.id, device.users.role);

  return new Response(
    JSON.stringify({
      success: true,
      user: {
        id: device.users.id,
        displayName: device.users.display_name,
        role: device.users.role,
      },
      token: jwt,
    }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
}

async function handleInviteGenerate(
  req: Request,
  supabase: any
): Promise<Response> {
  const { role, expiresInHours } = await req.json();

  // TODO: Проверить, что запрашивающий - admin
  // (можно через JWT из Authorization header)

  const rawToken = await generateToken();
  const tokenHash = await hashToken(rawToken);

  const expiresAt = new Date(
    Date.now() + (expiresInHours || 24) * 60 * 60 * 1000
  );

  const { data: invite, error } = await supabase
    .from("invites")
    .insert({
      token_hash: tokenHash,
      role: role || "user",
      expires_at: expiresAt.toISOString(),
    })
    .select()
    .single();

  if (error) {
    return new Response(
      JSON.stringify({ error: "Failed to create invite" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  return new Response(
    JSON.stringify({
      success: true,
      inviteToken: rawToken,
      inviteUrl: `${new URL(req.url).origin}?invite=${rawToken}`,
      expiresAt: invite.expires_at,
    }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
}

// Main handler
serve(async (req) => {
  // CORS headers
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    const url = new URL(req.url);
    const path = url.pathname;

    let response: Response;

    if (path.endsWith("/register/prepare")) {
      response = await handleRegisterPrepare(req, supabase);
    } else if (path.endsWith("/register/finish")) {
      response = await handleRegisterFinish(req, supabase);
    } else if (path.endsWith("/login/prepare")) {
      response = await handleLoginPrepare(req, supabase);
    } else if (path.endsWith("/login/finish")) {
      response = await handleLoginFinish(req, supabase);
    } else if (path.endsWith("/invite/generate")) {
      response = await handleInviteGenerate(req, supabase);
    } else {
      response = new Response(
        JSON.stringify({ error: "Not found" }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    // Add CORS headers to response
    const headers = new Headers(response.headers);
    headers.set("Access-Control-Allow-Origin", "*");
    headers.set("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
    headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error", details: error.message }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  }
});
