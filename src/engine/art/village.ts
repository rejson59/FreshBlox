import * as THREE from 'three'
import { Bricks,cloud,island,pine } from './voxel'

/** A timber village on the edge of the playable island, not a background picture. */
export function village(scene:THREE.Scene) {
  const b=new Bricks()
  // Stone path grid, broken joints and an occasionally mossy slab.
  const stones=['#b2aea1','#b5bab1','#9ea9a6','#c3beab','#a5ad99']
  for(let gx=-12;gx<=12;gx++)for(let gz=-12;gz<=12;gz++) {
    if(Math.abs(gx)>1&&Math.abs(gz)>1&&Math.abs(gx)!==5&&Math.abs(gz)!==5) continue
    const k=Math.abs(gx*13+gz*7)
    b.box(gx*2.65,.21,gz*2.65,2.58,.12,2.58,stones[k%stones.length])
  }
  // Basalt fingers below the meadow. Grass fringes conceal the square deck edge.
  for(let i=0;i<40;i++) {
    const n=i%10,side=Math.floor(i/10),a=-32.7+n*7.2
    const x=side===0?-36:side===1?36:a,z=side===2?-36:side===3?36:a
    const dep=5+i*7%13
    b.box(x,-dep/2-1,z,7.4,dep,7.2,i%2?'#9a7960':'#817b71');b.box(x,-.43,z,7.7,1.15,7.5,'#82b53c')
    b.box(x*.95,-dep-1.1,z*.95,5,3.6,4.9,'#6a6f72')
    if(i%3===0) pine(b,x,0,z,1.13+(n%3)*.23)
  }
  const cottages=[[-18,-16],[18,-21],[-29,23],[29,26],[-28,-29],[30,-32]]
  cottages.forEach(([x,z],i)=>{
    b.box(x,2.25,z,7.2,4.5,6.1,'#e5b27b')
    const roof=i%2?'#536e7c':'#c35f2d'
    for(const u of [-1,1]){
      b.box(x+u*3.48,2.2,z+3.12,.45,4.45,.38,'#7e4c36');b.box(x+u*2.1,2.55,z+3.14,1.22,1.45,.15,'#52676a');b.box(x+u*2.1,2.54,z+3.24,.14,1.6,.12,'#ab7047')
      b.box(x+u*1.9,5.92,z,4.85,.55,7.55,roof,-u*.61)
    }
    for(let j=0;j<6;j++) {const w=6.9-j*1.1;b.box(x,4.6+j*.42,z,w,.42,6.2,'#d9a274')}
    b.box(x,1.35,z+3.13,1.55,2.7,.23,'#80533b');b.box(x,4.25,z+3.13,7.2,.32,.36,'#8d5838')
    b.box(x+2.3,6.1,z-1.55,.95,2.4,.94,'#98745d');b.box(x,7.22,z,.6,.4,7.6,roof)
  })
  for(const [x,z] of [[-21,-19],[-12,-19],[14,-15],[24,-19],[-19,11],[26,18]]) pine(b,x,0,z,1.25)
  for(const [x,z] of [[-7,-6],[8,-6],[6,7],[-7,6],[-19,17],[15,-19]]){
    b.box(x,.27,z,4.9,.4,3,'#6f8738');for(const s of [-1,1]){b.box(x,.55,z+s*1.5,5.1,.52,.22,'#b38b56');b.box(x+s*2.48,.55,z,.22,.52,3.2,'#ad804c')}
    for(let j=0;j<15;j++){const px=x+(j%5-2)*.78,pz=z+(Math.floor(j/5)-1)*.82;b.box(px,.78,pz,.16,.74,.16,'#4c8c39');b.box(px,1.14+(j%2)*.14,pz,.43,.28,.42,['#f3ab28','#e56558','#ffe78e','#b391e3'][j%4])}
  }
  for(let i=0;i<12;i++){const a=i*Math.PI/6, x=92*Math.cos(a),z=92*Math.sin(a);island(b,x,-4+i%3*3,z,2.8,'#82ab60','#868a88');pine(b,x+2,-4+i%3*3,z,2.2);cloud(b,x*.77,13+i%4*2,z*.73,1.9)}
  // Square stepped travertine basin, turquoise spillways and falling water.
  b.box(0,.42,0,8.2,.36,8.2,'#b1c7b0');b.box(0,.77,0,6,.56,6,'#36c6cf');b.box(0,1.4,0,2.7,1.36,2.7,'#289ca9')
  for(let j=0;j<16;j++){const a=j*Math.PI/8;b.box(3.68*Math.cos(a),.87,3.68*Math.sin(a),1.4,.78,.74,'#60dce3',0,Math.PI/2-a)}
  b.box(0,1.85,0,3.65,.43,3.65,'#77eff0');b.box(0,2.45,0,1.48,1.15,1.48,'#3ab9ca');b.box(0,3.16,0,2.28,.4,2.28,'#81ebef');b.box(0,3.75,0,.68,1.32,.68,'#69e5eb')
  const clear=b.finish(scene), streams=new Bricks()
  for(let i=0;i<24;i++){const a=i*Math.PI/12,r=i%2?1.5:.89;streams.box(r*Math.sin(a),i%2?1.41:2.57,r*Math.cos(a),.22,i%2?1.0:1.08,.22,i%3?'#82eeed':'#c9ffff')}
  const water=new THREE.Group();scene.add(water);const clearWater=streams.finish(water)
  return {cottages, update:(t:number)=>{water.scale.y=1+.043*Math.sin(t*3.7);water.rotation.y=.035*Math.sin(t*2)}, dispose:()=>{clear();clearWater();water.removeFromParent()}}
}
