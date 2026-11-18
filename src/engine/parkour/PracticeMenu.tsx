import {OBBY_ZONES,worldOf} from '../obbyCourse'
import type {Lang} from '../../data/locales'
export function PracticeMenu({lang,stage,best,resume,exit,visit}:{lang:Lang;stage:number;best:number;resume:()=>void;exit:()=>void;visit:(stage:number)=>void}) {
  const pl=lang==='pl'
  return <div className="fixed inset-0 z-40 grid place-items-center overflow-auto bg-slate-950/75 p-3 backdrop-blur-sm">
    <section role="dialog" aria-label={pl?'Mapa kampanii':'Campaign map'} aria-modal="true" className="my-auto w-full max-w-md rounded-2xl border border-white/20 bg-slate-950 p-4 text-white shadow-xl">
      <div className="text-[10px] font-black tracking-widest text-amber-300">PARKOUR / SOLO</div>
      <h2 className="mt-1 text-xl font-bold">{pl?'Mapa kampanii':'Campaign map'}</h2>
      <p className="my-2 text-xs text-slate-300">{pl?'Co 100 etapów wejdź w portal. Postęp gościa zostaje w tej przeglądarce.':'Enter the portal every 100 stages. Guest progress stays in this browser.'}</p>
      <ol className="space-y-1">{OBBY_ZONES.map(z=><li key={z.index}><button disabled={z.startStage>best} aria-current={z.index===worldOf(stage)?'step':undefined} onClick={()=>visit(z.startStage)} className="flex w-full items-center gap-3 rounded-lg bg-white/10 px-3 py-1.5 text-left text-sm font-bold hover:enabled:bg-white/20 disabled:opacity-50"><span className="font-mono" style={{color:z.accent}}>{String(z.index+1).padStart(2,'0')}</span>{pl?z.namePl:z.nameEn}<span className="ml-auto text-xs text-gray-300">{z.startStage}–{z.endStage}</span></button></li>)}</ol>
      <div className="mt-3 flex gap-2"><button onClick={resume} autoFocus className="rounded-lg bg-amber-300 px-4 py-2 font-bold text-slate-950">{pl?'Wznów':'Resume'}</button><button onClick={exit} className="rounded-lg border border-white/30 px-4 py-2">{pl?'Wróć do gier':'Back to games'}</button></div>
    </section>
  </div>
}
