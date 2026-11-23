/* Moon Gate's projected film poses, retargeted to a side-view arena. */
(() => {
  "use strict";

  const poses = window.FILM_POSES;
  const floor = 447;
  const unit = 1.06;
  const white = "#fff2cd";
  const aliases = {
    walk: "guard", idle: "guard", block: "check", parry: "brush", punch: "jab",
    heavy: "high", trip: "sweep", throw: "cast", thrown: "airturn", grab: "lock",
    win: "salute", stun: "reel", hurt: "belly", ko: "down"
  };
  const feetFirst = new Set(["kick","high","sweep","airkick","wheel","sweepfinish","flyingHeel","retreatHeel"]);
  const colors = [
    { ink:"#182329", shadow:"#35454a", band:"#63dfce", trim:"#318f87", eye:"#dcfaf0" },
    { ink:"#ac3542", shadow:"#792e3b", band:"#ffcd7c", trim:"#cf834b", eye:"#fff1ce" }
  ];
  const clamp = (n,lo,hi) => Math.max(lo,Math.min(hi,n));
  const mix = (a,b,v) => a+(b-a)*v;
  const named = key => poses[aliases[key] || key] || poses.guard;

  function position(f,clock) {
    const a = named(f.fromPose || f.pose), b = named(f.pose);
    const w = f.blend == null ? 1 : clamp(f.blend,0,1);
    const pts = b.map(([x,y],i) => [mix(a[i][0],x,w), mix(a[i][1],y,w)]);
    if (f.pose === "walk") {
      const swing = Math.sin(f.step ?? clock*12);
      [[3,4,-1],[5,6,1]].forEach(([elbow,hand,side]) => {
        pts[elbow][0] += swing*side*7*w;
        pts[hand][0] += swing*side*7*w;
      });
      [[7,8,1],[9,10,-1]].forEach(([knee,foot,side]) => {
        pts[knee][0] += side*swing*12*w;
        pts[foot][0] += side*swing*24*w;
        pts[knee][1] -= Math.max(0,side*Math.cos(f.step ?? clock*12))*6*w;
        pts[foot][1] -= Math.max(0,side*Math.cos(f.step ?? clock*12))*11*w;
      });
    } else if (f.pose === "guard" || f.pose === "idle") {
      const breath = Math.sin(clock*4.6+f.id*1.3)*1.6*w;
      for (let i=0; i<7; i++) pts[i][1] += breath;
      pts[5][0] += breath*.65;
      pts[6][0] += breath*.8;
    }
    const name = aliases[f.pose] || f.pose;
    if (Number.isFinite(f.reach) && f.reach > 0) {
      const tip = feetFirst.has(name) ? 10 : 6;
      const diff = clamp(f.reach/unit-pts[tip][0],-28,47)*w;
      pts[tip][0] += diff;
      pts[tip-1][0] += diff*.45;
    }
    const height = key => Math.max(key[8][1],key[10][1],key[2][1]+17,key[4][1]+3,key[6][1]+3);
    const hipY = f.filmHip ?? (floor + (f.y || 0) - mix(height(a),height(b),w)*unit);
    const angle = f.angle || 0, facing = f.dir < 0 ? -1 : 1;
    if(f.contactTarget&&feetFirst.has(name)&&f.state==='attack'){
      const dx=f.contactTarget.x-f.x,dy=f.contactTarget.y-hipY,c=Math.cos(angle),sn=Math.sin(angle);
      const toe=[(dx*c+dy*sn)/(unit*facing),(-dx*sn+dy*c)/unit];
      const tip=pts[10];pts[9][0]+=(toe[0]-tip[0])*.48;pts[9][1]+=(toe[1]-tip[1])*.50;
      pts[10]=toe;
    }
    return { pts, hipY, angle, facing };
  }

  function joints(f,clock=0) {
    const { pts,hipY,angle,facing } = position(f,clock);
    const c=Math.cos(angle),s=Math.sin(angle);
    return pts.map(([dx,dy]) => {
      const x=dx*unit*facing,y=dy*unit;
      return {x:f.x+c*x-s*y,y:hipY+s*x+c*y};
    });
  }

  function canConnect(a,b,type,clock){
    const body=joints(b,clock);
    const attack=joints({...a,contactTarget:null,pose:MoonCombat.moves[type].hit,fromPose:MoonCombat.moves[type].hit,blend:1,angle:0,reach:undefined},clock);
    if(type==='grab'){
      const minY=Math.min(body[0].y,body[1].y)-13,maxY=Math.max(body[0].y,body[1].y)+12;
      return [attack[4],attack[6]].some(h=>h.y>=minY&&h.y<=maxY&&
        (body[1].x-h.x)*a.dir<=22 && (body[1].x-a.x)*a.dir>=0);
    }
    const head=body[2],hip=attack[0];
    const dx=(head.x-hip.x)*a.dir,dy=head.y-hip.y;
    return dx>=0 && Math.hypot(Math.max(0,dx-15),dy)<140;
  }

  function path(ctx,points,color,fillWidth=0) {
    ctx.beginPath();
    ctx.moveTo(...points[0]);
    for (let i=1;i<points.length;i++) ctx.lineTo(...points[i]);
    if (fillWidth) {
      ctx.strokeStyle=color;ctx.lineWidth=fillWidth;ctx.stroke();
    } else {
      ctx.closePath();ctx.fillStyle=color;ctx.fill();
    }
  }
  function oval(ctx,x,y,rx,ry,color) {
    ctx.beginPath();ctx.ellipse(x,y,rx,ry,0,0,Math.PI*2);ctx.fillStyle=color;ctx.fill();
  }
  function wrap(ctx,a,b,color) {
    path(ctx,[[mix(a[0],b[0],.68),mix(a[1],b[1],.68)],
              [mix(a[0],b[0],.79),mix(a[1],b[1],.79)]],color,6.6);
  }
  function drawDumpling(ctx,x,y,size=1,bites=0,clock=0,facing=1) {
    if(bites>=3)return;
    ctx.save();ctx.translate(x,y);ctx.scale(size*facing,size);
    const piece=[1,.80,.54][bites];ctx.scale(piece,piece);
    ctx.lineCap="round";
    for(let i=0;i<3;i++){
      const phase=(clock*.48+i/3)%1, drift=Math.sin(phase*6.28+i)*2.1;
      const sx=(i-1)*6.1+drift,sy=-10-10*phase;
      ctx.strokeStyle='rgba(255,248,223,'+(.20+.54*Math.sin(phase*Math.PI))+')';
      ctx.lineWidth=1.35;ctx.beginPath();ctx.moveTo(sx,sy);
      ctx.bezierCurveTo(sx+6,sy-5,sx-5,sy-8,sx+drift,sy-15);ctx.stroke();
    }
    ctx.beginPath();ctx.moveTo(-16,2);
    if(bites){
      ctx.quadraticCurveTo(-9,3,-10,-2);ctx.quadraticCurveTo(-5,-2,-6,-7.6);
    }else ctx.bezierCurveTo(-15,-3,-10,-7,-6,-7.6);
    ctx.quadraticCurveTo(-.8,-15,2,-10);
    ctx.bezierCurveTo(6,-12,10,-6,12,-4.5);
    ctx.quadraticCurveTo(21,3,13,6);
    ctx.bezierCurveTo(6.5,10,-17,9,-16,2);
    ctx.fillStyle=white;ctx.fill();ctx.strokeStyle="#a7754d";ctx.lineWidth=1.35;ctx.stroke();
    if(bites){
      ctx.beginPath();ctx.moveTo(-15,2);ctx.quadraticCurveTo(-9,3,-10,-2);
      ctx.quadraticCurveTo(-5,-2,-6,-7);ctx.strokeStyle='#ae713b';ctx.lineWidth=2;ctx.stroke();
    }
    for(const x of [-8,-3,3,8]){
      ctx.beginPath();ctx.moveTo(x*.39,-7.7);ctx.quadraticCurveTo(x*.95,-3.8,x,-1.6);
      ctx.strokeStyle="#cfad7f";ctx.lineWidth=1;ctx.stroke();
    }
    ctx.restore();
  }
  function drawFighter(ctx,f,clock=0) {
    const {pts,hipY,angle,facing} = position(f,clock);
    const {ink,shadow,band,trim,eye} = colors[f.id === 1 ? 1 : 0];
    ctx.save();
    const grounded = clamp(1+((f.y||0)-(f.shadowDrop||0))/240,.29,1);
    oval(ctx,f.x+2,floor+1.3+(f.shadowDrop||0),(f.pose==="down"||f.pose==="splat"?66:39)*grounded,
         3.8*grounded,"rgba(79,58,52,"+(.10+.13*grounded)+")");
    ctx.translate(f.x,hipY);ctx.rotate(angle);ctx.scale(unit*facing,unit);
    ctx.lineCap="round";ctx.lineJoin="round";
    const limb=(indices,color,width)=>path(ctx,indices.map(i=>pts[i]),color,width);
    limb([1,3,4],shadow,7.4);
    limb([0,7,8],shadow,8.9);
    limb([0,9,10],ink,9.9);
    limb([0,1,2],ink,10.6);
    limb([1,5,6],ink,8.4);
    wrap(ctx,pts[3],pts[4],trim);wrap(ctx,pts[5],pts[6],band);
    oval(ctx,pts[6][0],pts[6][1],4.75,4.5,ink);
    const head=pts[2],shoulder=pts[1];
    const dx=head[0]-shoulder[0],dy=head[1]-shoulder[1],length=Math.hypot(dx,dy)||1;
    const up=[dx/length,dy/length],cross=[-up[1],up[0]];
    const offset=(xx,yy)=>[head[0]+cross[0]*xx+up[0]*yy,head[1]+cross[1]*xx+up[1]*yy];
    const ripple=Math.sin(clock*12.7+f.id)*2.1;
    path(ctx,[offset(-10,-1),offset(-30,-.5+ripple),offset(-25,-5+ripple*.8),offset(-10,-4)],trim);
    path(ctx,[offset(-11,.4),offset(-27,6+ripple),offset(-19,.1+ripple*.5),offset(-11,-2)],band);
    oval(ctx,head[0],head[1],16.2,16.2,ink);
    path(ctx,[offset(-15.7,.4),offset(15.3,3.8),offset(15.9,.4),offset(-15.8,-3.4)],band);
    if(f.pose!=="down" && f.pose!=="splat") {
      path(ctx,[offset(6.2,-.9),offset(13.1,-.15),offset(10.9,-2.55),offset(6.9,-2.5)],eye);
    }
    if(window.MaskHook)window.MaskHook(ctx,f,head,up,cross);
    if(f.jaw!=null) {
      const pt=offset(9.2,-7.3);
      oval(ctx,...pt,3.4,1.0+2.3*f.jaw,"#f2c4a0");
    }
    ctx.restore();
  }
  window.Art=Object.freeze({drawFighter,drawDumpling,joints,canConnect});
})();
