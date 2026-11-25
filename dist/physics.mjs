export const LIMIT = 1800;
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export function matrixColor(value) {
  const v = clamp(Number(value) || 0, -1, 1);
  return v >= 0 ? `rgb(0, ${Math.round(205*v)}, ${Math.round(102*v)})` : `rgb(${Math.round(-225*v)}, ${Math.round(-52*v)}, ${Math.round(-64*v)})`;
}
export function createMatrix(n, random = Math.random, symmetric = false, candidates = null) {
  if(candidates!==null&&(!Array.isArray(candidates)||candidates.length===0||!candidates.every(v=>Number.isFinite(v)&&v>=-1&&v<=1)))throw new Error('候选系数必须是 −1～1 之间的数字，且列表不能为空');
  const next=()=>candidates===null?Math.round((random()*2-1)*100)/100:candidates[Math.floor(random()*candidates.length)];
  const m = Array.from({length:n}, () => Array.from({length:n}, next));
  if(symmetric) for(let i=0;i<n;i++) for(let j=0;j<i;j++) m[i][j]=m[j][i];
  return m;
}
export class World {
  constructor(n=6) { this.n=n; this.particles=[]; this.matrix=createMatrix(n); this.range=100; this.strength=1; this.damping=.85; this.width=1000; this.height=700; }
  add(x,y,type) { if(this.particles.length>=LIMIT) return false; this.particles.push({x:clamp(x,0,this.width),y:clamp(y,0,this.height),vx:0,vy:0,type:clamp(type,0,this.n-1)}); return true; }
  scatter(count, type=-1) { for(let i=0;i<count;i++) this.add(Math.random()*this.width,Math.random()*this.height,type<0?Math.floor(Math.random()*this.n):type); }
  step(dt=1) {
    const ps=this.particles, range=this.range, w=this.width,h=this.height;
    // A spatial grid visits only nearby particles. Opposite edges connect.
    const cols=Math.max(1,Math.floor(w/range)),rows=Math.max(1,Math.floor(h/range)),cw=w/cols,ch=h/rows;
    const grid=Array.from({length:cols*rows},()=>[]);
    ps.forEach((p,i)=>grid[Math.min(rows-1,Math.floor(p.y/ch))*cols+Math.min(cols-1,Math.floor(p.x/cw))].push(i));
    const decay=Math.pow(this.damping,dt);
    for(let i=0;i<ps.length;i++) {
      const p=ps[i],gx=Math.min(cols-1,Math.floor(p.x/cw)),gy=Math.min(rows-1,Math.floor(p.y/ch));
      let ax=0,ay=0;
      // Deduplicate cells on small screens with only one or two grid columns.
      const cells=new Set();
      for(let yy=-1;yy<=1;yy++) for(let xx=-1;xx<=1;xx++) cells.add(((gy+yy+rows)%rows)*cols+(gx+xx+cols)%cols);
      for(const cell of cells) for(const j of grid[cell]) {
        if(i===j) continue;
        const q=ps[j],coefficient=this.matrix[p.type][q.type];
        if(coefficient===0) continue;
        let dx=q.x-p.x,dy=q.y-p.y;
        if(dx>w/2)dx-=w;else if(dx<-w/2)dx+=w;
        if(dy>h/2)dy-=h;else if(dy<-h/2)dy+=h;
        const d=Math.hypot(dx,dy);
        if(d===0||d>=range)continue;
        const f=coefficient*(1-d/range)*.32*this.strength/Math.max(d,5);
        ax+=dx*f;ay+=dy*f;
      }
      p.vx=clamp((p.vx+ax*dt)*decay,-5,5);p.vy=clamp((p.vy+ay*dt)*decay,-5,5);
    }
    for(const p of ps) {p.x=((p.x+p.vx*dt)%w+w)%w;p.y=((p.y+p.vy*dt)%h+h)%h;}
  }
}
