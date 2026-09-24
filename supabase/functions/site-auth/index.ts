import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.105.4";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" },
});
const invalid = () => json({ error: "아이디 또는 비밀번호가 일치하지 않습니다." }, 401);
const passwordValid = (value: unknown, minimum = 8): value is string =>
  typeof value === "string" && value.length >= minimum && new TextEncoder().encode(value).length <= 72;
async function hash(value: string) {
  return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value))))
    .map(b => b.toString(16).padStart(2, "0")).join("");
}
const emailFor = async (id: string) => `${await hash(id.toLowerCase())}@users.15month.invalid`;

// Public sign-in entry point: passwords are verified by Supabase Auth (or the
// one-time server-only legacy hash). Privileged actions separately verify JWTs.
Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (request.method !== "POST") return json({ error: "지원하지 않는 요청입니다." }, 405);
  let stage = 'request';
  try {
    if (Number(request.headers.get("content-length") || 0) > 8192) return json({ error: "요청이 너무 큽니다." }, 413);
    const raw = await request.text();
    if (raw.length > 8192) return json({ error: "요청이 너무 큽니다." }, 413);
    let payload;
    try { payload = JSON.parse(raw); } catch { return json({ error: "잘못된 요청입니다." }, 400); }
    const action = payload?.action;
    if (!["login", "signup", "change-password"].includes(action)) return json({ error: "지원하지 않는 요청입니다." }, 400);
    const url = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const options = { auth: { persistSession: false, autoRefreshToken: false } };
    const admin = createClient(url, serviceKey, options);
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    async function budget(key: string, limit: number) {
      const { data, error } = await admin.rpc("consume_auth_budget", { p_key_hash: await hash(key), p_limit: limit });
      if (error) throw error;
      return data === true;
    }

    if (action === "change-password") {
      const token = (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
      const { data: identity, error: identityError } = await admin.auth.getUser(token);
      if (identityError || !identity.user) return json({ error: "다시 로그인해 주세요." }, 401);
      const { data: profile, error: profileError } = await admin.from("profiles")
        .select("id,user_id,status").eq("auth_user_id", identity.user.id).maybeSingle();
      if (profileError) throw profileError;
      if (!profile || profile.status !== "approved") return json({ error: "계정 권한을 확인해 주세요." }, 403);
      if (!passwordValid(payload.currentPassword, 4) || !passwordValid(payload.newPassword) || payload.currentPassword === payload.newPassword) {
        return json({ error: "현재 비밀번호와 다른 8글자 이상의 새 비밀번호를 입력해 주세요. 최대 72바이트입니다." }, 400);
      }
      if (!await budget(`password:${identity.user.id}`, 10)) return json({ error: "시도 횟수를 초과했습니다. 30분 후 다시 시도해 주세요." }, 429);
      const verifier = createClient(url, serviceKey, options);
      const { data: verified, error: verifyError } = await verifier.auth.signInWithPassword({ email: await emailFor(profile.user_id), password: payload.currentPassword });
      if (verifyError || !verified.session) return invalid();
      await admin.auth.admin.signOut(verified.session.access_token, "local");
      // Revoke while the verified original token still exists. Updating the
      // password itself can invalidate it before a subsequent logout request.
      stage = 'revoke-sessions';
      const { error: signOutError } = await admin.auth.admin.signOut(token, "global");
      if (signOutError) throw signOutError;
      stage = 'update-password';
      const { error: updateError } = await admin.auth.admin.updateUserById(identity.user.id, { password: payload.newPassword });
      if (updateError) throw updateError;
      stage = 'update-profile';
      const { error: profileUpdateError } = await admin.from("profiles").update({ must_change_password: false }).eq("id", profile.id);
      if (profileUpdateError) throw profileUpdateError;
      return json({ changed: true });
    }

    const userId = typeof payload.userId === "string" ? payload.userId.trim().toLowerCase() : "";
    const password = payload.password;
    if (!/^[\p{L}\p{N}_.-]{4,40}$/u.test(userId) || !passwordValid(password, action === "signup" ? 8 : 4)) {
      return json({ error: "아이디 또는 비밀번호 형식을 확인해 주세요." }, 400);
    }
    if (!await budget(`${action}:account:${userId}`, action === "signup" ? 5 : 15) ||
        !await budget(`${action}:ip:${ip}`, action === "signup" ? 10 : 60)) {
      return json({ error: "시도 횟수를 초과했습니다. 30분 후 다시 시도해 주세요." }, 429);
    }
    const email = await emailFor(userId);
    if (action === "signup") {
      const nickname = typeof payload.gameNickname === "string" ? payload.gameNickname.trim() : "";
      if (!nickname || nickname.length > 40 || ["admin", "15month"].includes(userId)) return json({ error: "사용할 수 없는 가입 정보입니다." }, 400);
      const { data: existing, error: lookupError } = await admin.from("profiles").select("id").eq("user_id", userId).maybeSingle();
      if (lookupError) throw lookupError;
      if (existing) return json({ error: "사용할 수 없는 가입 정보입니다." }, 400);
      const { data: created, error: createError } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
      if (createError || !created.user) return json({ error: "가입 정보를 확인한 뒤 다시 시도해 주세요." }, 400);
      const { error: insertError } = await admin.from("profiles").insert({ user_id: userId, auth_user_id: created.user.id,
        game_nickname: nickname, role: "member", status: "pending", is_owner: false });
      if (insertError) { await admin.auth.admin.deleteUser(created.user.id); throw insertError; }
      return json({ created: true });
    }

    const { data: profile, error: profileError } = await admin.from("profiles")
      .select("id,user_id,auth_user_id,status").eq("user_id", userId).maybeSingle();
    if (profileError) throw profileError;
    if (!profile || !["approved", "pending"].includes(profile.status)) return invalid();
    if (!profile.auth_user_id) {
      const { data: valid, error: legacyError } = await admin.rpc("verify_legacy_password", { p_user_id: userId, p_password: password });
      if (legacyError) throw legacyError;
      if (!valid) return invalid();
      const { data: created, error: createError } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
      if (createError || !created.user) return json({ error: "로그인을 다시 시도해 주세요." }, 409);
      const { data: linked, error: linkError } = await admin.from("profiles").update({ auth_user_id: created.user.id })
        .eq("id", profile.id).is("auth_user_id", null).select("id");
      if (linkError || !linked?.length) {
        await admin.auth.admin.deleteUser(created.user.id);
        return json({ error: "로그인을 다시 시도해 주세요." }, 409);
      }
      const { error: clearError } = await admin.rpc("clear_legacy_password", { p_user_id: userId });
      if (clearError) throw clearError;
    }
    // Keep the privileged client separate: signInWithPassword changes its auth state.
    const loginClient = createClient(url, serviceKey, options);
    const { data: signedIn, error: signInError } = await loginClient.auth.signInWithPassword({ email, password });
    if (signInError || !signedIn.session) return invalid();
    const { error: seenError } = await admin.from("profiles").update({ last_seen_at: new Date().toISOString() }).eq("id", profile.id);
    if (seenError) throw seenError;
    return json({ accessToken: signedIn.session.access_token, refreshToken: signedIn.session.refresh_token });
  } catch (error) {
    console.error("site-auth request failed", { stage, code: error?.code, status: error?.status });
    return json({ error: "인증 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요." }, 500);
  }
});
