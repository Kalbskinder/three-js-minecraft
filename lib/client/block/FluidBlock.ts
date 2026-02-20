import { BlockTransparent } from "./BlockTransparent";
import { BlockFace, type TextureCoords } from "./BlockFace";
import { BlockFaceGeometry } from "./BlockFaceGeometry";

export class FluidBlock extends BlockTransparent {
	// Fluid-specific face geometries - 1px shorter (15/16 = 0.9375 instead of 1.0)
	private static readonly FLUID_HEIGHT = 15 / 16;

	private static readonly FLUID_TOP = new BlockFaceGeometry(
		"top",
		[0, FluidBlock.FLUID_HEIGHT, 0],
		[1, FluidBlock.FLUID_HEIGHT, 1],
	);
	private static readonly FLUID_BOTTOM = new BlockFaceGeometry(
		"bottom",
		[0, 0, 0],
		[1, 0, 1],
	);
	private static readonly FLUID_NORTH = new BlockFaceGeometry(
		"north",
		[0, 0, 0],
		[1, FluidBlock.FLUID_HEIGHT, 0],
	);
	private static readonly FLUID_SOUTH = new BlockFaceGeometry(
		"south",
		[0, 0, 1],
		[1, FluidBlock.FLUID_HEIGHT, 1],
	);
	private static readonly FLUID_EAST = new BlockFaceGeometry(
		"east",
		[1, 0, 0],
		[1, FluidBlock.FLUID_HEIGHT, 1],
	);
	private static readonly FLUID_WEST = new BlockFaceGeometry(
		"west",
		[0, 0, 0],
		[0, FluidBlock.FLUID_HEIGHT, 1],
	);

	constructor(id: number, name: string) {
		super(id, name);
	}

	// Only render top face when there's no water above
	setTopFace(uvCoords: TextureCoords): this {
		this.faces.push(new BlockFace(FluidBlock.FLUID_TOP, uvCoords, true));
		return this;
	}

	// Bottom and side faces shouldn't cull against other water blocks
	setBottomFace(uvCoords: TextureCoords): this {
		this.faces.push(new BlockFace(FluidBlock.FLUID_BOTTOM, uvCoords, false));
		return this;
	}

	setEastFace(uvCoords: TextureCoords): this {
		this.faces.push(new BlockFace(FluidBlock.FLUID_EAST, uvCoords, false));
		return this;
	}

	setWestFace(uvCoords: TextureCoords): this {
		this.faces.push(new BlockFace(FluidBlock.FLUID_WEST, uvCoords, false));
		return this;
	}

	setSouthFace(uvCoords: TextureCoords): this {
		this.faces.push(new BlockFace(FluidBlock.FLUID_SOUTH, uvCoords, false));
		return this;
	}

	setNorthFace(uvCoords: TextureCoords): this {
		this.faces.push(new BlockFace(FluidBlock.FLUID_NORTH, uvCoords, false));
		return this;
	}
}
