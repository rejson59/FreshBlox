import * as THREE from 'three'
import { Bricks,paintedSky } from './voxel'
export function sunsetStadium(scene:THREE.Scene,half:number) {
  const sky=paintedSky(scene,'#f28680','#ffd18c'), b=new Bricks()
  // Grandstands and crowds sit *outside* the disc/camera boundary. Open roof.
  for(let side=0;side<4;side++){
    const rot=side*Math.PI/2, c=Math.cos(rot),s=Math.sin(rot)
    const box=(x:number,y:number,z:number,w:number,h:number,d:number,col:string)=>b.box(x*c+z*s,y,-x*s+z*c,w,h,d,col,0,rot)
    for(let row=0;row<6;row++){
      const z=-(half+1+row*1.5),y=.7+row*1.04
      box(0,y*.5,z,half*2+row*1.5,y,1.8,row%3?'#b75f42':'#d99861');box(0,y+.15,z-.2,half*2+row*1.5,.3,.8,'#287e83')
      for(let k=-14;k<=14;k++){
        if(k%8===0)continue
        const x=k*(1.7+row*.042),i=Math.abs(k*5+row*7+side*9),shirt=['#1b8e93','#f1a03f','#76547e','#f8c95d','#ce6145','#4678a3'][i%6],skin=['#e7b078','#ae7852','#ffd39d'][i%3]
        box(x,y+.52,z,.72,.8,.5,shirt);box(x,y+1.19,z,.56,.55,.54,skin);box(x-.02,y+1.48,z-.03,.6,.16,.55,i%4?'#55413a':'#ca8a4e');box(x-.14,y+1.24,z+.28,.065,.09,.04,'#3c3036');box(x+.13,y+1.24,z+.28,.065,.09,.04,'#3c3036')
      }
    }
    // Boxes and press galleries over the seating bowl.
    for(let k=-2;k<=2;k++){box(k*12,8.3,-37,10,4.6,3.5,'#b76344');box(k*12,8.8,-35.17,7.9,1.8,.25,'#386a75');box(k*12,7.67,-35,9.8,.36,.65,'#edaa6b');box(k*12,10.75,-37,10.9,.52,4.35,'#288e91')}
    for(const x of [-23,23]){box(x,9,-35,.32,9,.32,'#6c6159');box(x,13.5,-35,3.6,1.35,.6,'#69564e');for(let j=0;j<4;j++)box(x-1.23+j*.82,13.5,-34.62,.58,.7,.12,'#ffecbb')}
  }
  // Court paint: coloured end zones, touch lines, centre and key markings.
  for(const side of [-1,1]) {
    b.box(0,.012,side*19,49,.018,11.4,side>0?'#3d9abc':'#ca9947'); b.box(0,.025,side*24.5,49.2,.02,.2,'#fff4d1');b.box(side*24.5,.025,0,.2,.02,49,'#fff4d1');b.box(0,.028,side*13.3,49,.024,.18,'#fff4d1')
  }
  b.box(0,.032,0,49,.025,.24,'#fff1d4');for(let j=0;j<48;j++){const a=j*Math.PI/24;b.box(4.8*Math.sin(a),.03,4.8*Math.cos(a),.66,.035,.18,'#fff1d6',0,a)}
  for(let j=0;j<24;j++){const a=j*Math.PI/12,r=60+(j%3)*6;for(let k=0;k<3;k++){const h=6+(j*13%11)-k*1.3;b.box(r*Math.cos(a),h/2+k*.7,r*Math.sin(a),15-k*3,h,14-k*2,'#956d66',0,a)}}
  const clear=b.finish(scene)
  return {setNight:(n:boolean)=>sky.set(n?'#292749':'#f48b83',n?'#856379':'#ffd596'),dispose:()=>{sky.dispose();clear()}}
}
