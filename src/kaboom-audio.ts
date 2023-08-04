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

// plugin!
export function audioPlugin(k: K.KaboomCtx) {
  let bpm = 120;

  k.onUpdate(() => {
    let targetTime = k.audioCtx.currentTime + k.dt() * 3;
    k.get("beat").forEach(
      (o) => {
        o.scheduleTo(targetTime);
      })
  })

  return {
    tempo(newTempo?: number): number | undefined {
      if (newTempo) bpm = newTempo;
      else return bpm;
    },

    beat() {
      let scheduledUntil = 0;
      let scheduledBeat = 0;


      return {
        id: "beat",

        scheduleTo(time: number) {
          let timeDiff = time - scheduledUntil;

          if (timeDiff < 0) return;

          let beatDiff = bpm * (timeDiff / 60);
          let beatTarget = scheduledBeat + beatDiff;

          let nextBeat = Math.ceil(scheduledBeat);

          while (nextBeat < beatTarget) {
            let toNextBeat = nextBeat - scheduledBeat;
            let nextTime = scheduledUntil + (toNextBeat * timeDiff) / beatDiff;

            //console.log("timediff: " + timeDiff);
            //console.log("beatdiff: " + beatDiff);
            //console.log("scheduling beat " + nextBeat + " at " + nextTime);

            if (this.playAt) {
              this.playAt(nextTime);
            }

            nextBeat += 1;
            scheduledUntil = nextTime;
          }

          scheduledUntil = time;
          scheduledBeat = beatTarget;
        },

        inspect() {
          return bpm;
        },

        add() {
          scheduledUntil = k.audioCtx.currentTime;
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
