import {Circuit,STEP,SPEED,CUBE,sectors} from './circuit.js';
// Neon Dash: Voltage Works. Solo, 2 players on one screen, or an online race (up to 7) on ONE shared track.
// Every racer runs the identical course on the same fixed timestep. Your cube is solid; the others are
// see-through "ghosts" in their own color with a head badge, so you can see the whole field at once.
const $=id=>document.getElementById(id);
const canvas=$('game');let ctx=canvas.getContext('2d');const track=$('track'), primary=$('primary'), two=$('two'), web=$('online');
const image=name=>{const im=new Image();im.src=name+'.webp';return im;};
const pilot=image('pilot'), skies=[0,1,2].map(n=>image('horizon'+n));
const colors=['#70f1dd','#ffc478','#71caff','#ab99ff','#ff9281','#a3f6ac'];
const SEAT=['#7cf3da','#ff8fd1','#ffd166','#8fb8ff','#b7ff8f','#ff9f6b','#c79bff'];
const saveKey='sal0mander.voltage-works.half.v1', soundKey='sal0mander.voltage-works.sound', faceKey='sal0mander.neon-dash.face';
// Faces: 0 = the original pilot cube, 1-6 = drawn cartoon faces. Only the number is ever shared online.
const FACES=['Coach Sam','Smile','Shades','Cat','Robot','Alien','Star eyes'];
// Face Builder (shared across SAL0MANder games; our own art): eyes, mouth, top and brows picked from parts. Online it travels as ONE
// number (10000 + eyes*1000 + mouth*100 + top*10 + brows), so no picture or text ever leaves the device.
const CUSTOM=10000,PARTS=[['Eyes',['Dots','Big','Shades','Stars','Sleepy','Wink']],['Mouth',['Smile','Grin','Flat','Oh','Tongue']],['Top',['None','Cat ears','Antenna','Crown','Spikes','Bow']],['Brows',['None','Happy','Angry','Raised']]];
const W=[1000,100,10,1];
const partsOf=v=>W.map(w=>Math.floor((v-CUSTOM)/w)%10);
const isCustom=v=>Number.isInteger(v)&&v>=CUSTOM&&v<CUSTOM+10000&&partsOf(v).every((p,i)=>p<PARTS[i][1].length);
const customCode=p=>CUSTOM+p.reduce((s,n,i)=>s+n*W[i],0);
function face(id,c,R=30){ctx.save();ctx.fillStyle=c;ctx.strokeStyle=c;ctx.lineCap='round';ctx.lineWidth=R*.16;
 const eye=(x,y,r)=>{ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();},smile=(y,w)=>{ctx.beginPath();ctx.arc(0,y,w,.15*Math.PI,.85*Math.PI);ctx.stroke();};
 const star=(x,y,s)=>{ctx.beginPath();for(let i=0;i<10;i++){const a=i*Math.PI/5-Math.PI/2,rr=i%2?s*.4:s;ctx.lineTo(x+Math.cos(a)*rr,y+Math.sin(a)*rr);}ctx.fill();};
 if(id>=CUSTOM){const [e,m,t,b]=isCustom(id)?partsOf(id):[0,0,0,0],L=(x1,y1,x2,y2)=>{ctx.beginPath();ctx.moveTo(x1*R,y1*R);ctx.lineTo(x2*R,y2*R);ctx.stroke();};
  for(const s of[-1,1]){const x=s*R*.35,y=-R*.1;
   if(e===0)eye(x,y,R*.15);else if(e===1){ctx.lineWidth=R*.09;ctx.beginPath();ctx.arc(x,y,R*.21,0,Math.PI*2);ctx.stroke();eye(x,y+R*.04,R*.09);ctx.lineWidth=R*.16;}
   else if(e===3)star(x,y,R*.24);else if(e===4){ctx.beginPath();ctx.arc(x,y-R*.08,R*.17,.15*Math.PI,.85*Math.PI);ctx.stroke();}
   else if(e===5){if(s<0)eye(x,y,R*.15);else L(.22,-.1,.5,-.1);}}
  if(e===2){ctx.fillRect(-R*.75,-R*.3,R*1.5,R*.34);}
  if(b===1)for(const s of[-1,1]){ctx.lineWidth=R*.1;ctx.beginPath();ctx.arc(s*R*.35,-R*.3,R*.2,1.15*Math.PI,1.85*Math.PI);ctx.stroke();}
  else if(b>1){ctx.lineWidth=R*.1;for(const s of[-1,1]){if(b===2)L(s*.18,-.38,s*.55,-.5);else L(s*.2,-.52,s*.52,-.52);}}
  ctx.lineWidth=R*.16;
  if(m===0)smile(R*.05,R*.42);else if(m===1){ctx.beginPath();ctx.arc(0,R*.15,R*.38,.1*Math.PI,.9*Math.PI);ctx.fill();}
  else if(m===2)L(-.3,.35,.3,.35);else if(m===3){ctx.lineWidth=R*.1;ctx.beginPath();ctx.arc(0,R*.36,R*.13,0,Math.PI*2);ctx.stroke();}
  else{smile(R*.05,R*.42);eye(R*.15,R*.5,R*.11);}
  ctx.lineWidth=R*.16;
  if(t===1){ctx.beginPath();ctx.moveTo(-R*.8,-R*.45);ctx.lineTo(-R*.62,-R*.95);ctx.lineTo(-R*.28,-R*.62);ctx.moveTo(R*.8,-R*.45);ctx.lineTo(R*.62,-R*.95);ctx.lineTo(R*.28,-R*.62);ctx.stroke();}
  else if(t===2){L(0,-.62,0,-.9);eye(0,-R*.97,R*.1);}
  else if(t===3){ctx.beginPath();ctx.moveTo(-R*.45,-R*.6);ctx.lineTo(-R*.45,-R*.95);ctx.lineTo(-R*.22,-R*.75);ctx.lineTo(0,-R*.97);ctx.lineTo(R*.22,-R*.75);ctx.lineTo(R*.45,-R*.95);ctx.lineTo(R*.45,-R*.6);ctx.closePath();ctx.fill();}
  else if(t===4){ctx.beginPath();for(let i=0;i<=6;i++)ctx.lineTo(-R*.75+i*R*.25,i%2?-R*.95:-R*.65);ctx.lineTo(R*.75,-R*.6);ctx.lineTo(-R*.75,-R*.6);ctx.closePath();ctx.fill();}
  else if(t===5){ctx.beginPath();ctx.moveTo(R*.45,-R*.75);ctx.lineTo(R*.15,-R*.95);ctx.lineTo(R*.15,-R*.55);ctx.closePath();ctx.moveTo(R*.45,-R*.75);ctx.lineTo(R*.75,-R*.95);ctx.lineTo(R*.75,-R*.55);ctx.closePath();ctx.fill();eye(R*.45,-R*.75,R*.09);}
  ctx.restore();return;}
 if(id===2){ctx.fillRect(-R*.75,-R*.42,R*1.5,R*.34);ctx.fillRect(-R*.12,-R*.42,R*.24,R*.2);smile(R*.05,R*.42);}
 else if(id===3){ctx.beginPath();ctx.moveTo(-R*.8,-R*.35);ctx.lineTo(-R*.6,-R*.95);ctx.lineTo(-R*.25,-R*.55);ctx.moveTo(R*.8,-R*.35);ctx.lineTo(R*.6,-R*.95);ctx.lineTo(R*.25,-R*.55);ctx.stroke();eye(-R*.35,-R*.1,R*.13);eye(R*.35,-R*.1,R*.13);
   ctx.beginPath();ctx.moveTo(-R*.15,R*.15);ctx.lineTo(0,R*.28);ctx.lineTo(R*.15,R*.15);ctx.stroke();ctx.lineWidth=R*.06;for(const s of[-1,1]){ctx.beginPath();ctx.moveTo(s*R*.3,R*.25);ctx.lineTo(s*R*.85,R*.15);ctx.moveTo(s*R*.3,R*.33);ctx.lineTo(s*R*.85,R*.4);ctx.stroke();}}
 else if(id===4){ctx.fillRect(-R*.55,-R*.35,R*.32,R*.32);ctx.fillRect(R*.23,-R*.35,R*.32,R*.32);ctx.fillRect(-R*.45,R*.2,R*.9,R*.14);ctx.beginPath();ctx.moveTo(0,-R*.65);ctx.lineTo(0,-R*.95);ctx.stroke();eye(0,-R*1.02,R*.1);}
 else if(id===5){ctx.beginPath();ctx.ellipse(-R*.35,-R*.12,R*.24,R*.32,-.5,0,Math.PI*2);ctx.ellipse(R*.35,-R*.12,R*.24,R*.32,.5,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.arc(0,R*.32,R*.12,0,Math.PI*2);ctx.stroke();}
 else if(id===6){for(const s of[-1,1]){ctx.beginPath();for(let i=0;i<10;i++){const a=i*Math.PI/5-Math.PI/2,rr=i%2?R*.11:R*.27;ctx.lineTo(s*R*.38+Math.cos(a)*rr,-R*.12+Math.sin(a)*rr);}ctx.fill();}ctx.beginPath();ctx.arc(0,R*.15,R*.38,.1*Math.PI,.9*Math.PI);ctx.fill();}
 else{eye(-R*.35,-R*.12,R*.15);eye(R*.35,-R*.12,R*.15);smile(R*.05,R*.42);}
 ctx.restore();}
// Coach Sam: the photo cube (face 0) is Samuel, the tutor. Kids pick cartoon faces; Sam records a run kids can race.
// sal0mander.com (public games/classroom site) stays neutral. Coach Sam features only appear via the tutoring site's
// link (?sam=1, for Sam's students) or Sam's own link (?coach=1, to record runs and race as SAM).
const COACH_MODE=/[?&]coach=1\b/.test(location.search),SAM_LINK=COACH_MODE||/[?&]sam=1\b/.test(location.search);let samRun=null,rec=[],recFull=false,coachOutAt=0;
// Best runs: every full 1-player run is saved ON THIS DEVICE ONLY (no names, nothing sent anywhere), top 10 by score.
// Each saved run keeps its jump ticks, so any row can be raced as a ghost (the course is deterministic).
const boardKey='neon-dash-board-v1';let ghost=null,lastRank=-1;
function loadBoard(){try{const b=JSON.parse(read(boardKey)||'[]');return Array.isArray(b)?b.filter(e=>e&&Array.isArray(e.j)&&e.j.every(Number.isInteger)&&Number.isFinite(e.s)).slice(0,10):[];}catch{return [];}}
function keepRun(){const m=me(),e={s:scoreOf(m),p:Math.floor(run.progress*1e4)/1e4,f:run.finished,pr:run.prisms,g:m.gold||0,pf:m.perfect||0,fc:myFace,j:rec.slice(),at:Date.now()};
  const b=loadBoard();b.push(e);b.sort((a,c)=>c.s-a.s||a.at-c.at);const top=b.slice(0,10);save(boardKey,JSON.stringify(top));return top.indexOf(e);}
function simulate(jumps){const x={r:new Circuit(score),replay:new Set(jumps)};while(alive(x)){if(x.replay.has(x.r.tick))jumpFor(x);x.r.advance();grabCoins(x);watchSprings(x);}return x;}
let myFace=(()=>{const v=Number(read(faceKey));return isCustom(v)||(Number.isInteger(v)&&v>=(COACH_MODE?0:1)&&v<FACES.length)?v:(COACH_MODE?0:1);})();
// The built face is shared by every SAL0MANder game on this device ('sal0mander.face'), so it follows the kid.
let myCustom=(()=>{for(const k of ['sal0mander.face',faceKey+'.custom']){const v=Number(read(k));if(isCustom(v))return v;}return customCode([1,0,4,1]);})();
function read(key){try{return localStorage.getItem(key);}catch{return null;}}
function save(key,value){try{if(value===null)localStorage.removeItem(key);else localStorage.setItem(key,value);}catch{/* Session play is still available. */}}
let score,run,racers=[],kind='solo',checkpoint,mode='loading',attempt=0,last=0,acc=0,noticeEnd=0,countIn=0,width=0,height=0,shownHud='',muted=read(soundKey)==='off';
let net=null; // {ws,code,you,count,ready,iAmReady}
track.volume=.60;track.muted=muted;
function soundUI(){$('sound').textContent=muted?'Sound off':'Sound on';$('sound').setAttribute('aria-pressed',String(!muted));}
soundUI();
const me=()=>racers.find(x=>x.me)||racers[0];
const alive=x=>!x.r.dead&&!x.r.finished;
// The camera follows you; in same-screen 2-player it follows whoever is still running.
// The camera follows you; once you're out it follows whoever is still running (spectate), so you can watch their face.
function focus(){const m=me();if(kind==='solo'||alive(m))return m;return [...racers].filter(alive).sort((a,b)=>b.r.time-a.r.time)[0]||m;}
function syncTrack(){
  const f=focus();if(!f||mode!=='play'||countIn>0)return;
  if(track.readyState){try{track.currentTime=f.r.time;}catch{/* Metadata may still be loading. */}}
  track.play().catch(()=>{});
}
track.addEventListener('loadedmetadata',syncTrack);
function racer(seat,isMe,isLocal){return {r:new Circuit(score),seat,me:isMe,local:isLocal,color:SEAT[seat%SEAT.length],left:false,face:isMe?myFace:1+(seat%6)};}
// Score decides who is ahead, live: distance (1 pt per 0.1% of the course) + 50 per prism + 10 per Perfect + 250 for finishing.
function scoreOf(x){const r=x.r;return Math.floor(r.progress*1000)+r.prisms*50+(x.pp||0)+(x.gold||0)*100+(x.sp||0)+(r.finished?250:0);}
// Spring bonus: a bounce pad (spring) launches you; tap jump within 0.1 s AFTER it fires for +75 (x2, x3, x4 in a row).
// Tap too early and you jump over the spring instead. Missing a spring's timing resets the streak.
function watchSprings(x){const r=x.r;x.springSeen=x.springSeen||new Set();for(let i=r.first;i<r.gates.length;i++){const g=r.gates[i];if(g.x>r.x+60)break;
  if(g.kind==='pad'&&g.tripped&&!x.springSeen.has(i)){x.springSeen.add(i);if(x.springOpen!=null&&!x.springHit)x.springStreak=0;x.springOpen=r.tick;x.springHit=false;}}
  if(x.springOpen!=null&&!x.springHit&&r.tick-x.springOpen>12){x.springStreak=0;x.springOpen=null;}}
// Gold coins (+100): hard extras, same spots for everyone. Sky coins float at the very top of a jump in the calm stretches
// between obstacles (you must jump on purpose ~0.3 s early); platform coins sit high above platforms (jump while on top).
let COINS=[];
// Stage 1 timing (seconds). Later stages tighten: Stage 2 {great:.05,perfect:.025}, Stage 3 {great:.033,perfect:.016}.
const TIMING={great:.07,perfect:.033,critical:.025};let GOLD=new Set();
// Positions chosen by simulation (course is fixed): each coin can be grabbed and survived by a skilled jump, and a player
// who only jumps on the arrows gets none. 10 sit high above platforms, 2 float in the longest calm stretches.
function buildCoins(){const L=[];for(const l of run.ledges||[])for(const f of [.3,.55,.8])L.push([l.x+l.w*f,l.h+42]);COINS=[...L,[8333,237],[15019,237],[21705,237],[28390,237],[35076,237],[41428,237],[45773,237],[52459,237],[56470,237],[65830,237],[5037,171],[37792,171]].map(([x,h])=>({x,h})).sort((a,b)=>a.x-b.x);}
function grabCoins(x){const r=x.r;if(!alive(x)&&!r.finished)return;x.gotGold=x.gotGold||new Set();for(let i=0;i<COINS.length;i++){const c=COINS[i];if(c.x<r.x-60)continue;if(c.x>r.x+60)break;
  if(!x.gotGold.has(i)&&Math.abs(r.x-c.x)<49&&Math.abs(r.y+CUBE/2-c.h)<52){x.gotGold.add(i);x.gold=(x.gold||0)+1;if(x.local||x.replay)x.coinFlash=performance.now();}}}
function ahead(a,b){return scoreOf(b)-scoreOf(a);} // equal scores tie and share the place
// Perfect jump: pressed within 70 ms of a teal arrow reaching your cube. Breaks ties when everyone survives.
function jumpFor(x){const r=x.r;if(!r||r.dead||r.finished)return;
  if(x.springOpen!=null&&!x.springHit&&r.tick-x.springOpen<=12){r.spring();x.springHit=true;x.springStreak=(x.springStreak||0)+1;x.sp=(x.sp||0)+75*Math.min(x.springStreak,4);x.springFlash=performance.now();}if(kind==='solo'&&x.me&&recFull)rec.push(r.tick);r.jump();x.perfect=x.perfect||0;x.used=x.used||new Set();
  // Timing grades (rhythm-game style, from osu!/DDR): GREAT within TIMING.great of an arrow, PERFECT within TIMING.perfect.
  // Gold arrows (the 5 big beat drops) also pay +100 CRITICAL within TIMING.critical. Streaks multiply up to x5.
  let best=null;for(const c of r.cues){if(c>r.time+TIMING.great)break;const d=Math.abs(c-r.time);if(d<=TIMING.great&&!x.used.has(c)&&(!best||d<best.d))best={c,d};}
  if(best){x.used.add(best.c);const perfect=best.d<=TIMING.perfect;x.streak=(x.streak||0)+1;const m=Math.min(x.streak,5);x.pp=(x.pp||0)+(perfect?20:10)*m;
    if(perfect)x.perfect=(x.perfect||0)+1;else x.great=(x.great||0)+1;x.grade=perfect?'PERFECT':'GREAT';
    if(GOLD.has(best.c)&&best.d<=TIMING.critical){x.pp+=100;x.crit=(x.crit||0)+1;x.grade='CRITICAL';}x.flash=performance.now();}else x.streak=0;}
function standings(){return [...racers].sort(ahead);}
// Place = 1 + number of racers strictly ahead, so tied racers share a place (and nobody 'leads' at 0%).
function place(x){return 1+racers.filter(y=>ahead(y,x)<0).length;}
function short(x){return x.coach?'SAM':x.ghostName?'GHOST':(kind==='online'||kind==='coach')?(x.me?'YOU':'R'+(x.seat+1)):'P'+(x.seat+1);}
function label(x){return x.coach?'Coach Sam':x.ghostName?x.ghostName:kind==='coach'?'You':kind==='online'?(x.me?'You':'Racer '+(x.seat+1)):'Player '+(x.seat+1);}
function resultText(){
  if(kind==='coach'){const m=me(),c=racers.find(x=>x.replay),n=label(c),d=ahead(m,c);return d<0?'You beat '+n+'!':d===0?'Dead heat with '+n+'!':n+' wins this time. Try again!';}
  const list=standings(),top=list[0],tie=list[1]&&ahead(list[0],list[1])===0;
  if(kind==='online'){const p=place(me()),shared=racers.some(y=>y!==me()&&place(y)===p);return p===1?(shared?'Tied for 1st!':'You win!'):'You came '+(shared?'joint ':'')+['','1st','2nd','3rd','4th','5th','6th','7th'][p]+' of '+list.length;}
  if(tie)return 'It’s a tie!';
  return label(top)+' wins!';
}
function faceIcon(fc,color,p){const c=document.createElement('canvas');c.width=c.height=56;
  const keep=ctx;ctx=c.getContext('2d');ctx.fillStyle='#1b1630';ctx.beginPath();ctx.arc(28,28,26,0,Math.PI*2);ctx.fill();ctx.strokeStyle=color;ctx.lineWidth=4;ctx.stroke();ctx.translate(28,29);face(fc>0?fc:1,color,17);ctx.setTransform(1,0,0,1,0,0);if(p<=3)medal(44,14,10,p);ctx=keep;return c;}
const pctText=e=>e.f?'finished':(Math.floor(e.p*1000)/10).toFixed(1)+'%';
// Best runs board: this device's top runs plus Coach Sam's run (when the tutoring link loaded it). Tap Race to race any of them.
function boardList(){const rows=loadBoard().map((e,i)=>({...e,name:'Ghost #'+(i+1),fresh:i===lastRank}));
  if(samRun){if(!samRun.entry){const x=simulate(samRun.jumps);samRun.entry={s:scoreOf(x),p:x.r.progress,f:x.r.finished,pr:x.r.prisms,g:x.gold||0,pf:x.perfect||0,fc:0,j:samRun.jumps,coach:true,name:'Coach Sam'};}rows.push(samRun.entry);}
  rows.sort((a,b)=>b.s-a.s);const ol=$('board');ol.replaceChildren();
  rows.slice(0,5).forEach((e,i)=>{const li=document.createElement('li'),col=e.coach?'#ffd166':'#9ad7ff',txt=document.createElement('div'),name=document.createElement('b'),stat=document.createElement('span'),go=document.createElement('button');
    name.textContent=(i+1)+'. '+e.name+(e.fresh?' · NEW':'');name.style.color=col;stat.textContent=e.s+' pts · '+pctText(e)+' · ◆ '+e.pr+' · gold '+e.g;txt.append(name,stat);
    go.type='button';go.textContent='Race';go.setAttribute('aria-label','Race '+e.name);go.onclick=()=>{if(score)startGhost(e);};
    if(e.fresh)li.className='mine';li.append(faceIcon(e.fc,col,i+1),txt,go);ol.append(li);});
  $('boardBox').hidden=!rows.length;}
function resultList(){const ol=$('ranks');ol.replaceChildren();for(const x of standings()){const li=document.createElement('li'),p=place(x),c=faceIcon(x.face,x.color,p);
  const name=document.createElement('b');name.textContent=(p<=3?['','1st','2nd','3rd'][p]:p+'th')+' · '+label(x);name.style.color=x.color;
  const stat=document.createElement('span');stat.textContent=scoreOf(x)+' pts · '+(x.r.finished?'finished':(Math.floor(x.r.progress*1000)/10).toFixed(1)+'%')+' · ◆ '+x.r.prisms+' · ★ '+(x.perfect||0)+' perfect · '+(x.great||0)+' great'+(x.crit?' · '+x.crit+' critical':'')+' · gold '+(x.gold||0)+(x.left?' · left':'');
  if(x.me)li.className='mine';li.append(c,name,stat);ol.append(li);}}
function resultDetail(){return standings().map(x=>place(x)+'. '+label(x)+' · '+scoreOf(x)+' pts · '+(x.r.finished?'finished':(Math.floor(x.r.progress*1000)/10).toFixed(1)+'%')+' · ◆ '+x.r.prisms+(x.left?' (left)':'')).join('   ');}
function lobbyUI(show){
  $('lobby').hidden=!show;$('actions').hidden=show;$('keys2').hidden=show||!(mode==='title');
  if(!show)return;
  const inRoom=!!net?.code;
  $('lobbyStart').hidden=inRoom;$('lobbyRoom').hidden=!inRoom;
  if(inRoom){
    $('roomCode').textContent=net.code;
    $('roomInfo').textContent=net.count+' racer'+(net.count===1?'':'s')+' here · '+net.ready+' ready'+(net.count<2?' · share the code with a friend':'');
    $('ready').disabled=net.iAmReady;$('ready').textContent=net.iAmReady?'Waiting for everyone…':'I’m ready';
  }
}
let menuAt=0;
function menu(state){
  mode=state;menuAt=performance.now();if(state!=='title'&&state!=='lobby'&&state!=='paused'){const o=$('overlay');o.classList.add('cool');clearTimeout(o.coolT);o.coolT=setTimeout(()=>o.classList.remove('cool'),1500);}$('pick').hidden=!(state==='title'||state==='lobby');track.pause();$('overlay').hidden=false;$('pause').hidden=true;$('hud').hidden=state==='title'||state==='lobby'||kind!=='solo';
  if(state==='lobby'){$('eyebrow').textContent='RACE ONLINE';$('title').innerHTML='Neon <em>Race</em>';$('detail').textContent='Same course, same blocks, everyone on one track. No names, no chat, nothing saved.';lobbyUI(true);return;}
  lobbyUI(false);
  const again=!!checkpoint&&kind==='solo',dead=state==='dead',paused=state==='paused',won=state==='won',result=state==='result';
  $('eyebrow').textContent=result?(kind==='online'?'ONLINE RACE':kind==='coach'?'GHOST RACE':'2-PLAYER RACE'):dead?'ATTEMPT '+attempt:paused?'VOLTAGE WORKS':won?'FINISH LINE':'STAGE 01 · VOLTAGE WORKS';
  if(state==='title')$('title').innerHTML='Neon <em>Dash</em>';
  else $('title').textContent=result?resultText():dead?run.dead:paused?'Paused':'Stage clear!';
  $('ranks').hidden=!result;if(result)resultList();
  $('boardBox').hidden=true;if(state==='title'||((dead||won)&&kind==='solo'))boardList();
  $('title').classList.toggle('long',result);
  $('detail').hidden=result;$('detail').textContent=result?resultDetail():
    (dead||won)&&lastRank===0?'New personal best! '+scoreOf(me())+' pts. Saved on this device.':(dead||won)&&lastRank>0?'#'+(lastRank+1)+' on your best runs · '+scoreOf(me())+' pts.':
    dead?Math.floor(run.progress*100)+'% of the circuit · '+run.prisms+' / '+run.total+' prisms':
    paused?'Resume the beat when you’re ready.':won?run.prisms+' / '+run.total+' prisms collected.':
    again?'Your halfway checkpoint is saved.':'Jump at the teal arrows. Every five prisms charge a shield against one spike or saw. Race a friend on the same track.';
  primary.textContent=paused?'Resume':result?(kind==='online'?'Race again':'Rematch'):won?'Play again':again?'Continue from halfway':dead?'Try again':'1 Player';
  primary.disabled=false;
  two.hidden=paused;two.textContent=result?'1 Player':'2 Players';
  web.hidden=paused||result;
  $('secondary').hidden=!again||paused||won||result;
  $('keys2').hidden=state!=='title';
  const over=result||dead||won;$('coachCta').hidden=!(over&&SAM_LINK);
  $('coach').hidden=!samRun||paused||(!over&&state!=='title');if(samRun)$('coach').textContent=result&&kind==='coach'?'Race Sam again':'Race Coach Sam';
  if(result&&kind==='coach'){primary.textContent=ghost?.coach?'Race Sam again':'Race ghost again';$('coach').hidden=true;}
  $('saveRun').hidden=!(COACH_MODE&&kind==='solo'&&(dead||won)&&recFull);
}
function setSolo(){kind='solo';leaveNet();run=new Circuit(score);racers=[{r:run,seat:0,me:true,local:true,color:SEAT[0]}];}
function start(fromHalf){
  attempt++;lastRank=-1;if(kind!=='solo')setSolo();rec=[];recFull=!fromHalf;run.reset(fromHalf?checkpoint:null);racers[0].perfect=0;racers[0].great=0;racers[0].crit=0;racers[0].used=new Set();racers[0].pp=0;racers[0].streak=0;racers[0].gold=0;racers[0].gotGold=new Set();racers[0].sp=0;racers[0].springStreak=0;racers[0].springSeen=new Set();racers[0].springOpen=null;countIn=fromHalf?1.5:0;
  $('message').textContent=fromHalf?'Ready…':'';noticeEnd=0;play();
}
// Ghost race: you vs a recorded run (Coach Sam's, or one of your saved best runs). Same track, same speed.
function startCoach(){if(samRun)startGhost({coach:true,name:'Coach Sam',fc:0,j:samRun.jumps});}
function startGhost(g){ghost=g;attempt++;leaveNet();kind='coach';coachOutAt=0;const gx={r:new Circuit(score),seat:1,me:false,local:false,coach:!!g.coach,ghostName:g.coach?'':g.name,replay:new Set(g.j),color:g.coach?'#ffd166':'#9ad7ff',face:g.fc,perfect:0};
  racers=[racer(0,true,true),gx];run=racers[0].r;countIn=1.5;$('message').textContent='';play();}
function startLocal(){attempt++;leaveNet();kind='local';racers=[racer(0,true,true),racer(1,false,true)];run=racers[0].r;countIn=1.5;$('message').textContent='';play();}
function startOnline(){
  attempt++;kind='online';racers=[];
  net.seats.forEach((taken,seat)=>{if(taken)racers.push(racer(seat,seat===net.you,seat===net.you));});
  run=me().r;if(COACH_MODE&&myFace===0)me().coach=true;countIn=2;$('message').textContent='';play();
}
function play(){mode='play';acc=0;last=performance.now();$('overlay').hidden=true;$('hud').hidden=kind!=='solo';$('pause').hidden=kind==='online';canvas.focus({preventScroll:true});syncTrack();if(kind==='solo')hud();}
function activate(){
  if(!score||mode==='play')return;
  if(mode==='paused')return play();
  if(mode==='result'){if(kind==='coach')return ghost?startGhost(ghost):startCoach();if(kind==='local')return startLocal();if(kind==='online'){netSend({t:'again'});net.iAmReady=false;return menu('lobby');}}
  if(kind!=='solo')setSolo();
  start(!!checkpoint&&mode!=='won');
}
primary.onclick=activate;
$('coach').onclick=()=>{if(score&&samRun)startCoach();};
$('saveRun').onclick=()=>{const blob=new Blob([JSON.stringify({v:1,name:'Coach Sam',course:'voltage-works',jumps:rec,progress:+run.progress.toFixed(4),finished:run.finished,prisms:run.prisms,perfect:me().perfect||0,recordedAt:new Date().toISOString()})],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='sam-run.json';a.click();$('saveRun').textContent='Saved: put sam-run.json next to game.js';};
// Clear my data: deletes everything this game saved on this device (runs, face, checkpoint, sound). Tap twice to confirm.
{const w=$('wipe');let armed=-1e9;if(w)w.onclick=()=>{if(performance.now()-armed>4000){armed=performance.now();w.textContent='Tap again to delete';return;}
  try{for(const k of Object.keys(localStorage))if(/^(sal0mander|neon-dash)/i.test(k))localStorage.removeItem(k);}catch{/* Nothing saved. */}location.reload();};}
two.onclick=()=>{if(!score)return;if(mode==='result'&&kind==='local'){setSolo();start(false);}else startLocal();};
$('secondary').onclick=()=>{checkpoint=null;save(saveKey,null);start(false);};
$('pause').onclick=()=>{if(mode==='play'&&kind!=='online')menu('paused');};
$('sound').onclick=()=>{muted=!muted;track.muted=muted;soundUI();save(soundKey,muted?'off':'on');};
const full=$('full'),cabinet=$('cabinet');
if(!cabinet.requestFullscreen)full.hidden=true;
full.onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await cabinet.requestFullscreen();}catch{}};
document.addEventListener('fullscreenchange',()=>{full.textContent=document.fullscreenElement?'Exit full screen':'Full screen';});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&mode==='play'&&kind!=='online')menu('paused');});
// ---------- online ----------
function relayURL(){
  const q=new URLSearchParams(location.search).get('relay');if(q)return q;
  if(['localhost','127.0.0.1'].includes(location.hostname))return 'ws://localhost:8787';
  return 'wss://race.sal0mander.com';
}
function netSend(o){try{if(net?.ws?.readyState===1)net.ws.send(JSON.stringify(o));}catch{}}
function leaveNet(){if(net?.ws){try{net.ws.close();}catch{}}net=null;}
function openNet(first){
  leaveNet();$('lobbyMsg').textContent='Connecting…';
  let ws;try{const u=relayURL();ws=new WebSocket(first.t==='join'?u+(u.includes('?')?'&':'?')+'code='+encodeURIComponent(first.code):u);}catch{ws=null;}
  if(!ws){$('lobbyMsg').textContent='Online races aren’t switched on yet.';return;}
  net={ws,code:'',you:0,count:0,ready:0,iAmReady:false,seats:[]};
  ws.onopen=()=>{$('lobbyMsg').textContent='';ws.send(JSON.stringify(first));};
  ws.onerror=()=>{$('lobbyMsg').textContent='Online races aren’t switched on yet. Try 2 Players on this screen.';};
  ws.onclose=()=>{if(net?.ws===ws){if(mode==='lobby')$('lobbyMsg').textContent='Disconnected.';net.closed=true;}};
  ws.onmessage=e=>{let m;try{m=JSON.parse(e.data);}catch{return;}onNet(m);};
}
function onNet(m){
  if(!net)return;
  if(m.t==='err'){$('lobbyMsg').textContent=m.msg;leaveNet();return lobbyUI(true);}
  if(m.t==='room'){net.code=m.code;net.you=m.you;net.count=m.count;lobbyUI(true);}
  if(m.t==='peers'){net.count=m.count;net.ready=m.ready;net.seats=m.seats||net.seats;if(mode==='lobby')lobbyUI(true);}
  if(m.t==='again'){net.iAmReady=false;if(mode==='lobby')lobbyUI(true);}
  if(m.t==='go'){net.seats=m.seats;net.iAmReady=false;startOnline();}
  if(m.t==='left'){const x=racers.find(x=>x.seat===m.p&&!x.me);if(x){x.left=true;if(!x.r.dead&&!x.r.finished)x.r.dead='Left the race';}}
  if(m.t==='s'){
    const x=racers.find(x=>x.seat===m.p&&!x.me);if(!x)return;const r=x.r;
    if(Number.isFinite(m.k))r.tick=(m.d||m.f)?m.k:Math.max(r.tick,m.k);/* a crash/finish report is exact */
    if(Number.isFinite(m.y))r.y=m.y;if(Number.isFinite(m.a))r.angle=m.a;if(Number.isInteger(m.fc)){x.face=m.fc;x.coach=m.fc===0;}if(Number.isInteger(m.pf))x.perfect=m.pf;if(Number.isInteger(m.pp))x.pp=m.pp;if(Number.isInteger(m.gd))x.gold=m.gd;if(Number.isInteger(m.sp))x.sp=m.sp;
    if(Number.isFinite(m.pr))r.prisms=m.pr;r.shield=!!m.sh;if(m.d)r.dead=m.d;if(m.f)r.finished=true;
  }
}
web.onclick=()=>{if(!score)return;kind='online';menu('lobby');};
function buildPicker(){const box=$('faces');box.replaceChildren();FACES.forEach((name,id)=>{if(id===0&&!COACH_MODE)return;const b=document.createElement('button');b.type='button';b.className='faceBtn';b.setAttribute('aria-label','Face: '+name);b.setAttribute('aria-pressed',String(id===myFace));b.title=name;
  const c=document.createElement('canvas');c.width=c.height=88;const g2=c.getContext('2d'),keep=ctx;
  if(id===0){g2.fillStyle='#70f1dd';g2.fillRect(0,0,88,88);if(pilot.complete&&pilot.naturalWidth){const s=Math.min(pilot.width,pilot.height);g2.drawImage(pilot,(pilot.width-s)/2,(pilot.height-s)/2,s,s,6,6,76,76);}else{g2.fillStyle='#14121f';g2.font='800 15px sans-serif';g2.textAlign='center';g2.fillText('PILOT',44,50);}}
  else{g2.fillStyle=SEAT[0];g2.fillRect(0,0,88,88);g2.fillStyle='#1b1630';g2.fillRect(8,8,72,72);g2.translate(44,46);ctx=g2;face(id,SEAT[0],30);ctx=keep;}
  b.append(c);b.onclick=()=>{myFace=id;save(faceKey,String(id));buildPicker();};box.append(b);});
  // "Make your own" tile + part buttons (tap to cycle). Shown under the preset faces.
  const tile=document.createElement('button'),tc=document.createElement('canvas');tile.type='button';tile.className='faceBtn mine';tile.title='Make your own';tile.setAttribute('aria-label','Face: make your own');tile.setAttribute('aria-pressed',String(myFace===myCustom));
  tc.width=tc.height=88;{const g2=tc.getContext('2d'),keep=ctx;g2.fillStyle=SEAT[0];g2.fillRect(0,0,88,88);g2.fillStyle='#1b1630';g2.fillRect(8,8,72,72);g2.translate(44,48);ctx=g2;face(myCustom,SEAT[0],30);ctx=keep;}
  tile.append(tc);tile.onclick=()=>{myFace=myCustom;save(faceKey,String(myFace));buildPicker();};box.append(tile);
  let ed=$('faceEdit');if(!ed){ed=document.createElement('div');ed.id='faceEdit';ed.setAttribute('role','group');ed.setAttribute('aria-label','Make your own face');box.after(ed);}
  ed.replaceChildren();ed.hidden=myFace!==myCustom;const parts=partsOf(myCustom);
  PARTS.forEach(([name,opts],i)=>{const b=document.createElement('button');b.type='button';b.textContent=name+': '+opts[parts[i]];b.onclick=()=>{parts[i]=(parts[i]+1)%opts.length;myCustom=myFace=customCode(parts);save(faceKey,String(myFace));save(faceKey+'.custom',String(myCustom));save('sal0mander.face',String(myCustom));buildPicker();};ed.append(b);});}
