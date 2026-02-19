import Chunk from "./chunk/Chunk";
import type { Minecraft } from "../main/Minecraft";
import type { WorldGenerator } from "./WorldGenerator";

export class HousingWorld {
	/** Maximum world height (Y axis remains bounded). */
	static readonly HEIGHT = 256;
	/** Number of chunk layers stacked vertically. */
	static readonly CHUNK_HEIGHT_COUNT = HousingWorld.HEIGHT / Chunk.SIZE; // 8

	/** All loaded chunks, keyed by "cx,cy,cz". */
	readonly chunks = new Map<string, Chunk>();

	/** Chunks that need their mesh rebuilt. */
	private dirtyChunks = new Set<Chunk>();

	/** Set of "cx,cz" columns that have already been terrain-generated. */
	private generatedColumns = new Set<string>();

	constructor(public minecraft: Minecraft) { }

	// ─── Key helpers ──────────────────────────────────────────────────────────

	private chunkKey(cx: number, cy: number, cz: number): string {
		return `${cx},${cy},${cz}`;
	}

	private columnKey(cx: number, cz: number): string {
		return `${cx},${cz}`;
	}

	// ─── Column generation tracking ───────────────────────────────────────────

	isColumnGenerated(cx: number, cz: number): boolean {
		return this.generatedColumns.has(this.columnKey(cx, cz));
	}

	markColumnGenerated(cx: number, cz: number): void {
		this.generatedColumns.add(this.columnKey(cx, cz));
	}

	// ─── Chunk access ────────────────────────────────────────────────────────

	getChunk(cx: number, cy: number, cz: number): Chunk | undefined {
		return this.chunks.get(this.chunkKey(cx, cy, cz));
	}

	getOrCreateChunk(cx: number, cy: number, cz: number): Chunk {
		const key = this.chunkKey(cx, cy, cz);
		let chunk = this.chunks.get(key);
		if (!chunk) {
			chunk = new Chunk(cx, cy, cz);
			this.chunks.set(key, chunk);
			this.minecraft.scene.add(chunk.mesh);
		}
		return chunk;
	}

	/** Mark a chunk as needing a mesh rebuild. */
	markDirty(chunk: Chunk): void {
		chunk.isDirty = true;
		this.dirtyChunks.add(chunk);
	}

	// ─── Block access (world coordinates) ────────────────────────────────────

	set(x: number, y: number, z: number, block: number): void {
		if (y < 0 || y >= HousingWorld.HEIGHT) return;
		const cx = Math.floor(x / Chunk.SIZE);
		const cy = Math.floor(y / Chunk.SIZE);
		const cz = Math.floor(z / Chunk.SIZE);
		const lx = x - cx * Chunk.SIZE;
		const ly = y - cy * Chunk.SIZE;
		const lz = z - cz * Chunk.SIZE;
		const chunk = this.getOrCreateChunk(cx, cy, cz);
		chunk.setBlock(lx, ly, lz, block);
		this.markDirty(chunk);
	}

	get(x: number, y: number, z: number): number {
		if (y < 0 || y >= HousingWorld.HEIGHT) return 0;
		const cx = Math.floor(x / Chunk.SIZE);
		const cy = Math.floor(y / Chunk.SIZE);
		const cz = Math.floor(z / Chunk.SIZE);
		const chunk = this.getChunk(cx, cy, cz);
		if (!chunk) return 0;
		const lx = x - cx * Chunk.SIZE;
		const ly = y - cy * Chunk.SIZE;
		const lz = z - cz * Chunk.SIZE;
		return chunk.getBlock(lx, ly, lz);
	}

	/** Alias for get(); kept for compatibility with Chunk.updateGeometry. */
	getUnsafe(x: number, y: number, z: number): number {
		return this.get(x, y, z);
	}

	// ─── Colour helpers (used by block tinting) ────────────────────────────────

	getFoliageColorAtPosition(
		_x: number,
		_y: number,
		_z: number,
	): [number, number, number] {
		return [119 / 255, 171 / 255, 47 / 255];
	}

	getGrassColorAtPosition(
		_x: number,
		_y: number,
		_z: number,
	): [number, number, number] {
		return [89 / 255, 201 / 255, 60 / 255];
	}

	// ─── Mesh building ────────────────────────────────────────────────────────

	/**
	 * Build meshes for dirty chunks.
	 * Pass maxChunks to spread work across frames and avoid stutters.
	 */
	buildChunks(maxChunks = Infinity): void {
		let built = 0;
		for (const chunk of this.dirtyChunks) {
			chunk.updateGeometry(this);
			chunk.buildMesh();
			chunk.isDirty = false;
			this.dirtyChunks.delete(chunk);
			if (++built >= maxChunks) break;
		}
	}

	// ─── Infinite world update ────────────────────────────────────────────────

	/**
	 * Call every frame (or on a tick) to stream chunks around the player.
	 *
	 * @param playerX          - Camera/player world X
	 * @param playerZ          - Camera/player world Z
	 * @param generator        - The WorldGenerator used to fill new columns
	 * @param renderDistance   - Half-width in chunks (default 8: 17x17 grid)
	 * @param maxGenPerFrame   - New columns to generate per call (default 4)
	 * @param maxBuildPerFrame - Dirty chunks to mesh per call (default 8)
	 */
	update(
		playerX: number,
		playerZ: number,
		generator: WorldGenerator,
		renderDistance = 8,
		maxGenPerFrame = 1,
		maxBuildPerFrame = 2,
	): void {
		const pcx = Math.floor(playerX / Chunk.SIZE);
		const pcz = Math.floor(playerZ / Chunk.SIZE);

		// Generate columns from closest ring outward
		let generated = 0;
		outer: for (let r = 0; r <= renderDistance; r++) {
			for (let dx = -r; dx <= r; dx++) {
				for (let dz = -r; dz <= r; dz++) {
					if (Math.abs(dx) !== r && Math.abs(dz) !== r) continue; // ring edge only
					const cx = pcx + dx;
					const cz = pcz + dz;
					if (!this.isColumnGenerated(cx, cz)) {
						generator.generateChunk(this, cx, cz);
						if (++generated >= maxGenPerFrame) break outer;
					}
				}
			}
		}

		// Unload columns too far from the player
		const unloadLimit = renderDistance + 3;
		for (const [key, chunk] of this.chunks) {
			if (
				Math.abs(chunk.x - pcx) > unloadLimit ||
				Math.abs(chunk.z - pcz) > unloadLimit
			) {
				this.minecraft.scene.remove(chunk.mesh);
				chunk.mesh.geometry.dispose();
				this.dirtyChunks.delete(chunk);
				this.chunks.delete(key);
			}
		}

		// Build pending meshes
		this.buildChunks(maxBuildPerFrame);
	}

	// ─── Clearing ─────────────────────────────────────────────────────────────

	clear(): void {
		for (const chunk of this.chunks.values()) {
			this.minecraft.scene.remove(chunk.mesh);
			chunk.mesh.geometry.dispose();
		}
		this.chunks.clear();
		this.dirtyChunks.clear();
		this.generatedColumns.clear();
	}
}
