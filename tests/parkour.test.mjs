import assert from 'node:assert/strict'
import test from 'node:test'
import { generateTestObbyCourse, nextCheckpoint, enteredGate, tuning, worldOf } from '../src/engine/obbyCourse.ts'
import { routes } from '../src/engine/parkour/routes.ts'
import { countFinish, readPractice } from '../src/engine/parkour/progress.ts'
import { worlds } from '../src/data/worlds.ts'
const course = generateTestObbyCourse()

test('five worlds, 500 distinct playable scores (ignoring turns, palette, spacing and names)', () => {
  assert.deepEqual(course, generateTestObbyCourse())
  assert.equal(worlds.obby.name.pl,'Parkour');assert.equal(worlds.obby.name.en,'Parkour');assert.equal(worlds.obby.room,'OBBY-1')
  assert.deepEqual(routes.map(w=>w.length),[20,20,20,20,20]);assert.equal(course.checkpoints.length,500)
  for(const key of ['titlePl','titleEn'])assert.equal(new Set(course.checkpoints.map(cp=>cp[key])).size,500)
  assert.equal(new Set(routes.flat().map(([,,score])=>score.replace(/[<>]/g,''))).size,100)
  const blockSignatures = new Set()
  course.checkpoints.forEach((cp,index)=>{
    assert.equal(cp.stage,index+1);assert.equal(cp.zone,Math.floor(index/100))
    const blocks=course.blocks.filter(b=>b.stage===cp.stage)
    assert.equal(blocks[0].checkpointStage,cp.stage);assert.ok(blocks.length>=4)
    // Compare translated, unpainted geometry; remove absolute dimensions and stage IDs.
    blockSignatures.add(blocks.slice(1).map((b,i)=>[b.kind,Math.sign(b.x-blocks[i].x),Math.sign((b.y+b.h/2)-(blocks[i].y+blocks[i].h/2)),Math.sign(b.w-b.d),b.moveAxis,b.spinnerCross].join(':')).join('|'))
  })
  assert.equal(blockSignatures.size,500)
})

test('every gap has a reachable landing inside a walking jump arc, even at adverse ferry phase',()=>{
  const top=b=>b.y+b.h/2,amp=(b,axis)=>b.moveAxis===axis?b.moveAmp:0
  for(const cp of course.checkpoints){
    const stage=cp.stage,blocks=course.blocks.filter(b=>b.stage===stage&&!['hazard','pusher','spinner'].includes(b.kind))
    if(stage%100!==0)blocks.push(course.blocks.find(b=>b.checkpointStage===stage+1))
    // Split routes can be taken on either side; check all edges between successive landing rows.
    const rows=[];for(const b of blocks){if(rows.at(-1)?.[0].z===b.z)rows.at(-1).push(b);else rows.push([b])}
    for(let j=1;j<rows.length;j++)for(const a of rows[j-1])for(const b of rows[j]){
      const jump=['bounce','jumppad'].includes(a.kind)?a.jumpVel:13.8
      const dy=top(b)-top(a)+amp(a,'y')+amp(b,'y')
      const flight=(jump+Math.sqrt(jump*jump-68*dy))/34
      // Inscribe a box in a circular landing, reserve room for feet and run-up.
      const inset=b=>['pillar','bounce'].includes(b.kind)?Math.SQRT1_2:1
      const gap=(axis,dim)=>Math.max(0,Math.abs(b[axis]-a[axis])-(a[dim]*inset(a)+b[dim]*inset(b))/2+amp(a,axis)+amp(b,axis)+.5)
      assert.ok(Math.hypot(gap('x','w'),gap('z','d'))+1<flight*11.4,`unreachable ${a.id} -> ${b.id}`)
    }
    if(stage>1){const before=tuning(stage-1),now=tuning(stage);assert.ok(now.gap>before.gap&&now.pad<before.pad&&now.tempo>before.tempo)}
  }
})

test('campaign advances in order; four spatial gates, one final goal beyond stage 500',()=>{
  assert.deepEqual(course.gates.map(g=>[g.stage,g.to]),[[100,101],[200,201],[300,301],[400,401],[500,null]])
  let stage=1,warps=0
  for(const cp of course.checkpoints){
    assert.equal(cp.stage,stage);assert.ok(!nextCheckpoint(stage,stage+2));assert.ok(!nextCheckpoint(stage,stage-1))
    const gate=course.gates[worldOf(stage)]
    assert.equal(enteredGate(gate,stage,cp),false)
    if(stage!==gate.stage){assert.ok(nextCheckpoint(stage,stage+1));stage++;continue}
    assert.ok(!nextCheckpoint(stage,stage+1));assert.ok(gate.z<cp.z-20)
    assert.ok(!enteredGate(gate,stage-1,gate));assert.ok(!enteredGate(gate,stage,{...gate,x:gate.x+3}));assert.ok(!enteredGate(gate,stage,{...gate,y:gate.y+5}))
    assert.ok(!enteredGate(gate,stage,{...gate,z:gate.z+2}));assert.ok(enteredGate(gate,stage,gate))
    if(gate.to){stage=gate.to;warps++;const spawn=course.checkpoints[stage-1];assert.ok(Math.abs(spawn.x-gate.x)>1000);assert.ok(!enteredGate(gate,stage,spawn))}
  }
  assert.equal(stage,500);assert.equal(warps,4)
})

test('resuming at the last checkpoint is not a finish; old unlocks survive local practice validation',()=>{
  assert.deepEqual(readPractice({stage:50,best:77,completions:0}),{stage:50,best:77,completions:0})
  assert.deepEqual(readPractice({stage:77,best:20}),{stage:20,best:20,completions:0});assert.equal(readPractice({stage:'100',best:NaN}).stage,1)
  for(const ms of [undefined,NaN,0])assert.equal(countFinish(500,ms,true,0),false)
  assert.equal(countFinish(499,20000,true,0),false);assert.equal(countFinish(500,20000,false,0),true)
  assert.equal(countFinish(500,20000,false,1),false);assert.equal(countFinish(500,20000,true,1),true)
})

test('migration keeps legacy best times while storing 500-stage times independently', async()=>{
  const {PGlite}=await import('@electric-sql/pglite')
  const {readFile}=await import('node:fs/promises')
  const db=new PGlite()
  try {
    await db.exec('CREATE TABLE public.fb_profiles (id integer primary key, obby_best_time_ms integer); INSERT INTO public.fb_profiles VALUES (1,12345);')
    const migration=await readFile(new URL('../supabase/migrations/202611180002_parkour_500.sql',import.meta.url),'utf8')
    await db.exec(migration);await db.exec(migration)
    await db.exec('UPDATE public.fb_profiles SET parkour_500_best_time_ms=50000 WHERE id=1')
    const result=await db.query('SELECT obby_best_time_ms, parkour_500_best_time_ms FROM public.fb_profiles')
    assert.deepEqual(result.rows,[{obby_best_time_ms:12345,parkour_500_best_time_ms:50000}])
  } finally {await db.close()}
})
