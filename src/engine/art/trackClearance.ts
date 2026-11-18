/** Conservative planar clearance for scenery clusters (including hills and shrubs).
 * Curve samples must be dense: the allowance also covers the distance between samples. */
export function sceneryClearOfTrack(x:number,z:number,scale:number,hill:boolean,width:number,points:readonly {x:number;z:number}[]):boolean {
  const clusterRadius = hill ? 5.3*scale : Math.max(2.7*scale,4.1)
  const clearance = width/2 + clusterRadius + 2
  return points.every(p => (p.x-x)**2+(p.z-z)**2 > clearance**2)
}
