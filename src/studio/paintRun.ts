// Orthographic voxel renderer for the small guest course. No WebGL context or engine download.
import type { Island } from './course'
import { pieceInfo } from './course'
import type { Runner } from './physics'
type Pt = [number, number]
export function paintRun(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  camera: number,
  r: Runner,
  track: Island[],
  canyon = false,
) {
  const s = Math.min(w / 13.7, h / 8, 66),
    base = h * 0.63
  const pt = (x: number, y: number, z: number): Pt => [
    w * 0.29 + (x - camera - z * 0.43) * s,
    base - (y + (x - camera) * 0.075 - z * 0.38) * s,
  ]
  const poly = (pts: Pt[], color: string) => {
    ctx.fillStyle = color
    ctx.beginPath()
    for (let i = 0; i < pts.length; i++) i ? ctx.lineTo(...pts[i]) : ctx.moveTo(...pts[i])
    ctx.closePath()
    ctx.fill()
  }
  function box(
    x: number,
    y: number,
    z: number,
    dx: number,
    dy: number,
    dz: number,
    color: string,
    front: string,
    side: string,
  ) {
    const l = x - dx / 2,
      a = z - dz / 2,
      b = z + dz / 2,
      rr = x + dx / 2,
      low = y - dy
    poly([pt(rr, y, a), pt(rr, y, b), pt(rr, low, b), pt(rr, low, a)], side)
    poly([pt(l, y, b), pt(rr, y, b), pt(rr, low, b), pt(l, low, b)], front)
    poly([pt(l, y, a), pt(rr, y, a), pt(rr, y, b), pt(l, y, b)], color)
  }
  const sky = ctx.createLinearGradient(0, 0, 0, h)
  sky.addColorStop(0, '#4eb7d0')
  sky.addColorStop(0.7, '#b6e0d6')
  sky.addColorStop(1, '#fce0a9')
  ctx.fillStyle = sky
  ctx.fillRect(0, 0, w, h)
  // Distant bands and clouds move more slowly than the foreground.
  for (let layer = 0; layer < 2; layer++) {
    const size = (layer ? 144 : 110) * Math.max(0.65, s / 48),
      ox = camera * s * (layer ? 0.14 : 0.065)
    for (let i = Math.floor(ox / size) - 1; i < Math.ceil((ox + w) / size) + 1; i++) {
      const x = i * size - ox,
        peak = h * (0.23 + layer * 0.16) + Math.sin(i * 7 + layer) * h * 0.08
      poly(
        [
          [x - size, h],
          [x - size, peak + h * 0.22],
          [x - size * 0.55, peak + h * 0.22],
          [x - size * 0.55, peak + h * 0.1],
          [x - size * 0.23, peak + h * 0.1],
          [x - size * 0.23, peak],
          [x + size * 0.2, peak],
          [x + size * 0.2, peak + h * 0.13],
          [x + size * 0.6, peak + h * 0.13],
          [x + size * 0.6, h],
        ],
        layer ? '#a3cfc0' : '#a6cfd3',
      )
    }
  }
  for (let i = 0; i < 7; i++) {
    const x = ((((i * 263 - camera * s * 0.22) % (w + 190)) + w + 190) % (w + 190)) - 95,
      y = h * (0.1 + ((i * 3) % 5) * 0.054)
    ctx.fillStyle = '#f8f1d8'
    ctx.fillRect(x, y, 78, 11)
    ctx.fillRect(x + 20, y - 11, 31, 11)
  }
  // Parallax terraces: each floating mesa has a sunlit top, a sheer shaded
  // face, rock seams and a stand of conifers. Coordinates stay stable on scroll.
  const sun=ctx.createRadialGradient(w*.77,h*.12,2,w*.77,h*.12,h*.46)
  sun.addColorStop(0,'#ffefbfcc');sun.addColorStop(1,'#ffdf9b00');ctx.fillStyle=sun;ctx.fillRect(0,0,w,h)
  for(let layer=0;layer<2;layer++){
    const span=(layer?4.7:3.6)*s, scroll=camera*s*(layer?.48:.28), scale=layer?1:.65
    for(let i=Math.floor(scroll/span)-1;i<=Math.ceil((scroll+w)/span)+1;i++){
      const x=i*span-scroll+Math.sin(i*34)*span*.3, y=h*(.22+layer*.18)+Math.sin(i*13+layer)*h*.12
      const size=span*(.34+.08*Math.sin(i)), deep=size*(.84+.4*Math.sin(i*5))
      const slab=(dx:number,dy:number,sw:number,sh:number,top:string,front:string,side:string)=>{
        const xx=x+dx,yy=y+dy;poly([[xx-sw,yy],[xx,yy-sw*.25],[xx+sw*.74,yy-sw*.1],[xx-sw*.26,yy+sw*.15]],top)
        poly([[xx-sw,yy],[xx-sw*.26,yy+sw*.15],[xx-sw*.26,yy+sw*.15+sh],[xx-sw,yy+sh]],front)
        poly([[xx-sw*.26,yy+sw*.15],[xx+sw*.74,yy-sw*.1],[xx+sw*.74,yy-sw*.1+sh],[xx-sw*.26,yy+sw*.15+sh]],side)
      }
      slab(0,0,size,deep,layer?'#94ac59':'#8db5a0',layer?'#94785c':'#7fa8a4',layer?'#b59b71':'#9cb8aa')
      slab(size*.02,deep*.95,size*.69,deep*.57,'#96a995',layer?'#7d7567':'#80a6a5',layer?'#9b8971':'#8bb2aa')
      slab(0,-2,size*1.025,size*.1,layer?'#99c76a':'#a1cbb4',layer?'#64975e':'#83b5a2',layer?'#7cab66':'#94bdab')
      for(let j=0;j<3;j++){
        const xx=(j-1)*size*.42,ty=-size*.06+(j%2)*-size*.12,ts=size*(.15+.05*(j%2))*scale
        slab(xx,ty-ts*1.9,ts*.22,ts*2,'#886f4b','#705c4b','#795f4b')
        for(let k=0;k<3;k++) slab(xx,ty-ts*(1.55+.72*k),ts*(1-k*.23),ts*.83,layer?'#72a55e':'#8ab6a2',layer?'#397566':'#70a99e',layer?'#4d876a':'#7db1a0')
      }
    }
  }
  track.forEach((p, i) => {
    const sx = pt(p.x, p.top, 0)[0]
    if (sx < -5 * s || sx > w + 5 * s) return
    const width = p.width
    if(canyon && p.kind==='solid'){
      box(p.x,p.top-.08,0,width*.96,.93,2.29,'#ef9a42','#d16c2d','#b15a2e')
      box(p.x,p.top,0,width,.19,2.4,'#ffb24e','#f7913a','#da762e')
      for(const k of [-1,1])box(p.x+k*width*.32,p.top+.004,-.45,.12,.012,.58,'#ffc374','#eb9242','#e69140')
      return
    }
    box(p.x, p.top - 0.24, 0, width, 1.07, 2.35, '#998f6c', '#a8845b', '#846b51')
    box(p.x + 0.13, p.top - 1.3, 0, width * 0.72, 0.47 + (i % 3) * 0.16, 1.8, '#8e8573', '#8d7d68', '#6c695d')
    const color = p.kind === 'start' || p.kind === 'finish' ? '#99d465' : pieceInfo[p.kind].color
    box(
      p.x,
      p.top,
      0,
      width,
      0.26,
      2.4,
      color,
      p.kind === 'ice'
        ? '#5fa5bc'
        : p.kind === 'checkpoint'
          ? '#9171c4'
          : p.kind === 'bounce'
            ? '#dc6638'
            : '#6b9c4e',
      p.kind === 'ice' ? '#8acee0' : '#799454',
    )
    if (p.kind === 'bounce')
      for (const offset of [-0.55, 0, 0.55])
        box(p.x + offset, p.top + 0.018, 0, 0.19, 0.015, 1.55, '#ffecc0', '#c97b44', '#ca763b')
    if (p.kind === 'ice')
      for (const offset of [-0.9, 0.35, 0.95])
        box(p.x + offset, p.top + 0.015, -0.12, 0.11, 0.012, 1.5, '#c1f3f4', '#8ce0e6', '#aff0f2')
    if (p.kind === 'solid' || p.kind === 'start') {
      const tx = p.x - width * 0.28
      box(tx, p.top + 0.65, -0.9, 0.18, 0.65, 0.18, '#ab885d', '#8c6644', '#725338')
      box(tx, p.top + 1.05, -0.9, 0.65, 0.48, 0.62, '#88b666', '#528b55', '#659658')
      box(tx, p.top + 1.38, -0.9, 0.43, 0.38, 0.42, '#a1c872', '#649958', '#73a45d')
    }
    if (p.kind === 'checkpoint' || p.kind === 'finish') {
      const fx = p.x + 0.65
      box(fx, p.top + 1.8, -0.82, 0.07, 1.8, 0.08, '#eee2bd', '#e1d2ac', '#b6aa8f')
      poly(
        [
          pt(fx, p.top + 1.8, -0.82),
          pt(fx + 0.75, p.top + 1.68, -0.82),
          pt(fx + 0.56, p.top + 1.48, -0.82),
          pt(fx + 0.76, p.top + 1.27, -0.82),
          pt(fx, p.top + 1.35, -0.82),
        ],
        p.kind === 'finish' ? '#ff6339' : '#885abb',
      )
    }
  })
  const x = r.x,
    y = r.y,
    stride = r.ground < 0 ? 0.16 : (Math.sin(r.elapsed * 15) * 0.14 * Math.abs(r.vx)) / 6.3
  if (r.ground >= 0) {
    const [cx, cy] = pt(x, y + 0.015, 0)
    ctx.fillStyle = '#23302438'
    ctx.beginPath()
    ctx.ellipse(cx, cy, 0.44 * s, 0.12 * s, -0.08, 0, Math.PI * 2)
    ctx.fill()
  }
  // Block runner: shoes, articulated legs, hoodie, face and asymmetric hair.
  box(x+stride+.055,y+.93,-.24,.22,.42,.21,'#ffaa50','#e7772b','#c35a23')
  box(x+stride+.07,y+.58,-.24,.18,.18,.19,'#ffd09a','#e5ad82','#ce9067')
  box(x - stride, y + 0.47, -0.14, 0.23, 0.4, 0.21, '#354553', '#233340', '#374752')
  box(x - stride + 0.045, y + 0.12, -0.14, 0.32, 0.12, 0.23, '#fff5dc', '#dcd9c3', '#b7bcad')
  box(x + stride, y + 0.47, 0.14, 0.23, 0.4, 0.21, '#40525b', '#283743', '#394956')
  box(x + stride + 0.045, y + 0.12, 0.14, 0.32, 0.12, 0.23, '#fff5dc', '#ded9c6', '#b7bcad')
  box(x, y + 1.01, 0, 0.47, 0.58, 0.44, '#ffad53', '#f07737', '#c9552a')
  box(x-.14,y+1.06,-.04,.27,.23,.46,'#e47b2c','#d36a26','#ac592a')
  for(const u of [-.05,.12]) box(x+u,y+.96,.226,.029,.16,.02,'#fff2c4','#ffedce','#e5c39a')
  box(x+.05,y+.66,.23,.27,.095,.02,'#ea782b','#d46624','#ae5525')
  box(x - stride, y + 0.88, 0.28, 0.19, 0.34, 0.17, '#ffa657', '#f5853b', '#d95d2d')
  box(x - stride, y + 0.56, 0.28, 0.17, 0.15, 0.16, '#ffcb99', '#e8a679', '#d19769')
  box(x + 0.05, y + 1.46, 0, 0.46, 0.45, 0.43, '#ffd1a5', '#f2b78a', '#e2a277')
  box(x + 0.02, y + 1.55, 0, 0.52, 0.16, 0.48, '#4b403a', '#3b3436', '#282c33')
  box(x - 0.13, y + 1.43, 0.14, 0.23, 0.1, 0.2, '#433932', '#383035', '#2c2930')
  for(let j=0;j<5;j++)box(x-.16+(j%3)*.12,y+1.58+.065*(j%2),-.12+Math.floor(j/3)*.2,.18,.14,.22,j%2?'#4b392f':'#574039','#352e2c','#2b292b')
  box(x+.12,y+1.42,.2,.1,.095,.08,'#463830','#382e2d','#2b292c')
  box(x+.19,y+1.17,.219,.095,.018,.02,'#944f3a','#934f38','#944f39')
  box(x + 0.19, y + 1.31, 0.221, 0.055, 0.075, 0.014, '#323138', '#323138', '#212028')
}
