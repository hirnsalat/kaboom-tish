import * as K from "kaboom";

// utilities
function resolveSound(
  k: K.KaboomCtx,
  src: any,
): K.Asset<K.SoundData> {
  if (typeof src === "string") {
    const snd = k.getSound(src);
    if (snd) {
      return snd;
    } else {
      throw new Error(`Sound not found: ${src}`);
    }
  } else if (src instanceof K.SoundData) {
    return K.Asset.loaded(src);
  } else if (src instanceof K.Asset) {
    return src;
  } else {
    throw new Error(`Invalid sound: ${src}`);
  }
}

function beatScheduler(k: K.KaboomCtx): ((bpm: number) => void) {
  // debug level 1 -> infrequent events
  // debug level 2 -> log every frame
  let debug = 1;

  let running = false;
  let scheduledUntil = 0;
  let scheduledBeat = 0;

  // number of seconds between frames to detect game pause
  let pauseThreshold = 0.2;

  return (bpm: number) => {
    let currentTime = k.audioCtx.currentTime
    let dt = k.dt();
    let lookahead = dt * 10;

    if (!running && dt > pauseThreshold) return;

    if (!running) {
      if (debug >= 1) console.log("starting scheduler at " + currentTime + ", dt=" + dt)
      scheduledUntil = currentTime;
      running = true;
    }

    if (scheduledUntil < currentTime) {
      let underrunBy = currentTime - scheduledUntil;

      if (debug >= 1) {
        console.log("scheduling underrun by " + underrunBy);
      }

      if (underrunBy > pauseThreshold) {
        if (debug >= 1) console.log("pausing scheduler")
        running = false;
        return;
      }
    }

    let targetTime = currentTime + lookahead;
    let timeDiff = targetTime - scheduledUntil;

    if (timeDiff < 0) return;

    let beatDiff = bpm * (timeDiff / 60);
    let targetBeat = scheduledBeat + beatDiff;

    if (debug >= 2) {
      console.log("scheduling beats " + scheduledBeat + " to " + targetBeat + " from " + scheduledUntil + " to " + targetTime);
    }

    k.get("beat").forEach(
      (o) => {
        o.schedule(scheduledUntil, targetTime, scheduledBeat, targetBeat);
      }
    )

    scheduledUntil = targetTime;
    scheduledBeat = targetBeat;
  }
}

export interface BeatOpt {
  bar?: number,
  subdivision?: number,
}

// plugin!
export function kaboomTishPlugin(k: K.KaboomCtx) {
  let bpm = 120;
  let scheduler = beatScheduler(k);
  let masterGain = k.audioCtx.createGain();

  masterGain.connect(k.audioCtx.destination);

  k.onUpdate(() => {
    scheduler(bpm);
  })

  k.onUpdate(() => {
    masterGain.gain.value = k.volume();
  })

  return {
    tempo(newTempo?: number): number | undefined {
      if (newTempo) bpm = newTempo;
      else return bpm;
    },

    beat(opt?: BeatOpt) {
      const scheduledBeats: number[] = [];

      if (!opt) opt = {};

      function transformBeat(beatComp, beat): number {
        let bar = beatComp.bar;
        let subdivision = beatComp.subdivision;

        return beat * subdivision / bar;
      }

      return {
        id: "beat",

        isBeat: false,
        bar: opt.bar ? opt.bar : 1,
        subdivision: opt.subdivision ? opt.subdivision : 1,

        schedule(fromT: number, toT: number, fromB: number, toB: number) {
          fromB = transformBeat(this, fromB);
          toB = transformBeat(this, toB);

          let timeDiff = toT - fromT;
          let beatDiff = toB - fromB;

          let beatTarget = toB;

          let nextBeat = Math.ceil(fromB);

          let currentT = fromT;
          let currentB = fromB;

          while (nextBeat < beatTarget) {
            let toNextBeat = nextBeat - currentB;
            let nextTime = currentT + (toNextBeat * timeDiff) / beatDiff;

            //console.log("timediff: " + timeDiff);
            //console.log("beatdiff: " + beatDiff);
            //console.log("scheduling beat " + nextBeat + " at " + nextTime);

            if (this.playAt) {
              this.playAt(nextTime);
              scheduledBeats.push(nextTime);
            }

            currentB = nextBeat;
            currentT = nextTime;
            nextBeat += 1;
          }

          this.get("beat").forEach(
            (o) => {
              o.schedule(fromT, toT, fromB, toB);
            }
          )
        },

        inspect() {
          return this.isBeat ? "*" : ".";
        },

        add() {
        },

        update() {
          this.isBeat = false;
          if (scheduledBeats[0] < k.audioCtx.currentTime) {
            this.isBeat = true;
            scheduledBeats.shift();
          }
        },
      };
    },

    sample(sound: string | K.SoundData | K.Asset<K.SoundData>, playbackRate?: number) {
      let ctx = k.audioCtx;
      let destination = masterGain;
      let buffer: AudioBuffer;
      // const gainNode = ctx.createGain();

      function start(data: K.SoundData) {
        buffer = data.buf;
      }

      const snd = resolveSound(k, sound);
      snd.onLoad(start);

      return {
        id: "plays",

        add() { },

        playAt(t: number) {
          let srcNode = ctx.createBufferSource();
          srcNode.connect(destination);
          srcNode.buffer = buffer;
          srcNode.playbackRate.value = playbackRate ? playbackRate : 1;
          srcNode.start(t);
        },
      };
    },
  };
}

export default kaboomTishPlugin;
