import type { IStructure } from "./IStructure.ts";
import type { HousingWorld } from "../World.ts";

const OAK_LOG = 26;
const OAK_LEAVES = 30;
const AIR = 0;

/**
 * A classic Minecraft-style oak tree.
 *  - Trunk: 4–6 blocks tall
 *  - Leaf canopy: two wide layers + a narrow top layer + single cap
 */
export class OakTree implements IStructure {
    generate(
        world: HousingWorld,
        x: number,
        y: number,
        z: number,
        rand: () => number,
    ): void {
        const height = 4 + Math.floor(rand() * 3); // 4–6

        // Trunk
        for (let i = 0; i < height; i++) {
            world.set(x, y + i, z, OAK_LOG);
        }

        const leafBase = y + height;

        // Two wide leaf layers (radius 2) then a narrow top layer (radius 1)
        for (let dy = -1; dy <= 1; dy++) {
            const radius = dy === 1 ? 1 : 2;
            for (let dx = -radius; dx <= radius; dx++) {
                for (let dz = -radius; dz <= radius; dz++) {
                    // Clip corners for a rounder look
                    if (Math.abs(dx) === radius && Math.abs(dz) === radius) continue;
                    const lx = x + dx;
                    const ly = leafBase + dy;
                    const lz = z + dz;
                    if (world.get(lx, ly, lz) === AIR) {
                        world.set(lx, ly, lz, OAK_LEAVES);
                    }
                }
            }
        }

        // Single cap leaf
        world.set(x, leafBase + 2, z, OAK_LEAVES);
    }
}
