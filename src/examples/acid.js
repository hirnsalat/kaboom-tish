import kaboom from "kaboom";
import kaboomTish from "../kaboom-tish";

const k = kaboom({
  plugins: [kaboomTish],
});

k.loadSprite("bean", "/sprites/bean.png");
k.loadSprite("noise", "/sprites/noise.png");
k.loadSound("bark", "/sounds/dog.wav");

k.volume(0.2);

k.add([
  k.beat({ bar: 4, subdivision: 4 }),
  k.audio(),
  k.sound(),
  k.pitch(45),
  k.oscillator("sawtooth"),
  k.volumeEnvelope(),
])

k.volume(0.1);

// we can only start audio context after interaction :/
k.onClick(() => {
  k.addKaboom(k.mousePos());
  audioCtx.resume();
});

k.onKeyPress("m", () => {
  if (k.volume() == 0) {
    k.volume(0.2);
  } else {
    k.volume(0);
  }
})
