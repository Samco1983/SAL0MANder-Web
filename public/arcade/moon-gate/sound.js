/* Original Moon Gate film score, voices and foley, mastered for the arcade. */
(() => {
  "use strict";
  const clip = {
    crowdPoint:[0,1.15],crowdRound:[1.30,2.87],
    biteOne:[6.00,.98],biteTwo:[7.10,.98],biteThree:[8.20,.98],
    softMunch:[1.20,.21],lipSmack:[1.46,.20],gulp:[1.75,.42],
    victoryPalms:[2.30,1.99],payout:[4.55,1.25],
    hit: [0, 0.446236], block: [0.516236, 0.407574], parry: [0.993810, 0.177234],
    sweep: [1.241043, 0.409478], ko: [1.720522, 1.107234],
    voiceBlack: [2.897755, 0.300204], voiceRed: [3.267959, 0.231383],
    ouchBlack: [3.569342, 0.267098], ouchRed: [3.906440, 0.272200],
    wuaa: [4.248639, 1.150635], whoosh: [5.469274, 0.181202],
    throw: [5.720476, 0.341814], step: [6.132290, 0.442404],
    land: [6.644694, 0.433832], chew: [7.148526, 0.161224],
    bell: [7.379751, 0.797188], round1: [8.246939, 0.777211],
    round2: [9.094150, 0.761814], round3: [9.925964, 0.712993],
    round4: [10.708957, 0.710658], round5: [11.489615, 0.763878],
    fight: [12.323492, 0.675941], dub: [13.069433, 0.948957], bill: [14.088390, 1.458299],
    air: [15.616689, 0.367007], skid: [16.053696, 0.406825],
    floor: [16.530522, 0.447234], heavy: [17.047755, 0.458231],
    hiyaBlack: [17.575986, 0.563560], yahBlack: [18.209546, 0.229819],
    oofBlack: [18.509365, 0.328481], gruntBlack: [18.907846, 0.310408],
    hiyaRed: [19.288254, 0.566576], yahRed: [19.924830, 0.298934],
    oofRed: [20.293764, 0.328390], gruntRed: [20.692154, 0.232925],
    snap: [20.995079, 0.450227], hiya: [21.515306, 0.592834],
    watah: [22.178141, 0.587302], slap: [22.835442, 0.128730],
    hiss: [23.034172, 0.494354],
    risingKick:[0,.584989],risingFlip:[.674989,.724989],risingFinish:[1.489977,.944989]
  };
  const rising=new Set(["risingKick","risingFlip","risingFinish"]);
  const featured = new Set(["hiya", "watah", "slap", "hiss", "wuaa", "ko",...rising]);
  const variations = {
    hit: ["hit","snap"],
    voiceBlack: ["voiceBlack","yahBlack","hiyaBlack"],
    voiceRed: ["voiceRed","hiyaRed","yahRed"],
    ouchBlack: ["ouchBlack","gruntBlack","oofBlack"],
    ouchRed: ["ouchRed","oofRed","gruntRed"]
  };
  const nextTake = new Map();
  const base = document.currentScript?.src || document.baseURI;
  const audioUrls = window.MoonGateAudioURLs || {};
  const assetUrl = (name) => audioUrls[name] || new URL("assets/audio/" + name + ".mp3", base).href;
  function fetchAudio(name) {
    return fetch(assetUrl(name)).then((response) => {
      if (!response.ok) throw new Error("Audio unavailable");
      return response.arrayBuffer();
    }).catch(() => null);
  }
  const bankBytes = fetchAudio("ring");
  const soundtrackNames={ironlantern:"Iron Lantern",courtyard:"Moon Gate Courtyard"};
  let selection="ironlantern";
  try{const saved=localStorage.getItem("moonGate.soundtrack");if(Object.hasOwn(soundtrackNames,saved))selection=saved;}catch{}
  const voiceBytes=fetchAudio("kiai");
  const crowdBytes=fetchAudio("crowd");
  const festivalBytes=fetchAudio("festival");
  const festivalCues=new Set(['biteOne','biteTwo','biteThree','softMunch','lipSmack','gulp','victoryPalms','payout']);
  let festivalBank;
  let crowdBank,crowdSource,crowdEnvelope;
  const scores=new Map();
  let ctx, musicBus, effectsBus, bank, voiceBank, ready, musicSource, musicWanted = false;
  let userPaused = false, unlocked = false, musicStarted = 0, musicOffset = 0;
  let currentCall = null;
  let duckUntil = 0, auditionContext, auditionSource, auditionEpoch = 0;
  const voices = new Set();
  const throttle = new Map();
  const paused = () => userPaused || document.hidden;
  function setting(key, value) {
    try {
      const name = "moonGate.audio." + key;
      if (value === undefined) return localStorage.getItem(name) !== "0";
      localStorage.setItem(name, value ? "1" : "0");
    } catch { return true; }
  }
  let musicOn = setting("music"), effectsOn = setting("effects");
  function scoreTrack(key){
    if(!ctx)return Promise.resolve(null);
    if(!scores.has(key))scores.set(key,fetchAudio(key).then(data=>data?ctx.decodeAudioData(data):null).catch(()=>null));
    return scores.get(key);
  }
  let score=null;
  function loadTrack(){
    if(!ctx)return;
    const key=selection;
    scoreTrack(key).then(buffer=>{if(selection===key){score=buffer;playMusic();}});
  }
  function setBus(bus, gain) {
    if (!bus || !ctx) return;
    bus.gain.cancelScheduledValues(ctx.currentTime);
    bus.gain.setTargetAtTime(gain, ctx.currentTime, .012);
  }
  function init() {
    if (ctx) return;
    const Audio = window.AudioContext || window.webkitAudioContext;
    if (!Audio) return;
    try {
      ctx = new Audio();
      const limiter = ctx.createDynamicsCompressor();
      limiter.threshold.value = -8; limiter.knee.value = 12; limiter.ratio.value = 4;
      limiter.attack.value = .003; limiter.release.value = .12;
      const output = ctx.createGain(); output.gain.value = .82;
      limiter.connect(output); output.connect(ctx.destination);
      musicBus = ctx.createGain(); musicBus.gain.value = musicOn ? .37 : 0;
      effectsBus = ctx.createGain(); effectsBus.gain.value = effectsOn ? .90 : 0;
      musicBus.connect(limiter); effectsBus.connect(limiter);
      const decode = (bytes) => bytes.then((data) => data ? ctx.decodeAudioData(data) : null).catch(() => null);
      ready = Promise.all([decode(bankBytes).then(buffer=>{bank=buffer;}),decode(voiceBytes).then(buffer=>{voiceBank=buffer;}),decode(crowdBytes).then(buffer=>{crowdBank=buffer;}),decode(festivalBytes).then(buffer=>{festivalBank=buffer;})]);
      loadTrack();
      ctx.addEventListener("statechange", playMusic);
    } catch { ctx = null; }
  }
  function unlock() {
    unlocked = true;
    init();
    if (ctx && !paused() && ctx.state !== "running") ctx.resume().catch(() => {});
    playMusic();
    return ready || Promise.resolve();
  }
  function playMusic() {
    if (!musicWanted || !musicOn || !score || !ctx || ctx.state !== "running" || paused() || musicSource) return;
    const source = ctx.createBufferSource();
    source.buffer = score; source.loop = true; source.connect(musicBus);
    source.start(0, musicOffset % score.duration);
    musicStarted = ctx.currentTime; musicSource = source;
    source.onended = () => source.disconnect();
  }
  function haltMusic(remember) {
    if (musicSource) {
      if (remember) musicOffset += ctx.currentTime - musicStarted;
      musicSource.stop(); musicSource = null;
    }
    if (!remember) musicOffset = 0;
  }
  function playClip(name, ended, holdSeconds=0,rate=1,level=1) {
    const buffer=festivalCues.has(name)?festivalBank:name==='crowdPoint'||name==='crowdRound'?crowdBank:rising.has(name)?voiceBank:bank;
    if (!effectsOn || !buffer || !ctx || ctx.state !== "running" || paused() || !clip[name]) return null;
    const [offset, duration] = clip[name];
    const source = ctx.createBufferSource();
    source.buffer = buffer;source.playbackRate.value=rate;
    let envelope;
    if(holdSeconds>duration){
      envelope=ctx.createGain();
      const now=ctx.currentTime;
      source.loop=true;
      // Quiet gaps between claps in the round recording make a clean loop.
      source.loopStart=offset+.578;
      source.loopEnd=offset+duration-.62;
      source.connect(envelope);envelope.connect(effectsBus);
      crowdEnvelope=envelope;
      envelope.gain.setValueAtTime(level,now);
      envelope.gain.setValueAtTime(level,now+holdSeconds-.70);
      envelope.gain.linearRampToValueAtTime(0,now+holdSeconds);
    }else if(level!==1){
      envelope=ctx.createGain();envelope.gain.value=level;
      source.connect(envelope);envelope.connect(effectsBus);
    }else source.connect(effectsBus);
    voices.add(source);
    source.onended = () => {
      voices.delete(source); source.disconnect(); envelope?.disconnect(); if (ended) ended();
    };
    source.start(0,offset,Math.max(duration,holdSeconds));
    return source;
  }
  function stopCrowd(){
    if(!crowdSource)return;
    if(crowdEnvelope&&ctx.state==='running'){
      const now=ctx.currentTime;
      const gain=crowdEnvelope.gain;
      if(gain.cancelAndHoldAtTime)gain.cancelAndHoldAtTime(now);
      else{const level=gain.value;gain.cancelScheduledValues(now);gain.setValueAtTime(level,now);}
      crowdEnvelope.gain.linearRampToValueAtTime(0,now+.055);
      crowdSource.stop(now+.055);
    }else crowdSource.stop();
    crowdSource=null;crowdEnvelope=null;
  }
  function applause(round,holdSeconds=0,final=false){
    stopCrowd();
    if(final)playClip('victoryPalms',null,0,1,1.05);
    const instance=playClip(round?'crowdRound':'crowdPoint',()=>{if(crowdSource===instance){crowdSource=null;crowdEnvelope=null;}},holdSeconds,1,final?.32:1);
    crowdSource=instance;
  }
  function cue(name) {
    const now = performance.now();
    const minGap = name === "step" ? 115 : 30;
    if (now - (throttle.get(name) ?? -Infinity) < minGap) return;
    const takes = variations[name];
    const index = nextTake.get(name) || 0;
    if (playClip(takes ? takes[index] : name)) {
      throttle.set(name,now);
      if (takes) nextTake.set(name,(index + 1) % takes.length);
      if (featured.has(name) && musicOn) {
        duckUntil = Math.max(duckUntil,ctx.currentTime + clip[name][1]);
        setBus(musicBus,.19);
        musicBus.gain.setTargetAtTime(.37,duckUntil,.072);
      }
    }
  }
  function stopAudition() {
    auditionEpoch++;
    if (auditionSource) { auditionSource.stop(); auditionSource = null; }
  }
  // A move-list audition can run while the game (including its main audio
  // clock and fight announcer) is paused. Only the latest tap should be heard.
  async function audition(name) {
    stopAudition();
    const musicPreview=Object.hasOwn(soundtrackNames,name);
    if (document.hidden || (musicPreview?!musicOn:!effectsOn||!clip[name])) return false;
    const epoch = auditionEpoch;
    init();
    if (!ctx) return false;
    if (!auditionContext) {
      const Audio = window.AudioContext || window.webkitAudioContext;
      try { auditionContext = new Audio(); } catch { return false; }
    }
    try {
      await Promise.all([auditionContext.resume(),ready]);
      const buffer=musicPreview?await scoreTrack(name):festivalCues.has(name)?festivalBank:rising.has(name)?voiceBank:bank;
      if (epoch !== auditionEpoch || !buffer || (musicPreview?!musicOn:!effectsOn) || document.hidden) return false;
      const source = auditionContext.createBufferSource();
      const gain = auditionContext.createGain();
      gain.gain.value = musicPreview?.43:.86; gain.connect(auditionContext.destination);
      source.buffer = buffer; source.connect(gain);
      source.onended = () => {
        source.disconnect(); gain.disconnect();
        if (auditionSource === source) auditionSource = null;
      };
      auditionSource = source;
      if(musicPreview){
        const length=Math.min(8,buffer.duration);
        gain.gain.setValueAtTime(.43,auditionContext.currentTime+Math.max(0,length-.35));
        gain.gain.linearRampToValueAtTime(0,auditionContext.currentTime+length);
        source.start(0,0,length);
      }else source.start(0,clip[name][0],clip[name][1]);
      return true;
    } catch { return false; }
  }
  function waitForCall(name) {
    if (currentCall) currentCall.cancel();
    const ms = clip[name][1] * 1000;
    return new Promise((resolve) => {
      let done = false, source = null, timer = 0;
      function finish() {
        if (done) return;
        done = true; clearTimeout(timer);
        if (currentCall === handle) currentCall = null;
        resolve();
      }
      const handle = {cancel() { if (source) source.stop(); finish(); }};
      currentCall = handle;
      function runSilentClock() {
        if (done) return;
        let remaining = ms, last = performance.now();
        function tick() {
          const now = performance.now();
          if (!paused()) remaining -= Math.min(80, now - last);
          last = now;
          if (remaining <= 0) finish();
          else timer = setTimeout(tick, Math.min(35, Math.max(1, remaining)));
        }
        tick();
      }
      function start() {
        if (done) return;
        if (paused()) { timer = setTimeout(start, 30); return; }
        source = playClip(name,finish);
        if (!source) runSilentClock();
      }
      if (effectsOn && ready && !bank) {
        // If the first download stalls or fails, a silent player still gets the same opening beat.
        let started = false;
        const once = () => { if (!started && !done) { started = true; clearTimeout(timer); start(); } };
        timer = setTimeout(once, 800);
        ready.then(once, once);
      } else start();
    });
  }
  function syncPaused() {
    if (document.hidden) stopAudition();
    if (!ctx || !unlocked) return;
    if (paused()) ctx.suspend().catch(() => {});
    else ctx.resume().then(playMusic).catch(() => {});
  }
  document.addEventListener("visibilitychange", syncPaused);
  window.addEventListener("pagehide", () => {
    if (ctx) ctx.suspend().catch(() => {});
  });
  window.addEventListener("pageshow", syncPaused);
  window.Sound = Object.freeze({
    unlock, cue, audition, applause, stopCrowd,
    eat(name,rate,level){
      const sound=playClip(name,null,0,rate,level);
      if(sound&&musicOn){
        duckUntil=Math.max(duckUntil,ctx.currentTime+clip[name][1]/rate+.05);
        setBus(musicBus,.045);musicBus.gain.setTargetAtTime(.37,duckUntil,.18);
      }
    },
    marqueeDing(beat){
      if(beat===0)playClip('payout',null,0,1,.76);
      playClip('bell',null,0,[1.45,1.66,1.91,2.18][beat],.84);
    },
    soundtracks:Object.freeze(soundtrackNames),
    get soundtrack(){return selection;},
    selectSoundtrack(key){
      if(!Object.hasOwn(soundtrackNames,key)||key===selection)return;
      haltMusic(false);stopAudition();selection=key;score=null;
      try{localStorage.setItem("moonGate.soundtrack",key);}catch{}
      loadTrack();
    },
    setMusic(value) {
      musicOn = !!value; setting("music",musicOn); setBus(musicBus,musicOn ? .37 : 0);
      if (musicOn) playMusic(); else {haltMusic(true);stopAudition();}
    },
    setEffects(value) {
      effectsOn = !!value; setting("effects",effectsOn); setBus(effectsBus,effectsOn ? .90 : 0);
      if (!effectsOn) stopAudition();
    },
    get musicEnabled() { return musicOn; },
    get effectsEnabled() { return effectsOn; },
    startMusic() { musicWanted = true; playMusic(); },
    stopMusic() { musicWanted = false; haltMusic(false); },
    pause() { userPaused = true; syncPaused(); },
    resume() { stopAudition(); userPaused = false; return unlock(); },
    stopAll() {
      stopCrowd();
      musicWanted = false; haltMusic(false); stopAudition();
      if (currentCall) currentCall.cancel();
      for (const voice of voices) { try { voice.stop(); } catch {} }
      throttle.clear();
    },
    callRound(n) { return waitForCall("round" + Math.min(5, Math.max(1, Math.trunc(n) || 1))); },
    callFight() { return waitForCall("fight"); }
  });
})();
