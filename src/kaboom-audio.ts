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
  let started = false;
  let debug = 1;
  let scheduledUntil = 0;
  let scheduledBeat = 0;

  return (bpm: number) => {

    if (!started) {
      scheduledUntil = k.audioCtx.currentTime;
      started = true;
    }

    if (debug >= 1 && scheduledUntil < k.audioCtx.currentTime) {
      console.log("scheduling underrun by " + (k.audioCtx.currentTime - scheduledUntil));
    }

    let targetTime = k.audioCtx.currentTime + k.dt() * 4;
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
export function audioPlugin(k: K.KaboomCtx) {
  let bpm = 120;
  let scheduler = beatScheduler(k);

  k.onUpdate(() => {
    scheduler(bpm);
  })

  return {
    tempo(newTempo?: number): number | undefined {
      if (newTempo) bpm = newTempo;
      else return bpm;
    },

    beat() {
      return {
        id: "beat",

        schedule(fromT: number, toT: number, fromB: number, toB: number) {
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
            }

            currentB = nextBeat;
            currentT = nextTime;
            nextBeat += 1;
          }
        },

        inspect() {
          return bpm;
        },

        add() {
        },

        update() {
        },
      };
    },

    plays(sound: string | K.SoundData | K.Asset<K.SoundData>) {
      let ctx = k.audioCtx;
      let destination = ctx.destination;
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
          srcNode.start(t);
        },
      };
    },
  };
}

export default audioPlugin;
