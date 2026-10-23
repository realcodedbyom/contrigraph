'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import gsap from 'gsap';
import Lenis from 'lenis';
import CountUp from './CountUp';
import SignalShader from './SignalShader';
import CornerButton from './CornerButton';

export function ProductMotion() {
  useEffect(() => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const lenis = new Lenis({ duration: .7, anchors: true });
    const tick = (seconds: number) => lenis.raf(seconds * 1000);
    gsap.ticker.add(tick);
    return () => { gsap.ticker.remove(tick); lenis.destroy(); };
  }, []);
  return null;
}

export default function ProductExperience() {
  const [view, setView] = useState<'Schedule' | 'Recovery'>('Schedule');
  const [preview, setPreview] = useState(false);
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!panel.current || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const tween = gsap.fromTo(panel.current, { y: 5 }, { y: 0, duration: .28, ease: 'power2.out' });
    return () => { tween.kill(); };
  }, [view, preview]);
  const moved = view === 'Recovery' && preview;
  return <div className="experience-shell">
    <div className="experience-toolbar"><span className="experience-project">Campus launch <small>Illustrative workspace</small></span><span className="experience-status">Planning this week</span></div>
    <div className="experience-tabs" role="tablist" aria-label="Explore product preview">{(['Schedule','Recovery'] as const).map(v=><button key={v} type="button" role="tab" id={'tab-'+v} aria-controls="experience-panel" aria-selected={view===v} onClick={()=>setView(v)}>{v === 'Schedule' ? 'Team capacity' : 'Test a recovery'}<span>{v==='Schedule'?'01':'02'}</span></button>)}</div>
    <div ref={panel} id="experience-panel" role="tabpanel" aria-labelledby={'tab-'+view} className="experience-panel">
      <div className="experience-heading"><div><p>THE WEEK AHEAD</p><h2>{moved ? 'A little breathing room.' : 'A clear view of the load.'}</h2></div><span className="experience-week">MON—FRI</span></div>
      <div className="capacity-table"><div className="capacity-labels"><span>Member / expertise</span><span>Planned / available</span></div>{[{name:'Alex',skill:'Backend specialist',hours:moved?12:20,capacity:16},{name:'Sam',skill:'Interface & testing',hours:moved?14:6,capacity:16},{name:'Jo',skill:'Research & documentation',hours:10,capacity:12}].map(p=><div className="capacity-person" key={p.name}><div className="capacity-person-info"><span className="capacity-avatar">{p.name[0]}</span><div><strong>{p.name}</strong><small>{p.skill}</small></div><span className={p.hours>p.capacity?'capacity-warning':''}>{p.hours}h / {p.capacity}h</span></div><div className="capacity-track" aria-label={`${p.name}: ${p.hours} hours planned against ${p.capacity} available`}><span style={{width:Math.min(p.hours/p.capacity*100,100)+'%',background:p.hours>p.capacity?'#cb5934':'#738966'}}/></div></div>)}</div>
      <div className="experience-decision"><span className="decision-index">↳</span><div><strong>{moved ? 'Testing moves. Backend ownership stays.' : 'One specialist. Two ways to protect their time.'}</strong><p>{moved ? 'In this example, moving 8h of testing to Sam brings both members within capacity. The specialist keeps the API task.' : 'Alex is the only backend specialist. Keep the API with Alex and preview moving testing to a qualified teammate.'}</p></div></div>
      {view==='Recovery' ? <div className="experience-recovery"><CornerButton accentColor="#d9653d" showIcon={false} onClick={()=>setPreview(!preview)}>{preview ? 'Reset example' : 'Preview redistribution'}</CornerButton><span role="status">{preview ? 'Example only. No project data changed.' : 'No changes until a real preview is approved.'}</span></div> : <button className="experience-switch" onClick={()=>setView('Recovery')}>What could we change? <span>Explore recovery →</span></button>}
    </div>
    <div className="experience-bottom"><span><CountUp to={44} duration={.8} suffix="h"/> <small>Team capacity</small></span><span><CountUp to={36} duration={.8} suffix="h"/> <small>Planned effort</small></span><Link href="/help#workload">How planning works ↗</Link></div>
  </div>;
}

export function ProductSignal() {
  const scene = process.env.NEXT_PUBLIC_SPLINE_SCENE;
  const [loadScene, setLoadScene] = useState(false);
  // A published Spline embed URL is optional; never load an arbitrary third-party scene.
  const splineUrl = scene && /^https:\/\/my\.spline\.design\/[a-zA-Z0-9/_-]+\/?$/.test(scene) ? scene : '';
  return <div className="product-signal"><SignalShader/><div><p>LESS GUESSWORK. MORE ROOM TO BUILD.</p><h2>Make the connections.<br/>Find a way forward.</h2></div>{splineUrl && (loadScene ? <iframe src={splineUrl} title="ContriGraph interactive 3D scene" loading="lazy" referrerPolicy="no-referrer" sandbox="allow-scripts allow-same-origin"/> : <button onClick={()=>setLoadScene(true)}>Explore the 3D scene ↗</button>)}</div>;
}
