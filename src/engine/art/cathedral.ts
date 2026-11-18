import * as THREE from 'three'
import { Bricks } from './voxel'
/** Open-sided basalt walkways below a continuous, portalable aether-glass floor. */
export function cathedral(scene:THREE.Scene,half:number) {
  const b=new Bricks(), clean:(()=>void)[]=[]
  const stone=['#332947','#423352','#433758','#392e4b']
  for(let i=-5;i<=5;i++)for(let j=-5;j<=5;j++) {
    const x=i*4.45,z=j*4.45,k=Math.abs(i*11+j*7)
    const bridge=i===0||j===0||Math.abs(i)===3||Math.abs(j)===3||Math.abs(i)===5||Math.abs(j)===5
    if(bridge){b.box(x,-.53,z,4.39,1.0,4.39,stone[k%4]);b.box(x,-1.96,z,3.87,2.0,3.87,'#312543');b.box(x-.25,-3.1-k%4*.6,z,2.35,2.4+k%4,2.65,'#241c38')}
    else {b.box(x,-10-k%5,z,1.5,8,1.8,'#57426b');b.box(x,-.08,z,4.3,.07,.045,'#826ba2');b.box(x,-.08,z,.045,.07,4.3,'#826ba2')}
  }
  for(let i=-2;i<=2;i++)for(const s of [-1,1]){b.box(i*8.9,-.012,s*1.92,8.6,.03,.12,i%2?'#64dbe3':'#d88cee');b.box(s*1.92,-.012,i*8.9,.12,.03,8.6,'#6ac8dc')}
  clean.push(b.finish(scene));
  // Pointed voussoirs, recessed jambs and staggered stone courses on each wall.
  for(let side=0;side<4;side++){
    const wall=new THREE.Group();wall.rotation.y=side*Math.PI/2;scene.add(wall);const b=new Bricks()
    for(let row=0;row<14;row++)for(let j=0;j<13;j++){
      const x=-25.5+4*j+(row%2)*1.9
      if(Math.abs(x)<23.8) b.box(x,row*1.68+.84,-half+.009,3.91,1.6,.034,stone[(j+row)%4])
    }
    for(const cx of [-10,10]){
      const tint=cx<0?'#537599':'#80537e'
      for(const dir of [-1,1]){
        for(let pillar=0;pillar<3;pillar++) {
          const px=cx+dir*(6.25+pillar*.65);b.box(px,5,-half+.08+pillar*.02,.52,10,.23,tint);b.box(px,.62,-half+.13,.87,1.24,.33,'#605273');b.box(px,9.8,-half+.17,.78,.86,.35,'#70587e')
        }
        for(let rim=0;rim<3;rim++) for(let i=0;i<14;i++){
          const point=(n:number)=>{const u=n/14;return [cx+dir*(6.35+rim*.72)*(1-u*u),9.6+(7.5+rim*.85)*u]}
          const a=point(i),d=point(i+1),dx=d[0]-a[0],dy=d[1]-a[1]
          b.box((a[0]+d[0])/2,(a[1]+d[1])/2,-half+.12+rim*.03,.64,Math.hypot(dx,dy)*.95,.3,rim===1?tint:stone[(i+rim)%4],-Math.atan2(dx,dy))
        }
      }
      for(let k=0;k<4;k++) b.box(cx,18.1+k*.85,-half+.12,1.4-k*.25,.7,.27,'#68587f',.785)
    }
    clean.push(b.finish(wall));clean.push(()=>wall.removeFromParent())
  }
  const pos=new Float32Array(270*3)
  for(let i=0;i<270;i++){pos[3*i]=Math.sin(i*123.44)*32;pos[3*i+1]=-8-(i%19);pos[3*i+2]=Math.sin(i*85.2)*41}
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.BufferAttribute(pos,3));const mat=new THREE.PointsMaterial({color:'#cf98ff',size:.13});const dust=new THREE.Points(geo,mat);scene.add(dust)
  return ()=>{clean.forEach(f=>f());dust.removeFromParent();geo.dispose();mat.dispose()}
}
