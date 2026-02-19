import type { HousingWorld } from "./World.ts";
import type { IStructure } from "./structures/IStructure.ts";
import { OakTree } from "./structures/OakTree.ts";

// ─── Seeded PRNG (mulberry32) ───────────────────────────────────────────────

export function mulberry32(seed: number): () => number {
    return function () {
        seed = (seed + 0x6d2b79f5) | 0;
        let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

// ─── Simple 2-D value noise ──────────────────────────────────────────────────

function fade(t: number): number {
    return t * t * t * (t * (t * 6 - 15) + 10);
}

function lerp(a: number, b: number, t: number): number {
    return a + t * (b - a);
}

class ValueNoise {
    private perm: Uint8Array;

    constructor(seed: number) {
        this.perm = new Uint8Array(512);
        const rand = mulberry32(seed);
        const p = new Uint8Array(256);
        for (let i = 0; i < 256; i++) p[i] = i;
        // Fisher-Yates shuffle
        for (let i = 255; i > 0; i--) {
            const j = Math.floor(rand() * (i + 1));
            const tmp = p[i];
            p[i] = p[j];
            p[j] = tmp;
        }
        for (let i = 0; i < 512; i++) this.perm[i] = p[i & 255];
    }

    /** Smooth value noise in [0, 1] */
    sample(x: number, z: number): number {
        const xi = Math.floor(x) & 255;
        const zi = Math.floor(z) & 255;
        const xf = x - Math.floor(x);
        const zf = z - Math.floor(z);
        const u = fade(xf);
        const v = fade(zf);

        const aa = this.perm[this.perm[xi] + zi] / 255;
        const ba = this.perm[this.perm[xi + 1] + zi] / 255;
        const ab = this.perm[this.perm[xi] + zi + 1] / 255;
        const bb = this.perm[this.perm[xi + 1] + zi + 1] / 255;

        return lerp(lerp(aa, ba, u), lerp(ab, bb, u), v);
    }

    /** Fractal octave noise in [0, 1] */
    octave(
        x: number,
        z: number,
        octaves: number,
        persistence: number,
        scale: number,
    ): number {
        let value = 0;
        let amplitude = 1;
        let frequency = scale;
        let maxValue = 0;
        for (let i = 0; i < octaves; i++) {
            value += this.sample(x * frequency, z * frequency) * amplitude;
            maxValue += amplitude;
            amplitude *= persistence;
            frequency *= 2;
        }
        return value / maxValue;
    }
}

/** Deterministic integer hash of (seed, chunkX, chunkZ) for per-chunk PRNGs. */
function hashCoords(seed: number, x: number, z: number): number {
    let h = (seed ^ 0x45d9f3b) | 0;
    h = (Math.imul(h ^ (x * 1664525 + 1013904223), 0x27d4eb2d)) | 0;
    h = (Math.imul(h ^ (z * 1664525 + 1013904223), 0x27d4eb2d)) | 0;
    h ^= h >>> 16;
    return h >>> 0;
}

// ─── Block IDs ────────────────────────────────────────────────────────────────

const BLK = {
    AIR: 0,
    STONE: 1,
    GRASS: 8,
    DIRT: 9,
    BEDROCK: 19,
    SAND: 20,
} as const;

// ─── Structure entry ──────────────────────────────────────────────────────────

export interface StructureEntry {
    structure: IStructure;
    /** Average number of placement attempts per chunk column. */
    attemptsPerChunk: number;
}

// ─── Generator options ────────────────────────────────────────────────────────

export interface WorldGenOptions {
    /** Integer seed. Default: 12345 */
    seed?: number;
    /** Y level considered "sea level". Default: 62 */
    seaLevel?: number;
    /** Minimum terrain height. Default: 48 */
    minHeight?: number;
    /** Maximum terrain height. Default: 96 */
    maxHeight?: number;
    /**
     * Structures to place during generation.
     * Defaults to a single OakTree with 3 attempts per chunk.
     */
    structures?: StructureEntry[];
}

// ─── WorldGenerator ───────────────────────────────────────────────────────────

export class WorldGenerator {
    readonly seed: number;
    private noise: ValueNoise;
    private seaLevel: number;
    private minHeight: number;
    private maxHeight: number;
    private structures: StructureEntry[];

    constructor(options: WorldGenOptions = {}) {
        this.seed = options.seed ?? 12345;
        this.noise = new ValueNoise(this.seed);
        this.seaLevel = options.seaLevel ?? 62;
        this.minHeight = options.minHeight ?? 48;
        this.maxHeight = options.maxHeight ?? 96;
        this.structures = options.structures ?? [
            { structure: new OakTree(), attemptsPerChunk: 3 },
        ];
    }

    /** Add a structure to this generator after construction. Returns `this` for chaining. */
    addStructure(entry: StructureEntry): this {
        this.structures.push(entry);
        return this;
    }

    /** Sample the terrain height (Y) at any world XZ coordinate. */
    getSurfaceY(wx: number, wz: number): number {
        const n = this.noise.octave(wx, wz, 6, 0.5, 0.004);
        return Math.round(this.minHeight + n * (this.maxHeight - this.minHeight));
    }

    /**
     * Generate terrain + structures for one chunk column (all Y slices).
     * Writes block data directly into chunk buffers to avoid per-block overhead.
     * Safe to call multiple times — skips already-generated columns.
     */
    generateChunk(world: HousingWorld, chunkX: number, chunkZ: number): void {
        if (world.isColumnGenerated(chunkX, chunkZ)) return;
        world.markColumnGenerated(chunkX, chunkZ);

        const cs = 32; // Chunk.SIZE (avoids circular import at runtime)
        const numCY = 8; // 256 / 32
        const wx0 = chunkX * cs;
        const wz0 = chunkZ * cs;

        // ── Heightmap ──────────────────────────────────────────────────────
        const heights = new Int32Array(cs * cs);
        let maxHeight = 0;
        for (let lx = 0; lx < cs; lx++) {
            for (let lz = 0; lz < cs; lz++) {
                const h = this.getSurfaceY(wx0 + lx, wz0 + lz);
                heights[lx * cs + lz] = h;
                if (h > maxHeight) maxHeight = h;
            }
        }

        // ── Terrain: write directly into chunk blocks (no world.set overhead) ─
        for (let cy = 0; cy < numCY; cy++) {
            const cyMin = cy * cs;
            const cyMax = cyMin + cs; // exclusive

            // Skip chunk Y-layers entirely above the highest terrain in this column
            if (cyMin > maxHeight) continue;

            const chunk = world.getOrCreateChunk(chunkX, cy, chunkZ);

            for (let lx = 0; lx < cs; lx++) {
                for (let lz = 0; lz < cs; lz++) {
                    const surfaceY = heights[lx * cs + lz];
                    const isBeach = surfaceY <= this.seaLevel + 2;

                    // Nothing in this chunk-layer for this column
                    if (surfaceY < cyMin) continue;

                    const fillTop = Math.min(surfaceY, cyMax - 1);
                    for (let wy = cyMin; wy <= fillTop; wy++) {
                        const ly = wy - cyMin;
                        let block: number = BLK.AIR;
                        if (wy === 0) {
                            block = BLK.BEDROCK;
                        } else if (wy < surfaceY - 4) {
                            block = BLK.STONE;
                        } else if (wy < surfaceY) {
                            block = isBeach ? BLK.SAND : BLK.DIRT;
                        } else {
                            block = isBeach ? BLK.SAND : BLK.GRASS;
                        }
                        // Direct write — same layout as chunk.setBlock(lx, ly, lz)
                        chunk.blocks[(lx * cs + ly) * cs + lz] = block;
                    }
                }
            }

            world.markDirty(chunk);
        }

        // ── Structures: use world.set() since they may cross chunk boundaries ─
        const chunkRand = mulberry32(hashCoords(this.seed, chunkX, chunkZ));

        for (const { structure, attemptsPerChunk } of this.structures) {
            for (let attempt = 0; attempt < attemptsPerChunk; attempt++) {
                const lx = Math.floor(chunkRand() * cs);
                const lz = Math.floor(chunkRand() * cs);
                const wx = wx0 + lx;
                const wz = wz0 + lz;
                const surfaceY = heights[lx * cs + lz];
                const isBeach = surfaceY <= this.seaLevel + 2;
                if (!isBeach) {
                    structure.generate(world, wx, surfaceY + 1, wz, chunkRand);
                }
            }
        }
    }
}
