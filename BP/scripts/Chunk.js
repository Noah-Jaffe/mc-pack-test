class Chunk {
  constructor(location, dimension) {
    if (typeof location.x !== 'number' || typeof location.z !== 'number') 
      throw new Error('Invalid parameters: x and z must be numbers.');
    this.x = Math.floor(location.x / 16);
    this.z = Math.floor(location.z / 16);
    this.location = { x: this.x * 16 + 8, y: 100, z: this.z * 16 + 8 }
    this.dimension = dimension;
  }

  equals(other) {
    return this.x === other.x && this.z === other.z;
  }

  getEntitiesInside() {
    if (!this.dimension) 
      throw new Error('Dimension not set for this chunk.');
    const entities = this.dimension.getEntities({
      location: this.location,
      volume: { x: 16, y: 256, z: 16 }
    });
    return entities
  }

  isLoaded() {
    return !!this.dimension.getBlock(this.location)
  }
}

export { Chunk };