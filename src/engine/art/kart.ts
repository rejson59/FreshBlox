import {sceneryClearOfTrack} from './trackClearance'
import * as THREE from 'three'
import {Bricks,pine,cloud,placard,paintedSky} from './voxel'
import type {R6AvatarConfig} from '../../data/catalog'

/** Low-slung 17 chassis facing -Z: stepped wedge, sidepods, sidewalls, exposed axles, visor and gloves. */
export function kart(color:string,player:boolean,avatar?:R6AvatarConfig,vehicle:'kart'|'rally'|'formula'|'gt'='kart') {
  const group=new THREE.Group(),b=new Bricks(),trim=player?'#ff9828':'#aadff5',helmet=player?'#ffce25':color
  b.box(0,.35,0,1.83,.22,3.2,'#322e34');b.box(0,.51,-.1,1.36,.28,2.67,color)
  for(const side of [-1,1]){
    b.box(side*.88,.52,.06,.41,.38,1.49,color);b.box(side*.881,.73,.05,.44,.07,1.33,trim)
    b.box(side*.77,.38,-1.55,.48,.3,.34,color,0,side*.19);b.box(side*.7,.88,1.36,.13,.67,.15,'#34303a');b.box(side*1.02,1.19,1.38,.13,.34,.53,color)
    b.box(side*.33,.97,-.21,.32,.32,.72,helmet,0,side*.15,.15);b.box(side*.34,.98,-.54,.23,.22,.21,avatar?.skinColor??'#e5b482')
  }
  b.box(0,.37,-1.75,1.67,.32,.42,color);b.box(0,.38,-1.98,.42,.33,.07,trim)
  b.box(0,.65,-1.12,.72,.33,1.43,color,0,0,-.32);b.box(0,.83,-1.11,.25,.05,1.38,trim,0,0,-.32)
  b.box(0,.81,.49,.86,.91,.3,'#282636');b.box(0,1.16,1.37,2.13,.18,.46,color);b.box(0,1.263,1.37,.31,.04,.44,trim)
  b.box(0,.95,.12,.7,.73,.53,helmet);b.box(0,1.65,.13,.83,.72,.76,helmet);b.box(0,1.64,-.267,.83,.32,.12,'#272335');b.box(.39,1.64,-.13,.095,.31,.36,'#33303d');b.box(-.39,1.64,-.13,.095,.31,.36,'#33303d');b.box(0,1.51,-.331,.61,.033,.022,'#705955')
  if(vehicle==='rally'||vehicle==='gt'){
    b.box(0,1.15,.38,1.48,.55,1.05,color);b.box(0,1.43,.08,1.25,.37,.65,'#303844')
    b.box(-.79,.79,-1.14,.16,.28,1.25,trim);b.box(.79,.79,-1.14,.16,.28,1.25,trim)
  }
  if(vehicle==='formula'){
    b.box(0,.48,-2.1,2.2,.17,.42,trim);b.box(0,1.3,1.45,2.3,.17,.48,trim)
    b.box(0,.65,-1.42,.4,.4,1.7,color)
  }
  if(vehicle==='gt')b.box(0,1.35,1.5,2.2,.14,.45,trim)
  const clear=b.finish(group,true);group.userData.disposeBricks=clear
  const rubber=new THREE.MeshStandardMaterial({color:'#211e26',roughness:.87}), alloy=new THREE.MeshStandardMaterial({color:'#aaa69d',roughness:.43})
  for(const [r,len,mat] of [[.43,.38,rubber],[.226,.407,alloy],[.107,.42,rubber]] as const){const geo=new THREE.CylinderGeometry(r,r,len,16);geo.rotateZ(Math.PI/2);for(const x of [-1.03,1.03])for(const z of [-1.2,1.12]){const m=new THREE.Mesh(geo,mat);m.castShadow=true;m.position.set(x,.43,z);group.add(m)}}
  for(const face of ['hood','left','right','back']){
    const n=placard(player?'17':color==='#2685cf'?'08':'32','#252536','#fff2d6',face==='back'?.57:.44,face==='back'?.28:.32).mesh
    if(face==='hood'){n.position.set(0,.887,-1.04);n.rotation.x=-Math.PI*.5-.32;n.rotation.z=Math.PI}
    else if(face==='back'){n.position.set(-.46,1.16,1.616)}
    else {const side=face==='left'?-1:1;n.position.set(side*1.1,.51,.1);n.rotation.y=side*Math.PI/2}
    group.add(n)
  }
  return group
}
export function countryside(scene:THREE.Scene,curve:THREE.Curve<THREE.Vector3>,width:number){
  const b=new Bricks(),points=curve.getSpacedPoints(1024)
  for(let i=0;i<192;i++)for(const side of [-1,1]) {
    const edge=(j:number)=>{const p=curve.getPointAt(j/192),t=curve.getTangentAt(j/192);return new THREE.Vector3(p.x-t.z*side*width/2,.12,p.z+t.x*side*width/2)}
    const a=edge(i),z=edge(i+1),mid=a.clone().lerp(z,.5);b.box(mid.x,.095,mid.z,.87,.25,a.distanceTo(z)+.025,i%2?'#f5e8cc':'#e84937',0,Math.atan2(z.x-a.x,z.z-a.z))
  }
  for(let i=0;i<245;i++){
    const x=((i*59)%249)-123+Math.sin(i*71)*2,z=((i*127)%213)-165
    const s=1+(i%7)*.27, hill=i%4===0
    if(!sceneryClearOfTrack(x,z,s,hill,width,points))continue
    if(hill){b.box(x,1.68,z,8*s,3.5,6*s,'#c09665');b.box(x,3.66,z,8.2*s,.5,6.2*s,'#8faa4b')}
    pine(b,x,hill?3.9:0,z,s);for(let j=0;j<3;j++)b.box(x+2.2+j*.64,.46,z-.7+j*.42,1,1,1.16,['#578443','#759e48','#94ad4c'][j])
  }
  for(let i=0;i<26;i++)cloud(b,(i*81%320)-160,21+i%6*3,(i*57%260)-195,1.1+i%5*.4)
  const clear=b.finish(scene),sky=paintedSky(scene,'#6cbae1','#ffecc2');return ()=>{clear();sky.dispose()}
}
