import type { HousingWorld } from "../World.ts";

/**
 * A fixed structure (tree, house, etc.) that can be procedurally placed in the world.
 * Implement this interface to define any structure the WorldGenerator can spawn.
 */
export interface IStructure {
    /**
     * Place the structure in the world.
     * @param world  - The target world (set/get blocks here)
     * @param x      - World X of the structure origin (base centre)
     * @param y      - World Y of the structure origin (first block above ground)
     * @param z      - World Z of the structure origin (base centre)
     * @param rand   - Seeded PRNG tied to this chunk/location (deterministic)
     */
    generate(
        world: HousingWorld,
        x: number,
        y: number,
        z: number,
        rand: () => number,
    ): void;
}
