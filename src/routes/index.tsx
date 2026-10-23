import { openConsentChoice } from "@/components/analytics";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { studioPlans, subscriptionNote } from "@/lib/plans";
import { useScrollReveal } from "@/lib/scroll-reveal";

export const Route = createFileRoute("/")({
  head: () => ({ meta: [
    { title: "Dance class fee tracking and WhatsApp reminders | ChoreoStudio" },
    { name: "description", content: "See who has paid, who is due and who is overdue at your dance studio. Remind each dancer on WhatsApp with the amount filled in. First month free, no card." },
    { property: "og:title", content: "ChoreoStudio | Less chasing. More dancing." },
    { property: "og:description", content: "See who has paid, who is due and who is overdue at your dance studio. Remind each dancer on WhatsApp with the amount filled in. First month free, no card." },
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
  const [students,setStudents] = useState(40), [fee,setFee] = useState(2500), [late,setLate] = useState(20);
  const [paid,setPaid] = useState(false);
  const DEMO_VIDEO_URL = ""; // paste the demo video file URL here when it is ready
  const hero = useRef<HTMLElement>(null);
  const problem = useRef<HTMLElement>(null);
  const solution = useRef<HTMLElement>(null);
  const estimate = Math.round(students * fee * late / 100);
  useScrollReveal(".section .wrap > *, .footer .wrap");
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let ctx: { revert: () => void } | undefined;
    Promise.all([import("gsap"), import("gsap/ScrollTrigger")]).then(([{ gsap }, { ScrollTrigger }]) => {
      gsap.registerPlugin(ScrollTrigger);
      ctx = gsap.context(() => {
        if (problem.current) gsap.fromTo(problem.current, { clipPath:"polygon(0 0, 100% 0, 100% 0, 0 0)" }, { clipPath:"polygon(0 0, 100% 0, 100% 100%, 0 100%)", duration:.35, ease:"steps(5)", scrollTrigger:{ trigger:problem.current, start:"top 95%", toggleActions:"play none none none" } });
        if (solution.current) gsap.fromTo(solution.current, { clipPath:"polygon(0 0, 100% 0, 100% 0, 0 0)" }, { clipPath:"polygon(0 0, 100% 0, 100% 100%, 0 100%)", duration:.38, ease:"steps(4)", scrollTrigger:{ trigger:solution.current, start:"top 90%", toggleActions:"play none none none" } });
      });
    }).catch(() => {});
    return () => { ctx?.revert(); };
  }, []);
  return <>
    <main>
      <section className="hero" ref={hero} id="top">
        <div className="wrap site-nav"><a className="brand" href="#top"><img className="brand-mark" src="/logo-mark.svg" alt="" width="30" height="30"/>ChoreoStudio</a><nav className="nav-links" aria-label="Main"><a className="nav-hide" href="#how">How it works</a><a className="nav-hide" href="#features">Features</a><a className="nav-hide" href="#pricing">Pricing</a><a className="nav-hide" href="#faq">FAQ</a><a href="/login">Log in</a><a className="nav-cta" href="/login?mode=register">Start free trial</a></nav></div>
        <div className="wrap hero-body"><div className="hero-type"><h1 className="display"><span>Less</span><span>chasing.</span><span>More</span><span>dancing.</span></h1><p className="hero-sub">See who has paid and who hasn't. Remind the rest on WhatsApp in one tap.</p><div className="size-picker"><div className="hero-actions"><Button asChild variant="retro"><a href="/login?mode=register">Start free trial</a></Button><a className="text-link" href="#how">See how it works</a></div><p className="trial-note">Free for your first month. No card needed.</p></div></div>
          <Window title="ChoreoStudio / Arrive" className="hero-window"><div className="window-inner"><div className="screen-top"><span>SEPTEMBER FEES</span><span>12 of 40 pending</span></div><Student name="Anand K." batch="Hip-hop · Sat 5pm" amount="₹1,800" status="OVERDUE"/><Student name="Bela S." batch="Kathak · Tue 6pm" amount="₹2,500" status="DUE"/><Student name="Chirag R." batch="Bollywood · Thu 7pm" amount="₹2,100" status="PAID"/><Student name="Naina K." batch="Contemporary · Fri 5pm" amount="₹1,600" status="DUE"/><div className="screen-footer"><span>Sample dancer data</span><Button asChild variant="retro"><a href="/login?mode=register">Start free trial</a></Button></div></div></Window>
        </div>
      </section>
      <section className="section problem glitch-tear" id="problem" ref={problem}><div className="wrap"><div className="problem-grid"><div><Window title="paper_register_FINAL_v7.xls" className="register"><div className="register-lines"><p>30 SEPT · MONTH END</p><p>Anand ..........?</p><p>Bela ............ check chat</p><p>Chirag ......... paid?</p><p>Naina .......... remind</p></div></Window><span className="hand-note">same notebook. new month.</span></div><div className="problem-copy"><h2 className="display">It's month end. Do your records match?</h2><p className="section-intro">Your paper register says one thing, your bank statement another, and the WhatsApp chats a third. Choreo keeps fees, missed classes and batch sizes in one place.</p><Window title="ChoreoStudio / fees"><div className="window-inner"><div className="screen-top"><span>ONE LIST. NO GUESSWORK.</span><span>September</span></div><Student name="Anand K." batch="Hip-hop" amount="₹1,800" status="OVERDUE"/><Student name="Bela S." batch="Kathak" amount="₹2,500" status="DUE"/><Student name="Chirag R." batch="Bollywood" amount="₹2,100" status="PAID"/></div></Window></div></div>
      </div></section>
      <section className="section solution shard-wipe" id="how" ref={solution}><div className="wrap"><h2 className="display">A day in the studio.</h2><p className="section-intro">Arrive, do, done. See what needs attention without hunting through messages.</p><div className="sequence">
        <Window title="01 / Arrive"><div className="window-inner step-content"><div className="step-number">01</div><h3 className="step-heading">Arrive</h3><p>Open the month. See who has paid, who is due and who is slipping.</p><div className="screen-top"><span>SEPT FEES</span><span>12 pending</span></div><Student name="Anand K." batch="Hip-hop" amount="₹1,800" status="OVERDUE"/><Student name="Bela S." batch="Kathak" amount="₹2,500" status="DUE"/></div></Window>
        <Window title="02 / Do"><div className="window-inner step-content"><div className="step-number">02</div><h3 className="step-heading">Do</h3><p>One dancer, one clear next step. A reminder opens on WhatsApp; record a payment when it lands.</p><div className="detail-line"><b>Anand K.</b> · Hip-hop, Sat 5pm</div><div className="detail-line">September fee: ₹1,800 · OVERDUE</div><div className="detail-line">Attendance: ● ● ○ ● ● ○ ●</div><div style={{display:"flex",gap:10,flexWrap:"wrap",marginTop:16}}><Button asChild variant="retroPaper"><a href="/login?mode=register">Try it free</a></Button><Button variant="retro" onClick={()=>{setPaid(false); requestAnimationFrame(()=>setPaid(true));}}>Record payment</Button></div></div></Window>
        <Window title="03 / Done"><div className="window-inner step-content"><div className="step-number">03</div><h3 className="step-heading">Done</h3><p>Collecting fees... <strong>40 of 40</strong></p><div className="segments" aria-label="40 of 40 fees collected">{Array.from({length:10},(_,i)=><i key={i}/>)}</div><div className={`stamp ${paid?"thud":""}`}>PAID</div><p>Month closed. Go dance.</p></div></Window>
      </div></div></section>
      {DEMO_VIDEO_URL ? <section className="section video-section" id="demo"><div className="wrap"><h2 className="display">See it in action.</h2><p className="section-intro">A short look: add a dancer, see who hasn't paid, send a reminder, confirm a payment.</p><Window title="Choreo_Studio_demo.mp4" className="video-window"><video controls playsInline preload="metadata" src={DEMO_VIDEO_URL} style={{ width:"100%", display:"block" }}/></Window></div></section> : null}
      <section className="section features" id="features"><div className="wrap"><h2 className="display">Everything your front desk juggles.</h2><p className="section-intro">Keep fees, attendance and batches in one place, so the notebook and the chat scroll stop being your system.</p><div className="desktop-icons">{[
        { icon:"₹",title:"Fees",desc:"See paid, due and overdue in one list. The WhatsApp message is written, you press Send. If a dancer pays part, you see what is still owed. If they pay extra, the app asks before it records the extra as credit." },
        { icon:"✓",title:"Attendance",desc:"Mark a batch in seconds and spot missed classes." },
        { icon:"▦",title:"Batches",desc:"Set up batches and rosters and see how full each one is." },
        { icon:"✔",title:"Payment claims",desc:"Dancers tell you they've paid from a private link. You confirm it against your bank or UPI statement." },
      ].map(x=><a className="desktop-icon" href="/login?mode=register" key={x.title}><span className="pixel-image" aria-hidden="true">{x.icon}</span><h3>{x.title}</h3><p>{x.desc}</p></a>)}</div></div></section>
      <section className="section calc-section" id="calculator"><div className="wrap">
        <Window title="fee_estimate.calc" className="calc-window"><div className="calc-body"><div><h3>How much are you chasing each month?</h3><div className="calc-total">{money(estimate)}</div><p>{students} dancers · {money(fee)} a month · {late}% pay late</p><p>An estimate from your own numbers, not a promise. Change the numbers to match your studio.</p></div><div><div className="range-row"><label htmlFor="calc-students">Dancers</label><input id="calc-students" className="field range-num" type="number" inputMode="numeric" min="1" max="1000" value={students} onChange={e=>setStudents(Math.max(0,Math.min(1000,Number(e.target.value)||0)))}/><input aria-label="Dancers slider" type="range" min="10" max="300" step="5" value={Math.min(300,Math.max(10,students))} onChange={e=>setStudents(Number(e.target.value))}/></div><div className="range-row"><label htmlFor="calc-fee">Monthly fee (₹)</label><input id="calc-fee" className="field range-num" type="number" inputMode="numeric" min="0" max="50000" value={fee} onChange={e=>setFee(Math.max(0,Math.min(50000,Number(e.target.value)||0)))}/><input aria-label="Monthly fee slider" type="range" min="500" max="6000" step="100" value={Math.min(6000,Math.max(500,fee))} onChange={e=>setFee(Number(e.target.value))}/></div><div className="range-row"><label htmlFor="calc-late">Pay late (%)</label><input id="calc-late" className="field range-num" type="number" inputMode="numeric" min="0" max="100" value={late} onChange={e=>setLate(Math.max(0,Math.min(100,Number(e.target.value)||0)))}/><input aria-label="Late percentage slider" type="range" min="5" max="50" value={Math.min(50,Math.max(5,late))} onChange={e=>setLate(Number(e.target.value))}/></div></div></div></Window>
      </div></section>
      <section className="section public-pricing" id="pricing"><div className="wrap"><h2 className="display">Plans for your studio.</h2><p className="section-intro">Free for your first month, with every feature. Then ₹249 a month, or ₹479 for studios with more than 50 dancers. Automated WhatsApp messages are coming soon.</p><div className="offer-banner"><strong>Early-studio offer: free setup and a price locked for a year.</strong><p>The first 10 studios get help setting up their dancer list, a direct line to the founder, and today's price for 12 months. In return: one 15-minute feedback call a month.</p></div><div className="pricing-grid">{studioPlans.map((plan,i)=><article className="pricing-card" key={plan.id}><span className="chrome-font">plan_0{i+1}.exe</span><h3>{plan.name}</h3><p className="pricing-price">{plan.price}<span>/month</span></p><ul>{plan.features.map(f=><li key={f}>{f}</li>)}</ul><Button asChild variant={plan.id==="growth"?"retro":"retroPaper"}><a href="/login?mode=register">Start free trial</a></Button></article>)}</div><p className="pricing-footnote">{subscriptionNote}</p></div></section>
      <section className="section faq" id="faq"><div className="wrap"><h2 className="display">Questions owners ask.</h2><div className="faq-list">{[
        ["Do my dancers need to install an app?","No. Your reminder opens in your own WhatsApp. If you want dancers to tell you when they have paid, send them a private link from the app. It opens in their browser, with no app and no account. They pay you directly, and you confirm it."],
        ["How do I get my dancers in?","You add dancers one at a time in guided setup, which takes a few minutes. With a long list, ask us and we'll add them with you on a call (free for the first 10 studios)."],
        ["How do the reminders work?","You see who will be messaged, review the message and tap send. It opens in WhatsApp. Nothing is sent automatically."],["Do you take my dancers' payments?","No. ChoreoStudio keeps the record only. Money goes straight from your dancers to you, so we never hold it."],
        ["We have several trainers. Is that covered?","Today the app is built around one studio team. Tell us how you work when you join; it shapes what we build next."],
        ["How does the free month work?","Sign up and use everything free for your first month, with no card. Nothing is charged until you choose a plan yourself. After that it is ₹249 a month, or ₹479 a month for Studio+."],
        ["What is different in Studio+?","Studio+ is for studios with more than 50 dancers. It adds automated WhatsApp messages sent from your own WhatsApp Business account, which is coming soon, and priority support. Everything else is in Regular."],
        ["I'm a dancer. What do I do?","Nothing here. ChoreoStudio is a tool for studio owners. Your studio messages you on WhatsApp about your fees, and you pay them directly. You don't need an app or an account."],
        ["Where is my data, and who can see it?","Your records are stored in Mumbai. Only your studio can see them. A dancer can see only their own fees, and only through the private link you send. You can ask us for a spreadsheet of your records or to delete them."],
        ["What if I want to stop?","Cancel any time. Your records are yours; ask and we'll send them as a spreadsheet."],
      ].map(([q,a],i)=><Window title={`readme_0${i+1}.txt`} key={q}><details><summary>{q}</summary><p>{a}</p></details></Window>)}</div></div></section>
      <section className="section final-cta" id="start"><div className="wrap"><h2 className="display">Ready to stop chasing?</h2><p className="section-intro">Free for your first month. Add your dancers, see who owes, remind each dancer on WhatsApp.</p><div className="hero-actions"><Button asChild variant="retro"><a href="/login?mode=register">Start free trial</a></Button><a className="text-link" href="#how">See how it works</a></div></div></section>
    </main><footer className="footer"><div className="wrap"><strong className="brand-line"><img className="brand-mark" src="/logo-mark.svg" alt="" width="26" height="26"/>ChoreoStudio</strong><span>Less chasing. More dancing.</span><div><a href="/login?mode=register">Start free trial</a> · <a href="/login">Log in</a> · <a href="/privacy">Privacy</a> · <a href="/terms">Terms</a> · <button type="button" className="text-link" onClick={openConsentChoice}>Cookie settings</button> · <a href="mailto:support@choreostudio.live">Contact</a></div><small>© 2026 ChoreoStudio. A tool for studio owners. Dancers: your studio will message you on WhatsApp.</small></div></footer>
  </>;
}
