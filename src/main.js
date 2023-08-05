import kaboom from "kaboom";
import kaboomTish from "./kaboom-tish";

const k = kaboom({
  plugins: [kaboomTish],
});

add([
  pos(80, 80),
  text("nothing is here!"),
])

