import kaboom from "kaboom";
import audioPlugin from "./kaboom-audio";

const k = kaboom({
  plugins: [audioPlugin],
});

k.loadSprite("bean", "sprites/bean.png");
k.loadSound("bark", "sounds/dog.wav");

const bean = k.add([
  k.pos(120, 80),
  k.sprite("bean"),
  k.area(),
  k.color(255, 255, 255),

  k.beat(),
  k.plays("bark"),
]);

bean.onUpdate(() => {
  if (bean.isBeat) {
    tween(0, 255, 0.1, (c) => { bean.color = rgb(c, c, 255) });
    bean.color = rgb(0, 0, 255);
  } else {
    bean.color = rgb(255, 255, 255);
  }
})

k.onUpdate(() => {
  k.tempo(k.wave(80, 160, time() / 2));
})

// set volume so it's not as annoying
k.volume(0.2);

k.onClick(() => {
  k.addKaboom(k.mousePos());
  audioCtx.resume();
  //  bean.start();
});
