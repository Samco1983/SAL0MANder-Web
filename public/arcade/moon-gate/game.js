"use strict";
const $=id=>document.getElementById(id), {Match,idleInput,clamp}=MoonCombat;
const canvas=$('arena'), ctx=canvas.getContext('2d'), bg=new Image();bg.src='assets/stage.webp';
const names=['Black','Red'], intro=$('call'), panel=$('panel');
const controls = [
 ['left','Move left'],['right','Move right'],['jump','Jump'],['low','Crouch'],
 ['jab','Punch'],['kick','Kick'],['guard','Block'],['parry','Parry'],
 ['finish','Power finisher'],['grab','Grab shortcut'],['start','Start / pause']
];
const defaultKeys=[
 {left:'KeyA',right:'KeyD',jump:'KeyW',low:'KeyS',jab:'KeyF',kick:'KeyG',guard:'Space',parry:'KeyE',finish:'KeyT',grab:'KeyH'},
 {left:'ArrowLeft',right:'ArrowRight',jump:'ArrowUp',low:'ArrowDown',jab:'Comma',kick:'Period',guard:'ShiftRight',parry:'Slash',finish:'Enter',grab:null}
];
const defaultPad={left:14,right:15,jump:0,low:13,jab:2,kick:3,guard:4,parry:6,finish:5,grab:1,start:9};
const prefKey='moon-gate-controls-v1';
const keyboard=defaultKeys.map(m=>({...m})), padMaps=[{...defaultPad},{...defaultPad}], sources=['auto','auto'];
const keyMaps=[{},{}];
let capture=null,editor=null,controlSeat=0,controlDevice='keyboard';
const keyboardCode=/^(Key[A-Z]|Digit[0-9]|Numpad(?:[0-9]|Add|Subtract|Multiply|Divide|Decimal|Enter)|Arrow(?:Left|Right|Up|Down)|Space|Enter|Shift(?:Left|Right)|Comma|Period|Slash|Semicolon|Quote|BracketLeft|BracketRight|Backslash|Minus|Equal|Backquote|IntlBackslash)$/;
function saveControls(){
 try{localStorage.setItem(prefKey,JSON.stringify({keyboard,padMaps,sources}));return true;}catch{return false;}
}
function loadControls(){
 try{
  const saved=JSON.parse(localStorage.getItem(prefKey)||'null');if(!saved)return;
  const seen=new Set();
  const keyboards=defaultKeys.map((defs,i)=>Object.fromEntries(Object.keys(defs).map(a=>{
   const v=saved.keyboard[i][a];
   if(v===null&&a==='grab')return [a,null];
   if(!keyboardCode.test(v)||seen.has(v))throw Error('Invalid keyboard binding');
   seen.add(v);return [a,v];
  })));
  const pads=[0,1].map(i=>{const used=new Set();return Object.fromEntries(Object.keys(defaultPad).map(a=>{
   const n=saved.padMaps[i][a];if(!Number.isInteger(n)||n<0||n>63||used.has(n))throw Error('Invalid controller binding');
   used.add(n);return [a,n];
  }));});
  for(let i=0;i<2;i++){keyboard[i]=keyboards[i];padMaps[i]=pads[i];const v=saved.sources?.[i];if(/^(auto|keys|pad-\d+)$/.test(v))sources[i]=v;}
 }catch{}
}
function rebuildKeyMaps(){
 for(let i=0;i<2;i++)keyMaps[i]=Object.fromEntries(Object.entries(keyboard[i]).filter(([,code])=>code!==null).map(([action,code])=>[code,action]));
 if(keyboard[0].guard==='Space'&&!keyMaps[0].KeyR&&!keyMaps[1].KeyR)keyMaps[0].KeyR='alternateGuard';
}
loadControls();rebuildKeyMaps();
function keyLabel(code){
 if(!code)return 'Unassigned';
 const names={ArrowLeft:'←',ArrowRight:'→',ArrowUp:'↑',ArrowDown:'↓',ShiftRight:'Right Shift',ShiftLeft:'Left Shift',Period:'.',Comma:',',Slash:'/',Minus:'-',Equal:'=',Semicolon:';',Quote:"'",BracketLeft:'[',BracketRight:']',Backslash:'Backslash',Backquote:'Backtick'};
 return names[code]||code.replace(/^Key|^Digit/,'').replace(/^Numpad/,'Num ');
}
const buttonLabels=['A / Cross','B / Circle','X / Square','Y / Triangle','LB / L1','RB / R1','LT / L2','RT / R2','Back / Share','Start / Options','L3','R3','D-pad up','D-pad down','D-pad left','D-pad right','Home'];
function padLabel(n){return buttonLabels[n]||'Button '+n;}
function labelFor(i,action,device){
 return device==='pad'?padLabel(padMaps[i][action]):keyLabel(keyboard[i][action]);
}
function bindControl(i,device,action,value){
 const keyboardMode=device==='keyboard',maps=keyboardMode?keyboard:padMaps;
 if(keyboardMode&&!keyboardCode.test(value))return 'Choose a letter, number, arrow, Shift, Space or punctuation key.';
 if(!keyboardMode&&(!Number.isInteger(value)||value<0||value>63))return 'Choose a controller button.';
 if(keyboardMode&&Object.values(keyboard[1-i]).includes(value))return keyLabel(value)+' is assigned to '+names[1-i]+'. Choose another key.';
 const map=maps[i],old=map[action],conflict=Object.keys(map).find(k=>k!==action&&map[k]===value);
 if(conflict&&old===null)return 'That key already controls '+controls.find(([a])=>a===conflict)[1].toLowerCase()+'. Choose a free key.';
 if(conflict)map[conflict]=old;
 map[action]=value;
 rebuildKeyMaps();cleanInputs();return '';
}
function redrawStrips(){
 for(let i=0;i<2;i++){
  const node=$(i?'redKeys':'keyStrip'),device=assigned[i]!==null?'pad':'keyboard',label=a=>labelFor(i,a,device);
  node.replaceChildren();const title=document.createElement('b');title.textContent=names[i].toUpperCase();node.append(title);
  for(const [keys,action] of [[[label('left'),label('right')],'Move'],[[label('jump')],'Jump'],[[label('low')],'Crouch'],[[label('jab')],'Punch'],[[label('kick')],'Kick'],[[label('jab'),label('kick')],'Grab'],[[label('guard')],'Block'],[[label('low'),label('guard')],'Low block'],[[label('parry')],'Parry'],[[label('finish')],'Power']]){
   const span=document.createElement('span');
   keys.forEach((key,index)=>{if(index)span.append(action==='Move'?' / ':' + ');const k=document.createElement('kbd');k.textContent=key;span.append(k);});span.append(' '+action);node.append(span);
  }
 }
}
const binds=[{},{}],touchKeys=[{},{}],padMemory=new Map(),queue=[{},{}];
let match,mode='solo',paused=false,token=0,fx=[],flag=null,shake=0,notices=0,endAge=0,last=performance.now(),acc=0,clock=0,freezeCaption=0,koScene=null,mealCue=0,landed=false,roundLit=false;
let activePads=[],assigned=[null,null],lastPadCheck=0,view='';
function getPads(){try{return Array.from(navigator.getGamepads?.()||[]).filter(p=>p?.connected);}catch{return [];}}
function detectPads(){
 const previous=assigned.join(',');activePads=getPads();const taken=new Set();assigned=[null,null];const players=mode==='solo'?[0]:[0,1];
 for(const i of players)if(sources[i].startsWith('pad-')){
  const id=Number(sources[i].slice(4));if(activePads.some(p=>p.index===id)&&!taken.has(id)){assigned[i]=id;taken.add(id);}
 }
 const auto=mode==='solo'?[0]:[1,0];
 for(const i of auto)if(sources[i]==='auto'){const free=activePads.find(p=>!taken.has(p.index));if(free){assigned[i]=free.index;taken.add(free.index);}}
 if(previous!==assigned.join(','))redrawStrips();
}
function keyEnabled(i){return assigned[i]===null&&!sources[i].startsWith('pad-');}
function blockEvents(){return !match||match.phase!=='fight'||paused;}
function queuePress(i,act,oppositeHeld=false){
 if(blockEvents())return;
 const presses=queue[i];
 if((act==='jab'||act==='kick') && oppositeHeld){
  delete presses.jab;delete presses.kick;
  presses.grab=true;presses.grabChord=true;
 }else if(!presses.grabChord || (act!=='jab'&&act!=='kick'))presses[act]=true;
}
function otherAttack(action){return action==='jab'?'kick':action==='kick'?'jab':null;}
function cleanInputs(){for(let i=0;i<2;i++){binds[i]={};queue[i]={};}for(const t of touchKeys)for(const k in t)delete t[k];document.querySelectorAll('.on[data-key]').forEach(el=>el.classList.remove('on'));}
const fullButton=$('fullScreen'),cabinet=document.querySelector('.cabinet'),header=cabinet.querySelector('header');
cabinet.append(panel);
const displayHelp=document.createElement('aside');
displayHelp.setAttribute('role','status');displayHelp.className='displayHelp';displayHelp.hidden=true;
header.after(displayHelp);
function showScreenStatus(message){
 displayHelp.textContent=message;displayHelp.hidden=!message;
}
function nativeFull(){
 return (document.fullscreenElement||document.webkitFullscreenElement)===cabinet;
}
function sizeArena(){
 let width=960,height=540;
 if(nativeFull()){
  const slot=$('arenaSlot').getBoundingClientRect();
  const scale=Math.min(slot.width/960,slot.height/540);
  if(scale>0){width=Math.round(slot.width/scale);height=Math.round(slot.height/scale);}
 }
 if(canvas.width!==width)canvas.width=width;
 if(canvas.height!==height)canvas.height=height;
}
new ResizeObserver(sizeArena).observe($('arenaSlot'));
let fullPending=false,toolbarTimer,monitorTimer,wasFull=false;
function revealTools(){
 if(!nativeFull())return;
 cabinet.classList.add('showTools');clearTimeout(toolbarTimer);
 toolbarTimer=setTimeout(()=>{if(!header.contains(document.activeElement))cabinet.classList.remove('showTools');},2200);
}
cabinet.addEventListener('pointermove',e=>{if(e.clientY<=24)revealTools();});
cabinet.addEventListener('pointerdown',e=>{
 if(e.pointerType==='touch'&&e.target===canvas)revealTools();
});
cabinet.addEventListener('keydown',e=>{if(e.key==='Tab')revealTools();});
header.addEventListener('focusout',()=>{if(cabinet.classList.contains('showTools'))revealTools();});
async function exitGameScreen(){
 const exit=document.exitFullscreen||document.webkitExitFullscreen;
 if(nativeFull()&&exit)await exit.call(document);
}
function updateFull(){
 const active=nativeFull();
 if(active===wasFull)return;
 wasFull=active;clearTimeout(toolbarTimer);clearTimeout(monitorTimer);
 cabinet.classList.remove('showTools');
 document.documentElement.classList.toggle('game-expanded',active);
 document.documentElement.classList.toggle('monitor-game',active);
 fullButton.textContent=active?'Exit full screen':'Full screen';
 fullButton.setAttribute('aria-pressed',String(active));sizeArena();
 if(!active){fullButton.focus({preventScroll:true});return;}
 showScreenStatus('');
 canvas.tabIndex=-1;canvas.focus({preventScroll:true});
 monitorTimer=setTimeout(async()=>{
  const windowIsSmall=(innerWidth+3<screen.width&&outerWidth+3<screen.width)||
   (innerHeight+3<screen.height&&outerHeight+3<screen.height);
  if(nativeFull()&&windowIsSmall){
   await exitGameScreen();
   showScreenStatus('The browser kept the game inside this window. Full screen is unavailable here.');
  }
 },1000);
}
async function toggleFull(){
 if(fullPending)return;
 fullPending=true;
 try{
  if(nativeFull()){await exitGameScreen();return;}
  const enter=cabinet.requestFullscreen||cabinet.webkitRequestFullscreen;
  const enabled=document.fullscreenEnabled??document.webkitFullscreenEnabled;
  if(!enter||enabled===false){
   showScreenStatus(window.self===window.top?'This browser does not allow full screen here.':'This preview blocks full screen on your monitor.');
   return;
  }
  showScreenStatus('');
  if(cabinet.requestFullscreen)await enter.call(cabinet,{navigationUI:'hide'});
  else await enter.call(cabinet);
 }catch{showScreenStatus('The browser blocked full screen on your monitor.');}
 finally{fullPending=false;updateFull();}
}
fullButton.onclick=toggleFull;
document.addEventListener('fullscreenchange',updateFull);
document.addEventListener('webkitfullscreenchange',updateFull);
window.addEventListener('keydown',e=>{
 if(capture&&panel.open&&(capture.device==='keyboard'||e.code==='Escape')){
  e.preventDefault();
  if(e.repeat)return;
  if(e.code==='Escape'){capture=null;editor?.('Assignment canceled.');return;}
  if(e.metaKey||e.ctrlKey||e.altKey)return;
  finishCapture(e.code);return;
 }
 if(panel.open||e.metaKey||e.ctrlKey||e.altKey)return;
 if(e.code==='Escape'&&nativeFull()){e.preventDefault();toggleFull();return;}
 if(e.code==='Escape'&&match){e.preventDefault();openPanel('pause');return;}
 if(!match||!$('result').hidden){
  if(match?.phase==='roundEnd' && e.code==='Enter' && !e.repeat && e.target.tagName!=='BUTTON'){
   e.preventDefault();beginRound();
  }
  return;
 }
 keyMaps.forEach((keys,i)=>{const a=keys[e.code];if(!a||!keyEnabled(i)||(i&&mode==='solo'))return;e.preventDefault();
  if(!binds[i][a]&&!e.repeat){binds[i][a]=true;queuePress(i,a,!!binds[i][otherAttack(a)]);}
 });
});
window.addEventListener('keyup',e=>{keyMaps.forEach((map,i)=>{if(map[e.code])delete binds[i][map[e.code]];});});
document.querySelectorAll('[data-key]').forEach(el=>{
 const a=el.dataset.key,who=Number(el.dataset.player||0);el.addEventListener('pointerdown',e=>{e.preventDefault();el.setPointerCapture(e.pointerId);touchKeys[who][a]=true;queuePress(who,a,!!touchKeys[who][otherAttack(a)]);el.classList.add('on');});
 const release=()=>{delete touchKeys[who][a];el.classList.remove('on');};el.onpointerup=release;el.onlostpointercapture=release;el.onpointercancel=release;
});
function samplePads(){
 for(const p of getPads()){
  const i=assigned.indexOf(p.index),b=p.buttons,pressed=n=>!!b[n]?.pressed, map=padMaps[i>=0?i:0];
  if(capture?.device==='pad'){
   if(p.index!==capture.padIndex)continue;
   const seen=capture,raw=b.map(btn=>!!btn?.pressed);const key=raw.findIndex((on,n)=>on&&!seen.held[n]);seen.held=raw;
   if(key>=0){finishCapture(key);padMemory.delete(p.index);}continue;
  }
  const old=padMemory.get(p.index)||{},now={};for(const [a,n] of Object.entries(map)){
   now[a]=pressed(n);
   if(now[a]&&!old[a]){
    if(a==='start'&&i>=0){if(panel.open&&view==='inputs')continue;if(panel.open){panel.close();}else if(!match){startMatch();}else if(match.phase==='roundEnd'&&!$('result').hidden){beginRound();}else openPanel('pause');}
    else if(i>=0)queuePress(i,a,otherAttack(a)!==null&&pressed(map[otherAttack(a)]));
   }
  }
  now.left=now.left||(p.axes[0]||0)<-.32;now.right=now.right||(p.axes[0]||0)>.32;now.low=now.low||(p.axes[1]||0)>.37;
  padMemory.set(p.index,now);
 }
}
function input(i,consume){
 const keys=assigned[i]!==null?(padMemory.get(assigned[i])||{}):binds[i];
 const down=a=>!!keys[a]||!!touchKeys[i][a];
 const press=consume?queue[i]:{};if(consume)queue[i]={};
 return {move:+down('right')-+down('left'),low:down('low'),guard:down('guard')||down('alternateGuard'),press};
}
function call(text,sub='',bounds=false){intro.hidden=!text;intro.classList.toggle('ringCall',bounds);intro.querySelector('b').textContent=text;intro.querySelector('small').textContent=sub;}
function notice(text,duration=1){$('notice').replaceChildren();if(text){const sp=document.createElement('span');sp.textContent=text;$('notice').append(sp);}notices=duration;}
const victorySeconds=6;
const prizeSpot={x:450,y:352},pickupAt=2.30,feastSeconds=9.55;
const biteTimes=[3.22,5.18,6.55];
const eatingSounds=biteTimes.map((time,i)=>[time,['biteOne','biteTwo','biteThree'][i],1,1.20]);
eatingSounds.push([7.60,'gulp',.98,1.05]);
function progress(t){const u=clamp(t,0,1);return u*u*(3-2*u);}
function victoryMeal(w,age){
 const dir=w.x<=prizeSpot.x?1:-1;
 const target=prizeSpot.x-dir*46*1.06;
 const travel=progress((age-1.04)/1.01), distance=target-w.x;
 const retreat=progress((age-pickupAt)/.62);
 const pose={x:w.x+travel*distance-dir*45*retreat,y:0,angle:0,dir,
  state:'victory',reach:undefined,contactTarget:null,fromPose:'salute',pose:'salute',blend:1};
 if(age<1.04)return pose;
 if(age<1.90){
  pose.pose='walk';pose.blend=progress((age-1.04)/.12);pose.step=travel*Math.abs(distance)*.075;
 }else if(age<pickupAt){
  pose.fromPose='walk';pose.pose='carry';pose.blend=progress((age-1.90)/.3);
 }else if(age<pickupAt+.48){
  pose.fromPose='carry';pose.pose='prize';pose.blend=progress((age-pickupAt)/.48);
 }else{
  const i=biteTimes.findIndex(t=>age<t+.98);
  if(i<0){
   pose.fromPose='chew';pose.pose='bow';pose.blend=progress((age-7.53)/.30)*(1-progress((age-7.95)/.32));
   if(age>=8.27){pose.fromPose='chew';pose.pose='salute';pose.blend=progress((age-8.27)/.44);}
  }else{
   const since=age-biteTimes[i];
   pose.fromPose=since<0?(i?'chew':'prize'):'bite';pose.pose=since<0?'bite':'chew';
   pose.blend=since<0?progress((since+.34)/.34):progress(since/.31);
   if(since>=0){pose.jaw=(.5+.5*Math.cos((since-.07)*2*Math.PI/.315))*(1-progress((since-.82)/.16));pose.y=2.3*pose.jaw;}
  }
 }
 return pose;
}
const roundBoardAt=1.42,matchBoardAt=2.90;
const marqueeFirstBeat=8.10,marqueeInterval=.32;
let resultFace=null,returningBoard=null,marqueeBeats=0;
function timeLeft(m){return '0:'+String(Math.max(0,Math.ceil(m.time))).padStart(2,'0');}
const crowd={at:-100,strong:false,duration:1.1};
const rulesText=$('railDesc').textContent;
const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)');
let ringScene=null;
function showRingOut(fighters,title,detail){
 const exits=fighters.map(fighter=>{
  const side=fighter.x<MoonCombat.ring.left?-1:1;
  const startX=clamp(fighter.x,96,864);
  const finishX=side<0?67:893;
  return {fighter:{...fighter,x:startX},side,finishX};
 });
 ringScene={at:clock,exits};
 freezeCaption=0;notice('');call(title,detail,true);Sound.cue('bell');
}
function ringOutPose(exit,age){
 const {fighter,side,finishX}=exit;
  const t=reducedMotion.matches?1:clamp(age/.73,0,1);
 const slide=1-(1-t)**2;
 const grounded=fighter.state==='down';
 let from=fighter.pose,to='reel',blend=clamp(t/.24,0,1);
 if(grounded){
  to='splat';blend=clamp(t/.65,0,1);
 }else if(t>=.24&&t<.70){
  from='reel';to='fall_open';blend=(t-.24)/.46;
 }else if(t>=.70){
  from='fall_open';to='splat';blend=(t-.70)/.30;
 }
 return {...fighter,state:'ringOut',fromPose:from,pose:to,blend,reach:undefined,contactTarget:null,
   x:fighter.x+(finishX-fighter.x)*slide,y:49*t*t-(grounded?5:22)*Math.sin(Math.PI*t),
   shadowDrop:49,angle:grounded?0:side*.42*Math.sin(Math.PI*t)};
}
function noteFlag(id){
 crowd.at=clock;crowd.strong=roundLit;crowd.duration=roundLit?(match.phase==='won'?feastSeconds:victorySeconds)-endAge:1.1;
 Sound.applause(crowd.strong,crowd.duration,roundLit&&match.phase==='won');flag={id,at:clock};
 const side=document.querySelectorAll('.fighterHUD')[id];side.classList.remove('lit');void side.offsetWidth;side.classList.add('lit');
}
function effect(kind,x,y,n=14,col='#fff1c2'){
 for(let i=0;i<n;i++){const ang=(i+.5*Math.random())/n*Math.PI*2,v=32+Math.random()*(kind==='ko'?310:164);
 fx.push({x,y,vx:Math.cos(ang)*v,vy:Math.sin(ang)*v,t:0,life:.13+Math.random()*(kind==='ko'?.4:.17),col,ground:kind==='ground'});}
}
function events(type,e={}){
 const who=names[e.id]||'',q=n=>Sound.cue(n),voice=e.id?'voiceRed':'voiceBlack';
 if(type==='aim'){
   const head=Art.joints(match.f[e.victim],clock)[2];
   e.x=head.x-match.f[e.id].dir*12;e.y=head.y-4;return;
 }
 if(type==='ringOut'){
  match.decidingRead=names[e.victim]+' landed or stepped outside the line. Take the middle back.';
  showRingOut([match.f[e.victim]],'OUT OF BOUNDS',names[e.victim].toUpperCase()+' OUT  /  '+who.toUpperCase()+' +1');
 }
 if(type==='doubleOut'){flag=null;showRingOut(match.f,'DOUBLE RING OUT','BOTH OUT  /  NO POINT');}
 if(type==='restart'){ringScene=null;call('');cleanInputs();}
 if(type==='throwPunish'){notice(who+' catches the reach',.72);match.throwRead=match.clock;}
 if(type==='swing'){q('whoosh');if(MoonCombat.airKick(e.type))q(e.id?'watah':'risingFlip');else if(e.type==='kick')q(e.id?'hiya':'risingKick');else if(e.type==='sweep')q('skid');else if(e.type==='cross')q(voice);}
 if(type==='jump'){q('air');}
 if(type==='land')q('step');
 if(type==='point'&&e.points<2&&!match.sudden)noteFlag(e.id);
 if(type==='hit'||type==='trip'){
   const opponent=names[e.victim];
   match.decidingRead=match.throwRead===match.clock?who+' caught '+opponent+' reaching for a throw. A missed grab leaves time for a punch.':
     MoonCombat.airKick(e.type)?who+' landed an overhead kick. Stand and block to cover your head.':
     type==='trip'?who+' swept the legs. Crouch and block to catch the sweep.':
     e.type==='cross'?who+' landed a driving cross. Stand and block or step out of reach.':
     e.type==='kick'?who+' landed a side kick. Either guard can stop it.':who+' landed a high jab. Standing guard covers that punch.';
   const heavy=e.type!=='jab';q(e.type==='jab'||e.type==='cross'?'slap':type==='trip'?'sweep':'heavy');q(e.victim?'ouchRed':'ouchBlack');
   if(MoonCombat.airKick(e.type)){q('slap');notice('Overhead',.38);}
   shake=heavy?6:3;effect('hit',e.x,e.y,heavy?18:10);if(e.chain>1)notice(who+' · '+e.chain+' hit combo',.65);
 }
 if(type==='floor'){const f=match.f[e.id];q('floor');shake=6;effect('ground',f.x,445,18,'#bd8862');}
 if(type==='throw'){q('throw');shake=3;notice(match.escapeFrames?'Grab now to escape':'Throw locked',.40);}
 if(type==='escape'){q('parry');effect('parry',e.x,e.y,14,'#60ebd4');notice('Throw escaped',.68);}
 if(type==='launch'){q('air');match.decidingRead=who+' scored the throw. Press Punch + Kick as the grab connects to escape.';}
 if(type==='block'||type==='break'){q('block');effect('block',e.x,e.y,9,'#f3c17d');if(type==='break')notice('Guard broken',.7);}
 if(type==='parry'){q('parry');q('hiss');effect('parry',e.x,e.y,19,'#7affdb');notice(names[e.victim]+(match.f[e.victim].power>=100?' · Moon counter ready':' · Perfect parry'),.78);}
 if(type==='miss')notice(names[e.id]+' · Parry exposed',.4);
 if(type==='clash'){q('block');effect('clash',e.x,e.y);}
 if(type==='hint'&&e.id===0)notice(e.text,.7);
 if(type==='sudden'){call('Golden point','NEXT CLEAN HIT WINS');freezeCaption=1;q('bell');}
 if(type==='ko'){match.decidingRead=e.type==='finish'?who+' spent full power after a parry.':who+' caught a missed parry. An early held block is safer.';q('ko');q(e.id?'wuaa':'risingFinish');shake=12;effect('ko',e.x,e.y,34);koScene=e;}
 if(type==='end'){if(e.reason==='ON POINTS')match.decidingRead='Time expired. The higher point total wins.';endAge=0;roundLit=false;flag=null;mealCue=0;landed=false;freezeCaption=0;cleanInputs();notice('');
  resultFace=Venue.resultFace(match,timeLeft(match));marqueeBeats=0;
  if(!ringScene){q('bell');call('');}}
}
function setMode(v){mode=v;$('redKeys').hidden=v!=='versus';detectPads();redrawStrips();$('solo').setAttribute('aria-pressed',String(v==='solo'));$('versus').setAttribute('aria-pressed',String(v==='versus'));}
$('solo').onclick=()=>setMode('solo');$('versus').onclick=()=>setMode('versus');
function matchLayout(playing){
 $('stage').classList.toggle('menu',!playing);$('cover').hidden=playing;$('hud').hidden=!playing;$('pause').hidden=!playing;
 const coarse=matchMedia('(pointer:coarse)').matches,duoTouch=playing&&coarse&&mode==='versus';$('touch').hidden=!playing||!coarse;$('touch2').hidden=!duoTouch;cabinet.classList.toggle('duoTouch',duoTouch);
}
function startMatch(){token++;Sound.stopAll();Sound.resume();Sound.startMusic();detectPads();match=new Match(mode,events);match.contactTest=Art.canConnect;matchLayout(true);beginRound();}
async function beginRound(){
 returningBoard=match.phase==='roundEnd'&&resultFace&&!reducedMotion.matches
  ?{face:resultFace,name:names[match.roundWinner],at:clock}:null;
 const serial=++token;crowd.at=-100;Sound.stopCrowd();koScene=null;ringScene=null;flag=null;shake=0;fx=[];mealCue=0;landed=false;endAge=0;cleanInputs();
 resultFace=null;marqueeBeats=0;$('stage').classList.remove('showStand');
 $('result').hidden=true;$('result').classList.remove('between');$('railTitle').textContent='Tournament rules';$('railDesc').textContent=rulesText;
 match.nextRound();match.decidingRead='';match.throwRead=-1;updateHud();notice('');
 call('Round '+match.round,match.round===1?'WIN THREE ROUNDS TO CLAIM THE LAST DUMPLING':'TWO POINTS WIN / RING OUT SCORES ONE');
 await Sound.callRound(match.round);if(serial!==token)return;
 call('始め！','HAJIME  /  FIGHT');await Sound.callFight();if(serial!==token)return;
 queue[0]={};queue[1]={};match.fight();call('');
}
function toMenu(){token++;match=null;paused=false;flag=null;ringScene=null;fx=[];call('');notice('');$('result').hidden=true;$('railTitle').textContent='Tournament rules';$('railDesc').textContent=rulesText;cleanInputs();Sound.stopAll();matchLayout(false);setMode(mode);}
$('start').onclick=startMatch;$('again').onclick=()=>{if(match?.phase==='won')startMatch();else if(match?.phase==='roundEnd'&&!paused)beginRound();};$('home').onclick=toMenu;
function updateHud(){
 if(!match)return;const m=match;
 $('round').textContent='ROUND '+m.round+' / 5';$('timer').textContent=m.sudden?'G.P.':timeLeft(m);
 const scores=m.f.map((f,i)=>m.roundWinner===i&&!roundLit&&f.points===2?1:f.points);
 const display=m.sudden?'GP':$('timer').textContent;
 const board=$('digits'),key=[m.round,display,...scores].join('/');
 if(board.dataset.value!==key){
  board.dataset.value=key;Venue.scoreboard(board,display,scores,m.round);
  board.setAttribute('aria-label','Round '+m.round+'. Black '+scores[0]+', Red '+scores[1]+'. '+(m.sudden?'Golden point.':display+' remaining.'));
 }
 m.f.forEach((f,i)=>{
  $('g'+i).style.width=f.guard+'%';$('p'+i).style.width=f.power+'%';const shown=m.wins[i]-(m.roundWinner===i&&!roundLit?1:0);$('w'+i).textContent='◆'.repeat(shown)+'◇'.repeat(3-shown);
  const status=m.roundWinner!=null&&roundLit?(m.roundWinner===i?'ROUND WIN':m.reason==='RING OUT'?'OUT':'ROUND OVER'):f.state==='landing'?'LANDING':f.state==='break'?'GUARD BREAK':f.state==='blockstun'?'BLOCK STUN':f.state==='miss'?'EXPOSED':f.state==='guard'?(f.lowGuard?'LOW GUARD':'HIGH GUARD'):f.state==='parry'?'PARRY':f.power>=100?'POWER FULL':'';
  $('s'+i).textContent=status;
 });
}
function drawVenue(){
 Venue.platform(ctx,MoonCombat.ring);
 Venue.boundary(ctx,MoonCombat.ring);
 if(ringScene){
  for(const side of new Set(ringScene.exits.map(exit=>exit.side))){
   Venue.crossedEdge(ctx,MoonCombat.ring,side,clock-ringScene.at,reducedMotion.matches);
  }
 }
 const final=match.phase==='won',boardAge=endAge-(final?matchBoardAt:roundBoardAt);
 let turn=resultFace?(reducedMotion.matches?Number(boardAge>=0):clamp(boardAge/.78,0,1)):0;
 if(returningBoard)turn=reducedMotion.matches?0:clamp(1-(clock-returningBoard.at)/.45,0,1);
 Venue.resultStand(ctx,$('digits'),returningBoard?.face||resultFace,
  returningBoard?.name||names[match.roundWinner],final,turn,marqueeBeats,
  endAge-marqueeFirstBeat,reducedMotion.matches);
 Venue.audience(ctx,clock,crowd);
 Venue.chef(ctx,prizeSpot.x,prizeSpot.y,1);
 Venue.prizeTable(ctx,prizeSpot.x,prizeSpot.y+5);
 if(match.phase!=='won'||endAge<pickupAt){
  Art.drawDumpling(ctx,prizeSpot.x,prizeSpot.y,1.95,0,reducedMotion.matches?.63:clock);
 }
 Venue.steamerLid(ctx,prizeSpot.x,prizeSpot.y,1);
 const held=roundLit&&match?.roundWinner!=null,age=flag?clock-flag.at:3;
 const lift=clamp(held?age*7:Math.min(age*7,(1.30-age)*5),0,1);
 Venue.referee(ctx,clock,held?match.roundWinner:flag?.id,lift);
}
let filmTime=0,lastFilmPaint=-1;
const quietAudience={at:-100,strong:false,duration:0};
const filmBoard=document.createElement('canvas');filmBoard.width=640;filmBoard.height=162;
Venue.scoreboard(filmBoard,'0:30',[0,0],1);
function openingFighter(id,t){
 const keys=window.MOON_GATE_OPENING[id];
 const next=keys.findIndex(k=>k[0]>t),b=keys[next<0?keys.length-1:next],a=keys[next<=0?(next<0?keys.length-1:0):next-1];
 const u=progress((t-a[0])/(b[0]-a[0]||1));
 return {id,x:a[1]+(b[1]-a[1])*u,y:0,filmHip:447+(a[2]+(b[2]-a[2])*u-460)*1.06,
  dir:a[3],angle:(a[4]+(b[4]-a[4])*u)*Math.PI/180,fromPose:a[5],pose:b[5],blend:u,state:'film'};
}
function attract(elapsed,now){
 if(document.hidden||panel.open||!bg.complete||!bg.naturalWidth)return;
 if(!reducedMotion.matches)filmTime=(filmTime+elapsed)%14;
 if(now-lastFilmPaint<1000/30)return;
 lastFilmPaint=now;
 const t=reducedMotion.matches?1.9:filmTime,wide=progress((t-2.0)/2.15)*(1-progress((t-12)/2));
 const lid=progress((t-.22)/1.05)*(1-progress((t-13.35)/.62));
 const zoom=2.52-1.52*wide,focusY=350+43*wide;
 const side=(canvas.width-960)/2,vertical=(canvas.height-540)/2;
 ctx.save();ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,canvas.width,canvas.height);
 ctx.translate(side+657,vertical+294);ctx.scale(zoom,zoom);ctx.translate(-prizeSpot.x,-focusY);
 Venue.courtyard(ctx,bg,side+280,vertical+240);Venue.platform(ctx,MoonCombat.ring);Venue.boundary(ctx,MoonCombat.ring);
 Venue.resultStand(ctx,filmBoard,null,'',false,0,0);
 Venue.audience(ctx,t,quietAudience);Venue.chef(ctx,prizeSpot.x,prizeSpot.y,lid);
 Venue.prizeTable(ctx,prizeSpot.x,prizeSpot.y+5);
 ctx.save();ctx.globalAlpha=progress(lid/.47);
 Art.drawDumpling(ctx,prizeSpot.x,prizeSpot.y,1.95,0,t+.63);ctx.restore();
 Venue.steamerLid(ctx,prizeSpot.x,prizeSpot.y,lid);
 Venue.referee(ctx,t,null,0);
 for(const id of [0,1])Art.drawFighter(ctx,openingFighter(id,Math.min(t,12)),t);
 ctx.restore();$('stage').classList.add('hasFilm');
}
function copyF(f,pose,blend=1){return {...f,fromPose:f.pose,pose,blend,reach:undefined};}
function endFighters(){
 const f=match.f.map(a=>({...a})),id=match.roundWinner,w=f[id],l=f[1-id],age=endAge;
 const decision=match.reason==='RING OUT'||match.reason==='ON POINTS';
 const finishKind=koScene?.type||w.move, trip=l.state==='tripped',flight=l.state==='thrown', strikes=koScene||!trip&&!flight;
 const lock=koScene?.20:.09;const u=clamp((age-lock)/(trip?.60:.70),0,1);
 if(decision){Object.assign(l,copyF(l,l.pendingOut?'splat':'guard'),{x:clamp(l.x,90,870),angle:0,y:0});}
 else if(trip||flight){
  const m=new Match('versus');m.f=[{...f[0]},{...f[1]}];m.phase='roundEnd';
  const detached=m.f[1-id];m.f[id].state=flight?'toss':w.state;
  for(let n=0;n<Math.min(85,Math.floor(age*60));n++){if(detached.state==='down')break;m.stepFighter(detached,m.f[id],idleInput(),1/60);}
  Object.assign(l,detached);if(age>1)Object.assign(l,copyF(l,'down'),{y:0,angle:0});
 }else{
  const aerial=MoonCombat.airKick(finishKind);l.x=clamp(l.x+w.dir*(koScene?178:aerial?155:108)*(1-(1-u)**2),60,900);
  l.y=-(koScene?106:aerial?77:46)*4*u*(1-u);l.angle=-w.dir*Math.sin(Math.PI*u)*.57;
  Object.assign(l,copyF(l,u<.11?'reel':u<.46?'loft':u<.81?'fall_open':'splat',clamp(.6+age*4,0,1)));
 }
 if(!decision&&!landed&&age>(trip?.63:flight?.80:.80)){landed=true;Sound.cue('floor');shake=8;effect('ground',l.x,444,20,'#bc8658');}
 if(age<.79){
  if(decision){Object.assign(w,copyF(w,'guard'),{angle:0,y:0});}
  else if(flight){Object.assign(w,copyF(w,age<.25?'hoist':'cast'));}
  else if(strikes&&finishKind){w.pose=MoonCombat.moves[finishKind].hit;w.blend=1;w.angle=0;
   if(MoonCombat.airKick(finishKind)){const settle=clamp((age-.17)/.28,0,1);w.y*=1-settle;
     if(settle>0){w.contactTarget=null;w.pose='high';}}
   }
 }else if(match.phase==='won'){
  Object.assign(w,victoryMeal(w,age));
 }else{
  const bow=clamp((age-2.05)/.42,0,1)*clamp((3.75-age)/.5,0,1);
  Object.assign(w,{fromPose:'salute',pose:'bow',blend:bow,y:0,angle:0,reach:undefined});
 }
 return f;
}
function render(){
 if(!match||!bg.complete||!bg.naturalWidth)return;
 const side=(canvas.width-960)/2,vertical=(canvas.height-540)/2;
 ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,canvas.width,canvas.height);ctx.save();
 ctx.translate(side,vertical);
 const jitter=shake*(matchMedia('(prefers-reduced-motion: reduce)').matches?.15:1);
 ctx.translate(Math.sin(clock*132)*jitter,Math.cos(clock*97)*jitter*.55);
 Venue.courtyard(ctx,bg,side,vertical);
 const ended=['roundEnd','won'].includes(match.phase),f=ended?endFighters():match.f.slice();
 if(ringScene){
  for(const exit of ringScene.exits)f[exit.fighter.id]=ringOutPose(exit,clock-ringScene.at);
 }
 const belowLedge=ringScene&&(reducedMotion.matches||clock-ringScene.at>.35);
 if(belowLedge)for(const a of f)if(a.state==='ringOut')Art.drawFighter(ctx,a,clock);
 drawVenue();
 for(const a of f){
  if(belowLedge&&a.state==='ringOut')continue;
  if(a.state==='attack'&&['flip','jumpIn','jumpAway','finish','cross','kick'].includes(a.move)&&a.age>MoonCombat.moves[a.move].start*.66&&a.age<MoonCombat.moves[a.move].start+.13){
   ctx.save();ctx.globalAlpha=.18;Art.drawFighter(ctx,{...a,x:a.x-a.dir*11,blend:.64},clock-.03);ctx.restore();
  }
  Art.drawFighter(ctx,a,clock);
 }
 if(match.phase==='won'&&endAge>=pickupAt){
  const winner=f[match.roundWinner],joints=Art.joints(winner,clock),hand=joints[6],head=joints[2];
  const bites=biteTimes.filter(t=>endAge>=t).length;
  const lifted=progress((endAge-pickupAt)/.48);
  Art.drawDumpling(ctx,hand.x+winner.dir*lifted*(bites===0?19:11),hand.y-12+lifted*9,1.95,bites,reducedMotion.matches?.63:clock,winner.dir);
  const since=endAge-biteTimes[bites-1];
  if(since>=0&&since<.38&&!reducedMotion.matches){
   ctx.fillStyle='#f9d69e';ctx.globalAlpha=1-since/.38;
   for(let n=0;n<4;n++)ctx.fillRect(head.x+winner.dir*(12+since*(16+n*19)),head.y+8+since*(n-2)*32+since*since*150,2.7,2.3);
   ctx.globalAlpha=1;
  }
 }
 for(const a of fx){const q=1-a.t/a.life;ctx.globalAlpha=Math.max(0,q);ctx.strokeStyle=a.col;ctx.lineWidth=a.ground?3:2.8;
  ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(a.x-a.vx*.052*q,a.y-a.vy*.052*q);ctx.stroke();}
 ctx.restore();ctx.globalAlpha=1;
}
function step(dt){
 if(!match||paused)return;clock+=dt;shake=Math.max(0,shake-38*dt);
 if(ringScene&&!ringScene.landed&&clock-ringScene.at>=(reducedMotion.matches?.04:.73)){
  ringScene.landed=true;Sound.cue('floor');
  for(const exit of ringScene.exits)effect('ground',exit.finishX,495,reducedMotion.matches?0:9,'#b48f67');
 }
 if(returningBoard&&clock-returningBoard.at>=.45)returningBoard=null;
 if(notices>0&&(notices-=dt)<=0)notice('');if(freezeCaption>0&&(freezeCaption-=dt)<=0)call('');
 if(match.phase==='fight'||match.phase==='ringReset'){const take=match.phase==='fight'&&match.hitstop<=0;match.tick(dt,[input(0,take),input(1,take)]);}
 else if(match.phase==='roundEnd'||match.phase==='won'){
  endAge+=dt;const won=match.phase==='won',id=match.roundWinner;
  if(won&&mealCue<eatingSounds.length&&endAge>=eatingSounds[mealCue][0]){
   const [,name,rate,volume]=eatingSounds[mealCue++];Sound.eat(name,rate,volume);
  }
  if(!roundLit&&endAge>=1){roundLit=true;noteFlag(id);}
  const boardAt=won?matchBoardAt:roundBoardAt;
  if(endAge>=boardAt&&endAge-dt<boardAt){
   call('');$('stage').classList.add('showStand');
   $('digits').setAttribute('aria-label',names[id]+' wins the '+(won?'match':'round')+'. '+timeLeft(match)+' remaining. Round points '+match.f.map(f=>f.points).join(' to ')+'. Rounds won '+match.wins.join(' to ')+'.');
  }
  if(won&&marqueeBeats<4&&endAge>=marqueeFirstBeat+marqueeBeats*marqueeInterval){
   Sound.marqueeDing(marqueeBeats);marqueeBeats++;
  }
  if(endAge>=(won?feastSeconds:2.20)&&$('result').hidden){
   call('');$('endingTag').textContent=won?'TOURNAMENT RESULT':'ROUND '+match.round+' RESULT';
   $('endingTitle').textContent=names[id]+(won?' wins the dumpling':' takes the round');
   $('endingBody').textContent='Black '+match.wins[0]+'  —  '+match.wins[1]+' Red   ·   '+match.reason;
   if(won&&match.decidingRead)$('endingBody').textContent+='  '+match.decidingRead;
   $('railTitle').textContent=won?'Tournament result':'Round '+match.round;
   $('railDesc').textContent=match.decidingRead||match.reason;
   $('result').classList.toggle('between',!won);$('again').textContent=won?'Rematch':'Start now';$('result').hidden=false;
   if(won){$('again').focus();Sound.stopMusic();}
  }
  if(!won&&!$('result').hidden){
   const next='Round '+(match.round+1)+' starts in '+Math.max(1,Math.ceil(victorySeconds-endAge));
   if($('endingTag').textContent!==next)$('endingTag').textContent=next;
   if(endAge>=victorySeconds)beginRound();
  }
 }
 for(const a of fx){a.t+=dt;a.x+=a.vx*dt;a.y+=a.vy*dt;if(a.ground)a.vy+=250*dt;}fx=fx.filter(a=>a.t<a.life);
}
function loop(now){const elapsed=Math.min(.12,(now-last)/1000);last=now;if(now-lastPadCheck>500){detectPads();lastPadCheck=now;}
 samplePads();if(!paused){acc+=elapsed;while(acc>=1/60){step(1/60);acc-=1/60;}}else acc=0;
 if(match){updateHud();render();}else attract(elapsed,now);requestAnimationFrame(loop);}

