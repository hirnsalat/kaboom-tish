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
  let masterGainNode = k.audioCtx.createGain();

  masterGainNode.connect(k.audioCtx.destination);

  k.onLoad(() => {
    let bufferSrc = k.audioCtx.createBufferSource();
    bufferSrc.connect(masterGainNode);
    bufferSrc.start();
    console.log("starting audio?!?");
  })

  k.onUpdate(() => {
    scheduler(bpm);
  })

  k.onUpdate(() => {
    masterGainNode.gain.value = k.volume();
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

            this.trigger("scheduleBeat", nextTime, nextBeat);

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
            this.trigger("beat");
          }
        },

        onScheduleBeat(action: (time: number) => void) {
          this.on("scheduleBeat", action);
        }
      };
    },

    audio() {
      let localVolume: number = 1;

      return {
        id: "audio",
        inputNode: AudioNode,
        outputNode: AudioNode,
        targetNode: AudioNode,
        gainManaged: false,

        rewire(target: AudioNode) {
          if (this.targetNode == target) return;
          this.targetNode = target;
          this.outputNode.disconnect();
          this.outputNode.connect(target);
        },

        add() {
          this.outputNode = k.audioCtx.createGain();
          this.outputNode.connect(masterGainNode);
          this.inputNode = this.outputNode;
        },

        update() {
          this.get("audio").forEach((c) => {
            c.rewire(this.inputNode);
          })
        },

        destroy() {
          this.outputNode.disconnect();
        },

        volume(vol?: number): number {
          if (vol != undefined) {
            localVolume = vol;
            if (!this.gainManaged) {
              this.outputNode.gain.value = vol;
            }
          }
          return localVolume;
        }
      }
    },

    volumeEnvelope() {
      let schedulerEvent: K.EventController;
      let attack = 0.01;
      let decay = 0.1;

      return {
        id: "volumeEnvelope",
        require: ["sound", "audio"],

        add() {
          if (this.onScheduleSound) {
            schedulerEvent = this.onScheduleSound((time) => {
              let gainParam = this.outputNode.gain;
              time = time ? time : this.outputNode.context.currentTime + 0.05;
              gainParam.cancelScheduledValues(time);
              // gainParam.setValueAtTime(0, time);
              // gainParam.linearRampToValueAtTime(this.volume(), time + attack);
              gainParam.setTargetAtTime(this.volume(), time, attack / 3);
              gainParam.setTargetAtTime(0, time + attack, decay);
            });
            this.outputNode.gain.value = 0;
            this.gainManaged = true;
          }
        },

        update() {
        },

        destroy() {
          if (schedulerEvent) {
            schedulerEvent.cancel();
          }
          this.gainManaged = false;
        },
      }
    },

    playEveryBeat() {
      let eventController: K.EventController;
      return {
        id: "playEveryBeat",
        require: ["sound", "beat"],

        add() {
          if (this.onScheduleBeat && this.playSound) {
            eventController = this.onScheduleBeat(this.playSound);
          }
        },

        destroy() {
          eventController.cancel();
        },
      }
    },

    playEveryBar(offset?: number) {
      let eventController: K.EventController;
      let realOffset = offset ? offset : 0
      return {
        id: "playEveryBeat",
        require: ["sound", "beat"],

        add() {
          if (this.onScheduleBeat && this.playSound) {
            eventController = this.onScheduleBeat(
              (time, beat) => {
                if ((beat - realOffset) % this.subdivision == 0) {
                  this.playSound(time)
                }
              }
            );
          }
        },

        destroy() {
          eventController.cancel();
        },
      }
    },

    sound() {
      return {
        id: "sound",

        onScheduleSound(action: (time: number) => void): K.EventController {
          return this.on("scheduleSound", action);
        },

        playSound(time?: number) {
          if (!time) time = 0;
          this.trigger("scheduleSound", time);
        },
      }
    },

    sample(sound: string | K.SoundData | K.Asset<K.SoundData>, playbackRate?: number) {
      let ctx = k.audioCtx;
      let destination = masterGainNode;
      let buffer: AudioBuffer;
      // const gainNode = ctx.createGain();
      let schedulerEvent: K.EventController;

      function start(data: K.SoundData) {
        buffer = data.buf;
      }

      const snd = resolveSound(k, sound);
      snd.onLoad(start);

      function playSoundAt(time: number | undefined) {
        let srcNode = ctx.createBufferSource();
        srcNode.connect(destination);
        srcNode.buffer = buffer;
        srcNode.playbackRate.value = playbackRate ? playbackRate : 1;
        srcNode.start(time);
      }

      return {
        id: "sample",
        require: ["sound", "audio"],

        add() {
          if (this.onScheduleSound) {
            schedulerEvent = this.onScheduleSound(playSoundAt);
          }
        },

        update() {
          destination = this.inputNode;
        },

        destroy() {
          if (schedulerEvent) {
            schedulerEvent.cancel();
          }
        },
      };
    },

    pitch(note?: number) {
      let basePitch: number = 69; // A4 = 440Hz
      let pitchParam: AudioParam;

      return {
        id: "pitch",

        initPitch(base: number, param: AudioParam) {
          basePitch = base;
          pitchParam = param;
          if (note != undefined) {
            // this is in cents!
            pitchParam.value = (note - basePitch) * 100;
          }
        },
      }
    },

    oscillator(shape?: OscillatorType) {
      let oscNode = k.audioCtx.createOscillator();
      let started = false;

      return {
        id: "oscillator",
        require: ["audio", "pitch"],

        add() {
          oscNode.type = shape ? shape : "sine";
          if (this.initPitch) {
            this.initPitch(69, oscNode.detune);
            // oscNode.frequency.value = 220;
          }
        },

        update() {
          oscNode.connect(this.inputNode);
          if (!started) {
            oscNode.start();
            started = true;
          }
        },
      }
    },
  };
}

export default kaboomTishPlugin;
