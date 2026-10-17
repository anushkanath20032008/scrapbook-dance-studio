import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { studioPlans, subscriptionNote } from "@/lib/plans";
import { joinWaitlist } from "@/lib/waitlist.functions";

export const Route = createFileRoute("/")({
  head: () => ({ meta: [
    { title: "Choreo Studio | Less chasing. More dancing." },
    { name: "description", content: "Fees, attendance and batches for independent dance studios in India. Join the founding studios." },
    { property: "og:title", content: "Choreo Studio | Less chasing. More dancing." },
    { property: "og:description", content: "Track fees, missed classes and batch sizes in one place. Built for independent dance studios in India." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }), component: Home,
});

const money = (n:number) => "₹" + Math.round(n).toLocaleString("en-IN");
function Window({ title, children, className = "", count }: { title:string; children:ReactNode; className?:string; count?:string }) {
  return <div className={`window ${className}`}><div className="window-bar"><span className="chrome-font">{title}</span><span className="window-controls" aria-hidden="true">{count && <span className="chrome-font count-in">{count}</span>}<i/><i/></span></div>{children}</div>;
}
function Student({ name, batch, amount, status }: { name:string; batch:string; amount:string; status:"PAID"|"DUE"|"OVERDUE" }) {
  const color = status === "PAID" ? "var(--status-paid)" : status === "DUE" ? "var(--status-due)" : "var(--status-overdue)";
  const ink = status === "DUE" ? "var(--ink)" : "var(--paper)";
  return <div className="screen-row" style={{ "--status": color, "--status-ink": ink } as React.CSSProperties}><span><strong>{name}</strong><small>{batch} · {amount}</small></span><b>{status}</b></div>;
}
function Home() {
  const submit = useServerFn(joinWaitlist);
  const [students,setStudents] = useState(60), [fee,setFee] = useState(2500), [late,setLate] = useState(20);
  const [studio,setStudio] = useState(""), [phone,setPhone] = useState(""), [bucket,setBucket] = useState("26-50"), [consent,setConsent] = useState(false);
  const [message,setMessage] = useState(""), [busy,setBusy] = useState(false), [count,setCount] = useState("5");
  const [paid,setPaid] = useState(false);
  const hero = useRef<HTMLElement>(null);
  const problem = useRef<HTMLElement>(null);
  const solution = useRef<HTMLElement>(null);
  const estimate = Math.round(students * fee * late / 100);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { setCount("5, 6, 7, 8"); return; }
    let n = 0; const values = ["5", "6", "7", "8", "5, 6, 7, 8"];
    const timer = window.setInterval(() => { n++; setCount(values[n] ?? "5, 6, 7, 8"); if(n === values.length-1) window.clearInterval(timer); }, 340);
    let ctx: { revert: () => void } | undefined;
    Promise.all([import("gsap"), import("gsap/ScrollTrigger")]).then(([{ gsap }, { ScrollTrigger }]) => {
      gsap.registerPlugin(ScrollTrigger);
      ctx = gsap.context(() => {
        if (problem.current) gsap.fromTo(problem.current, { clipPath:"polygon(0 0, 100% 0, 100% 0, 0 0)" }, { clipPath:"polygon(0 0, 100% 0, 100% 100%, 0 100%)", duration:.35, ease:"steps(5)", scrollTrigger:{ trigger:problem.current, start:"top 95%", toggleActions:"play none none none" } });
        if (solution.current) gsap.fromTo(solution.current, { clipPath:"polygon(0 0, 100% 0, 100% 0, 0 0)" }, { clipPath:"polygon(0 0, 100% 0, 100% 100%, 0 100%)", duration:.38, ease:"steps(4)", scrollTrigger:{ trigger:solution.current, start:"top 90%", toggleActions:"play none none none" } });
      });
    }).catch(() => {});
    return () => { window.clearInterval(timer); ctx?.revert(); };
  }, []);
  async function handleSubmit(e:FormEvent<HTMLFormElement>) {
    e.preventDefault(); setMessage("");
    if (!studio.trim() || !/^\+?[0-9\s-]{10,18}$/.test(phone.trim()) || !consent) { setMessage("Add your studio, a valid WhatsApp number and consent to join."); return; }
    setBusy(true);
    try {
      const params = new URLSearchParams(window.location.search);
      const result = await submit({ data: { studioName:studio, whatsappNumber:phone, studentBucket:bucket as "10-25"|"26-50"|"51-100"|"101-300", estimatedAmount:estimate, monthlyFee:fee, latePercent:late, consent:true, source:"landing", utmSource:params.get("utm_source"), utmMedium:params.get("utm_medium"), utmCampaign:params.get("utm_campaign"), utmContent:params.get("utm_content"), utmTerm:params.get("utm_term") } });
      setMessage("You're on the list. We'll be in touch about a demo."); setStudio(""); setPhone(""); setConsent(false);
      localStorage.setItem("choreoOptOut", result.token);
    } catch (err) { setMessage(err instanceof Error ? err.message : "Could not save your request. Try again."); }
    finally { setBusy(false); }
  }
  return <>
    <main>
      <section className="hero" ref={hero} id="top">
        <div className="wrap site-nav"><a className="brand" href="#top">Choreo Studio</a><nav className="nav-links" aria-label="Main"><a className="nav-hide" href="#how">How it works</a><a className="nav-hide" href="#features">Features</a><a className="nav-hide" href="#pricing">Pricing</a><a className="nav-hide" href="#faq">FAQ</a><a href="/login">Log in</a><a className="nav-cta" href="#join">Join waitlist</a></nav></div>
        <div className="wrap hero-body"><div className="hero-type"><h1 className="display"><span>Less</span><span>chasing.</span><span>More</span><span>dancing.</span></h1><p className="hero-sub">Fees, attendance and batches for independent dance studios in India. See who hasn't paid and remind them on WhatsApp in one tap.</p></div>
          <Window title="Choreo Studio / Arrive" className="hero-window" count={count}><div className="window-inner"><div className="screen-top"><span>SEPTEMBER FEES</span><span>12 of 40 pending</span></div><Student name="Anand K." batch="Hip-hop · Sat 5pm" amount="₹1,800" status="OVERDUE"/><Student name="Bela S." batch="Kathak · Tue 6pm" amount="₹2,500" status="DUE"/><Student name="Chirag R." batch="Bollywood · Thu 7pm" amount="₹2,100" status="PAID"/><Student name="Naina K." batch="Contemporary · Fri 5pm" amount="₹1,600" status="DUE"/><div className="screen-footer"><span>Sample student data</span><Button variant="retro" onClick={() => document.getElementById("join")?.scrollIntoView({ behavior:"smooth" })}>Join founding studios</Button></div></div></Window>
        </div>
      </section>
      <div className="signup-strip" id="join"><div className="wrap"><Window title="Join_Founding_Studios.dialog" className="signup-dialog"><div className="window-inner"><h2 className="signup-heading">Join the founding studios</h2><p>Tell us about your studio. We'll set up a 15-minute demo on your own student list. Setup is free for founding studios.</p><form onSubmit={handleSubmit}><div className="signup-grid"><div><label className="form-label" htmlFor="studio">Studio name</label><input className="field" id="studio" value={studio} onChange={e=>setStudio(e.target.value)} maxLength={120} required autoComplete="organization" placeholder="Your studio"/></div><div><label className="form-label" htmlFor="phone">WhatsApp number</label><input className="field" id="phone" type="tel" value={phone} onChange={e=>setPhone(e.target.value)} required maxLength={18} inputMode="tel" placeholder="+91 ..."/></div><div><label className="form-label" htmlFor="bucket">Students</label><select className="field" id="bucket" value={bucket} onChange={e=>setBucket(e.target.value)}><option value="10-25">10–25</option><option value="26-50">26–50</option><option value="51-100">51–100</option><option value="101-300">101–300</option></select></div></div><label className="consent"><input type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)} required/><span>I agree to be contacted by Choreo Studio about the demo and founding waitlist. My details are used for this request; I can <a href="/opt-out">opt out</a> any time.</span></label><div style={{ marginTop:16 }}><Button variant="retro" type="submit" disabled={busy}>{busy?"Saving...":"Book a 15-minute demo"}</Button></div><p className="status-line" role="status">{message}</p></form></div></Window></div></div>
      <section className="section problem glitch-tear" id="problem" ref={problem}><div className="wrap"><div className="problem-grid"><div><Window title="paper_register_FINAL_v7.xls" className="register"><div className="register-lines"><p>5 SEPT · FEE REGISTER</p><p>Anand ..........?</p><p>Bela ............ check chat</p><p>Chirag ......... paid?</p><p>Naina .......... remind</p></div></Window><span className="hand-note">same notebook. new month.</span></div><div className="problem-copy"><h2 className="display">It's the 5th. Who paid?</h2><p className="section-intro">Your paper register says one thing. The WhatsApp chats say another. Choreo keeps fees, missed classes and batch sizes in one place.</p><Window title="Choreo Studio / fees"><div className="window-inner"><div className="screen-top"><span>ONE LIST. NO GUESSWORK.</span><span>September</span></div><Student name="Anand K." batch="Hip-hop" amount="₹1,800" status="OVERDUE"/><Student name="Bela S." batch="Kathak" amount="₹2,500" status="DUE"/><Student name="Chirag R." batch="Bollywood" amount="₹2,100" status="PAID"/></div></Window></div></div>
        <Window title="fee_estimate.calc" className="calc-window"><div className="calc-body"><div><h3>How much are you chasing each month?</h3><div className="calc-total">{money(estimate)}</div><p>{students} students · {money(fee)} a month · {late}% pay late or never</p><p>An estimate from your own numbers, not a promise.</p></div><div><label className="range-row">Students <output>{students}</output><input aria-label="Students" type="range" min="10" max="300" step="5" value={students} onChange={e=>setStudents(Number(e.target.value))}/></label><label className="range-row">Monthly fee <output>{money(fee)}</output><input aria-label="Monthly fee" type="range" min="500" max="6000" step="100" value={fee} onChange={e=>setFee(Number(e.target.value))}/></label><label className="range-row">Pay late or never <output>{late}%</output><input aria-label="Pay late or never" type="range" min="5" max="50" value={late} onChange={e=>setLate(Number(e.target.value))}/></label></div></div></Window>
      </div></section>
      <section className="section solution shard-wipe" id="how" ref={solution}><div className="wrap"><h2 className="display">A day in the studio.</h2><p className="section-intro">Arrive, do, done. See what needs attention without hunting through messages.</p><div className="sequence">
        <Window title="01 / Arrive"><div className="window-inner step-content"><div className="step-number">01</div><h3 className="step-heading">Arrive</h3><p>Open the month. See who has paid, who is due and who is slipping.</p><div className="screen-top"><span>SEPT FEES</span><span>12 pending</span></div><Student name="Anand K." batch="Hip-hop" amount="₹1,800" status="OVERDUE"/><Student name="Bela S." batch="Kathak" amount="₹2,500" status="DUE"/></div></Window>
        <Window title="02 / Do"><div className="window-inner step-content"><div className="step-number">02</div><h3 className="step-heading">Do</h3><p>One student, one clear next step. A reminder opens on WhatsApp; mark a payment when it lands.</p><div className="detail-line"><b>Anand K.</b> · Hip-hop, Sat 5pm</div><div className="detail-line">September fee: ₹1,800 · OVERDUE</div><div className="detail-line">Attendance: ● ● ○ ● ● ○ ●</div><div style={{display:"flex",gap:10,flexWrap:"wrap",marginTop:16}}><Button variant="retroPaper" onClick={()=>setMessage("This is a sample screen. Join the waitlist for a demo.")}>Remind</Button><Button variant="retro" onClick={()=>{setPaid(false); requestAnimationFrame(()=>setPaid(true));}}>Mark paid</Button></div></div></Window>
        <Window title="03 / Done"><div className="window-inner step-content"><div className="step-number">03</div><h3 className="step-heading">Done</h3><p>Collecting fees... <strong>40 of 40</strong></p><div className="segments" aria-label="40 of 40 fees collected">{Array.from({length:10},(_,i)=><i key={i}/>)}</div><div className={`stamp ${paid?"thud":""}`}>PAID</div><p>Month closed. Go dance.</p></div></Window>
      </div></div></section>
      <section className="section features" id="features"><div className="wrap"><h2 className="display">Everything your front desk juggles.</h2><p className="section-intro">Replace notebooks, spreadsheets and endless WhatsApp groups with one connected system.</p><div className="desktop-icons">{[
        { icon:"₹",title:"Fees",desc:"See paid, due and overdue in one list. Remind on WhatsApp in one tap. Part payments and extra amounts are caught." },
        { icon:"✓",title:"Attendance",desc:"Mark a batch in seconds and spot missed classes." },
        { icon:"▦",title:"Batches",desc:"Set up batches and rosters and see how full each one is." },
        { icon:"✔",title:"Payment claims",desc:"Dancers tell you they've paid from a private link. You confirm it against your bank or UPI statement." },
      ].map(x=><a className="desktop-icon" href="#join" key={x.title}><span className="pixel-image" aria-hidden="true">{x.icon}</span><h3>{x.title}</h3><p>{x.desc}</p></a>)}</div></div></section>
      <section className="section offer" id="offer"><div className="wrap offer-layout"><div><h2 className="display">Founding studios: the first 10.</h2><p className="section-intro">Your evenings, back. No more Sunday-night reconciling from three notebooks.</p></div><Window title="Choreo_Studio_setup.exe" className="offer-window"><div className="window-inner"><h3>Founding offer.</h3><p>Setup help and a launch price locked for a year. Cancel any time.</p><div className="segments" aria-hidden="true">{Array.from({length:10},(_,i)=><i key={i}/>)}</div><p><strong>Setting up your studio...</strong> Founding spots available.</p><ul><li>Batches and roster</li><li>One-tap attendance and missed-class log</li><li>Fee tracking and one-tap WhatsApp reminders</li><li>Free setup help on your own dancer list</li><li>A direct line to the founder</li><li>Your launch price locked for a year</li></ul><p>What we ask: a 15-minute feedback call each month, and permission to quote you only if you are happy.</p><Button variant="retro" onClick={()=>document.getElementById("join")?.scrollIntoView({behavior:"smooth"})}>Book a 15-minute demo</Button></div></Window></div></section>
      <section className="section public-pricing" id="pricing"><div className="wrap"><h2 className="display">Plans for your studio.</h2><p className="section-intro">Pick the plan that fits how many students you teach. Move up as your studio grows.</p><div className="pricing-grid">{studioPlans.map((plan,i)=><article className="pricing-card" key={plan.id}><span className="chrome-font">plan_0{i+1}.exe</span><h3>{plan.name}</h3><p className="pricing-price">{plan.price}<span>/month</span></p><ul>{plan.features.map(f=><li key={f}>{f}</li>)}</ul><Button asChild variant={plan.id==="growth"?"retro":"retroPaper"}><a href="/account">Choose {plan.name}</a></Button></article>)}</div><p className="pricing-footnote">{subscriptionNote}</p></div></section>
      <section className="section faq" id="faq"><div className="wrap"><h2 className="display">Questions owners ask.</h2><div className="faq-list">{[
        ["Do my dancers need to install an app?","No. They get a WhatsApp message with a private link. They pay you directly by UPI or cash, then tell you from that link, and you confirm it."],
        ["How do I get my dancers in?","You add dancers one at a time in guided setup, which takes a few minutes. With a long list, we'll help you set it up."],
        ["How do the reminders work?","You see who will be messaged, review the message and tap send. It opens in WhatsApp. Nothing is sent automatically."],["Do you take my dancers' payments?","No. Choreo Studio keeps the record only. Money goes straight from your dancers to you, so we never hold it."],
        ["We have several trainers. Is that covered?","Today the app is built around one studio team. Tell us how you work when you join; it shapes what we build next."],
        ["What if I want to stop?","Cancel any time. Your records are yours; ask and we'll send them as a spreadsheet."],
      ].map(([q,a],i)=><Window title={`readme_0${i+1}.txt`} key={q}><details><summary>{q}</summary><p>{a}</p></details></Window>)}</div></div></section>
    </main><footer className="footer"><div className="wrap"><strong>Choreo Studio</strong><span>Less chasing. More dancing.</span><div><a href="#join">Join the waitlist</a> · <a href="/login">Log in</a> · <a href="/privacy">Privacy</a> · <a href="/terms">Terms</a> · <a href="mailto:nath.anushka26@gmail.com">Contact</a> · <a href="/opt-out">Opt out</a></div><small>© 2026 Choreo Studio</small></div></footer>
  </>;
}
