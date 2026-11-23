/* The match clock advances in 1/60-second ticks. Presentation consumes the same contacts. */
const MoonCombat = (() => {
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const ease = v => { v=clamp(v,0,1); return v*v*(3-2*v); };
  const landingFrames={empty:4,hit:5,block:13,miss:19};
  const ring={left:124,right:836};
  const airKick=type=>['flip','jumpIn','jumpAway'].includes(type);
  const moves = {
    jab:    {name:'Jab',          tell:'coil',     hit:'jab',    start:.10, active:.075, recover:.15, range:110, step:15, points:1, drain:13},
    cross:  {name:'Driving cross',tell:'coil',     hit:'cross',  start:.18, active:.09,  recover:.26, range:131, step:31, points:2, drain:20},
    kick:   {name:'Side kick',    tell:'chamber',  hit:'kick',   start:.22, active:.10,  recover:.32, range:141, step:22, points:2, drain:27},
    sweep:  {name:'Low sweep',    tell:'sweepback',hit:'sweep',  start:.19, active:.10,  recover:.36, range:137, step:12, points:2, drain:23},
    grab:   {name:'Shoulder throw',tell:'grabCoil',hit:'grabReach',start:12/60,active:5/60,recover:34/60,range:109,step:21, points:2, drain:0},
    flip:   {name:'Flip kick',    tell:'chamber',  hit:'airkick',start:.16, active:.15,  recover:.33, range:148, step:26, points:3, drain:30},
    jumpIn: {name:'Flying head kick',tell:'tuck',hit:'flyingHeel',start:.15,active:.145,recover:.35,range:153,step:13,drain:30},
    jumpAway:{name:'Retreating head kick',tell:'chamber',hit:'retreatHeel',start:.12,active:.13,recover:.30,range:138,step:0,drain:23},
    finish: {name:'Moon counter', tell:'coil',     hit:'airkick',start:.12, active:.11,  recover:.68, range:161, step:45, points:0, drain:45}
  };
  const idleInput = () => ({move:0,low:false,guard:false,press:{}});
  function fighter(id,power=0) {
    return {id,x:id?573:387,dir:id?-1:1,state:'idle',age:0,move:null,origin:0,
      guard:100,power,points:0,recharge:0,parryAge:8,guardCooldown:0,opening:0,
      jumpT:-1,airSpeed:0,jumpResult:'empty',landingLeft:0,landingPress:null,y:0,angle:0,step:0,pose:'guard',fromPose:'guard',blend:1,
      reach:undefined,connected:false,hitFor:0,knock:0,speed:0,buffer:null,hitPose:'reel',
      sourceX:0,destX:0,aiWait:.3,sequence:0,modeAge:0,chain:0,lastHit:-10};
  }
  function change(f,state) {f.state=state;f.age=0;f.reach=undefined;}
  function setPose(f,pose,dt,speed=16) {
    if (f.pose!==pose) { f.fromPose=f.pose; f.pose=pose; f.blend=0; }
    f.blend=Math.min(1,f.blend+dt*speed);
  }
  class Match {
    constructor(mode='solo', emitter=()=>{}, random=Math.random) {
      this.mode=mode;this.emit=emitter;this.random=random;this.round=0;this.wins=[0,0];
      this.f=[fighter(0),fighter(1)];this.lastPoint=null;this.phase='menu';this.time=30;
      this.roundWinner=null;this.reason='';this.sudden=false;this.hitstop=0;this.clock=0;
    }
    nextRound() {
      this.round++;this.f=this.f.map((f,i)=>fighter(i,f.power));this.time=30;
      this.roundWinner=null;this.reason='';this.sudden=false;this.lastPoint=null;
      this.phase='intro';this.hitstop=0;this.clock=0;this.aiPlan=null;
    }
    fight() {if(this.phase==='intro'){this.phase='fight';this.emit('fight');}}
    get parryWindow(){return [4,4,3,3,2][Math.min(4,Math.max(0,this.round-1))]/60;}
    get escapeFrames(){
      if(this.round>=5&&(this.time<=10||this.sudden))return 0;
      return [18,14,10,7,5][Math.min(4,Math.max(0,this.round-1))];
    }
    win(id,reason) {
      if(this.phase!=='fight')return;
      this.wins[id]++;this.roundWinner=id;this.reason=reason;
      this.phase=this.wins[id]===3?'won':'roundEnd';this.emit('end',{id,reason,match:this.phase==='won'});
    }
    attack(f,type) {
      if(type==='finish'&&(f.power<99.99||f.opening<=0)){
        this.emit('hint',{id:f.id,text:f.power<99.99?'Build power with hits and parries':'Parry to open a Moon counter'});return;
      }
      if(type==='finish'){f.power=0;f.opening=0;}
      if(airKick(type))f.jumpResult='miss';
      f.contactTarget=null;
      change(f,'attack');f.sequence++;f.move=type;f.connected=false;f.origin=f.x;f.buffer=null;
      this.emit('swing',{id:f.id,type});
    }
    score(a,reason) {
      a.points++;this.lastPoint=a.id;
      this.emit('point',{id:a.id,points:a.points});
      if(this.sudden||a.points>=2)this.win(a.id,reason||(this.sudden?'GOLDEN POINT':'TWO POINTS'));
    }
    ringOut(loser){
      const winner=this.f[1-loser.id];
      this.emit('ringOut',{id:winner.id,victim:loser.id});
      this.score(winner,'RING OUT');
      if(this.phase==='fight'){this.phase='ringReset';this.resetAge=0;}
    }
    resetPositions(){
      this.f=this.f.map(old=>Object.assign(fighter(old.id,old.power),{points:old.points,guard:old.guard}));
      this.phase='fight';this.emit('restart');
    }
    choose(f,input) {
      const p=input.press||{};
      if(p.finish&&f.jumpT<0)return 'finish';
      if(p.grab&&f.jumpT<0)return 'grab';
      if(p.kick){
        if(f.jumpT<0)return input.low?'sweep':'kick';
        const direction=Math.sign(f.airSpeed)*f.dir;
        return direction>0?'jumpIn':direction<0?'jumpAway':'flip';
      }
      if(p.jab&&f.jumpT<0)return input.move===f.dir?'cross':'jab';
      return null;
    }
    stepFighter(f,other,input,dt) {
      f.age+=dt;f.modeAge+=dt;f.parryAge+=dt;
      const freshBlock=input.guard&&!f.guardHeld;
      f.guardHeld=!!input.guard;
      f.justGuard=Math.max(0,(f.justGuard||0)-dt);
      if(!input.guard)f.justGuard=0;
      if(freshBlock&&f.guardCooldown<=0&&f.jumpT<0&&['idle','guard'].includes(f.state)){
        f.justGuard=Math.min(3/60,this.parryWindow);f.justLow=!!input.low;f.guardCooldown=.24;
      }
      for(const name of ['recharge','guardCooldown','opening'])f[name]=Math.max(0,f[name]-dt);
      if(!f.recharge && !['guard','blockstun','break'].includes(f.state))f.guard=Math.min(100,f.guard+22*dt);
      if(f.jumpT>=0){
        if(['idle','attack'].includes(f.state))f.x+=f.airSpeed*dt;
        f.jumpT+=dt;const u=Math.min(1,f.jumpT/.67);f.y=-99*4*u*(1-u);
        if(u===1){
          f.jumpT=-1;f.y=0;f.angle=0;f.airSpeed=0;
          if(f.state==='idle'||f.state==='attack'){
            change(f,'landing');f.landingLeft=landingFrames[f.jumpResult];f.landingPress=null;f.buffer=null;
          }
          this.emit('land',{id:f.id,outcome:f.jumpResult});
        }
      }
      if(f.state==='landing'){
        if(f.landingLeft>0){
          if(f.landingLeft<=3&&Object.keys(input.press||{}).length)f.landingPress={...input.press};
          setPose(f,f.landingLeft>5?'absorb':'land',dt,25);f.landingLeft--;return;
        }
        change(f,'idle');
        if(f.landingPress){input={...input,press:{...f.landingPress,...input.press}};f.landingPress=null;}
      }
      if(f.state==='thrown'||f.state==='tripped'){
        const thrown=f.state==='thrown',u=clamp(f.age/(thrown?.86:.68),0,1);
        if(thrown){
          if(input.press?.grab&&f.escapeUntil>0&&f.age<=f.escapeUntil+1e-6&&other.state==='toss'){
            for(const target of [f,other]){
              target.pendingOut=false;change(target,'hurt');target.hitFor=.22;target.hitPose='check';target.knock=-target.dir*112;
              target.angle=0;target.y=0;
            }
            this.hitstop=.045;this.emit('escape',{id:f.id,x:(f.x+other.x)/2,y:350});return;
          }
          if(!f.throwScored&&f.age>=f.escapeUntil){
            f.throwScored=true;other.power=Math.min(100,other.power+11);
            this.emit('launch',{id:other.id,x:f.x,y:344});if(!f.pendingOut)this.score(other);
          }
          const travel=clamp((u-.29)/.71,0,1);
          f.x=f.sourceX+(f.destX-f.sourceX)*ease(travel);
          f.y=-43*ease(u/.33)*(1-travel)-109*Math.sin(Math.PI*travel);
          f.angle=-f.dir*Math.PI*2*ease(u);
          setPose(f,u<.22?'lock':u<.46?'airturn':u<.77?'tuck':'land',dt,25);
        }else{
          const fall=clamp((u-.11)/.71,0,1);
          f.x=f.sourceX+(f.destX-f.sourceX)*ease(clamp((u-.09)/.78,0,1));
          f.y=u<.83?-47*Math.sin(Math.PI*fall):-12*Math.sin(Math.PI*(u-.83)/.17);
          f.angle=-f.dir*.13*Math.sin(Math.PI*fall);
          setPose(f,u<.16?'heel_skid':u<.32?'tipover':u<.58?'fall_open':u<.82?'backfall':u<.91?'splat':'backfall',dt,32);
          if(u>=.82&&!f.floorCue){f.floorCue=true;this.emit('floor',{id:f.id});}
        }
        if(u>=1){change(f,'down');f.y=0;f.angle=0;f.knock=0;f.hitFor=thrown?.38:.32;if(thrown)this.emit('floor',{id:f.id});}
        return;
      }
      if(f.state==='toss'){
        setPose(f,f.age<.22?'lock':f.age<.38?'hoist':f.age<.62?'cast':'land',dt,22);
        if(f.age>.77)change(f,'idle');return;
      }
      if(f.state==='launched'){
        const u=clamp(f.age/(f.flightTime||.46),0,1);f.x=f.sourceX+(f.destX-f.sourceX)*(1-(1-u)**2);
        f.y=-(f.flightHeight||41)*4*u*(1-u);f.angle=-f.dir*(f.flightTilt||.31)*Math.sin(Math.PI*u);
        setPose(f,u<.16?(f.headBlow?'headSnap':'flail'):u<.52?'loft':u<.81?'fall_open':'absorb',dt,30);
        if(u===1){change(f,'idle');f.y=f.angle=0;this.emit('land',{id:f.id});}return;
      }
      if(f.state==='blockstun'){
        setPose(f,f.lowGuard?'lowguard':'check',dt,28);
        if(f.age>=f.hitFor)change(f,input.guard?'guard':'idle');return;
      }
      if(f.state==='parry'){
        setPose(f,f.lowGuard?'lowguard':'brush',dt,34);
        if(f.age+1e-7>=this.parryWindow){change(f,'miss');f.hitFor=.4;this.emit('miss',{id:f.id});}return;
      }
      if(f.state==='miss'){
        setPose(f,'reel',dt,12);if(f.age+1e-7>=f.hitFor)change(f,'idle');return;
      }
      if(['hurt','parried','break','down'].includes(f.state)){
        const pose=f.state==='down'?(f.age>f.hitFor*.62?'land':'down'):f.hitPose;
        setPose(f,pose,dt,30);f.x+=f.knock*dt;f.knock*=Math.exp(-12*dt);
        if(f.age>=f.hitFor){if(f.state==='break')f.guard=Math.max(f.guard,28);change(f,'idle');}
        return;
      }
      if(f.state==='attack'){
        // Fingers can land on neighboring ticks. Convert before contact while retaining immediate single-button attacks.
        if(input.press?.grabChord&&f.jumpT<0&&f.age<=3/60+1e-7&&['jab','cross','kick','sweep'].includes(f.move)){
          this.attack(f,'grab');return;
        }
        const m=moves[f.move],total=m.start+m.active+m.recover;
        const u=(f.age-m.start)/m.active;
        f.x+=f.dir*m.step*(ease((f.age-m.start+.085)/.13)-ease((f.age-dt-m.start+.085)/.13));
        if(airKick(f.move)&&f.jumpT>=0)f.angle=f.dir*Math.PI*(f.move==='flip'?2:f.move==='jumpIn'?.18:-.20)*(ease(f.age/m.start)-1);
        if(f.move==='finish')f.angle=f.dir*Math.PI*2*(ease(f.age/m.start)-1);
        if(f.age<m.start*.62)setPose(f,m.tell,dt,32);
        else if(f.age<m.start+m.active)setPose(f,m.hit,dt,1/Math.max(.045,m.start*.35));
        else setPose(f,f.move==='sweep'?'land':f.move==='kick'||airKick(f.move)?'chamber':'guard',dt,10);
        if(u>=1)f.contactTarget=null;
        if(f.move==='grab'&&u>=0&&!f.connected){
          setPose(f,'grabReach',dt,32);f.reach=m.range-9;
          if(u>1.9)setPose(f,'grabMiss',dt,19);
        }
        if(f.connected&&u>=0&&u<.95&&f.move!=='grab'){
          f.reach=clamp(Math.abs(other.x-f.x)-(f.move==='sweep'?26:10),38,135);
        }else if(f.move!=='grab'||u<0||u>1.9)f.reach=undefined;
        const next=this.choose(f,input);
        if(f.connected&&f.age>m.start+.045&&f.age<m.start+m.active+.13&&
           ((f.move==='jab'&&(next==='cross'||next==='kick'))||(f.move==='cross'&&next==='sweep'))){
          this.attack(f,next);return;
        }
        if(next&&total-f.age<.13)f.buffer=next;
        if(f.age+1e-8>=total){const queued=f.buffer;change(f,'idle');f.buffer=null;if(queued)this.attack(f,queued);}
        return;
      }
      if(f.jumpT<0)f.dir=other.x>=f.x?1:-1;
      if(input.press?.finish&&f.jumpT<0&&f.opening>0&&f.power>=100){this.attack(f,'finish');return;}
      if(input.press?.parry&&f.jumpT<0){change(f,'parry');f.lowGuard=!!input.low;setPose(f,f.lowGuard?'lowguard':'brush',dt,30);return;}
      if(input.guard && f.jumpT<0){
        if(f.state!=='guard')change(f,'guard');
        f.lowGuard=!!input.low;
        setPose(f,f.lowGuard?'lowguard':'check',dt,27);return;
      }
      if(f.state==='guard')change(f,'idle');
      if(input.press?.jump&&f.jumpT<0){
        f.jumpT=0;f.airSpeed=clamp(input.move||0,-1,1)*(input.move===f.dir?273:210);f.jumpResult='empty';this.emit('jump',{id:f.id});
      }
      const next=this.choose(f,input);if(next){this.attack(f,next);return;}
      f.angle=0;
      const move=clamp(input.move||0,-1,1);
      if(f.jumpT<0)f.x+=move*dt*(move===f.dir?251:211);
      if(move)f.step+=dt*10;
      setPose(f,f.jumpT>=0?(f.jumpT<.14?'chamber':f.jumpT<.48?'tuck':'land'):
        Math.abs(move)>.1?'walk':input.low?'land':'guard',dt,16);
    }
    canHit(a,b) {
      if(a.state!=='attack'||a.connected||['down','thrown','tripped','toss','launched'].includes(b.state))return false;
      const m=moves[a.move],dx=(b.x-a.x)*a.dir;
      if(a.age+1e-8<m.start||a.age+1e-8>=m.start+m.active||dx<5||dx>m.range)return false;
      if((a.move==='grab'||airKick(a.move))&&this.contactTest&&!this.contactTest(a,b,a.move,this.clock))return false;
      if(a.move==='grab')return b.jumpT<0 && b.state!=='hurt' && b.state!=='parried';
      if(a.move==='sweep')return b.y>-20;
      return Math.abs(a.y-b.y)<(airKick(a.move)?125:68);
    }
    resolve(a,b,type) {
      const m=moves[type],throwPunish=type!=='grab'&&b.state==='attack'&&b.move==='grab';a.connected=true;
      a.fromPose=m.tell;a.pose=m.hit;a.blend=1;a.reach=clamp(Math.abs(b.x-a.x)-(type==='sweep'?24:12),38,135);
      const aim={id:a.id,victim:b.id,type,x:b.x-a.dir*11,y:312+b.y};
      if(airKick(type))this.emit('aim',aim);
      const at=airKick(type)?aim.x:b.x-a.dir*(type==='sweep'?24:12);
      const level=airKick(type)?aim.y:type==='sweep'?435:Math.max(302,355+b.y);
      if(airKick(type))a.contactTarget={x:at,y:level};
      const evt=(kind)=>this.emit(kind,{id:a.id,victim:b.id,x:at,y:level,type,chain:a.chain});
      // A middle attack meets either guard. Jabs, crosses and aerials go
      // over a low guard. A sweep slips beneath a high guard.
      const middle=type==='kick',low=type==='sweep';
      if(type!=='grab'&&['guard','blockstun','parry'].includes(b.state)&&(middle||low===b.lowGuard)){
        if(airKick(type))a.jumpResult='block';
        if(b.state==='parry'||(b.state==='guard'&&b.justGuard>1e-6&&b.justLow===b.lowGuard)){
          b.justGuard=0;
          b.power=Math.min(100,b.power+34);b.opening=.80;b.guard=Math.min(100,b.guard+5);
          b.parryAge=5;change(a,'parried');a.hitFor=.57;a.hitPose='reel';a.knock=-a.dir*75;
          change(b,'idle');b.pose=b.lowGuard?'lowguard':'brush';b.blend=1;this.hitstop=.076;evt('parry');return;
        }
        b.guard=Math.max(0,b.guard-m.drain);b.recharge=.95;b.x+=a.dir*7;
        if(!b.guard){change(b,'break');b.hitPose='reel';b.hitFor=.72;evt('break');}
        else {change(b,'blockstun');b.hitFor=(type==='jab'?6:type==='finish'?14:10)/60;evt('block');}
        this.hitstop=.046;return;
      }
      if(airKick(type))a.jumpResult='hit';
      if(type==='finish'||(type!=='grab'&&['miss','parry'].includes(b.state))){
        const whiff=type!=='finish';
        change(b,'hurt');b.hitPose='reel';b.hitFor=1;b.jumpT=-1;b.pose='reel';b.blend=1;
        evt('ko');this.win(a.id,whiff?'PARRY PUNISH K.O.':'MOON COUNTER K.O.');return;
      }
      if(type!=='grab'){a.power=Math.min(100,a.power+({jab:7,cross:10,kick:11,sweep:9,flip:14,jumpIn:14,jumpAway:10}[type]));}
      b.power=Math.min(100,b.power+3);this.lastPoint=a.id;this.hitstop=type==='jab'?.05:.095;
      a.chain=this.clock-a.lastHit<.95?a.chain+1:1;a.lastHit=this.clock;b.chain=0;
      if(type==='sweep'||type==='grab'){
        b.jumpT=-1;b.sourceX=b.x;b.destX=clamp(b.x+a.dir*(type==='grab'?152:92),62,898);b.floorCue=false;
        b.pendingOut=b.destX<ring.left||b.destX>ring.right;
        change(b,type==='grab'?'thrown':'tripped');if(type==='grab')change(a,'toss');
        if(type==='grab'){b.escapeUntil=this.escapeFrames/60;b.throwScored=false;}
        b.fromPose=b.pose;b.pose=type==='grab'?'lock':'heel_skid';b.blend=.54;
      }else{
        b.knock=a.dir*(type==='jab'?100:210);b.hitPose=type==='jab'?'headSnap':airKick(type)?'headSnap':type==='kick'?'belly':'flail';
        b.fromPose=b.pose;b.pose=b.hitPose;b.blend=type==='jab'?.58:.78;
        change(b,'hurt');b.hitFor=type==='jab'?.14:airKick(type)?.29:.21;
        if(type==='cross'||airKick(type)){
          change(b,'launched');b.jumpT=-1;b.sourceX=b.x;b.headBlow=airKick(type);
          b.flightTime=type==='jumpAway'?.43:airKick(type)?.55:.47;
          b.flightHeight=type==='jumpAway'?52:airKick(type)?77:54;
          b.flightTilt=airKick(type)?.64:.41;
          b.destX=clamp(b.x+a.dir*(type==='jumpAway'?102:airKick(type)?156:131),62,898);
          b.pendingOut=b.destX<ring.left||b.destX>ring.right;
        }
      }
      if(throwPunish){
        if(b.state==='hurt')b.hitFor=Math.max(.33,b.hitFor);
        evt('throwPunish');
      }
      if(b.state==='hurt'&&type!=='grab'){
        const ticks=Math.ceil(b.hitFor*60);
        const travel=b.knock/60*(1-Math.exp(-12*ticks/60))/(1-Math.exp(-12/60));
        const end=b.x+travel;b.pendingOut=end<ring.left||end>ring.right;
      }
      evt(type==='grab'?'throw':type==='sweep'?'trip':'hit');
      if(type!=='grab'&&!b.pendingOut)this.score(a);
    }
    cpu(dt){
      const f=this.f[1],p=this.f[0],o=idleInput(),gap=Math.abs(f.x-p.x),dir=p.x>f.x?1:-1;
      if(f.state==='thrown'){
        if(f.age<.02)f.tryEscape=this.random()<.45+.045*this.round;
        if(f.tryEscape&&f.age>=.06+this.random()*.08){f.tryEscape=false;o.press.grab=true;}return o;
      }
      if(f.opening>.12&&f.power>=100&&gap<149){o.press.finish=true;return o;}
      if(f.aiGuard>0){f.aiGuard-=dt;o.guard=true;o.low=!!f.aiLow;return o;}
      if(p.state==='landing'&&p.landingLeft>=10&&p.jumpResult==='miss'&&gap<105&&f.state==='idle'&&f.punishedJump!==p.sequence){
        f.punishedJump=p.sequence;
        if(this.random()<.35+.075*this.round){o.press.jab=true;return o;}
      }
      f.aiWait-=dt;
      if(p.state==='attack'&&p.move!=='grab'&&gap<152&&f.aiRead!==p.sequence){
        if(p.age>.055&&p.age<moves[p.move].start){
          f.aiRead=p.sequence;
          f.repeats=f.readMove===p.move?Math.min(3,(f.repeats||0)+1):0;f.readMove=p.move;
          if(this.random()<.28+.075*this.round+.09*f.repeats){f.aiGuard=.23+this.random()*.17;f.aiLow=(p.move==='sweep')===(this.random()<.64+.05*this.round);o.guard=true;o.low=f.aiLow;if(this.random()<.27+.035*this.round)o.press.parry=true;return o;}
        }
      }
      if(f.state==='attack'||f.state==='toss')return o;
      if(gap>104){o.move=dir;if(gap>160)return o;}
      if(f.aiWait<=0){
        f.aiWait=.18+this.random()*(.38-.032*this.round);
        const n=this.random();
        if(gap<76 && (p.state==='guard'||n<.21))o.press.grab=true;
        else if(n<.16){o.press.jump=true;o.press.kick=true;}
        else if(n<.51){o.press.jab=true;o.move=n<.26?dir:0;}
        else if(n<.86){o.press.kick=true;o.low=n>.68;}
        else {f.aiGuard=.22;o.guard=true;}
      }
      return o;
    }
    tick(dt,inputs) {
      if(this.phase==='ringReset'){
        this.resetAge+=dt;if(this.resetAge>=1.35)this.resetPositions();return;
      }
      if(this.phase!=='fight')return;
      if(this.hitstop>0){this.hitstop=Math.max(0,this.hitstop-dt);return;}
      this.clock+=dt;
      const intents=[inputs[0]||idleInput(),this.mode==='solo'?this.cpu(dt):inputs[1]||idleInput()];
      this.f.forEach((f,i)=>{
        this.stepFighter(f,this.f[1-i],intents[i],dt);
        f.x=clamp(f.x,62,898);
      });
      const [a,b]=this.f;
      const pass=this.f.some(f=>f.y<-60||['thrown','tripped','toss'].includes(f.state));
      if(!pass&&Math.abs(b.x-a.x)<57){
        const sign=b.x>=a.x?1:-1,mid=clamp((b.x+a.x)/2,118.5,841.5);
        a.x=mid-sign*28.5;b.x=mid+sign*28.5;
      }
      const exits=this.f.filter(f=>(f.x<ring.left||f.x>ring.right)&&f.jumpT<0&&f.y>=-.01&&!['thrown','tripped','launched','toss'].includes(f.state));
      if(exits.length){
        if(exits.length===1)this.ringOut(exits[0]);
        else {this.phase='ringReset';this.resetAge=0;this.emit('doubleOut');}
        return;
      }
      const attacks=this.f.map((f,i)=>this.canHit(f,this.f[1-i])?f.move:null);
      // Same-tick attacks clash; neither seat wins a point from update order.
      if(attacks[0]&&attacks[1]&&(attacks[0]==='grab')!==(attacks[1]==='grab')){
        const i=attacks[0]==='grab'?1:0;this.resolve(this.f[i],this.f[1-i],attacks[i]);
      }else if(attacks[0]&&attacks[1]){a.connected=b.connected=true;for(const f of this.f)if(airKick(f.move))f.jumpResult='block';this.emit('clash',{x:(a.x+b.x)/2,y:360});this.hitstop=.06;}
      else {
        for(let i=0;i<2&&this.phase==='fight';i++)if(attacks[i])this.resolve(this.f[i],this.f[1-i],attacks[i]);
      }
      if(this.phase==='fight'&&!this.sudden){
        this.time=Math.max(0,this.time-dt);
        if(this.time<=.0001&&!this.f.some(f=>f.pendingOut)){
          if(a.points!==b.points)this.win(a.points>b.points?0:1,'ON POINTS');
          else {this.sudden=true;this.emit('sudden');}
        }
      }
    }
  }
  return {Match,moves,idleInput,clamp,ring,airKick};
})();
if(typeof module!=='undefined'&&module.exports)module.exports=MoonCombat;