function finishCapture(value){
 if(!capture)return;
 const {seat,device,action}=capture,err=bindControl(seat,device,action,value);
 capture=null;
 if(err){editor?.(err);return;}
 const persisted=saveControls();redrawStrips();
 editor?.(controls.find(([a])=>a===action)[1]+' is now '+labelFor(seat,action,device)+'.'+(persisted?'':' This browser only allows session settings.'));
}
function showControlEditor(body,add,button,message=''){
 body.replaceChildren();const i=controlSeat,device=controlDevice,isKey=device==='keyboard';
 const tabs=add('div','');tabs.className='controlTabs';
 function selectTab(text,selected,run){const b=button(text,()=>{capture=null;run();editor();},tabs);b.setAttribute('aria-pressed',String(selected));}
 names.forEach((n,j)=>selectTab('P'+(j+1)+' · '+n,i===j,()=>controlSeat=j));
 const assign=add('label','Play with');assign.className='setting';const source=add('select','',assign);
 detectPads();
 const options=[['auto','Auto'],['keys','Keyboard'],...activePads.map(p=>['pad-'+p.index,'Controller '+(p.index+1)+' · '+p.id.slice(0,24)])];
 if(sources[i].startsWith('pad-')&&!options.some(([v])=>v===sources[i]))options.push([sources[i],'Disconnected controller']);
 for(const [v,name] of options){const o=add('option',name,source);o.value=v;o.selected=v===sources[i];}
 source.onchange=()=>{sources[i]=source.value;if(source.value.startsWith('pad-')&&sources[1-i]===source.value)sources[1-i]='keys';capture=null;saveControls();detectPads();redrawStrips();editor();};
 const devices=add('div','');devices.className='controlTabs';
 for(const [v,name] of [['keyboard','Keyboard keys'],['pad','Controller buttons']]){
  const b=button(name,()=>{capture=null;controlDevice=v;editor();},devices);b.setAttribute('aria-pressed',String(v===device));
 }
 const msg=add('p',message||(isKey?'Choose an action, then press its new key.':'Choose a button from the list, or press Listen and use your controller. The left stick also moves and crouches.'));
 msg.className='bindingStatus';msg.setAttribute('role','status');
 const grid=add('div','');grid.className='bindingList';
 const availablePad=activePads.find(p=>p.index===assigned[i])||activePads.find(p=>'pad-'+p.index===sources[i])||(activePads.length===1?activePads[0]:null);
 for(const [action,name] of controls){
  if(isKey&&action==='start')continue;
  const row=add('div','',grid);row.className='bindingRow';add('span',name,row);
  const actions=add('div','',row);actions.className='bindActions';
  const title=labelFor(i,action,device);
  function listen(){
   capture={seat:i,device,action,padIndex:availablePad?.index,held:availablePad?availablePad.buttons.map(b=>b.pressed):[]};
   editor((isKey?'Press a key for ':'Press a controller button for ')+name+'. Escape cancels.');
  }
  if(!isKey){
   const sel=add('select','',actions);sel.setAttribute('aria-label',name+' controller button');
   const count=Math.max(17,availablePad?.buttons.length||0,padMaps[i][action]+1);
   for(let n=0;n<count;n++){const o=add('option',padLabel(n),sel);o.value=String(n);o.selected=n===padMaps[i][action];}
   sel.onchange=()=>{capture={seat:i,device,action};finishCapture(Number(sel.value));};
  }
  const listening=capture?.action===action&&capture.seat===i&&capture.device===device;
  if(isKey||availablePad){const b=button(listening?'Listening…':isKey?title:'Listen',listen,actions);b.setAttribute('aria-label',name+' · '+(isKey?title:'Listen on controller'));}
 }
 add('p','Punch + kick always grabs. Crouch + block always guards low. Choosing a button already used by this player swaps the two actions.');
 const footer=add('div','');footer.className='controlTabs';
 button('Restore '+(isKey?'keyboard':'controller')+' defaults',()=>{
  const defaults=isKey?defaultKeys[i]:defaultPad;
  if(isKey){
   const clash=Object.values(defaults).find(value=>value&&Object.values(keyboard[1-i]).includes(value));
   if(clash){capture=null;editor('Move '+keyLabel(clash)+' off '+names[1-i]+' first to restore these defaults.');return;}
  }
  (isKey?keyboard:padMaps)[i]={...defaults};rebuildKeyMaps();cleanInputs();capture=null;
  const saved=saveControls();redrawStrips();editor(saved?'Defaults restored.':'Defaults restored for this session.');
 },footer);
 if(!isKey)button('Refresh controllers',()=>{capture=null;editor();},footer);
}
function moveList(body,add){
 const tab=add('div','');tab.className='controlTabs';const table=add('table','');
 const keys=add('button','Keyboard',tab),pad=add('button','Controller',tab);
 function draw(device){
  keys.setAttribute('aria-pressed',String(device==='keyboard'));pad.setAttribute('aria-pressed',String(device==='pad'));table.replaceChildren();
  const head=add('tr','',table);['Move','Black','Red'].forEach(n=>add('th',n,head));
  for(const [name,combo] of [['Move',['left',' / ','right']],['Jump',['jump']],['Punch · high',['jab']],['Driving cross · high',['Forward + ','jab']],['Side kick · mid',['kick']],['Low sweep',['low',' + ','kick']],['Jump-in head kick',['Toward + ','jump',' then ','kick']],['Retreating head kick',['Away + ','jump',' then ','kick']],['Flip kick · high',['jump',' then ','kick']],['Grab / escape',['jab',' + ','kick']],['Standing block',['guard']],['Low block',['low',' + ','guard']],['Standing parry',['parry']],['Low parry',['low',' + ','parry']],['Moon counter',['finish']]]){
   const row=add('tr','',table);add('td',name,row);for(let i=0;i<2;i++)add('td',combo.map(a=>Object.hasOwn(defaultPad,a)?labelFor(i,a,device):a).join(''),row);
  }
 }
 keys.onclick=()=>draw('keyboard');pad.onclick=()=>draw('pad');draw('keyboard');
}

