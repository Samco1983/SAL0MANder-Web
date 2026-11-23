// Voltage Works uses the Unity course score, fixed timestep and hitboxes.
export const STEP=1/120, SPEED=390, CUBE=84, BEAT=60/140;
const FOOT=CUBE/2-5, accentBeats=[32,112,224,304,384];
export const LEDGE={from:260,to:1720,h:280,superV:1300,window:12};
export const sectors=['Freight Yard','Signal Bridge','Turbine Hall','Blackout Tunnel','Reactor Core','Daybreak Run'];
export class Circuit {
  constructor(score) {
    this.duration=score.duration;
    this.accents=score.accents;
    this.gates=[]; this.cues=[]; this.total=0;
    const place=(kind,x,w,h,teeth=0,base=0,prism=false,high=false)=>{
      this.gates.push({kind,x,w,h,teeth,base,prism,high,got:false,tripped:false});
      if(prism)this.total++;
    };
    let count=0;
    score.rows.forEach((row,r)=>[...row].forEach((mark,c)=>{
      if(mark==='.')return;
      const beat=r*16+c, accent=accentBeats.indexOf(beat);
      const t=accent>=0?this.accents[accent]:(beat+([5,10].includes(c)?.25:0))*BEAT+.055;
      if(t+1>=this.duration)return;
      const x=t*SPEED,prism=count++%4===0||accent>=0;
      if(mark!=='^')this.cues.push(t);
      switch(mark){
        case 'G':place('deck',x+101,376,66);this.cues.push(t+2*BEAT);place('spike',(t+2*BEAT)*SPEED+82,58,50,2,66,true);break;
        case '^':place('pad',x-20,46,10);place('spike',x+81,98,59,3,0,true,true);break;
        case '_':place('gap',x+45,155,0,0,0,prism);break;
        case 'o':place('saw',x+85,72,72,0,0,prism);break;
        case 'b':place('deck',x+94,123,54,0,0,prism);break;
        default:{const n=Number(mark);place('spike',x+121-n*16,n*32,48+n*3,n,0,prism);}
      }
    }));
    this.gates.sort((a,b)=>a.x-b.x);
    // Upper routes (Nov 23): after each spring, a floating one-way ledge high above the saw and the next hazard.
    // Only a SUPER bounce (tap jump right after the spring fires) reaches it; everyone else runs underneath, unchanged.
    this.ledges=this.gates.filter(g=>g.kind==='pad').map(p=>({x:p.x+LEDGE.from,w:LEDGE.to-LEDGE.from,h:LEDGE.h}));
    // Preserve the exact airborne or grounded state on the first tick at 50%.
    this.halfTick=Math.ceil(this.duration*.5/STEP);
    this.halfX=this.halfTick*STEP*SPEED;
    this.reset();
  }
  reset(save=null){
    this.tick=save?this.halfTick:0;this.y=0;this.v=0;this.angle=0;
    this.grounded=true;this.buffer=0;this.dead='';this.finished=false;this.first=0;this.jumps=0;
    this.prisms=0;this.shield=!!save?.shield;this.shieldBreak=0;this.clearedGate=null;this.padTick=null;
    this.gates.forEach((g,i)=>{g.got=!!save&&save.collected.includes(i);g.tripped=!!save&&save.pads.includes(i);if(g.got)this.prisms++;});
    if(save){
      this.y=save.y;this.v=save.v;this.angle=save.angle;this.grounded=save.grounded;
      this.buffer=save.buffer;this.clearedGate=this.gates[save.cleared]||null;
    }
  }
  get time(){return this.tick*STEP;}
  get x(){return this.time*SPEED;}
  get section(){return this.accents.filter(t=>t<=this.time).length;}
  get progress(){return Math.min(1,this.time/this.duration);}
  snapshot(){return {collected:this.gates.flatMap((g,i)=>g.got?[i]:[]),pads:this.gates.flatMap((g,i)=>g.tripped?[i]:[]),
    shield:this.shield,y:this.y,v:this.v,grounded:this.grounded,angle:this.angle,buffer:this.buffer,cleared:this.gates.indexOf(this.clearedGate)};}
  validSave(s){
    return !!s&&typeof s.shield==='boolean'&&typeof s.grounded==='boolean'&&
      [s.y,s.v,s.angle,s.buffer].every(Number.isFinite)&&Number.isInteger(s.cleared)&&s.cleared>=-1&&s.cleared<this.gates.length&&
      Array.isArray(s.collected)&&s.collected.every(i=>Number.isInteger(i)&&this.gates[i]?.prism&&this.gates[i].x<this.halfX+FOOT)&&
      Array.isArray(s.pads)&&s.pads.every(i=>Number.isInteger(i)&&this.gates[i]?.kind==='pad');
  }
  jump(){this.buffer=.12;}
  // Super bounce: called when the player taps within LEDGE.window ticks after a spring fires (still rising).
  spring(){if(this.padTick!=null&&this.tick-this.padTick<=LEDGE.window&&this.v>0){this.v=Math.max(this.v,LEDGE.superV);this.padTick=null;return true;}return false;}
  land(h){this.y=h;this.v=0;this.grounded=true;}
  advance(){
    if(this.dead||this.finished)return;
    if(this.buffer>0&&this.grounded){this.v=820;this.grounded=false;this.jumps++;this.buffer=0;}
    this.buffer=Math.max(0,this.buffer-STEP);this.tick++;
    const left=this.x-FOOT,right=this.x+FOOT,prev=this.y;
    this.v-=2600*STEP;this.y+=this.v*STEP;this.grounded=false;let floor=true;
    while(this.first<this.gates.length&&this.gates[this.first].x+this.gates[this.first].w<left-48)this.first++;
    for(let i=this.first;i<this.gates.length&&this.gates[i].x<right+32;i++){
      const g=this.gates[i],center=g.x+g.w/2;
      if(g.prism&&!g.got&&Math.abs(this.x-center)<FOOT+12&&Math.abs(this.y+CUBE/2-(g.base+(g.high?199:164)))<CUBE/2+10){
        g.got=true;this.prisms++;if(this.prisms%5===0)this.shield=true;
      }
      if(right<=g.x||left>=g.x+g.w||this.clearedGate===g)continue;
      if(g.kind==='gap'){
        if((left>=g.x&&right<=g.x+g.w)||(this.y< -2&&prev<0))floor=false;
        if(this.y< -19)this.dead='Missed the far ledge';
      }else if(g.kind==='pad'){
        if(!g.tripped&&this.y<=10&&this.v<=0){g.tripped=true;this.y=Math.max(0,this.y);this.v=995;this.padTick=this.tick;}
      }else if(g.kind==='deck'){
        if(prev>=g.h-.25&&this.y<=g.h&&this.v<=0)this.land(g.h);
        else if(this.y+2<g.h)this.dead='Hit the platform wall';
      }else if(g.kind==='saw'){
        const r=g.w/2,dx=center-Math.max(left,Math.min(right,center)),dy=r-Math.max(this.y+2,Math.min(this.y+CUBE-2,r));
        if(dx*dx+dy*dy<r*r)this.dead='Hit a saw blade';
      }else{
        const half=g.w/(2*g.teeth);let highest=0;
        for(let n=0;n<g.teeth;n++){const peak=g.x+(2*n+1)*half;highest=Math.max(highest,g.h*(1-Math.abs(peak-Math.max(left,Math.min(right,peak)))/half));}
        if(this.y+2<g.base+highest&&this.y+CUBE-2>g.base)this.dead='Hit the spikes';
      }
      if(this.dead&&this.shield&&(g.kind==='spike'||g.kind==='saw')){
        this.shield=false;this.shieldBreak=this.time;this.clearedGate=g;this.dead='';
      }
      if(this.dead)return;
    }
    for(const l of this.ledges)if(right>l.x&&left<l.x+l.w&&prev>=l.h-.25&&this.y<=l.h&&this.v<=0)this.land(l.h); // one-way: land from above only
    if(floor&&this.y<=0&&this.v<=0)this.land(0);
    this.angle=this.grounded?0:(this.angle+STEP*555)%360;
    this.finished=this.time>=this.duration;
  }
}
