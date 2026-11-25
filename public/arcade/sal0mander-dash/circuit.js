// SAL0MANder Dash BPM-locked course engine.
// Every level reads its song BPM from music-playlist.json and computes scroll speed
// and obstacle spacing from that BPM so jumps and hazards land directly on the beat.
export const STEP = 1 / 120;
export const CUBE = 84;
export const JUMP_V = 820;
export const GRAVITY = 2600;
export const JUMP_AIR_TIME = (2 * JUMP_V) / GRAVITY; // ~0.6308 s
export const BASE_PX_PER_BEAT = 215;

const FOOT = CUBE / 2 - 5;
const DEFAULT_ACCENT_BEATS = [16, 48, 80, 112, 144];
export const LEDGE = { fromFrac: 0.72, toFrac: 3.55, h: 276, superV: 1300, window: 12 };

export function speedForBpm(bpm, speedScale = 1) {
  const safeBpm = Number.isFinite(bpm) && bpm > 40 ? bpm : 96;
  const safeScale = Number.isFinite(speedScale) && speedScale > 0.5 ? speedScale : 1;
  return Math.round(BASE_PX_PER_BEAT * (safeBpm / 60) * safeScale);
}

export class Circuit {
  constructor(score, options = {}) {
    const bpm = Number.isFinite(options.bpm) && options.bpm > 40
      ? options.bpm
      : (Number.isFinite(score.bpm) && score.bpm > 40 ? score.bpm : 96);
    const speedScale = Number.isFinite(options.speedScale) && options.speedScale > 0.5
      ? options.speedScale
      : (Number.isFinite(score.speedScale) && score.speedScale > 0.5 ? score.speedScale : 1);

    this.bpm = bpm;
    this.beat = 60 / bpm;
    this.speed = speedForBpm(bpm, speedScale);
    this.beatOffset = Number.isFinite(score.beatOffset) ? score.beatOffset : 0.05;
    this.sectors = Array.isArray(score.sectors) && score.sectors.length
      ? score.sectors
      : ['Freight Yard', 'Signal Bridge', 'Turbine Hall', 'Blackout Tunnel', 'Reactor Core', 'Daybreak Run'];

    const totalBeats = (score.rows || []).length * 16;
    const computedDuration = (totalBeats + 4) * this.beat + this.beatOffset;
    this.duration = Number.isFinite(score.durationBeats)
      ? score.durationBeats * this.beat + this.beatOffset
      : computedDuration;

    const accentBeatList = Array.isArray(score.accentBeats) && score.accentBeats.length
      ? score.accentBeats
      : DEFAULT_ACCENT_BEATS;
    this.accentBeats = accentBeatList.filter((b) => b < totalBeats);
    this.accents = this.accentBeats.map((b) => b * this.beat + this.beatOffset);

    this.gates = [];
    this.cues = [];
    this.goldCues = [];
    this.total = 0;

    const S = this.speed;
    const B = this.beat;
    const peakOffset = S * (JUMP_AIR_TIME * 0.5); // Horizontal distance to apex of a jump

    const place = (kind, x, w, h, teeth = 0, base = 0, prism = false, high = false) => {
      this.gates.push({ kind, x, w, h, teeth, base, prism, high, got: false, tripped: false });
      if (prism) this.total++;
    };

    let count = 0;
    const accentSet = new Set(this.accentBeats);
    (score.rows || []).forEach((row, r) => {
      [...row].forEach((mark, c) => {
        if (mark === '.') return;
        const beatIndex = r * 16 + c;
        const t = beatIndex * B + this.beatOffset;
        if (t + 2 * B >= this.duration) return;
        const x = t * S;
        const isAccent = accentSet.has(beatIndex);
        const prism = count++ % 4 === 0 || isAccent;

        if (mark !== '^') {
          this.cues.push(t);
          if (isAccent) this.goldCues.push(t);
        }

        switch (mark) {
          case 'G': {
            // Long platform deck synced to 2 beats, followed by a beat-timed spike on the deck
            const deckStart = x + S * 0.24;
            const deckWidth = Math.max(240, Math.round(B * S * 2.75));
            const secondT = t + 2 * B;
            const secondPeak = secondT * S + peakOffset;
            place('deck', deckStart, deckWidth, 64);
            this.cues.push(secondT);
            place('spike', secondPeak - 28, 56, 48, 2, 64, true);
            break;
          }
          case '^': {
            // Spring pad right on the beat, launching over a triple-spike hazard
            place('pad', x - 20, 48, 10);
            place('spike', x + S * 0.26, 88, 56, 3, 0, true, true);
            break;
          }
          case '_': {
            // Floor gap centered neatly inside the jump arc
            const gapW = Math.min(168, Math.max(108, Math.round(S * 0.34)));
            place('gap', x + peakOffset - gapW * 0.5, gapW, 0, 0, 0, prism);
            break;
          }
          case 'o': {
            // Spinning saw centered right at jump apex
            const sawW = 68;
            place('saw', x + peakOffset - sawW * 0.5, sawW, sawW, 0, 0, prism);
            break;
          }
          case 'b': {
            // Single elevated deck block that cube lands atop cleanly
            const deckW = Math.max(118, Math.round(S * 0.32));
            place('deck', x + S * 0.23, deckW, 54, 0, 0, prism);
            break;
          }
          default: {
            const n = Math.max(1, Math.min(3, Number(mark) || 1));
            const spikeW = n * 28;
            const spikeH = 44 + n * 3;
            place('spike', x + peakOffset - spikeW * 0.5, spikeW, spikeH, n, 0, prism);
          }
        }
      });
    });

    this.gates.sort((a, b) => a.x - b.x);
    this.cues.sort((a, b) => a - b);

    // Floating one-way upper-route ledges after each spring pad (scaled to speed)
    this.ledges = this.gates
      .filter((g) => g.kind === 'pad')
      .map((p) => ({
        x: p.x + Math.round(S * LEDGE.fromFrac),
        w: Math.round(S * (LEDGE.toFrac - LEDGE.fromFrac)),
        h: LEDGE.h,
      }));

    this.halfTick = Math.ceil((this.duration * 0.5) / STEP);
    this.halfX = this.halfTick * STEP * this.speed;
    this.reset();
  }

