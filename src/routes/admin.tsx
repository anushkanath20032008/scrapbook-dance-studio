import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getWaitlist } from "@/lib/waitlist.functions";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";

type Signup = Awaited<ReturnType<typeof getWaitlist>>[number];
export const Route=createFileRoute("/admin")({
  head:()=>({meta:[{title:"Waitlist | Choreo Studio"},{name:"description",content:"Private Choreo Studio founding waitlist."},{property:"og:title",content:"Waitlist | Choreo Studio"},{property:"og:description",content:"Private founding studio enquiries."},{property:"og:type",content:"website"},{name:"twitter:card",content:"summary"},{name:"robots",content:"noindex,nofollow"}]}),
  component:Admin,
});
function Admin(){const [rows,setRows]=useState<Signup[]>([]),[state,setState]=useState("Checking access...");const get=useServerFn(getWaitlist);
  useEffect(()=>{let alive=true;supabase.auth.getUser().then(async({data})=>{if(!alive)return;if(!data.user){setState("Sign in to view the waitlist.");return}try{const list=await get();if(alive){setRows(list);setState("")}}catch{if(alive)setState("This list is only available to the Choreo Studio owner.")}});return()=>{alive=false}},[get]);
  return <main className="section features" style={{minHeight:"100vh"}}><div className="wrap"><a href="/">← Choreo Studio</a><h1 className="display" style={{fontSize:64,margin:"30px 0"}}>Founding waitlist.</h1>{state?<div className="window"><div className="window-bar chrome-font">Access</div><div className="window-inner"><p>{state}</p><Button variant="retro" onClick={()=>location.href="/account"}>Studio account</Button></div></div>:<><p>{rows.length} enquiries · newest first</p><div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse",background:"var(--paper)"}}><thead><tr>{["Received","Studio","WhatsApp","Students","Estimate","Source / campaign","Consent"].map(x=><th key={x} style={{border:"2px solid var(--ink)",padding:10,textAlign:"left"}}>{x}</th>)}</tr></thead><tbody>{rows.map(row=><tr key={row.id}><td style={{border:"1px solid",padding:10,whiteSpace:"nowrap"}}>{new Date(row.created_at).toLocaleString("en-IN")}</td><td style={{border:"1px solid",padding:10}}>{row.studio_name}</td><td style={{border:"1px solid",padding:10}}>{row.whatsapp_number}</td><td style={{border:"1px solid",padding:10}}>{row.student_bucket}</td><td style={{border:"1px solid",padding:10}}>₹{row.estimated_amount.toLocaleString("en-IN")}</td><td style={{border:"1px solid",padding:10}}>{row.source}{row.utm_source&&` / ${row.utm_source}`}{row.utm_campaign&&` / ${row.utm_campaign}`}</td><td style={{border:"1px solid",padding:10}}>{row.opted_out_at?"Opted out":"Active"}</td></tr>)}</tbody></table></div></>}</div></main>
}
