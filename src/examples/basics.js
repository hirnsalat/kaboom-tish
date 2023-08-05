import kaboom from "kaboom";
import kaboomTish from "../kaboom-tish";

const k = kaboom({
  plugins: [kaboomTish],
});

k.loadSprite("bean", "/sprites/bean.png");
k.loadSprite("noise", "/sprites/noise.png");
k.loadSound("bark", "/sounds/dog.wav");

const dog1 = k.add([
  k.pos(120, 120),
  k.sprite("bean"),
  k.area(),
  k.anchor("center"),
  k.scale(2),

  // be a sound that can be played!
  k.sound(),
  // every sound needs a volume!
  k.audio(),
  // use beat() to play a sound each beat!
  k.beat(),
  // sample plays an audio file!
  k.sample("bark", 0.5),
]);

const dog2 = k.add([
  k.pos(400, 80),
  k.sprite("bean"),
  k.area(),
  k.anchor("center"),
  k.scale(-1, 1),

  k.sound(),
  k.audio(),
  // you can subdivide the beat to create different rhythms!
  k.beat({ bar: 4, subdivision: 3 }),
  k.sample("bark"),
]);

// children inherit beat and audio settings!
const dog3 = dog2.add([
  k.pos(0, 80),
  k.sprite("bean"),
  k.area(),
  k.anchor("center"),
  k.scale(0.5),

  k.beat({ subdivision: 2 }),
  k.audio(),
  k.sample("bark", 2),
  k.sound(),
]);


function barkIndicator(dog) {
  const noise = dog.add([
    k.pos(20, 0),
    k.rotate(),
    k.anchor("left"),
    k.opacity(0),
    k.sprite("noise"),
  ])

  // use isBeat to react to sounds being played!
  dog.onUpdate(() => {
    if (dog.isBeat) {
      k.tween(1, 0, 0.15,
        (c) => { noise.opacity = c }
        , k.easings.easeInExpo);
      let rot = k.rand(-10, 10);
      noise.pos = k.Vec2.fromAngle(rot).scale(25);
      noise.angle = rot;
    }
  })
}

barkIndicator(dog1);
barkIndicator(dog2);
barkIndicator(dog3);

dog2.volume(0);

// tempo changes the beats per minute!
// or in this case, barks per minute!
k.onUpdate(() => {
  k.tempo(k.wave(110, 130, time() / 2));
})

// lower volume so it's not as annoying
// works just like in normal kaboom
k.volume(0.2);

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
