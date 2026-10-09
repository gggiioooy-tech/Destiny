// The peer database verifies the sender JWT, active session and administrator role.
// verify_jwt=false is required because the token belongs to the OTHER project.
const peerUrl = "https://mdzgblgujeztjgssodla.supabase.co";
const peerKey = "sb_publishable_UoJzZgbSWKUA03Vd_Q8FLg_RKH16VoW"; // Public API key, never a service credential.
const cors = {"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization,apikey,content-type,x-client-info","Access-Control-Allow-Methods":"POST,OPTIONS"};
const json = (body: unknown,status=200) => new Response(JSON.stringify(body),{status,headers:{...cors,"Content-Type":"application/json","Cache-Control":"no-store"}});
Deno.serve(async (req: Request) => {
 if(req.method==="OPTIONS") return new Response("ok",{headers:cors});
 if(req.method!=="POST") return json({error:"POST only"},405);
 const auth=req.headers.get("authorization") || "";
 if(!/^Bearer [^ ]+$/.test(auth)) return json({error:"관리자 로그인 후 이용해 주세요"},401);
 try {
  const raw=await req.text();
  if(new TextEncoder().encode(raw).length>262144) return json({error:"전송 내용이 너무 큽니다"},413);
  let input;
  try { input=JSON.parse(raw); } catch { return json({error:"잘못된 요청입니다"},400); }
  if(!/^[0-9a-f-]{36}$/i.test(input?.team_id||"") || !input?.deck || typeof input.deck!=="object" || Array.isArray(input.deck)) return json({error:"카운터를 먼저 저장해 주세요"},400);
  // Fetch the saved record, not caller-supplied content. Source export is an admin-only RPC.
  const source=await fetch(peerUrl+"/rest/v1/rpc/export_counter_for_transfer",{
   method:"POST",headers:{apikey:peerKey,Authorization:auth,"Content-Type":"application/json"},
   body:JSON.stringify({team_id:input.team_id,counter_match:input.deck}),signal:AbortSignal.timeout(15000)});
  if(!source.ok) return json({error:source.status===401||source.status===403?"보내는 사이트의 관리자 로그인이 필요합니다":"원본이 변경되었거나 전송할 수 없습니다. 새로고침 후 다시 시도해 주세요"},source.status===401||source.status===403?403:409);
  const payload=await source.json();
  if(payload?.source_site!=="seori") return json({error:"Invalid source"},403);
  const key=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const target=await fetch(Deno.env.get("SUPABASE_URL")+"/rest/v1/rpc/import_shared_counter",{
   method:"POST",headers:{apikey:key,Authorization:"Bearer "+key,"Content-Type":"application/json"},
   body:JSON.stringify({payload}),signal:AbortSignal.timeout(15000)});
  if(!target.ok) { console.error("Counter import failed",target.status); return json({error:"전송에 실패했습니다. 잠시 후 다시 시도해 주세요"},502); }
  return json(await target.json());
 } catch { return json({error:"연결이 지연되었습니다. 다시 눌러도 중복 등록되지 않습니다"},503); }
});
