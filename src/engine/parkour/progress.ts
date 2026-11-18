/** Account and guest paths both use starts-of-stages (1..100), not a fictitious stage 101. */
export function countFinish(stage:number, elapsed:number|undefined, fullRun:boolean, completions:number) {
  return stage===500 && elapsed!==undefined && Number.isFinite(elapsed) && elapsed>0 && (fullRun||completions===0)
}
export type PracticeSave = {stage:number;best:number;completions:number}
export function readPractice(v:unknown):PracticeSave {
  const s=(v??{}) as Partial<PracticeSave>
  const bounded=(n:unknown,max:number)=>typeof n==='number'&&Number.isInteger(n)?Math.max(1,Math.min(max,n)):1
  const best=bounded(s.best,500)
  return {stage:bounded(s.stage,best),best,completions:best===500 && Number.isSafeInteger(s.completions)?Math.max(0,s.completions!):0}
}
