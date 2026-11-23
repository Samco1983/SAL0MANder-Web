"use strict";
// eslint-disable-next-line no-unused-vars -- Shared classic-script global consumed by game.js.
const Venue=(()=>{
 const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
 const mix=(a,b,t)=>a+(b-a)*t;
 function stroke(c,points,color,width){
  c.strokeStyle=color;c.lineWidth=width;c.beginPath();c.moveTo(...points[0]);
  for(const p of points.slice(1))c.lineTo(...p);c.stroke();
 }
 function shape(c,points,color){
  c.fillStyle=color;c.beginPath();c.moveTo(...points[0]);for(const p of points.slice(1))c.lineTo(...p);c.closePath();c.fill();
 }
 function oval(c,x,y,rx,ry,color){
  c.fillStyle=color;c.beginPath();c.ellipse(x,y,rx,ry,0,0,Math.PI*2);c.fill();
 }
 const xAt=(x,y)=>480+(x-480)*(1+(y-447)/348);
 const deck={back:413,front:491,height:42};
 function platform(c,ring){
  const {back,front,height}=deck;
  const left=y=>xAt(ring.left,y),right=y=>xAt(ring.right,y);
  const a=[left(back),back],b=[right(back),back],d=[left(front),front],e=[right(front),front];
  const foot=([x,y])=>[x,y+height];
  c.save();c.lineJoin='round';
  shape(c,[[a[0]-12,back+height],[d[0]-13,front+height+4],[e[0]+19,front+height+4],[b[0]+10,back+height]],'rgba(55,39,33,.26)');
  for(const [rear,near] of [[a,d],[b,e]]){
   shape(c,[rear,near,foot(near),foot(rear)],'#63442f');
   stroke(c,[[rear[0],back+8],[near[0],front+8]],'#a7774a',3);
   stroke(c,[[rear[0],back+height-6],[near[0],front+height-6]],'#422f25',3);
  }
  shape(c,[d,e,foot(e),foot(d)],metal(c,front,height,'#aa7548','#754b35'));
  c.save();c.beginPath();c.moveTo(...a);for(const pt of [b,e,d])c.lineTo(...pt);c.closePath();c.clip();
  c.fillStyle=metal(c,back,front-back,'#b99166','#d9b482');c.fillRect(d[0],back,e[0]-d[0],front-back+1);
  const courses=[413,422,433,447,466,491];
  for(let i=1;i<courses.length;i++){
   const y=courses[i],p=courses[i-1];
   stroke(c,[[left(y),y],[right(y),y]],'#98734e',1.4);
   for(let x=110+(i%2)*84;x<850;x+=174){
    stroke(c,[[xAt(x,p),p],[xAt(x,y),y]],'rgba(112,77,47,.44)',1.0);
    const gy=p+(y-p)*.44,gx=xAt(x+29,gy);
    stroke(c,[[gx,gy],[gx+19,gy-.6],[gx+44,gy+.1]],'rgba(145,100,60,.22)',.8);
   }
  }
  c.restore();
  stroke(c,[d,e],'#f4d098',4);stroke(c,[[d[0],front+7],[e[0],front+7]],'#64442e',3);
  stroke(c,[[d[0],front+height-4],[e[0],front+height-4]],'#5c402d',4);
  for(let x=d[0]+17;x<e[0]-4;x+=67){
   c.fillStyle='#735034';c.fillRect(x-3,front+9,6,height-15);
   oval(c,x,front+13,2.1,2.1,'#d3a66c');
  }
  c.restore();
 }
 function boundary(c,ring){
  const near=deck.front-2,far=deck.back+2;
  const polygon=(inset)=>[[xAt(ring.left+inset,far+inset),far+inset],[xAt(ring.right-inset,far+inset),far+inset],[xAt(ring.right-inset,near-inset),near-inset],[xAt(ring.left+inset,near-inset),near-inset]];
  c.save();c.lineJoin='round';c.lineCap='butt';const rim=polygon(0);stroke(c,[...rim,rim[0]],'rgba(136,89,55,.49)',5.3);
  stroke(c,[...rim,rim[0]],'rgba(251,222,162,.88)',3.2);
  // Short chips break the pigment at irregular intervals. The underlying stone stays visible.
  rim.forEach((start,i)=>{const end=rim[(i+1)%4],length=Math.hypot(end[0]-start[0],end[1]-start[1]);
   for(let k=0;k<Math.floor(length/13);k++){const t=((k+.38+Math.sin(k*12.7+i)*.26)*13)/length;
    const u=Math.min(t+(1.6+2*Math.sin(k*.82)**2)/length,.995);
    stroke(c,[[mix(start[0],end[0],t),mix(start[1],end[1],t)],[mix(start[0],end[0],u),mix(start[1],end[1],u)]],'rgba(161,123,79,.57)',1.7);}
  });c.restore();
 }
 function crossedEdge(c,ring,side,age,reduced){
  const x=side<0?ring.left:ring.right;
  const far=deck.back+2,near=deck.front-2;
  const top=[xAt(x,far),far],bottom=[xAt(x,near),near];
  c.save();
  // Keep the call anchored to the chalk that the fighter actually crossed.
  shape(c,[top,bottom,[bottom[0],near+deck.height],[top[0],far+deck.height]],'rgba(132,57,26,.44)');
  stroke(c,[top,bottom],'#632b20',12);
  stroke(c,[top,bottom],'#ffe39a',6);
  for(const y of [448,469]){
   const travel=reduced?0:15*Math.min(age/.55,1);
   const tip=xAt(x,y)+side*(26+travel);
   stroke(c,[[tip-side*10,y-6],[tip,y],[tip-side*10,y+6]],'#fff2c8',4);
  }
  // Two chalk waves spread across the stone as the foot crosses the line.
  if(!reduced){
   for(const delay of [0,.23]){
    const u=(age-delay)/.64;
    if(u<0||u>=1)continue;
    c.globalAlpha=1-u;c.strokeStyle='#fff3d2';c.lineWidth=4*(1-u)+1;
    c.beginPath();c.ellipse(x,447,8+69*u,4+20*u,0,0,2*Math.PI);c.stroke();
   }
  }
  c.restore();
 }
 const robes=['#52615a','#956b50','#646157','#845851','#666f60','#827a65'];
 function spectator(c,x,y,dir,index,seated,t,elapsed,strong,duration){
  const scale=(seated?.78:.91)*(.90+((index*7)%8)*.018),delay=.055+(index%5)*.021+(dir<0?.065:0);
  const beat=elapsed-delay,period=strong&&beat>.84?.24+(index%4)*.022:.29;
  const active=beat>=-.12&&beat<duration;
  const phase=clamp((beat+.13)/.14,0,1)*clamp((duration-beat)/.32,0,1);
  const open=active?(1-Math.cos(2*Math.PI*beat/period))*.5:1;
  const lean=active?phase*(1-open)*(strong?3.5:1.8):Math.sin(t*1.4+index)*.36;
  const robe=robes[(index+(dir<0?2:0))%robes.length];
  c.save();c.translate(x,y);c.scale(scale*dir,scale);c.lineCap='round';c.lineJoin='round';
  if(seated){
   stroke(c,[[-5,-15],[5,-13],[8,-3],[14,-2]],'#524e42',4.2);
   stroke(c,[[3,-15],[10,-13],[12,-1],[17,0]],robe,4.5);
  }else{
   oval(c,0,.7,16.3,2,'rgba(89,64,44,.19)');
   stroke(c,[[1,-10],[13,-3],[11,-1],[-7,-1]],'#514a41',5.3);
   stroke(c,[[-3,-10],[-10,-3],[-16,-2],[-19,-2]],robe,5);
  }
  const hip=seated?-17:-11,shoulder=hip-16;
  shape(c,[[-6,shoulder+lean],[-1,shoulder-3+lean],[5,shoulder-1+lean],[9,hip+3],[-8,hip+3]],robe);
  stroke(c,[[-6,hip],[8,hip+1]],'#5b4a3b',2.1);
  const skin=['#705644','#89684e','#74533d','#90705a'][index%4];
  oval(c,1.7+lean,shoulder-8+lean,5.35,6.0,skin);
  shape(c,[[-3.6+lean,shoulder-9+lean],[-2+lean,shoulder-13+lean],[2+lean,shoulder-14+lean],[6+lean,shoulder-11+lean],[4+lean,shoulder-10+lean]],'#4f493e');
  if(index%4===1)oval(c,-3+lean,shoulder-13+lean,2.4,2.4,'#51483b');
  const closeX=9,handY=shoulder+9-(strong?11:6)*phase,spread=active?(strong?9:6.5)*open:4.2;
  stroke(c,[[-4,shoulder+2],[-7,shoulder+10],[closeX-spread,handY+1]],robe,3.8);
  stroke(c,[[4,shoulder+1],[11,shoulder+9],[closeX+spread,handY]],skin,2.7);
  oval(c,closeX-spread,handY+.5,1.9,2.2,skin);oval(c,closeX+spread,handY,1.9,2.2,skin);c.restore();
 }
 function audience(c,t,crowd){
  const delta=t-crowd.at;c.save();
  for(const side of [1,-1]){
   const X=left=>side===1?left:960-left;const from=X(101),to=X(342);
   // Each viewing platform sits on the back of the courtyard, with the feet and bench legs on its top.
   shape(c,[[X(58),394],[X(370),394],[X(365),411],[X(50),411]],'#aa8667');
   shape(c,[[X(80),371],[X(355),371],[X(370),394],[X(58),394]],'#cdaa81');
   stroke(c,[[X(58),394],[X(370),394]],'#dfbd93',2.2);
   for(const k of [93,151,213,280,339])stroke(c,[[X(k),397],[X(k-3),409]],'#9d795f',1);
   stroke(c,[[X(52),411],[X(366),411]],'rgba(92,67,51,.36)',2.4);
   stroke(c,[[from,363],[to,363]],'#785e48',4);
   for(const leg of [111,218,332])stroke(c,[[X(leg),363],[X(leg),371]],'#79614b',2.7);
   for(let i=0;i<7;i++)spectator(c,X(115+i*36),375,side,i+7,true,t,delta,crowd.strong,crowd.duration);
   for(let i=0;i<7;i++)spectator(c,X(89+i*40),389+(i%3)*1.4,side,i,false,t,delta,crowd.strong,crowd.duration);
  }c.restore();
 }
 function referee(c,t,side,lift){
  c.save();c.translate(480,423);c.scale(1.39,1.39);c.lineCap='round';c.lineJoin='round';
  oval(c,0,1,22,3.2,'rgba(69,49,37,.25)');
  for(const d of [-1,1]){
   stroke(c,[[d*4,-19],[d*8,-9],[d*12,-1]],'#354143',6.6);
   stroke(c,[[d*12,-1],[d*17,-1]],'#252e30',3.4);
  }
  shape(c,[[-10,-43],[0,-46],[10,-43],[14,-18],[8,-14],[-13,-15]],'#534f42');
  shape(c,[[-9,-42],[0,-45],[8,-42],[12,-20],[-11,-19]],'#f5e5b9');
  stroke(c,[[-7,-42],[2,-31],[8,-41]],'#4b5350',2);stroke(c,[[-10,-22],[10,-22]],'#283738',4);
  shape(c,[[-1,-22],[4,-21],[7,-14],[3,-15]],'#33403a');
  oval(c,0,-54,7.6,8.4,'#634a37');oval(c,1,-53,6.5,6.7,'#ac8661');
  shape(c,[[-7,-56],[-6,-61],[0,-63],[7,-59],[7,-56],[2,-58],[-4,-57]],'#383a34');
  stroke(c,[[-3,-54],[-1,-54]],'#4b4235',.9);stroke(c,[[2,-54],[4,-54]],'#4b4235',.9);
  for(const [i,d] of [[0,-1],[1,1]]){
   const v=side===i?lift:0,shoulder=[d*8,-40],elbow=[d*(14+7*v),-29-21*v],hand=[d*(20+12*v),-22-37*v];
   stroke(c,[shoulder,elbow],'#796e54',7.5);stroke(c,[shoulder,elbow],'#eeddb4',5.4);stroke(c,[elbow,hand],'#846649',3.3);
   const top=[hand[0]+d*(6+5*v),hand[1]-13-12*v],wave=1.1*Math.sin(t*6+d);
   stroke(c,[[hand[0]-d*2,hand[1]+5],top],'#493d32',2.5);
   const cloth=[top,[top[0]+d*14,top[1]+wave],[top[0]+d*30,top[1]+2.5+wave],[top[0]+d*24,top[1]+19+wave],[top[0]+d*10,top[1]+16],[top[0]+d*.5,top[1]+16]];
   shape(c,cloth,i?'#ad3335':'#202a2a');stroke(c,[...cloth,cloth[0]],'#f4d49b',1.35);
   stroke(c,[[top[0]+d*4,top[1]+3],[top[0]+d*4,top[1]+13]],i?'#edaa75':'#8fab98',1.25);
   oval(c,...hand,2.5,2.6,'#b28c67');
  }c.restore();
 }
 const glyphs={0:['01110','11011','11011','11011','11011','11011','01110'],1:['00100','01100','00100','00100','00100','00100','01110'],2:['01110','10001','00001','00010','00100','01000','11111'],3:['11110','00001','00001','01110','00001','00001','11110'],4:['00010','00110','01010','10010','11111','00010','00010'],5:['11111','10000','10000','11110','00001','00001','11110'],6:['01110','10000','10000','11110','10001','10001','01110'],7:['11111','00001','00010','00100','01000','01000','01000'],8:['01110','10001','10001','01110','10001','10001','01110'],9:['01110','10001','10001','01111','00001','00001','01110'],':':['0','0','1','0','1','0','0'],'G':['01111','10000','10000','10111','10001','10001','01111'],'P':['11110','10001','10001','11110','10000','10000','10000']};
 function lamps(c,value,center,y,pitch,lit){
  let total=0;for(const char of value)total+=((glyphs[char]?.[0].length||1)+1)*pitch;
  let x=center-(total-pitch)/2+pitch*.5;for(const char of value){const rows=glyphs[char];if(!rows)continue;
   for(let j=0;j<7;j++)for(let i=0;i<rows[j].length;i++){
    const on=rows[j][i]==='1';c.fillStyle=on?lit:'#382b1d';c.shadowBlur=on?1.9:0;c.shadowColor=lit;
    c.beginPath();c.arc(x+i*pitch,y+j*pitch,pitch*.36,0,Math.PI*2);c.fill();
   }x+=(rows[0].length+1)*pitch;
  }c.shadowBlur=0;
 }
 function scoreboard(canvas,time,scores,round){
  const c=canvas.getContext('2d');c.save();c.setTransform(2,0,0,2,0,0);c.clearRect(0,0,320,81);
  panel(c,0,0,320,81,8,metal(c,0,81,'#eec486','#79583d'));
  panel(c,4,4,312,73,5,'#28342d');
  for(const x of [76,244])stroke(c,[[x,13],[x,68]],'#514739',.9);
  c.textAlign='center';c.font='bold 11px Consolas, monospace';c.fillStyle='#dbcfb0';c.fillText('BLACK',40,17);c.fillText('RED',280,17);
  c.fillStyle='#cabc9b';c.font='bold 10px Consolas, monospace';c.fillText('ROUND '+round+' / 5',160,16);
  for(const [x,width] of [[11,56],[85,150],[253,56]]){c.fillStyle='#111411';c.fillRect(x,22,width,45);}
  lamps(c,String(scores[0]),39,28,5.25,'#ffbc5c');lamps(c,time,160,29,4.95,'#ffb752');lamps(c,String(scores[1]),281,28,5.25,'#ffbc5c');
  for(const x of [8,312])for(const y of [8,73]){oval(c,x,y,1.9,1.9,'#81715b');stroke(c,[[x-1,y+.45],[x+1,y-.45]],'#39392f',.7);}
  c.restore();
 }
 function panel(c,x,y,w,h,r,fill){
  c.fillStyle=fill;c.beginPath();c.roundRect(x,y,w,h,r);c.fill();
 }
 function metal(c,y,height,light,dark){
  const wash=c.createLinearGradient(0,y,0,y+height);
  wash.addColorStop(0,light);wash.addColorStop(.18,dark);wash.addColorStop(.49,light);wash.addColorStop(1,dark);
  return wash;
 }
 // Paint the reverse of the scoreboard once, when the referee calls the result.
 function resultFace(m,clockText){
  const face=document.createElement('canvas');face.width=444;face.height=126;
  const c=face.getContext('2d'),final=m.phase==='won';
  const brass=metal(c,2,120,'#f6cb83','#855633');
  panel(c,0,3,444,123,15,'#503523');panel(c,2,0,440,122,14,brass);
  panel(c,7,6,430,110,10,'#2a342e');panel(c,10,9,424,103,8,'#35423b');
  c.textAlign='center';c.font='bold 16px Bahnschrift, Arial, sans-serif';c.fillStyle='#ffe5ac';
  c.fillText('BLACK',76,28);c.fillText('TIME LEFT',222,28);c.fillText('RED',368,28);
  for(const [x,w] of [[18,115],[141,162],[311,115]]){
   panel(c,x,34,w,56,5,'#887455');panel(c,x+2,36,w-4,52,4,'#172019');
  }
  const score=final?m.wins:m.f.map(f=>f.points);
  lamps(c,String(score[0]),76,43,6.1,'#ffbb63');lamps(c,clockText,222,43,6.0,'#ffe6a1');lamps(c,String(score[1]),368,43,6.1,'#ffbb63');
  const legend=final?'ROUNDS WON':('ROUND '+m.round+' POINTS');
  c.fillStyle='#ffdf9c';c.font='bold 16px Bahnschrift, Arial, sans-serif';
  c.fillText(legend+'   /   '+(m.sudden?'GOLDEN POINT':m.reason),222,109,397);
  for(const x of [10,434])for(const y of [10,113]){
   oval(c,x,y,2.6,2.6,'#68482e');stroke(c,[[x-1.4,y+.7],[x+1.4,y-.7]],'#e5c593',1);
  }
  return face;
 }
 function winnerPlaque(c,name,final,beats){
  // The domed winner plate has its own hinge along the top of the cabinet.
  c.beginPath();c.moveTo(-172,0);c.lineTo(-172,-65);c.quadraticCurveTo(-122,-69,-89,-84);
  c.quadraticCurveTo(0,-116,89,-84);c.quadraticCurveTo(122,-69,172,-65);c.lineTo(172,0);c.closePath();
  c.fillStyle='#742e2a';c.fill();c.lineWidth=5;c.strokeStyle=metal(c,-100,104,'#f9ce81','#895338');c.stroke();
  panel(c,-142,-53,284,49,9,'#30271f');
  c.textAlign='center';c.fillStyle='#ffdf9b';c.font='bold 18px Bahnschrift, Arial, sans-serif';
  c.fillText(final?'MATCH WINNER':'ROUND WINNER',0,-59);
  c.font='bold 43px Georgia, serif';c.fillStyle=beats?'#fff0bb':'#f2d6a1';
  if(beats){c.shadowColor='#ffb53a';c.shadowBlur=8;}
  c.fillText(name.toUpperCase(),0,-15);c.shadowBlur=0;
  // Mirrored star lamps carry the four beats outwards from the winner's name.
  if(final)for(let bank=0;bank<4;bank++)for(const side of [-1,1]){
   const x=side*(80+bank*16),y=-30;
   const lit=bank<beats,r=bank%2?5.5:8;
   if(lit){c.shadowColor='#ffbe46';c.shadowBlur=8;}
   shape(c,[[x,y-r],[x+2,y-2],[x+r,y],[x+2,y+2],[x,y+r],[x-2,y+2],[x-r,y],[x-2,y-2]],lit?'#ffe096':'#654e37');
   c.shadowBlur=0;
  }
  for(let i=-7;i<=7;i++){
   const x=i*21,y=-69-24*(1-(Math.abs(i)/7)**1.55);
   const lit=beats>Math.min(3,Math.floor(Math.abs(i)/2));
   oval(c,x,y,5.3,5.3,'#573d29');
   if(lit){c.shadowColor='#ffc451';c.shadowBlur=10;}
   oval(c,x,y-.5,3.8,3.8,lit?'#fff0ac':'#9d805b');c.shadowBlur=0;
  }
  for(const side of [-1,1])for(let row=0;row<3;row++){
   const x=158*side,y=-48+row*15;
   oval(c,x,y,4.7,4.7,beats===4?'#ffdb73':'#997956');
  }
 }
 function flipAngle(t){
  // Momentum carries the face past vertical before the stop catches it.
  if(t<=0)return 0;
  if(t<.73){
   const u=t/.73;
   return (Math.PI+.21)*u*u*(3-2*u);
  }
  const settle=(t-.73)/.27;
  return Math.PI+.21*Math.cos(settle*Math.PI*1.7)*(1-settle)**2;
 }
 function flipFace(c,front,back,turn){
  if(turn<=0||turn>=1){c.drawImage(turn<=0?front:back,-222,-63,444,126);return;}
  const angle=flipAngle(turn),cos=Math.cos(angle),sin=Math.sin(angle);
  const face=cos>=0?front:back;
  // Project horizontal strips around the fixed axle. The near edge grows wider.
  const edge=y=>{
   const local=cos>=0?y:-y,scale=560/(560-local*sin);
   return {x:222*scale,y:local*cos*scale};
  };
  const top=edge(-63),bottom=edge(63);
  for(let i=0;i<18;i++){
   const a=edge(-63+7*i),b=edge(-63+7*(i+1)),half=(a.x+b.x)/2;
   c.drawImage(face,0,i*face.height/18,face.width,face.height/18,
    -half,a.y,2*half,Math.max(.35,b.y-a.y+.55));
  }
  c.save();c.globalAlpha=.38*(1-Math.abs(cos));
  shape(c,[[-top.x,top.y],[top.x,top.y],[bottom.x,bottom.y],[-bottom.x,bottom.y]],'#34291d');
  c.restore();
  const near=top.x>bottom.x?top:bottom;
  stroke(c,[[-near.x,near.y],[near.x,near.y]],'#b98f53',1+6*Math.abs(sin));
 }
 const borderLamps=[];
 for(let i=0;i<21;i++)borderLamps.push([-223+i*22.3,-64]);
 for(let i=1;i<=6;i++)borderLamps.push([223,-64+i*18.3]);
 for(let i=0;i<21;i++)borderLamps.push([223-i*22.3,64]);
 for(let i=1;i<=6;i++)borderLamps.push([-223,64-i*18.3]);
 function jackpotLights(c,age,reduced){
  const t=clamp(age,0,3.8),settle=reduced?1:clamp((t-3.15)/.65,0,1);
  const count=borderLamps.length,head=(t*31-Math.max(0,t-2.3)**2*6)%count;
  c.save();c.lineJoin='round';
  stroke(c,[...borderLamps,borderLamps[0]],'#665039',7);
  borderLamps.forEach(([x,y],i)=>{
   const trail=((head-i)%(count/2)+count/2)%(count/2);
   const glow=Math.max(0,1-trail/8)**1.5*(1-settle)+.82*settle;
   oval(c,x,y,3.8,3.8,'#5b3924');oval(c,x,y,3.2,3.2,'#af7a45');
   if(glow>.01){
    c.globalAlpha=glow*.22;oval(c,x,y,7,7,'#ffb536');
    c.globalAlpha=glow;oval(c,x,y,3.25,3.25,'#fff4ac');c.globalAlpha=1;
   }
  });
  c.restore();
 }
 function resultStand(c,front,back,name,final,turn,beats,chaseAge=0,reduced=false){
  c.save();c.translate(480,226);
  for(const side of [-1,1]){
   const x=side*236;
   oval(c,x+5,201,23,4,'rgba(82,60,42,.29)');
   panel(c,x-10,191,20,10,2,'#7e6b4f');
   panel(c,x-5,-18,10,211,3,'#645844');
   panel(c,x-3,-16,3,207,1,'#bca17a');
   panel(c,x-7,178,14,15,2,'#7e725c');
  }
  panel(c,-237,-4,474,8,3,'#594b3b');
  if(turn>.52){
   const u=clamp((turn-.52)/.45,0,1),pop=1+2.4*(u-1)**3+1.4*(u-1)**2;
   c.save();c.translate(0,-59);c.scale(1,Math.max(.001,pop));winnerPlaque(c,name,final,beats);c.restore();
  }
  flipFace(c,front,back,turn);
  if(final&&beats>0&&turn>=.99)jackpotLights(c,chaseAge,reduced);
  for(const side of [-1,1]){
   const x=side*236;
   panel(c,side<0?x:222,-4,14,8,2,'#c29c63');
   oval(c,x,0,8,8,'#5a4a38');oval(c,x,0,5.3,5.3,'#d2ad73');
   stroke(c,[[x-2,1],[x+2,-1]],'#6e5539',1.3);
  }
  c.restore();
 }
 let courtyardLayer=null;
 function courtyard(c,bg,side=0,vertical=0){
  if(!courtyardLayer){
   courtyardLayer=document.createElement('canvas');
   courtyardLayer.width=bg.naturalWidth;courtyardLayer.height=bg.naturalHeight;
   const paint=courtyardLayer.getContext('2d');paint.drawImage(bg,0,0);
   // Repeat the neighboring fence bays and stone courses beneath the painted side table.
   for(let y=385;y<449;y++){
    const strips=y<419?[[781,92]]:[[790,27],[841,29]];
    const shift=y<411?107:Math.round(2*(68+(y-410)*.22));
    for(const [x,width] of strips)paint.drawImage(bg,x-shift,y,width,1,x,y,width,1);
   }
  }
  // Extend just the scenery beyond the original ring on other monitor shapes.
  // Mirror at the visible edge so roof lines and stone courses meet the arena.
  const layer=courtyardLayer;
  if(side>0){
   const sample=Math.min(side*960/978,280);
   c.save();c.scale(-1,1);
   c.drawImage(layer,9,0,sample,540,0,-6,side,552);
   c.drawImage(layer,951-sample,0,sample,540,-960-side,-6,side,552);
   c.restore();
  }
  if(vertical>0){
   const sample=Math.min(vertical*540/552,45);
   c.save();c.scale(1,-1);
   c.drawImage(layer,0,6,960,sample,-9,0,978,vertical);
   c.drawImage(layer,0,534-sample,960,sample,-9,-540-vertical,978,vertical);
   c.restore();
  }
  c.drawImage(layer,-9,-6,978,552);
 }
 function chef(c,x,y,lift){
  c.save();c.translate(x-39,y+62);c.lineCap='round';c.lineJoin='round';
  stroke(c,[[-8,-20],[-9,0],[-16,1]],'#3c423a',6);
  stroke(c,[[6,-20],[8,0],[15,1]],'#3c423a',6);
  shape(c,[[-15,-49],[-3,-54],[10,-50],[17,-22],[-14,-20]],'#f6e9ce');
  shape(c,[[-9,-41],[9,-43],[12,-17],[-12,-16]],'#42685b');
  stroke(c,[[-12,-50],[-7,-40],[6,-52]],'#a98555',2.2);
  const hand=[37-59*lift,-52-42*lift];
  stroke(c,[[7,-48],[20,-48-12*lift],hand],'#dbcbb0',7);
  stroke(c,[[19,-48-12*lift],hand],'#b5825a',4.6);
  stroke(c,[[-12,-46],[-20,-34],[-12,-30]],'#f8ead0',6.4);
  oval(c,-11,-30,3.8,3.4,'#b5825a');
  oval(c,-1,-60,9.7,10.8,'#bc9069');
  stroke(c,[[1,-61],[4,-61]],'#473a30',1.6);
  stroke(c,[[1,-55],[4,-54],[6,-56]],'#73513b',1.35);
  panel(c,-11,-75,20,9,2,'#e6d8b8');
  for(const [xx,yy,r] of [[-10,-75,6],[-4,-80,7],[4,-79,6.5],[9,-74,5]])oval(c,xx,yy,r,r,'#fff2d8');
  c.restore();
 }
 function steamerLid(c,x,y,lift){
  // The woven lid tilts edge-on as the chef lifts it clear of the prize.
  c.save();c.translate(x-2-59*lift,y+13-42*lift);c.rotate(-.85*lift);
  c.scale(1,1-.28*lift);c.fillStyle='#cda36c';
  c.beginPath();c.moveTo(-38,0);c.quadraticCurveTo(-34,-26,0,-28);c.quadraticCurveTo(32,-26,38,0);c.closePath();c.fill();
  for(const k of [-23,-12,0,12,23])stroke(c,[[k*.45,-25],[k,0]],'#aa794d',1.1);
  stroke(c,[[-38,0],[0,2],[38,0]],'#8c623e',3);oval(c,0,-28,4,2.8,'#815936');
  c.restore();
 }
 function prizeTable(c,x,y){
  c.save();c.translate(x,y);c.lineJoin='round';
  oval(c,0,54,71,5,'rgba(67,44,34,.19)');
  for(const [leg,base] of [[-49,47],[48,47],[-61,56],[59,56]]){
   shape(c,[[leg-4,19],[leg+4,19],[leg+3,base],[leg-3,base]],'#633d2b');
   stroke(c,[[leg-2,24],[leg-2,base-2]],'#aa7549',2);
  }
  shape(c,[[-69,21],[69,21],[67,29],[-67,29]],'#834e31');
  shape(c,[[-63,13],[61,13],[70,21],[-70,21]],'#cd9a60');
  stroke(c,[[-69,21],[69,21]],'#f4c783',2);
  oval(c,0,14,38,7,'#855631');
  c.fillStyle='#c69250';c.fillRect(-38,9,76,6);
  oval(c,0,9,38,7,'#ebc088');oval(c,0,9,33,4.8,'#8f623a');
  stroke(c,[[-32,16],[0,18],[32,16]],'#e8b577',1.4);
  c.restore();
 }
 return {platform,boundary,crossedEdge,audience,referee,scoreboard,resultFace,resultStand,courtyard,chef,steamerLid,prizeTable};
})();