  reset(save = null) {
    this.tick = save ? this.halfTick : 0;
    this.y = 0;
    this.v = 0;
    this.angle = 0;
    this.grounded = true;
    this.buffer = 0;
    this.dead = '';
    this.finished = false;
    this.first = 0;
    this.jumps = 0;
    this.prisms = 0;
    this.shield = !!save?.shield;
    this.shieldBreak = 0;
    this.clearedGate = null;
    this.padTick = null;
    this.gates.forEach((g, i) => {
      g.got = !!save && save.collected.includes(i);
      g.tripped = !!save && save.pads.includes(i);
      if (g.got) this.prisms++;
    });
    if (save) {
      this.y = save.y;
      this.v = save.v;
      this.angle = save.angle;
      this.grounded = save.grounded;
      this.buffer = save.buffer;
      this.clearedGate = this.gates[save.cleared] || null;
    }
  }

  get time() {
    return this.tick * STEP;
  }

  get x() {
    return this.time * this.speed;
  }

  get section() {
    return Math.min(this.sectors.length - 1, this.accents.filter((t) => t <= this.time).length);
  }

  get progress() {
    return Math.min(1, this.time / this.duration);
  }

  snapshot() {
    return {
      collected: this.gates.flatMap((g, i) => (g.got ? [i] : [])),
      pads: this.gates.flatMap((g, i) => (g.tripped ? [i] : [])),
      shield: this.shield,
      y: this.y,
      v: this.v,
      grounded: this.grounded,
      angle: this.angle,
      buffer: this.buffer,
      cleared: this.gates.indexOf(this.clearedGate),
    };
  }

  validSave(s) {
    return (
      !!s &&
      typeof s.shield === 'boolean' &&
      typeof s.grounded === 'boolean' &&
      [s.y, s.v, s.angle, s.buffer].every(Number.isFinite) &&
      Number.isInteger(s.cleared) &&
      s.cleared >= -1 &&
      s.cleared < this.gates.length &&
      Array.isArray(s.collected) &&
      s.collected.every((i) => Number.isInteger(i) && this.gates[i]?.prism && this.gates[i].x < this.halfX + FOOT) &&
      Array.isArray(s.pads) &&
      s.pads.every((i) => Number.isInteger(i) && this.gates[i]?.kind === 'pad')
    );
  }

