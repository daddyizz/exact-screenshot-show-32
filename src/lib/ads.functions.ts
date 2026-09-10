import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { writeActivity } from "./operations.server";

async function assertAdmin(context:{supabase:any;userId:string}){const{data,error}=await context.supabase.rpc("has_role",{_user_id:context.userId,_role:"admin"});if(error)throw new Error(error.message);if(!data)throw new Error("Admin access required");}
function missing(error:any){const m=String(error?.message??error??"").toLowerCase();return m.includes("ad_placements")||m.includes("ad_daily_stats")||m.includes("schema cache")||m.includes("does not exist");}

export const listAdsAdmin=createServerFn({method:"GET"}).middleware([requireSupabaseAuth]).handler(async({context})=>{await assertAdmin(context);const{supabaseAdmin}=await import("@/integrations/supabase/client.server");const admin=supabaseAdmin as any;const{data,error}=await admin.from("ad_placements").select("id, slot_key, name, headline, body, image_url, target_url, cta_label, is_active, opens_new_tab, updated_at").order("slot_key");if(error){if(missing(error))return{ads:[],schemaMissing:true,analyticsReady:false,totals:{impressions:0,clicks:0,ctr:0}};throw new Error(error.message);}const stats=await admin.from("ad_daily_stats").select("placement_id,stat_date,impressions,clicks").gte("stat_date",new Date(Date.now()-29*86400000).toISOString().slice(0,10));let analyticsReady=true;let statRows:any[]=[];if(stats.error){if(!missing(stats.error))throw new Error(stats.error.message);analyticsReady=false;}else statRows=stats.data??[];const by=new Map<string,{impressions:number;clicks:number}>();for(const s of statRows){const cur=by.get(s.placement_id)??{impressions:0,clicks:0};cur.impressions+=Number(s.impressions)||0;cur.clicks+=Number(s.clicks)||0;by.set(s.placement_id,cur);}let ti=0,tc=0;const ads=(data??[]).map((a:any)=>{const s=by.get(a.id)??{impressions:0,clicks:0};ti+=s.impressions;tc+=s.clicks;return{...a,analytics:{...s,ctr:s.impressions?Number(((s.clicks/s.impressions)*100).toFixed(2)):0}};});return{ads,schemaMissing:false,analyticsReady,totals:{impressions:ti,clicks:tc,ctr:ti?Number(((tc/ti)*100).toFixed(2)):0}};});

const adInput=z.object({id:z.string().uuid().optional(),slotKey:z.string().trim().min(2).max(80),name:z.string().trim().min(2).max(120),headline:z.string().trim().min(2).max(160),body:z.string().trim().max(400).optional().default(""),imageUrl:z.string().trim().max(2048).optional().default(""),targetUrl:z.string().trim().min(1).max(2048),ctaLabel:z.string().trim().min(1).max(60),isActive:z.boolean(),opensNewTab:z.boolean()});

export const saveAdPlacement=createServerFn({method:"POST"}).middleware([requireSupabaseAuth]).inputValidator((data)=>adInput.parse(data)).handler(async({data,context})=>{
  await assertAdmin(context);
  const{supabaseAdmin}=await import("@/integrations/supabase/client.server");
  const admin=supabaseAdmin as any;
  const row={slot_key:data.slotKey,name:data.name,headline:data.headline,body:data.body||null,image_url:data.imageUrl||null,target_url:data.targetUrl,cta_label:data.ctaLabel,is_active:data.isActive,opens_new_tab:data.opensNewTab,updated_at:new Date().toISOString()};
  let placementId=data.id??null;
  if(data.id){
    const{data:saved,error}=await admin.from("ad_placements").update(row).eq("id",data.id).select("id").maybeSingle();
    if(error)throw new Error(error.message);
    placementId=saved?.id??data.id;
  }else{
    const{data:saved,error}=await admin.from("ad_placements").insert(row).select("id").maybeSingle();
    if(error)throw new Error(error.message);
    placementId=saved?.id??null;
  }
  await writeActivity(admin,{actorUserId:context.userId,eventType:data.id?"ads.placement_updated":"ads.placement_created",entityType:"ad_placement",entityId:placementId,status:"success",message:`${data.id?"Updated":"Created"} ad placement ${data.slotKey}`,metadata:{slotKey:data.slotKey,isActive:data.isActive,opensNewTab:data.opensNewTab}});
  return{ok:true};
});

export const deleteAdPlacement=createServerFn({method:"POST"}).middleware([requireSupabaseAuth]).inputValidator((data)=>z.object({id:z.string().uuid()}).parse(data)).handler(async({data,context})=>{
  await assertAdmin(context);
  const{supabaseAdmin}=await import("@/integrations/supabase/client.server");
  const admin=supabaseAdmin as any;
  const existing=await admin.from("ad_placements").select("id,slot_key").eq("id",data.id).maybeSingle();
  if(existing.error)throw new Error(existing.error.message);
  const{error}=await admin.from("ad_placements").delete().eq("id",data.id);
  if(error)throw new Error(error.message);
  await writeActivity(admin,{actorUserId:context.userId,eventType:"ads.placement_deleted",entityType:"ad_placement",entityId:data.id,status:"success",message:`Deleted ad placement ${existing.data?.slot_key??data.id}`,metadata:{slotKey:existing.data?.slot_key??null}});
  return{ok:true};
});
