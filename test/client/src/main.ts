import "./style.css";
import { Minecraft, WorldGenerator } from "housing-craft";

const canvas = document.querySelector("canvas")!;
const minecraft = new Minecraft(canvas);

// Change `seed` to get a completely different world
const generator = new WorldGenerator({ seed: 12345 });

// Stream chunks every frame centred on the camera
minecraft.renderCallbacks.push(() => {
  const { x, z } = minecraft.camera.position;
  minecraft.world.update(x, z, generator, /* renderDistance */ 3);
});

window.addEventListener("resize", () => {
  minecraft.resize();
});

minecraft.resize();