function openPanel(kind){
 if(panel.open)return;
 view=kind;paused=true;cleanInputs();Sound.pause();
 const body=$('pbody');body.replaceChildren();
 const add=(tag,txt,parent=body)=>{const el=document.createElement(tag);el.textContent=txt;parent.append(el);return el;};
 const button=(txt,fn,parent=body)=>{const el=add('button',txt,parent);el.onclick=fn;return el;};
 if(kind==='moves'){
  $('ptitle').textContent='Move list';add('p','Two clean hits win a round. First to three rounds wins the dumpling. Every attack has startup, contact, and recovery.');
  moveList(body,add);
  add('h3','Read the opening');add('p','Stand to guard the head. Crouch to cover the legs. Either guard stops a mid kick. Blocked attacks drain guard and lock the defender for 6–14 frames. Step away to refill guard.');
  add('p','Tap Block on contact to perfect-parry at the correct height: three frames in rounds 1-4, two in round 5. Holding Block earlier gives an ordinary guard. The dedicated parry allows 4 / 4 / 3 / 3 / 2 frames as rounds progress. Miss and you are exposed for 24 frames. A clean strike in that opening is an instant K.O. A perfect parry builds power. When the bar is full, use Moon counter immediately after a parry.');
  add('p','A jumping kick hits the head and needs standing guard. Cross the ring line on foot or land outside and your opponent earns one point. A strike that knocks you out of bounds counts once. Both fighters return to center if the round continues.');
  add('p','Throws beat both guards. They take 12 frames to start, catch for 5 and leave you exposed for 34 on a miss. Tap Grab within 18 / 14 / 10 / 7 / 5 frames to escape. In the final 10 seconds of round five, a landed throw is locked. At the bell, the higher score wins. A tie goes to the next clean hit.');
  add('h3','Jump timing');add('p','Choose your direction at takeoff. An empty jump takes 4 frames to recover. A flip kick takes 5 frames on a clean hit, 13 on block and 19 on a miss. A close jab starts in 6 frames. Space the jump so it lands outside jab range, or time the kick on descent.');
  add('h3','Hear the moves');const listen=add('div','');listen.className='listen';for(const [label,cue] of [['Palm slap','slap'],['Hi-yah!','hiya'],['Wa-tah!','watah'],['Parry hiss','hiss'],['Black’s rising kick','risingKick'],['Black’s flip cry','risingFlip'],['Held K.O. cry','risingFinish']])button(label,()=>Sound.audition(cue),listen);
 }else if(kind==='inputs'){
  $('ptitle').textContent='Customize controls';editor=message=>showControlEditor(body,add,button,message);editor();
 }else if(kind==='settings'){
  $('ptitle').textContent='Settings';
  const songRow=add('label','Fight music');songRow.className='setting';
  const song=add('select','',songRow);
  for(const [key,title] of Object.entries(Sound.soundtracks)){
   const option=add('option',title,song);option.value=key;option.selected=key===Sound.soundtrack;
  }
  song.onchange=()=>Sound.selectSoundtrack(song.value);
  button('Preview music',()=>Sound.audition(Sound.soundtrack));
  button('Hear dumpling munch',()=>Sound.audition('biteOne'));
  button('Hear Black’s kick',()=>Sound.audition('risingKick'));
  for(const [label,get,set] of [
   ['Music',()=>Sound.musicEnabled,v=>Sound.setMusic(v)],['Sound effects & announcer',()=>Sound.effectsEnabled,v=>Sound.setEffects(v)],
   ['Light display',()=>document.body.classList.contains('light'),v=>{document.body.classList.toggle('light',v);try{localStorage.setItem('moon-display',v?'light':'dark');}catch{}}]]){
   const row=add('div','');row.className='setting';add('span',label,row);const b=button(get()?'On':'Off',()=>{set(!get());b.textContent=get()?'On':'Off';b.setAttribute('aria-pressed',String(get()));},row);b.setAttribute('aria-pressed',String(get()));
  }
 }else{
  $('ptitle').textContent='Match paused';button('Resume',()=>panel.close());button('Move list',()=>{panel.close();openPanel('moves');});button('Customize controls',()=>{panel.close();openPanel('inputs');});button('Title screen',()=>{panel.close();toMenu();});
 }
 panel.showModal();
}
$('book').onclick=()=>openPanel('moves');$('settings').onclick=()=>openPanel('settings');$('inputs').onclick=()=>openPanel('inputs');$('pause').onclick=()=>openPanel('pause');
{const mt=$('musicToggle');if(mt){const syncMusicBtn=()=>{const on=Sound.musicEnabled,title=Sound.soundtracks[Sound.soundtrack]||'';mt.textContent=on?'Music: On':'Music: Off';mt.setAttribute('aria-pressed',String(on));mt.title=title?(on?'Now playing: '+title:'Music off ('+title+')'):'';};mt.onclick=()=>{Sound.unlock();Sound.setMusic(!Sound.musicEnabled);syncMusicBtn();};if(Sound.onMusicChange)Sound.onMusicChange(syncMusicBtn);syncMusicBtn();}}
$('close').onclick=()=>panel.close();panel.addEventListener('close',()=>{if(panel.open)return;capture=null;editor=null;paused=false;cleanInputs();view='';if(match)Sound.resume();else Sound.resume().then(()=>Sound.stopMusic());});
panel.addEventListener('click',e=>{if(e.target===panel){const b=panel.getBoundingClientRect();if(e.clientX<b.left||e.clientX>b.right||e.clientY<b.top||e.clientY>b.bottom)panel.close();}});
function pauseAway(){if(match&&!panel.open&&($('result').hidden||match.phase==='roundEnd'))openPanel('pause');}
window.addEventListener('blur',pauseAway);
window.addEventListener('gamepadconnected',detectPads);
window.addEventListener('gamepaddisconnected',e=>{if(match&&assigned.includes(e.gamepad.index)&&!panel.open)openPanel('inputs');detectPads();});
document.addEventListener('visibilitychange',()=>{if(document.hidden)pauseAway();});
try{document.body.classList.toggle('light',localStorage.getItem('moon-display')==='light');}catch{}
setMode('solo');requestAnimationFrame(loop);
