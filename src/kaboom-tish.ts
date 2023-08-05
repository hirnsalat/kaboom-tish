import * as K from "kaboom";
import * as T from "./kaboom-tish-types";

// utilities
// there might be a bug here, in that only string sounds work
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

let running = false;

function beatScheduler(k: K.KaboomCtx): ((bpm: number) => void) {
  // debug level 1 -> infrequent events
  // debug level 2 -> log every frame
  let debug = 1;

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

// plugin!
export function kaboomTishPlugin(k: K.KaboomCtx): T.KaboomTishPlugin {
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
    tempo(newTempo?: number): number {
      if (newTempo) bpm = newTempo;
      return bpm;
    },

    beat(opt?: T.BeatCompOpt) {
      const scheduledBeats: number[] = [];

      if (!opt) opt = {};

      function transformBeat(beatComp: T.BeatComp, beat: number): number {
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

            if (this.playSound) this.playSound(nextTime);

            scheduledBeats.push(nextTime);

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
          if (running && scheduledBeats[0] < k.audioCtx.currentTime) {
            this.isBeat = true;
            scheduledBeats.shift();
          }
        },

      };
    },

    sound() {
      return {
        id: "sound",

        onSchedule(action: (time: number) => void): K.EventController {
          return this.on("schedule", action);
        },

        playSound(time?: number) {
          if (!time) time = 0;
          this.trigger("schedule", time);
        },
      }
    },

    sample(sound: string | K.SoundData | K.Asset<K.SoundData>, playbackRate?: number) {
      let ctx = k.audioCtx;
      let destination = masterGain;
      let buffer: AudioBuffer;
      // const gainNode = ctx.createGain();
      let schedulerEvent: K.EventController;

      function start(data: K.SoundData) {
        buffer = data.buf;
      }

      const snd = resolveSound(k, sound);
      snd.onLoad(start);

      function playSoundAt(time) {
        let srcNode = ctx.createBufferSource();
        srcNode.connect(destination);
        srcNode.buffer = buffer;
        srcNode.playbackRate.value = playbackRate ? playbackRate : 1;
        srcNode.start(time);
      }

      return {
        id: "sample",
        require: ["sound"],

        add() {
          if (this.onSchedule) {
            schedulerEvent = this.onSchedule(playSoundAt);
          }
        },

        destroy() {
          if (schedulerEvent) {
            schedulerEvent.cancel();
          }
        },
      };
    },
  };
}

export default kaboomTishPlugin;