  jump() {
    this.buffer = 0.12;
  }

  spring() {
    if (this.padTick != null && this.tick - this.padTick <= LEDGE.window && this.v > 0) {
      this.v = Math.max(this.v, LEDGE.superV);
      this.padTick = null;
      return true;
    }
    return false;
  }

  land(h) {
    this.y = h;
    this.v = 0;
    this.grounded = true;
  }

  advance() {
    if (this.dead || this.finished) return;
    if (this.buffer > 0 && this.grounded) {
      this.v = JUMP_V;
      this.grounded = false;
      this.jumps++;
      this.buffer = 0;
    }
    this.buffer = Math.max(0, this.buffer - STEP);
    this.tick++;
    const left = this.x - FOOT;
    const right = this.x + FOOT;
    const prev = this.y;
    this.v -= GRAVITY * STEP;
    this.y += this.v * STEP;
    this.grounded = false;
    let floor = true;

    while (this.first < this.gates.length && this.gates[this.first].x + this.gates[this.first].w < left - 48) {
      this.first++;
    }

    for (let i = this.first; i < this.gates.length && this.gates[i].x < right + 32; i++) {
      const g = this.gates[i];
      const center = g.x + g.w / 2;
      if (
        g.prism &&
        !g.got &&
        Math.abs(this.x - center) < FOOT + 14 &&
        Math.abs(this.y + CUBE / 2 - (g.base + (g.high ? 199 : 164))) < CUBE / 2 + 12
      ) {
        g.got = true;
        this.prisms++;
        if (this.prisms % 5 === 0) this.shield = true;
      }
      if (right <= g.x || left >= g.x + g.w || this.clearedGate === g) continue;
      if (g.kind === 'gap') {
        if ((left >= g.x && right <= g.x + g.w) || (this.y < -2 && prev < 0)) floor = false;
        if (this.y < -19) this.dead = 'Missed the far ledge';
      } else if (g.kind === 'pad') {
        if (!g.tripped && this.y <= 10 && this.v <= 0) {
          g.tripped = true;
          this.y = Math.max(0, this.y);
          this.v = 995;
          this.padTick = this.tick;
        }
      } else if (g.kind === 'deck') {
        if (prev >= g.h - 0.5 && this.y <= g.h && this.v <= 0) this.land(g.h);
        else if (this.y + 2 < g.h) this.dead = 'Hit the platform wall';
      } else if (g.kind === 'saw') {
        const r = g.w / 2;
        const dx = center - Math.max(left, Math.min(right, center));
        const dy = r - Math.max(this.y + 2, Math.min(this.y + CUBE - 2, r));
        if (dx * dx + dy * dy < r * r) this.dead = 'Hit a saw blade';
      } else {
        const half = g.w / (2 * g.teeth);
        let highest = 0;
        for (let n = 0; n < g.teeth; n++) {
          const peak = g.x + (2 * n + 1) * half;
          highest = Math.max(highest, g.h * (1 - Math.abs(peak - Math.max(left, Math.min(right, peak))) / half));
        }
        if (this.y + 2 < g.base + highest && this.y + CUBE - 2 > g.base) this.dead = 'Hit the spikes';
      }
      if (this.dead && this.shield && (g.kind === 'spike' || g.kind === 'saw')) {
        this.shield = false;
        this.shieldBreak = this.time;
        this.clearedGate = g;
        this.dead = '';
      }
      if (this.dead) return;
    }

    for (const l of this.ledges) {
      if (right > l.x && left < l.x + l.w && prev >= l.h - 0.5 && this.y <= l.h && this.v <= 0) {
        this.land(l.h);
      }
    }
    if (floor && this.y <= 0 && this.v <= 0) this.land(0);
    this.angle = this.grounded ? 0 : (this.angle + STEP * 555) % 360;
    this.finished = this.time >= this.duration;
  }
}
