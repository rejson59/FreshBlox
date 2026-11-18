import * as THREE from 'three'
import {Bricks,cloud,island,placard,pine,vortex} from '../art/voxel'
import type {ObbyCourseData} from '../obbyCourse'

export function dressCampaign(course:ObbyCourseData,groups:THREE.Group[],pl:boolean) {
  const cleanup:(()=>void)[]=[], animate:((t:number)=>void)[][]=groups.map(()=>[])
  for(const world of course.zones) {
    const zone=world.index,group=groups[zone]
    // Small batches so the renderer can frustum-cull distant landscape on mobile.
    for(let first=world.startStage;first<=world.endStage;first+=4) {
      const b=new Bricks()
      for(let stage=first;stage<first+4;stage++) {
        const cp=course.checkpoints[stage-1]
        island(b,cp.x,cp.y-1.98,cp.z,1.04,world.trim,zone===0?'#946148':zone===2?'#698ea6':'#756077')
        for(const side of [-1,1]) {
          const k=stage+(side+1)*2, s=.95+(k%4)*.33
          const x=cp.x+side*(17+(k%4)*5),y=cp.y-3.2-(k%3)*2.8,z=cp.z-5-(k%5)*5
          island(b,x,y,z,s,zone===0?'#a4d649':world.trim,zone===0?'#b2784b':zone===1?'#b16b48':zone===2?'#689db5':'#614865')
          if(zone===0) {
            const leaf=['#ff9950','#ef7992','#f8bc3c','#e38d55'][k%4]
            b.box(x,y+2*s,z,.68*s,4*s,.75*s,'#794729');b.box(x,y+4*s,z,2.7*s,2.5*s,2.6*s,leaf)
            b.box(x+.95*s,y+3.5*s,z+.55*s,1.9*s,1.65*s,1.55*s,leaf)
            b.box(x+.43*s,y+2.9*s,z+.25*s,.42*s,1.65*s,.43*s,'#88502d',-.55)
            b.box(x-.72*s,y+4.4*s,z-.54*s,1.48*s,1.71*s,1.58*s,world.secondary)
            for(let j=0;j<5;j++){const dx=(j%3-1)*1.4*s,dz=(j*.91%2.5-1.1)*s;b.box(x+dx,y+.29*s,z+dz,.25*s,.58*s,.28*s,'#739d42');b.box(x+dx,y+.59*s,z+dz,.48*s,.21*s,.42*s,j%2?'#ffe471':'#f38b87')}
            for(let j=0;j<3;j++) b.box(x-2*s,y+(.5+j*.7)*s,z+2*s,.48*s,.7*s,.48*s,j===1?'#fff4c5':world.secondary)
          } else if(zone===1) {
            b.box(x,y+2*s,z,2.8*s,4*s,2.6*s,'#ce9257');b.box(x,y+4.2*s,z,3.4*s,.7*s,3.2*s,'#8d513b')
            const blades=new Bricks(); for(let a=0;a<4;a++){const theta=a*Math.PI/2;blades.box(-Math.sin(theta)*2.0*s,Math.cos(theta)*2*s,0,.65*s,3.4*s,.22*s,'#ffe5ad',theta)}
            const rotor=new THREE.Group();rotor.position.set(x,y+3.8*s,z+1.65*s);group.add(rotor);cleanup.push(blades.finish(rotor));animate[zone].push(t=>{rotor.rotation.z=t*.5+k})
          } else if(zone===2) {
            pine(b,x-1.9*s,y,z,s*.7,true)
            for(let j=0;j<3;j++) b.box(x+(.3+j*.82)*s,y+(1.6+j*.44)*s,z+(j%2)*s,.8*s,(3+j)*s,1.15*s,['#52cbdd','#9d90ea','#85d9ff'][j],-.22+j*.2,.4)
          } else if(zone===3) {
            for(let j=0;j<3;j++){const h=(2+j*1.55)*s; b.box(x+1.4*j*s-1.5*s,y+h/2,z,1.1*s,h,1.1*s,'#805c62');b.box(x+1.4*j*s-1.5*s,y+h,z,1.5*s,.42*s,1.45*s,'#ffad50')}
            for(let j=0;j<8;j++){const a=j*Math.PI/4;b.box(x+2*Math.cos(a)*s,y+(2+2*Math.sin(a))*s,z+1.8*s,1.3*s,1.0*s,.6*s,'#d19043',a)}
          } else {
            b.box(x,y+2.5*s,z,1.8*s,5*s,1.8*s,'#615784',0,.7);b.box(x,y+5.8*s,z,s,1.8*s,s,'#f1b8f8',.65,.6,.35)
            for(let j=0;j<12;j++){const a=j*Math.PI/6;b.box(x+3*Math.cos(a)*s,y+(4+.9*Math.sin(a))*s,z+2*Math.sin(a)*s,.8*s,.22*s,.36*s,world.accent,0,-a)}
          }
          if(k%3!==0) cloud(b,x+side*(4+k%4),y+11+(k%4)*3,z-14,1.15+s*.44)
          if(k%2===0) cloud(b,x+side*8,y-10,z+9,2.3)
        }
      }
      cleanup.push(b.finish(group))
    }
    const g=course.gates[zone], b=new Bricks()
    for(const side of [-1,1]) {
      for(let j=0;j<8;j++) b.box(g.x+side*3,g.y+.35+j*.7,g.z,.75,.7,.85,j%2===0?world.accent:'#fff5cc')
      b.box(g.x+side*3,g.y+5.88,g.z,1.12,.8,1.2,world.primary)
    }
    b.box(g.x,g.y+5.66,g.z,6.2,.28,.35,'#854e39')
    for(let j=0;j<9;j++) b.box(g.x-2.52+j*.63,g.y+5.24,g.z,.42,.53,.12,[world.primary,world.secondary,world.accent][j%3],Math.PI/4)
    cleanup.push(b.finish(group,true))
    const gate=vortex(group,g.x,g.y+2.45,g.z,2.55,2.55,g.to===null?'#ffcf57':world.trim);animate[zone].push(gate.update);cleanup.push(gate.dispose)
    const next=course.zones[zone+1],label=placard(next?(pl?next.namePl:next.nameEn):(pl?'META':'FINISH'),'#fff5d6','#784335',6.9,1.28)
    label.mesh.position.set(g.x,g.y+6.65,g.z);group.add(label.mesh);cleanup.push(label.dispose)
  }
  return {update:(zone:number,t:number)=>{for(const fn of animate[zone]) fn(t)},dispose:()=>cleanup.forEach(f=>f())}
}
