import { createFileRoute } from "@tanstack/react-router";

function js(value: unknown) {
  return JSON.stringify(value).replace(/</g, "\\u003c").replace(/>/g, "\\u003e").replace(/&/g, "\\u0026");
}

async function handle(request: Request) {
  const url = new URL(request.url);
  const blogId = url.searchParams.get("blogId")?.trim() ?? "";
  if (!/^[0-9a-f-]{36}$/i.test(blogId)) return new Response("/* invalid blog */", { status: 400, headers: { "Content-Type": "application/javascript; charset=utf-8" } });

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const admin = supabaseAdmin as any;
  const [blogResult, settingsResult, linksResult] = await Promise.all([
    admin.from("blogs").select("affiliate_recommendations_enabled").eq("id", blogId).maybeSingle(),
    admin.from("affiliate_prompt_settings").select("enabled,delay_seconds,close_snooze_minutes,clicked_cooldown_hours").eq("singleton", true).maybeSingle(),
    admin.from("affiliate_links").select("short_code,platform,link_type,category,keywords,cta_text,priority").eq("enabled", true).order("priority", { ascending: true }).limit(500),
  ]);
  if (blogResult.error || settingsResult.error || linksResult.error) return new Response("/* unavailable */", { status: 503, headers: { "Content-Type": "application/javascript; charset=utf-8", "Cache-Control": "no-store" } });
  if (!blogResult.data?.affiliate_recommendations_enabled || !settingsResult.data?.enabled) return new Response("/* BlogPilot affiliate prompt disabled */", { status: 200, headers: { "Content-Type": "application/javascript; charset=utf-8", "Cache-Control": "public, max-age=60" } });

  const settings = settingsResult.data;
  const links = linksResult.data ?? [];
  const origin = `${url.protocol}//${url.host}`;
  const body = `(function(){
    var CFG=${js({ origin, delay: Number(settings.delay_seconds ?? 8), snooze: Number(settings.close_snooze_minutes ?? 30), cooldown: Number(settings.clicked_cooldown_hours ?? 24), blogId, links })};
    var now=Date.now(), key='blogpilot-affiliate:'+CFG.blogId;
    var state={}; try{state=JSON.parse(localStorage.getItem(key)||'{}')}catch(e){}
    if(state.clickedUntil&&now<state.clickedUntil)return;
    if(state.snoozedUntil&&now<state.snoozedUntil)return;
    function norm(v){return String(v||'').toLowerCase().replace(/[^a-z0-9\\u00c0-\\u024f\\u1e00-\\u1eff]+/g,' ').replace(/\\s+/g,' ').trim()}
    function has(h,t){t=norm(t);if(t.length<3)return false;return (' '+h+' ').indexOf(' '+t+' ')>=0||h.indexOf(t)>=0}
    function choose(){var h=norm(document.title+' '+((document.body&&document.body.innerText)||'')),best=null,bestScore=-1;CFG.links.forEach(function(l){var m=0;String(l.keywords||'').split(',').forEach(function(k){if(has(h,k))m++});var c=!!(l.category&&has(h,l.category));if(!m&&!c)return;var score=(l.link_type==='product'?1000:0)+(m*10)+(c?3:0);if(best===null||score>bestScore||(score===bestScore&&Number(l.priority||100)<Number(best.priority||100))){best=l;bestScore=score}});return best}
    function show(){var l=choose();if(!l)return;var wrap=document.createElement('div');wrap.setAttribute('data-blogpilot-affiliate','1');wrap.style.cssText='position:fixed;left:12px;right:12px;bottom:12px;z-index:2147483646;background:#111;color:#fff;border:1px solid rgba(255,255,255,.18);border-radius:14px;padding:12px 14px;box-shadow:0 10px 30px rgba(0,0,0,.35);font:14px/1.35 system-ui,-apple-system,sans-serif;display:flex;gap:12px;align-items:center';var text=document.createElement('div');text.style.cssText='flex:1;min-width:0';text.innerHTML='<div style="font-size:11px;opacity:.7;margin-bottom:3px">Affiliate recommendation · '+String(l.platform||'deal')+'</div><div style="font-weight:700">'+String(l.cta_text||'Check the latest deal').replace(/[<>]/g,'')+'</div>';var a=document.createElement('a');a.href=CFG.origin+'/go/'+encodeURIComponent(l.short_code);a.target='_blank';a.rel='sponsored nofollow noopener noreferrer';a.textContent='View deal';a.style.cssText='background:#d9ff38;color:#111;text-decoration:none;font-weight:800;padding:9px 12px;border-radius:9px;white-space:nowrap';a.addEventListener('click',function(){try{localStorage.setItem(key,JSON.stringify({clickedUntil:Date.now()+CFG.cooldown*3600000}))}catch(e){};setTimeout(function(){wrap.remove()},100)});var x=document.createElement('button');x.type='button';x.setAttribute('aria-label','Close affiliate recommendation');x.textContent='×';x.style.cssText='border:0;background:transparent;color:#fff;font-size:22px;line-height:1;cursor:pointer;padding:4px';x.addEventListener('click',function(){try{localStorage.setItem(key,JSON.stringify({snoozedUntil:Date.now()+CFG.snooze*60000}))}catch(e){};wrap.remove()});wrap.appendChild(text);wrap.appendChild(a);wrap.appendChild(x);document.body.appendChild(wrap)}
    if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',function(){setTimeout(show,CFG.delay*1000)});else setTimeout(show,CFG.delay*1000);
  })();`;

  return new Response(body, { status: 200, headers: { "Content-Type": "application/javascript; charset=utf-8", "Cache-Control": "public, max-age=60", "X-Content-Type-Options": "nosniff" } });
}

export const Route = createFileRoute("/api/public/affiliate-prompt")({ server: { handlers: { GET: ({ request }) => handle(request) } } });
