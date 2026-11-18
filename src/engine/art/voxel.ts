import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'

/** Paint static set dressing in local coordinates. Hundreds of coloured bricks share one draw call. */
export class Bricks {
  private pieces: {m:THREE.Matrix4;c:THREE.Color}[] = []
  private pen = new THREE.Object3D()
  box(x:number,y:number,z:number,w:number,h:number,d:number,color:string,rz=0,ry=0,rx=0) {
    const p = this.pen
    p.position.set(x,y,z); p.scale.set(w,h,d); p.rotation.set(rx,ry,rz); p.updateMatrix()
    this.pieces.push({m:p.matrix.clone(),c:new THREE.Color(color)})
  }
  finish(parent: THREE.Object3D, bevel=false) {
    const geo = bevel ? new RoundedBoxGeometry(1,1,1,1,.045) : new THREE.BoxGeometry()
    const mat = new THREE.MeshStandardMaterial({roughness:.86,metalness:0,flatShading:true})
    const m=new THREE.InstancedMesh(geo,mat,this.pieces.length)
    this.pieces.forEach(({m:matrix,c},i)=>{m.setMatrixAt(i,matrix);m.setColorAt(i,c)})
    this.pieces=[]; m.castShadow=true; m.receiveShadow=true; m.computeBoundingSphere(); parent.add(m)
    return ()=>{m.removeFromParent();m.dispose();geo.dispose();mat.dispose()}
  }
}
export function pine(b:Bricks,x:number,y:number,z:number,s:number,icy=false) {
  b.box(x,y+1*s,z,.64*s,2*s,.65*s,'#785235')
  for(let k=0;k<4;k++) {
    const w=(3.3-k*.67)*s
    b.box(x+Math.sin(k*4)*.12*s,y+(1.9+k*.9)*s,z,w,1.25*s,w*.95,icy?['#497d75','#6bafa0','#acdcd1','#f3faff'][k]:['#34713a','#518d36','#6ba22e','#91bd43'][k],0,.12)
  }
}
export function cloud(b:Bricks,x:number,y:number,z:number,s:number) {
  for(const [dx,dy,dz,w,h,d] of [[0,0,0,6,1.45,2.5],[-1.25,.65,0,2.9,2.1,2.3],[.8,1.15,-.2,2.35,2.4,2.8],[2.8,.15,.25,2.6,1.65,1.8]])
    b.box(x+dx*s,y+dy*s,z+dz*s,w*s,h*s,d*s,'#fff9e9')
}
export function island(b:Bricks,x:number,y:number,z:number,s:number,grass:string,rock:string) {
  b.box(x,y-.38*s,z,7.1*s,.8*s,6.1*s,grass)
  b.box(x+.08*s,y-1.5*s,z,6.75*s,1.6*s,5.75*s,rock)
  b.box(x-.5*s,y-2.9*s,z+.2*s,4.9*s,1.5*s,4.7*s,rock)
  b.box(x+.1*s,y-4.1*s,z,2.8*s,1.3*s,3.2*s,rock)
  for(let k=0;k<4;k++)b.box(x+(-2.3+1.3*k)*s,y-(1.5+k%2)*s,z+(2.3-.19*(k%3))*s,1.05*s,(1+k%2)*s,1.2*s,rock,.08*(k%3-1))
  b.box(x-.2*s,y-5.1*s,z-.15*s,1.3*s,.95*s,1.5*s,rock)
}
/** Directional sky gradient: independent of camera translation, including portal teleports. */
export function paintedSky(scene:THREE.Scene,top:string,bottom:string) {
  const uniforms = {zenith:{value:new THREE.Color(top)},horizon:{value:new THREE.Color(bottom)}}
  const mat=new THREE.ShaderMaterial({uniforms,depthWrite:false,depthTest:false,side:THREE.BackSide,
    vertexShader:`varying vec3 ray;void main(){ray=position;vec4 clip=projectionMatrix*vec4(mat3(viewMatrix)*position,1.0);gl_Position=clip.xyww;}`,
    fragmentShader:`varying vec3 ray;uniform vec3 zenith;uniform vec3 horizon;void main(){vec3 d=normalize(ray);float g=smoothstep(-.43,.48,d.y);vec3 c=mix(horizon,zenith,g);float glow=max(0.,dot(d,normalize(vec3(.52,.25,-.85))));c+=vec3(.7,.47,.21)*pow(glow,32.);gl_FragColor=vec4(c,1.);
    #include <colorspace_fragment>
    }`})
  const geo=new THREE.SphereGeometry(1,24,12),mesh=new THREE.Mesh(geo,mat)
  mesh.frustumCulled=false;mesh.renderOrder=-100;scene.add(mesh)
  return {set:(a:string,b:string)=>{uniforms.zenith.value.set(a);uniforms.horizon.value.set(b)},dispose:()=>{geo.dispose();mat.dispose();mesh.removeFromParent()}}
}
/** Readable from either side; labels are a texture only, never a flat substitute for scenery. */
export function placard(text:string,ink:string,bg:string,w:number,h:number) {
  const c=document.createElement('canvas');c.width=512;c.height=128
  const ctx=c.getContext('2d')!;ctx.fillStyle=bg;ctx.fillRect(0,0,512,128);ctx.fillStyle=ink;ctx.textAlign='center';ctx.textBaseline='middle';ctx.font='900 74px system-ui,sans-serif';ctx.fillText(text,256,62,482)
  const tex=new THREE.CanvasTexture(c);tex.colorSpace=THREE.SRGBColorSpace
  const m=new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshBasicMaterial({map:tex,side:THREE.DoubleSide}))
  return {mesh:m,dispose:()=>{tex.dispose();m.material.dispose();m.geometry.dispose();m.removeFromParent()}}
}
/** Swirling luminous aperture, transparent in its centre. */
export function vortex(parent:THREE.Object3D,x:number,y:number,z:number,rx:number,ry:number,color:string) {
  const mat=new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.DoubleSide,uniforms:{t:{value:0},ink:{value:new THREE.Color(color)}},
    vertexShader:`varying vec2 p;void main(){p=uv*2.-1.;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader:`varying vec2 p;uniform float t;uniform vec3 ink;void main(){float r=length(p);if(r>1.)discard;float a=atan(p.y,p.x);float w=.5+.5*sin(a*6.-r*23.+t*2.+sin(a*3.+r*12.-t));float rim=exp(-19.*abs(r-.91));float threads=pow(w,4.)*(.25+r*.75);vec3 c=mix(ink*.33,ink*1.5+vec3(.4),clamp(rim+threads*.5,0.,1.));gl_FragColor=vec4(c,min(1.,.18+rim+threads*.6));
    #include <colorspace_fragment>
    }`})
  const geo=new THREE.PlaneGeometry(2*rx,2*ry),m=new THREE.Mesh(geo,mat);m.position.set(x,y,z);parent.add(m)
  return {mesh:m,update:(t:number)=>{mat.uniforms.t.value=t},dispose:()=>{geo.dispose();mat.dispose();m.removeFromParent()}}
}
