import "./style.css";
import { Minecraft, WorldGenerator } from "housing-craft";

const canvas = document.querySelector("canvas")!;
const minecraft = new Minecraft(canvas);

// Seed-based world generation (change seed to get a different world)
const generator = new WorldGenerator({ seed: 12345 });
generator.generate(minecraft.world);

minecraft.world.buildChunks();

window.addEventListener("resize", () => {
  minecraft.resize();
});

minecraft.resize();

window.addEventListener("resize", () => {
  minecraft.resize();
});

minecraft.resize();
