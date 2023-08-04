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

  k.beat(),
  k.plays("bark"),
]);

k.onUpdate(() => {
  k.tempo(k.wave(80, 160, time() / 2));
})

k.onClick(() => {
  k.addKaboom(k.mousePos());
  audioCtx.resume();
  //  bean.start();
});
