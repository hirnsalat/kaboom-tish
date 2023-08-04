import kaboom from "kaboom";
import audioPlugin from "./kaboom-audio";

const k = kaboom({
  plugins: [audioPlugin],
});

k.loadSprite("bean", "sprites/bean.png");
k.loadSprite("noise", "sprites/noise.png");
k.loadSound("bark", "sounds/dog.wav");

const bean = k.add([
  k.pos(120, 80),
  k.sprite("bean"),
  k.area(),
  k.anchor("center"),

  // use beat() to play a sound each beat!
  k.beat(),
  // sample plays an audio file!
  k.sample("bark"),
]);

const noise = bean.add([
  k.pos(20, 0),
  k.rotate(),
  k.anchor("left"),
  k.opacity(0),
  k.sprite("noise"),
])

// use isBeat to react to sounds being played!
bean.onUpdate(() => {
  if (bean.isBeat) {
    k.tween(1, 0, 0.15,
      (c) => { noise.opacity = c }
      , k.easings.easeInExpo);
    let rot = k.rand(-10, 10);
    noise.pos = k.Vec2.fromAngle(rot).scale(25);
    noise.angle = rot;
  }
})

// tempo changes the beats per minute!
// or in this case, barks per minute!
k.onUpdate(() => {
  k.tempo(k.wave(80, 160, time() / 2));
})

// lower volume so it's not as annoying
// works just like in normal kaboom
k.volume(0.2);

// we can only start audio context after interaction :/
k.onClick(() => {
  k.addKaboom(k.mousePos());
  audioCtx.resume();
});
