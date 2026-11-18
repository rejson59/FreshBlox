import type * as THREE from 'three'
import {Bricks} from './voxel'
import type {R6AvatarConfig} from '../../data/catalog'
export type Kit = 'street'|'court'|'away'|'rift'
/** Details attach to the moving limb, not to the world. Purchased outfits/hats remain visible. */
export function tailor(avatar:R6AvatarConfig, kit:Kit, torso:THREE.Object3D,head:THREE.Object3D,arms:THREE.Object3D[],legs:THREE.Object3D[]) {
  const clear:(()=>void)[]=[],sport=kit==='court'||kit==='away',rift=kit==='rift'
  const fabric=kit==='away'?'#793a9b':sport?'#068b91':rift?'#28768f':'#188ec9',edge=sport?'#0b505d':rift?'#22344c':'#21618c'
  if(avatar.hatId==='none'){
    const b=new Bricks(),shade=rift?'#29374f':'#433631'
    b.box(0,.35,-.015,.81,.23,.79,shade);b.box(0,.15,-.34,.8,.33,.18,shade)
    for(let i=0;i<6;i++){const x=(i%3-1)*.24,z=.23-Math.floor(i/3)*.37;b.box(x,.47+(i%2)*.04,z,.29,.26,.34,i%3===1?'#594336':shade,.08*(i%3-1),i*.1,-.2)}
    b.box(-.24,.25,.337,.28,.24,.17,shade,-.2);b.box(.32,.2,.055,.16,.27,.45,shade);clear.push(b.finish(head,true))
  }
  if(kit!=='street'||avatar.outfitId==='fresh-creator'){
    const b=new Bricks()
    b.box(0,-.52,0,1.195,.16,.65,edge)
    if(sport){
      b.box(0,.56,0,.54,.16,.65,edge);b.box(-.54,.38,0,.12,.49,.65,edge);b.box(.54,.38,0,.12,.49,.65,edge)
      const digits=kit==='away'?['111','101','111','101','111']:['110 101','001 101','111 111','100 001','111 001']
      for(const side of [-1,1])digits.forEach((line,row)=>[...line].forEach((v,col)=>{if(v==='1')b.box(side*(col-(line.length-1)/2)*.101,.3-row*.104,side*.32,.105,.106,.024,'#fff1d8')}))
    }else if(rift){
      b.box(0,.16,.326,.82,.72,.11,'#233546');b.box(0,.13,.397,.52,.09,.04,'#75e9ff');b.box(0,.21,-.33,.72,.67,.12,'#315475');b.box(0,.23,-.406,.47,.07,.045,'#6fe7ff')
    }else{
      b.box(0,.51,-.32,.82,.37,.26,'#276d9c');b.box(-.16,.35,.32,.046,.26,.04,'#fff0cc');b.box(.16,.37,.32,.046,.22,.04,'#fff0cc');b.box(0,-.29,.321,.63,.2,.045,'#287fb3')
    }
    clear.push(b.finish(torso,true))
  }
  arms.forEach(arm=>{
    const b=new Bricks();b.box(0,-.455,0,.545,.34,.551,avatar.skinColor)
    if(sport){b.box(0,.45,0,.555,.35,.56,fabric);b.box(0,-.25,0,.56,.14,.56,edge)}
    if(rift){b.box(0,.46,0,.59,.27,.59,'#435c78');b.box(0,-.24,0,.56,.12,.56,'#7bdeef')}
    clear.push(b.finish(arm,true))
  })
  legs.forEach(leg=>{
    const b=new Bricks()
    if(sport){b.box(0,.37,0,.558,.55,.57,fabric);b.box(0,-.02,0,.548,.24,.548,avatar.skinColor);b.box(0,-.2,0,.555,.16,.555,'#f6ead7')}
    b.box(0,-.5,.049,.57,.25,.68,rift?'#27364c':'#edece2');b.box(0,-.603,.057,.584,.07,.69,rift?'#69d9ef':'#ced1be');b.box(0,-.444,.312,.38,.065,.1,sport?fabric:'#c1c5c3');clear.push(b.finish(leg,true))
  })
  return {dispose:()=>clear.forEach(f=>f())}
}