pilot.addEventListener('load',()=>{if(score)buildPicker();});
$('create').onclick=()=>openNet({t:'create'});
$('join').onclick=()=>{const c=$('codeIn').value.trim();if(c.length<4){$('lobbyMsg').textContent='Type the 4-letter code.';return;}openNet({t:'join',code:c});};
$('codeIn').addEventListener('keydown',e=>{if(e.key==='Enter')$('join').click();});
$('ready').onclick=()=>{net.iAmReady=true;netSend({t:'ready'});lobbyUI(true);};
$('lobbyBack').onclick=()=>{setSolo();menu('title');};
// ---------- input ----------
// Same screen: Player 1 = Space / W / left half of the screen, Player 2 = ↑ / Enter / right half.
canvas.addEventListener('pointerdown',e=>{
  if(mode!=='play')return;e.preventDefault();
  if(kind!=='local')return jumpFor(me());
  const box=canvas.getBoundingClientRect();jumpFor(racers[e.clientX-box.left<box.width/2?0:1]);
});
window.addEventListener('keydown',e=>{
  if(!score||e.repeat||e.altKey||e.ctrlKey||e.metaKey)return;
  if(e.target instanceof HTMLInputElement)return;
  if(e.code==='KeyP'||e.code==='Escape'){
    if(kind==='online')return;
    if(mode==='play')menu('paused');else if(mode==='paused')play();return;
  }
  if(!['Space','ArrowUp','KeyW','Enter'].includes(e.code))return;
  if(e.target instanceof HTMLButtonElement&&mode!=='play')return;
  e.preventDefault();
  // Ignore jump-mashing for 1 s after a result/crash screen appears, so nobody skips their result by accident.
  if(mode!=='play')return mode==='lobby'||performance.now()-menuAt<1500?undefined:activate();
  if(kind!=='local')return jumpFor(me());
  jumpFor(racers[['Space','KeyW'].includes(e.code)?0:1]);
});
function notify(msg){$('message').textContent=msg;noticeEnd=focus().r.time+1.6;}
let sent=0;
function step(){
  if(kind!=='solo'){
    for(const x of racers){
      if(x.replay){if(alive(x)){if(x.replay.has(x.r.tick))jumpFor(x);x.r.advance();grabCoins(x);watchSprings(x);}continue;}
      if(!x.local||!alive(x))continue;
      const r=x.r,oldShield=r.shield;r.advance();grabCoins(x);watchSprings(x);
      if(x.me||kind==='local'){if(!oldShield&&r.shield)notify(label(x)+': shield charged');if(oldShield&&!r.shield)notify(label(x)+': shield absorbed the hit');}
    }
    // Remote racers who are still running move at the same constant speed, so step them forward locally between network updates.
    for(const x of racers)if(!x.local&&!x.replay&&alive(x))x.r.tick++;
    // Racing Coach Sam: once you're out, watch Sam for 3 s, then fast-forward his recorded run to its real result.
    if(kind==='coach'&&!alive(me())){coachOutAt=coachOutAt||performance.now();if(performance.now()-coachOutAt>3000)for(const c of racers)if(c.replay)while(alive(c)){if(c.replay.has(c.r.tick))jumpFor(c);c.r.advance();grabCoins(c);watchSprings(c);}}
    if(kind==='online'){const r=me().r;if(++sent%4===0||r.dead||r.finished){if(!me().sentEnd)netSend({t:'s',fc:myFace,pf:me().perfect||0,pp:me().pp||0,gd:me().gold||0,sp:me().sp||0,k:r.tick,y:Math.round(r.y*10)/10,a:Math.round(r.angle),pr:r.prisms,sh:r.shield?1:0,d:r.dead||undefined,f:r.finished||undefined});if(r.dead||r.finished)me().sentEnd=true;}}
    if(noticeEnd&&focus().r.time>noticeEnd){$('message').textContent='';noticeEnd=0;}
    if(racers.every(x=>!alive(x)))menu('result');
    return;
  }
  const oldShield=run.shield;run.advance();grabCoins(me());watchSprings(me());
  if(run.tick===run.halfTick){checkpoint=run.snapshot();save(saveKey,JSON.stringify(checkpoint));notify('Halfway checkpoint saved');}
  if(!oldShield&&run.shield)notify('Prism shield charged');
  if(oldShield&&!run.shield)notify('Shield absorbed the hit');
  if(noticeEnd&&run.time>noticeEnd){$('message').textContent='';noticeEnd=0;}
  if((run.dead||run.finished)&&recFull)lastRank=keepRun(); // the run ends here, so this saves once
  if(run.dead)menu('dead');
  if(run.finished){checkpoint=null;save(saveKey,null);menu('won');}
}
function hud(){
  const pct=Math.floor(run.progress*100),key=[pct,run.section,run.prisms,run.shield,me().perfect||0,me().gold||0,scoreOf(me())].join('/');
  if(key===shownHud)return;shownHud=key;
  $('sector').textContent=sectors[run.section];$('percent').textContent=pct+'%';$('fill').style.width=pct+'%';$('prisms').textContent=scoreOf(me())+' pts  ◆ '+run.prisms+'/'+run.total+'  ★ '+(me().perfect||0)+'  gold '+(me().gold||0);$('shield').hidden=!run.shield;
}
function polygon(points,color,stroke){
  ctx.beginPath();points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();ctx.fillStyle=color;ctx.fill();
  if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=2;ctx.stroke();}
}
function rect(x,y,w,h,c){ctx.fillStyle=c;ctx.fillRect(x,y,w,h);}
function line(x,y,x2,y2,c,w=2){ctx.strokeStyle=c;ctx.lineWidth=w;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x2,y2);ctx.stroke();}
// A racer: cube body, a little face, and a floating head badge with their number.
function drawRacer(x,cx,ground,ghost,useFace,depth=0,pip=false){
  // depth>0 = drawn 'further back' on the 3D floor (up, right, smaller) so racers level with you stay visible.
  const k=1-depth*.09,r=x.r;cx+=depth*30;const cy=ground-depth*17-(r.y+CUBE/2)*k;if(cx<-80||cx>width+80)return;
  ctx.save();ctx.globalAlpha=r.dead?.3:ghost?.72:x.me?1:.9;
  ctx.translate(cx,cy);ctx.scale(k,k);ctx.rotate(r.angle*Math.PI/180);
  if(x.face>0){rect(-42,-42,84,84,x.color);rect(-34,-34,68,68,'#1b1630');face(x.face,x.color,30);}
  else{rect(-42,-42,84,84,colors[r.section]);
    if(pilot.complete&&pilot.naturalWidth){const s=Math.min(pilot.width,pilot.height);ctx.drawImage(pilot,(pilot.width-s)/2,(pilot.height-s)/2,s,s,-38,-38,76,76);}}
  ctx.restore();
  ctx.save();ctx.globalAlpha=r.dead?.35:ghost?.75:1;
  if(r.shield){ctx.strokeStyle='#8fffea';ctx.lineWidth=3;ctx.beginPath();ctx.arc(cx,cy,59*k,0,Math.PI*2);ctx.stroke();}
  ctx.textAlign='center';ctx.textBaseline='middle';
  if(!pip&&x.local&&x.flash&&performance.now()-x.flash<600){const t=(performance.now()-x.flash)/600;ctx.save();ctx.globalAlpha=1-t;ctx.fillStyle='#ffd166';ctx.font='900 22px Barlow,"Arial Black",sans-serif';ctx.fillStyle=x.grade==='CRITICAL'?'#ff8fd1':x.grade==='PERFECT'?'#ffd166':'#7cf3da';ctx.fillText((x.grade||'PERFECT')+(x.streak>1?' ×'+Math.min(x.streak,5):'!'),cx,cy-70-t*30);ctx.restore();}
  if(!pip&&x.springFlash&&performance.now()-x.springFlash<700){const t=(performance.now()-x.springFlash)/700;ctx.save();ctx.globalAlpha=1-t;ctx.fillStyle='#7cf3da';ctx.font='900 22px Barlow,"Arial Black",sans-serif';ctx.fillText('SPRING '+(x.springStreak>1?'×'+Math.min(x.springStreak,4):'BONUS')+'!',cx,cy-130-t*30);ctx.restore();}
  if(!pip&&x.coinFlash&&performance.now()-x.coinFlash<700){const t=(performance.now()-x.coinFlash)/700;ctx.save();ctx.globalAlpha=1-t;ctx.fillStyle='#ffd166';ctx.font='900 22px Barlow,"Arial Black",sans-serif';ctx.fillText('+100 GOLD',cx,cy-100-t*30);ctx.restore();}
  if(pip||(r.dead&&!x.local)){ctx.restore();return;}
  if(x.local){
    // Your own marker lives under the track (empty floor), so ghosts jumping over you never cover it.
    const fy=ground+34+(kind==='local'?x.seat*34:0)-depth*15,tag=(kind==='online'||kind==='coach')?'YOU':'P'+(x.seat+1);
    ctx.fillStyle=x.color;polygon([[cx,fy-22],[cx-9,fy-10],[cx+9,fy-10]],x.color);
    ctx.font='800 17px Barlow,"Arial Black",sans-serif';const w=ctx.measureText(tag).width+22;
    ctx.beginPath();if(ctx.roundRect){ctx.roundRect(cx-w/2,fy-8,w,26,13);}else{ctx.rect(cx-w/2,fy-8,w,26);}ctx.fill();
    ctx.fillStyle='#14121f';ctx.fillText(tag,cx,fy+5);if(kind!=='solo')medal(cx+w/2+12,fy+5,10,place(x));
  }else{
    // Ghost head badge: a small colored face with their racer number, floating above them.
    // Head badge = their face, full strength so you can always tell who is who.
    const by=cy-78*k;ctx.globalAlpha=r.dead?.45:1;ctx.fillStyle='#14121f';ctx.beginPath();ctx.arc(cx,by,21,0,Math.PI*2);ctx.fill();ctx.strokeStyle=x.color;ctx.lineWidth=3;ctx.stroke();
    ctx.save();ctx.translate(cx,by);face(x.face||1,x.color,15);ctx.restore();medal(cx+22,by-12,8,place(x));
    ctx.fillStyle=x.color;ctx.font='800 12px Consolas,monospace';ctx.fillText(r.dead?'OUT':short(x),cx,by-31);
  }
  ctx.restore();
}
// Draw the course as seen by camera racer `cam`, into the canvas rectangle (vx,vy,vw,vh) in CSS pixels.
// The main view uses the whole canvas; picture-in-picture windows use small rectangles.
function scene(camX,vx,vy,vw,vh,d,mini){
  // Small windows are zoomed-in 'face cams': the racer's cube fills about half the window height.
  const cam=camX.r,scale=mini?(vh*.5)/CUBE:Math.min(vw/690,vh/650),keepW=width,keepH=height;width=vw/scale;height=vh/scale;
  ctx.save();ctx.setTransform(d,0,0,d,0,0);ctx.beginPath();ctx.rect(vx,vy,vw,vh);ctx.clip();
  ctx.setTransform(d*scale,0,0,d*scale,d*vx,d*vy);
  const section=cam.section,sky=skies[[0,0,1,1,2,2][section]],col=colors[section],ground=mini?height*.8+cam.y:height*.73,hero=mini?width*.4:Math.min(245,width*.23),origin=hero-cam.x;
  rect(0,0,width,height,'#25203a');
  if(sky.complete&&sky.naturalWidth){
    const zoom=Math.max(width/sky.width,height/sky.height),w=sky.width*zoom,h=sky.height*zoom;
    ctx.drawImage(sky,(width-w)/2,(height-h)/2,w,h);
  }
  rect(0,ground,width,height-ground,'#19182b');line(0,ground,width,ground,col,4);
  for(let x=-160-(cam.x*.35%130);x<width+200;x+=130)line(x,ground,x+(x-width/2)*.4,height,'#37334e');
  for(let i=1;i<=6;i++){const y=ground+(height-ground)*(i/6)**2;line(0,y,width,y,'#37334e',1);}
  for(const t of cam.cues){const x=origin+t*SPEED;if(x< -12)continue;if(x>width+12)break;const ac=GOLD.has(t)?'#ffd166':'#7ffce0',w=GOLD.has(t)?5:3;
    line(x,ground+7,x,ground-18,ac,w);line(x-7,ground-11,x,ground-19,ac,w);line(x,ground-19,x+7,ground-11,ac,w);}
  for(let i=cam.first;i<cam.gates.length;i++){
    const g=cam.gates[i],x=origin+g.x,y=ground-g.base;if(x>width+45)break;if(x+g.w< -60)continue;
    if(g.kind==='gap'){rect(x,ground-2,g.w,height-ground+2,'#090a17');line(x,ground,x,ground+53,col);line(x+g.w,ground,x+g.w,ground+53,col);}
    if(g.kind==='spike')for(let n=0;n<g.teeth;n++){const w=g.w/g.teeth,l=x+n*w;polygon([[l,y],[l+w/2,y-g.h],[l+w,y]],'#71395c','#ffd1a6');}
    if(g.kind==='deck'){rect(x,y-g.h,g.w,g.h,'#46375e');rect(x,y-g.h,g.w,4,col);}
    if(g.kind==='saw'){const rr=g.w/2,pts=[];for(let n=0;n<32;n++){const a=n*Math.PI/16+cam.time*4,k=n%2?rr*.72:rr;pts.push([x+rr+Math.cos(a)*k,y-rr+Math.sin(a)*k]);}polygon(pts,'#6b5075','#ffd0b2');}
    if(g.kind==='pad'){rect(x,y-8,g.w,8,'#ffba8d');for(let n=0;n<3;n++)polygon([[x+n*14,y-13],[x+6+n*14,y-21],[x+12+n*14,y-13]],'#ffbb82');}
    if(g.prism&&!g.got){const cx=x+g.w/2,cy=y-(g.high?199:164);polygon([[cx,cy-13],[cx+11,cy],[cx,cy+13],[cx-11,cy]],'#ffb285','#fff4cd');}
  }
  {const got=camX.gotGold||new Set();for(let i=0;i<COINS.length;i++){const c=COINS[i],cx=origin+c.x;if(cx<-30)continue;if(cx>width+30)break;if(got.has(i))continue;const cy=ground-c.h,s=1+Math.sin(cam.time*6+i)*.12;
    ctx.save();ctx.translate(cx,cy);ctx.scale(s,1);ctx.fillStyle='#ffd166';ctx.beginPath();ctx.arc(0,0,15,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#fff4cd';ctx.lineWidth=3;ctx.stroke();ctx.fillStyle='#b8860b';ctx.font='900 16px Barlow,sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('S',0,1);ctx.restore();}}
  for(const l of cam.ledges||[]){const lx=origin+l.x;if(lx>width+20||lx+l.w< -20)continue;const ly=ground-l.h;rect(lx,ly,l.w,12,'#3b2f63');rect(lx,ly,l.w,4,'#ff8fd1');ctx.save();ctx.globalAlpha=.25;rect(lx,ly+12,l.w,18,'#ff8fd1');ctx.restore();}
  if(kind==='solo'){const flag=origin+cam.halfX;
    if(flag>0&&flag<width){line(flag,ground,flag,ground-124,'#89ffe2',4);polygon([[flag,ground-124],[flag+60,ground-124],[flag+42,ground-100],[flag,ground-100]],'#89ffe2');}
    const r=run,cx=hero,cy=ground-r.y-CUBE/2;
    ctx.save();ctx.translate(cx,cy);ctx.rotate(r.angle*Math.PI/180);rect(-42,-42,84,84,col);
    if(myFace>0){rect(-34,-34,68,68,'#1b1630');face(myFace,col,30);}else if(pilot.complete&&pilot.naturalWidth){const s=Math.min(pilot.width,pilot.height);ctx.drawImage(pilot,(pilot.width-s)/2,(pilot.height-s)/2,s,s,-38,-38,76,76);}ctx.restore();
    if(r.shield){ctx.strokeStyle='#8fffea';ctx.lineWidth=3;ctx.beginPath();ctx.arc(cx,cy,59,0,Math.PI*2);ctx.stroke();}
  }else if(mini){
    // In a small window, the racer it belongs to is drawn solid and centred; nobody else, so their face is clear.
    drawRacer({...camX,me:true,local:true},hero,ground,false,camX.face>0||!camX.me,0,true);
  }else{
    // Everyone on one track: ghosts first (further back on the floor), then you on top.
    const others=racers.filter(x=>!x.me),depthOf=new Map(others.map((x,i)=>[x,i+1]));
    const order=[...others].reverse().concat(racers.filter(x=>x.me));
    for(const x of order)drawRacer(x,hero+(x.r.x-cam.x),ground,!x.local,!x.me,depthOf.get(x)||0);
  }
  ctx.restore();width=keepW;height=keepH;
}
// Gold / silver / bronze medal with ribbon tails, drawn at (x,y) with radius R.
const MEDAL=['#ffd166','#d9dde6','#d99a63'];
function medal(x,y,R,rank){if(rank<1||rank>3)return;const c=MEDAL[rank-1];ctx.save();
 ctx.fillStyle=rank===1?'#e2574c':rank===2?'#4c7be2':'#3aa86b';ctx.beginPath();ctx.moveTo(x-R*.7,y-R*.3);ctx.lineTo(x-R*.95,y-R*1.7);ctx.lineTo(x-R*.15,y-R*1.7);ctx.lineTo(x,y-R*.6);ctx.lineTo(x+R*.15,y-R*1.7);ctx.lineTo(x+R*.95,y-R*1.7);ctx.lineTo(x+R*.7,y-R*.3);ctx.fill();
 ctx.fillStyle=c;ctx.beginPath();ctx.arc(x,y,R,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#00000055';ctx.lineWidth=Math.max(1,R*.14);ctx.stroke();
 ctx.fillStyle='#2a2110';ctx.font='900 '+Math.round(R*1.15)+'px Barlow,"Arial Black",sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(String(rank),x,y+R*.06);ctx.restore();}
function draw(){
  const cw=canvas.clientWidth,ch=canvas.clientHeight;if(!cw||!ch||!run)return;
  const d=Math.min(devicePixelRatio||1,2);if(canvas.width!==Math.round(cw*d)||canvas.height!==Math.round(ch*d)){canvas.width=Math.round(cw*d);canvas.height=Math.round(ch*d);}
  const main=focus();scene(main,0,0,cw,ch,d,false);
  if(kind==='solo'||mode!=='play')return;
  ctx.setTransform(d,0,0,d,0,0);
  // Face cams: a row of zoomed-in windows across the top, in race order with 1st place on the RIGHT.
  // Windows slide to their new spot when the order changes. Up to 4 shown; you are always one of them.
  // Top 3 (the medal race) + you, so at most 4 small windows on any screen.
  const list=standings();let cams=list.slice(0,4);const mine=me();if(!cams.includes(mine)){cams[cams.length-1]=mine;}
  cams=cams.sort((a,b)=>list.indexOf(b)-list.indexOf(a)); // last place on the left ... 1st on the right
  const small=cw<700,n=cams.length,gap=small?5:8,head=small?15:20,rowW=Math.min(cw*(small?.62:.58),n*(small?96:200)+(n-1)*gap);
  const pw=(rowW-(n-1)*gap)/n,ph=Math.max(36,pw*.62),py=8;
  cams.forEach((x,k)=>{
    const target=8+k*(pw+gap);x.camX=x.camX==null?target:x.camX+(target-x.camX)*.12; // slide
    const px=x.camX,out=!alive(x)&&!x.r.finished,rank=place(x),tied=racers.some(y=>y!==x&&place(y)===rank);
    rect(px-2,py-2,pw+4,ph+head+4,rank===1?'#ffd166':x.color);rect(px,py,pw,head,'#0f1122');
    ctx.textBaseline='middle';ctx.textAlign='left';ctx.fillStyle=rank===1?'#ffd166':x.color;ctx.font=(small?'800 10px':'800 12px')+' Barlow,"Arial Black",sans-serif';
    ctx.fillText((tied?'=':'')+['','1st','2nd','3rd','4th','5th','6th','7th'][rank]+' '+short(x),px+4,py+head/2);
    ctx.textAlign='right';ctx.fillStyle='#e8e8f0';ctx.font=(small?'700 9px':'700 11px')+' Consolas,monospace';
    ctx.fillText((out?'OUT ':x.r.finished?'FIN ':'')+scoreOf(x),px+pw-4,py+head/2);
    scene(x,px,py+head,pw,ph,d,true);ctx.setTransform(d,0,0,d,0,0);
    medal(px+pw-(small?11:15),py+head+(small?13:18),small?9:13,rank);
    if(out){ctx.save();ctx.globalAlpha=.55;rect(px,py+head,pw,ph,'#0b0c18');ctx.restore();ctx.fillStyle='#ffffff';ctx.font=(small?'800 12px':'800 16px')+' Barlow,"Arial Black",sans-serif';ctx.textAlign='center';ctx.fillText('OUT',px+pw/2,py+head+ph/2);}
  });
  ctx.textBaseline='middle';
  if(!alive(me())&&main!==me()&&alive(main)&&mode==='play'){ctx.fillStyle='#ffffff';ctx.font=(small?'800 13px':'800 18px')+' Barlow,"Arial Black",sans-serif';ctx.textAlign='left';ctx.textBaseline='alphabetic';ctx.fillText('You’re out · watching '+short(main),12,ch-12);}
  else if(kind==='local'){ctx.textAlign='left';ctx.fillStyle='#c9c9d6';ctx.font='700 12px Consolas,monospace';ctx.fillText('P1: left half · Space/W    P2: right half · ↑/Enter',12,ph+head+28);}
  if(mode==='play'&&countIn>0){ctx.fillStyle='#ffffff';ctx.font='800 40px Barlow,"Arial Black",sans-serif';ctx.textAlign='center';ctx.fillText('Ready · '+Math.ceil(countIn*2),cw/2,ch*.45);}
}
function frame(now){
  if(mode==='play'){
    const dt=Math.max(0,Math.min(.1,(now-last)/1000));
    if(countIn>0){
      countIn=Math.max(0,countIn-dt);
      if(kind==='solo')$('message').textContent=countIn?'Ready · '+Math.ceil(countIn*2):'';
      if(!countIn)syncTrack();
    }else acc+=dt;
    while(acc>=STEP&&mode==='play'){step();acc-=STEP;}
    const f=focus().r;
    if(!track.paused&&track.readyState>=3&&Math.abs(track.currentTime-f.time)>.22)track.currentTime=f.time;
    if(kind==='solo')hud();
  }
  last=now;draw();requestAnimationFrame(frame);
}
async function boot(){
  const response=await fetch('course.json');if(!response.ok)throw Error('course');
  score=await response.json();setSolo();buildCoins();GOLD=new Set(run.cues.filter(c=>run.accents.some(a=>Math.abs(a-c)<.001)));buildPicker();
  if(SAM_LINK)try{const s=await (await fetch('sam-run.json',{cache:'no-cache'})).json();if(s&&Array.isArray(s.jumps)&&s.jumps.every(Number.isInteger))samRun=s;}catch{}
  try{const s=JSON.parse(read(saveKey));if(run.validSave(s))checkpoint=s;}catch{}
  menu('title');requestAnimationFrame(frame);
}
boot().catch(()=>{$('detail').textContent='The course could not load. Refresh to try again.';});
