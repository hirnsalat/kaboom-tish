import kaboom from "kaboom";
import kaboomTish from "../kaboom-tish";

const k = kaboom({
  plugins: [kaboomTish],
  width: 640,
  height: 448,
  letterbox: true,
  background: [141, 183, 255],
});

k.loadSprite("bean", "/sprites/bean.png");
k.loadSprite("noise", "/sprites/noise.png");
k.loadSprite("grass", "/sprites/grass.png");
k.loadSprite("steel", "/sprites/note.png");
k.loadSound("bark", "/sounds/dog.wav");


setGravity(3200)

const JUMP_FORCE = 1320
const MOVE_SPEED = 480

const level = k.addLevel([
  "=          =",
  "=          =",
  "=          =",
  "=@         =",
  "=          =",
  "=          =",
  "=##########=",
  "============",
], {
  tileWidth: 64,
  tileHeight: 64,
  tiles: {
    '@': () => [
      sprite('bean'),
      area({ scale: vec2(0.5, 1) }),
      body(),
      anchor("bot"),
      "player",
    ],
    '=': () => [
      sprite('grass'),
      area(),
      body({ isStatic: true }),
      anchor("bot"),
      "grass",
    ],
    '#': () => [
      sprite('steel'),
      area(),
      body({ isStatic: true }),
      anchor("bot"),
      k.audio(),
      k.sound(),
      "metal",
    ],
  }
})

level.use(k.audio())
level.use(k.beat())

level.get("metal").forEach((obj) => {
  const offset = obj.pos.x / 64
  obj.use(k.beat({ bar: 4, subdivision: 10 }))
  obj.use(k.pitch(60 + offset))
  obj.use(k.oscillator())
  obj.use(k.volumeEnvelope())
  // obj.use(k.playEveryBar(offset))
  obj.onCollide("player", () => {
    console.log("collide!")
    obj.playSound()
  })

  obj.use(color(hsl2rgb((offset * 25) / 255, 0.6, 0.7)))
  //obj.use(k.color("green"))
  obj.readd()
})

const player = level.get("player")[0];

camPos(320 + 32, 224 - 64);


function jump() {
  // these 2 functions are provided by body() component
  if (player.isGrounded()) {
    player.jump(JUMP_FORCE)
  }
}

// jump with space
onKeyPress("space", jump)

onKeyDown("left", () => {
  player.move(-MOVE_SPEED, 0)
})

onKeyDown("right", () => {
  player.move(MOVE_SPEED, 0)
})

onKeyPress("down", () => {
  player.weight = 3
})

onKeyRelease("down", () => {
  player.weight = 1
})

k.volume(0.2);

// k.add([
//   k.beat({ bar: 4, subdivision: 4 }),
//   k.audio(),
//   k.sound(),
//   k.pitch(60),
//   k.oscillator(),
//   k.volumeEnvelope(),
//   k.playEveryBeat(),
// ])

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
