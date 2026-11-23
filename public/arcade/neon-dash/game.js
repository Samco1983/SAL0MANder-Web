import {Circuit,STEP,SPEED,CUBE,sectors} from './circuit.js';
const $=id=>document.getElementById(id);
const canvas=$('game'), ctx=canvas.getContext('2d'), track=$('track'), primary=$('primary');
const image=name=>{const im=new Image();im.src=name+'.webp';return im;};
const pilot=image('pilot'), skies=[0,1,2].map(n=>image('horizon'+n));
const colors=['#70f1dd','#ffc478','#71caff','#ab99ff','#ff9281','#a3f6ac'];
const saveKey='sal0mander.voltage-works.half.v1', soundKey='sal0mander.voltage-works.sound';
function read(key){try{return localStorage.getItem(key);}catch{return null;}}
function save(key,value){try{if(value===null)localStorage.removeItem(key);else localStorage.setItem(key,value);}catch{/* Session play is still available. */}}
let run,checkpoint,mode='loading',attempt=0,last=0,acc=0,noticeEnd=0,countIn=0,width=0,height=0,shownHud='',muted=read(soundKey)==='off';
track.volume=.60;track.muted=muted;
function soundUI(){$('sound').textContent=muted?'Sound off':'Sound on';$('sound').setAttribute('aria-pressed',String(!muted));}
soundUI();
function syncTrack(){
  if(!run||mode!=='play'||countIn>0)return;
  if(track.readyState){try{track.currentTime=run.time;}catch{/* Metadata may still be loading. */}}
  track.play().catch(()=>{});
}
track.addEventListener('loadedmetadata',syncTrack);
function menu(state){
  mode=state;track.pause();$('overlay').hidden=false;$('pause').hidden=true;$('hud').hidden=state==='title';
  const again=!!checkpoint,dead=state==='dead',paused=state==='paused',won=state==='won';
  $('eyebrow').textContent=dead?'ATTEMPT '+attempt:paused?'VOLTAGE WORKS':won?'FINISH LINE':'STAGE 01 · VOLTAGE WORKS';
  if(state==='title')$('title').innerHTML='Neon <em>Dash</em>';
  else $('title').textContent=dead?run.dead:paused?'Paused':'Stage clear!';
  $('detail').textContent=dead?Math.floor(run.progress*100)+'% of the circuit · '+run.prisms+' / '+run.total+' prisms':
    paused?'Resume the beat when you’re ready.':won?run.prisms+' / '+run.total+' prisms collected.':
    again?'Your halfway checkpoint is saved.':'Jump at the teal arrows. Every five prisms charge a shield against one spike or saw. Reach halfway to save.';
  primary.textContent=paused?'Resume':won?'Play again':again?'Continue from halfway':dead?'Try again':'Play Voltage Works';
  primary.disabled=false;$('secondary').hidden=!again||paused||won;
}
function start(fromHalf){
  attempt++;run.reset(fromHalf?checkpoint:null);countIn=fromHalf?1.5:0;
  $('message').textContent=fromHalf?'Ready…':'';noticeEnd=0;play();
}
function play(){mode='play';acc=0;last=performance.now();$('overlay').hidden=true;$('hud').hidden=false;$('pause').hidden=false;canvas.focus({preventScroll:true});syncTrack();hud();}
function activate(){if(!run||mode==='play')return;if(mode==='paused')play();else start(!!checkpoint&&mode!=='won');}
primary.onclick=activate;
$('secondary').onclick=()=>{checkpoint=null;save(saveKey,null);start(false);};
$('pause').onclick=()=>{if(mode==='play')menu('paused');};
$('sound').onclick=()=>{muted=!muted;track.muted=muted;soundUI();save(soundKey,muted?'off':'on');};
const full=$('full'),cabinet=$('cabinet');
if(!cabinet.requestFullscreen)full.hidden=true;
full.onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await cabinet.requestFullscreen();}catch{}};
document.addEventListener('fullscreenchange',()=>{full.textContent=document.fullscreenElement?'Exit full screen':'Full screen';});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&mode==='play')menu('paused');});
canvas.addEventListener('pointerdown',e=>{if(mode==='play'){e.preventDefault();run.jump();}});
window.addEventListener('keydown',e=>{
  if(!run||e.repeat||e.altKey||e.ctrlKey||e.metaKey)return;
  if(e.code==='KeyP'||e.code==='Escape'){
    if(mode==='play')menu('paused');else if(mode==='paused')play();return;
  }
  if(!['Space','ArrowUp','KeyW','Enter'].includes(e.code))return;
  if(e.target instanceof HTMLButtonElement&&mode!=='play')return;
  e.preventDefault();if(mode==='play')run.jump();else activate();
});
function notify(msg){$('message').textContent=msg;noticeEnd=run.time+1.6;}
function step(){
  const oldShield=run.shield;run.advance();
  if(run.tick===run.halfTick){checkpoint=run.snapshot();save(saveKey,JSON.stringify(checkpoint));notify('Halfway checkpoint saved');}
  if(!oldShield&&run.shield)notify('Prism shield charged');
  if(oldShield&&!run.shield)notify('Shield absorbed the hit');
  if(noticeEnd&&run.time>noticeEnd){$('message').textContent='';noticeEnd=0;}
  if(run.dead)menu('dead');
  if(run.finished){checkpoint=null;save(saveKey,null);menu('won');}
}
function hud(){
  const pct=Math.floor(run.progress*100),key=[pct,run.section,run.prisms,run.shield].join('/');
  if(key===shownHud)return;shownHud=key;
  $('sector').textContent=sectors[run.section];$('percent').textContent=pct+'%';$('fill').style.width=pct+'%';$('prisms').textContent='◆ '+run.prisms+'/'+run.total;$('shield').hidden=!run.shield;
}
function polygon(points,color,stroke){
  ctx.beginPath();points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();ctx.fillStyle=color;ctx.fill();
  if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=2;ctx.stroke();}
}
function rect(x,y,w,h,c){ctx.fillStyle=c;ctx.fillRect(x,y,w,h);}
function line(x,y,x2,y2,c,w=2){ctx.strokeStyle=c;ctx.lineWidth=w;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x2,y2);ctx.stroke();}
function draw(){
  const cw=canvas.clientWidth,ch=canvas.clientHeight;if(!cw||!ch)return;
  const d=Math.min(devicePixelRatio||1,2);if(canvas.width!==Math.round(cw*d)||canvas.height!==Math.round(ch*d)){canvas.width=Math.round(cw*d);canvas.height=Math.round(ch*d);}
  const scale=Math.min(cw/690,ch/650);width=cw/scale;height=ch/scale;
  ctx.setTransform(d*scale,0,0,d*scale,0,0);
  const section=run.section,sky=skies[[0,0,1,1,2,2][section]],col=colors[section],ground=height*.73,hero=Math.min(245,width*.23),origin=hero-run.x;
  rect(0,0,width,height,'#25203a');
  if(sky.complete&&sky.naturalWidth){
    const zoom=Math.max(width/sky.width,height/sky.height),w=sky.width*zoom,h=sky.height*zoom;
    ctx.drawImage(sky,(width-w)/2,(height-h)/2,w,h);
  }
  rect(0,ground,width,height-ground,'#19182b');line(0,ground,width,ground,col,4);
  for(let x=-160-(run.x*.35%130);x<width+200;x+=130)line(x,ground,x+(x-width/2)*.4,height,'#37334e');
  for(let i=1;i<=6;i++){const y=ground+(height-ground)*(i/6)**2;line(0,y,width,y,'#37334e',1);}
  for(const t of run.cues){const x=origin+t*SPEED;if(x< -12)continue;if(x>width+12)break;
    line(x,ground+7,x,ground-18,'#7ffce0',3);line(x-7,ground-11,x,ground-19,'#7ffce0',3);line(x,ground-19,x+7,ground-11,'#7ffce0',3);}
  for(let i=run.first;i<run.gates.length;i++){
    const g=run.gates[i],x=origin+g.x,y=ground-g.base;if(x>width+45)break;
    if(g.kind==='gap'){rect(x,ground-2,g.w,height-ground+2,'#090a17');line(x,ground,x,ground+53,col);line(x+g.w,ground,x+g.w,ground+53,col);}
    if(g.kind==='spike')for(let n=0;n<g.teeth;n++){const w=g.w/g.teeth,l=x+n*w;polygon([[l,y],[l+w/2,y-g.h],[l+w,y]],'#71395c','#ffd1a6');}
    if(g.kind==='deck'){rect(x,y-g.h,g.w,g.h,'#46375e');rect(x,y-g.h,g.w,4,col);}
    if(g.kind==='saw'){const r=g.w/2,pts=[];for(let n=0;n<32;n++){const a=n*Math.PI/16+run.time*4,k=n%2?r*.72:r;pts.push([x+r+Math.cos(a)*k,y-r+Math.sin(a)*k]);}polygon(pts,'#6b5075','#ffd0b2');}
    if(g.kind==='pad'){rect(x,y-8,g.w,8,'#ffba8d');for(let n=0;n<3;n++)polygon([[x+n*14,y-13],[x+6+n*14,y-21],[x+12+n*14,y-13]],'#ffbb82');}
    if(g.prism&&!g.got){const cx=x+g.w/2,cy=y-(g.high?199:164);polygon([[cx,cy-13],[cx+11,cy],[cx,cy+13],[cx-11,cy]],'#ffb285','#fff4cd');}
  }
  const flag=origin+run.halfX;
  if(flag>0&&flag<width){line(flag,ground,flag,ground-124,'#89ffe2',4);polygon([[flag,ground-124],[flag+60,ground-124],[flag+42,ground-100],[flag,ground-100]],'#89ffe2');}
  const cx=hero,cy=ground-run.y-CUBE/2;
  ctx.save();ctx.translate(cx,cy);ctx.rotate(run.angle*Math.PI/180);rect(-42,-42,84,84,col);
  if(pilot.complete&&pilot.naturalWidth){const s=Math.min(pilot.width,pilot.height);ctx.drawImage(pilot,(pilot.width-s)/2,(pilot.height-s)/2,s,s,-38,-38,76,76);}ctx.restore();
  if(run.shield){ctx.strokeStyle='#8fffea';ctx.lineWidth=3;ctx.beginPath();ctx.arc(cx,cy,59,0,Math.PI*2);ctx.stroke();}
}
function frame(now){
  if(mode==='play'){
    const dt=Math.max(0,Math.min(.1,(now-last)/1000));
    if(countIn>0){
      countIn=Math.max(0,countIn-dt);
      $('message').textContent=countIn?'Ready · '+Math.ceil(countIn*2):'';
      if(!countIn)syncTrack();
    }else acc+=dt;
    while(acc>=STEP&&mode==='play'){step();acc-=STEP;}
    if(!track.paused&&track.readyState>=3&&Math.abs(track.currentTime-run.time)>.22)track.currentTime=run.time;
    hud();
  }
  last=now;draw();requestAnimationFrame(frame);
}
async function boot(){
  const response=await fetch('course.json');if(!response.ok)throw Error('course');
  run=new Circuit(await response.json());
  try{const s=JSON.parse(read(saveKey));if(run.validSave(s))checkpoint=s;}catch{}
  menu('title');requestAnimationFrame(frame);
}
boot().catch(()=>{$('detail').textContent='The course could not load. Refresh to try again.';});
