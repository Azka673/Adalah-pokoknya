/**
 * File: js/world.js
 * Purpose: World manager with chunked voxel data, async greedy meshing via Worker, and persistent block storage.
 */

import * as THREE from 'https://unpkg.com/three@0.152.2/build/three.module.js';
import { Noise } from './noise.js';
import { generateGeometryAsync, greedyMesh } from './mesher.js';

/**
 * Class World
 * Manages chunk generation, block storage, greedy meshing, loading/unloading and block edits.
 */
export class World {
  /**
   * Create World
   * @param {THREE.Scene} scene
   * @param {Inventory} inventory
   * @param {object} [particleSystem] - optional ParticleSystem to show effects
   */
  constructor(scene, inventory, particleSystem = null) {
    /** @type {THREE.Scene} */
    this.scene = scene;
    /** @type {Inventory} */
    this.inventory = inventory;
    /** @type {object|null} */
    this.particles = particleSystem || null;

    // configuration
    this.chunkSize = 16; // X,Z
    this.chunkHeight = 32; // Y
    this.blockSize = 1;

    // internal storage: Map key "cx,cz" => { mesh, blocks:Uint8Array, generating:boolean }
    this.chunks = new Map();

    this.noise = new Noise(Math.floor(Math.random() * 10000));
    this.seed = Date.now();

    // palette mapping id -> THREE.Color
    this.palette = {
      1: new THREE.Color(0x8b5a2b), // dirt
      2: new THREE.Color(0x58a84b), // grass
      3: new THREE.Color(0x8e8e8e), // stone
      4: new THREE.Color(0x7d5a3c)  // wood
    };

    // distant ground for visual continuity
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(2000, 2000),
      new THREE.MeshLambertMaterial({ color: 0x223322 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -1;
    this.scene.add(ground);
  }

  /**
   * Convert chunk coordinates to map key
   * @param {number} cx
   * @param {number} cz
   * @returns {string}
   * @private
   */
  _key(cx, cz) {
    return `${cx},${cz}`;
  }

  /**
   * Create an empty block array for a chunk
   * @returns {Uint8Array}
   * @private
   */
  _createEmptyBlocks() {
    return new Uint8Array(this.chunkSize * this.chunkHeight * this.chunkSize);
  }

  /**
   * Helper: set block in flat array
   * @param {Uint8Array} blocks
   * @param {number} x
   * @param {number} y
   * @param {number} z
   * @param {number} id
   * @private
   */
  _blocksSet(blocks, x, y, z, id) {
    if (x < 0 || y < 0 || z < 0 || x >= this.chunkSize || y >= this.chunkHeight || z >= this.chunkSize) return;
    blocks[x + this.chunkSize * (y + this.chunkHeight * z)] = id;
  }

  /**
   * Helper: get block from flat array
   * @param {Uint8Array} blocks
   * @param {number} x
   * @param {number} y
   * @param {number} z
   * @returns {number}
   * @private
   */
  _blocksGet(blocks, x, y, z) {
    if (x < 0 || y < 0 || z < 0 || x >= this.chunkSize || y >= this.chunkHeight || z >= this.chunkSize) return 0;
    return blocks[x + this.chunkSize * (y + this.chunkHeight * z)];
  }

  /**
   * Generate (or restore) chunk at chunk coords (cx,cz).
   * Uses async meshing (worker) and updates mesh when ready.
   * @param {number} cx
   * @param {number} cz
   */
  generateChunk(cx, cz) {
    const key = this._key(cx, cz);
    if (this.chunks.has(key)) return;

    // create block data
    const blocks = this._createEmptyBlocks();

    // fill using noise-based heightmap
    for (let x = 0; x < this.chunkSize; x++) {
      for (let z = 0; z < this.chunkSize; z++) {
        const worldX = cx * this.chunkSize + x;
        const worldZ = cz * this.chunkSize + z;
        const n = this._fbm(worldX * 0.06, worldZ * 0.06);
        const h = Math.max(1, Math.min(this.chunkHeight - 1, Math.floor(n * (this.chunkHeight - 6)) + 4));
        for (let y = 0; y < h; y++) {
          if (y >= h - 1) this._blocksSet(blocks, x, y, z, 2); // grass
          else if (y > h - 6) this._blocksSet(blocks, x, y, z, 1); // dirt
          else this._blocksSet(blocks, x, y, z, 3); // stone
        }
      }
    }

    // store placeholder chunk entry so other code knows it exists
    this.chunks.set(key, { mesh: null, blocks, generating: true });

    // async generate geometry
    generateGeometryAsync(blocks, this.chunkSize, this.chunkHeight, this.chunkSize, this.blockSize, this.palette)
      .then((geom) => {
        // create material and mesh
        const mat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true });
        const mesh = new THREE.Mesh(geom, mat);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.position.set(cx * this.chunkSize * this.blockSize, 0, cz * this.chunkSize * this.blockSize);
        mesh.userData = { cx, cz };
        // replace placeholder
        const entry = this.chunks.get(key);
        if (entry && entry.mesh) {
          // remove old mesh
          this.scene.remove(entry.mesh);
          if (entry.mesh.geometry) entry.mesh.geometry.dispose();
          if (entry.mesh.material) entry.mesh.material.dispose();
        }
        this.scene.add(mesh);
        this.chunks.set(key, { mesh, blocks, generating: false });
      })
      .catch((err) => {
        console.error('Chunk meshing failed', err);
        // fallback: synchronous meshing to ensure chunk is created
        try {
          const geom = greedyMesh(blocks, this.chunkSize, this.chunkHeight, this.chunkSize, this.blockSize, this.palette);
          const mat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true });
          const mesh = new THREE.Mesh(geom, mat);
          mesh.position.set(cx * this.chunkSize * this.blockSize, 0, cz * this.chunkSize * this.blockSize);
          mesh.userData = { cx, cz };
          this.scene.add(mesh);
          this.chunks.set(key, { mesh, blocks, generating: false });
        } catch (e) {
          console.error('Fallback meshing failed', e);
        }
      });
  }

  /**
   * Simple fractal noise (fbm)
   * @private
   */
  _fbm(x, y) {
    let v = 0, amp = 1, freq = 1;
    for (let i = 0; i < 4; i++) {
      v += this.noise.get(x * freq, y * freq) * amp;
      amp *= 0.5;
      freq *= 2;
    }
    return v;
  }

  /**
   * Update world each frame: load/generate nearby chunks based on player
   * @param {number} dt
   * @param {Player} player
   */
  update(dt, player) {
    const px = Math.floor(player.position.x / (this.chunkSize * this.blockSize));
    const pz = Math.floor(player.position.z / (this.chunkSize * this.blockSize));
    const loadRadius = 2;

    // load required chunks
    for (let dx = -loadRadius; dx <= loadRadius; dx++) {
      for (let dz = -loadRadius; dz <= loadRadius; dz++) {
        this.generateChunk(px + dx, pz + dz);
      }
    }

    // unload distant chunks
    for (const key of Array.from(this.chunks.keys())) {
      const [cx, cz] = key.split(',').map(Number);
      if (Math.abs(cx - px) > loadRadius + 1 || Math.abs(cz - pz) > loadRadius + 1) {
        const obj = this.chunks.get(key);
        if (obj && obj.mesh) {
          this.scene.remove(obj.mesh);
          if (obj.mesh.geometry) obj.mesh.geometry.dispose();
          if (obj.mesh.material) obj.mesh.material.dispose();
        }
        this.chunks.delete(key);
      }
    }
  }

  /**
   * Convert world block coordinates to chunk coords and local coords
   * @param {number} wx
   * @param {number} wy
   * @param {number} wz
   * @returns {{cx:number,cz:number, lx:number,ly:number,lz:number}}
   */
  worldToChunk(wx, wy, wz) {
    const bx = Math.floor(wx / this.blockSize);
    const by = Math.floor(wy / this.blockSize);
    const bz = Math.floor(wz / this.blockSize);
    const cx = Math.floor(bx / this.chunkSize);
    const cz = Math.floor(bz / this.chunkSize);
    const lx = bx - cx * this.chunkSize;
    const ly = by;
    const lz = bz - cz * this.chunkSize;
    return { cx, cz, lx, ly, lz };
  }

  /**
   * Get block id at absolute world coordinates. Returns 0 for empty/out-of-range.
   * @param {number} wx
   * @param {number} wy
   * @param {number} wz
   * @returns {number}
   */
  getBlockAt(wx, wy, wz) {
    const pos = this.worldToChunk(wx, wy, wz);
    const key = this._key(pos.cx, pos.cz);
    const chunk = this.chunks.get(key);
    if (!chunk) return 0;
    if (pos.ly < 0 || pos.ly >= this.chunkHeight) return 0;
    return this._blocksGet(chunk.blocks, pos.lx, pos.ly, pos.lz);
  }

  /**
   * Set block id at absolute world coordinates. Re-meshes affected chunk.
   * @param {number} wx
   * @param {number} wy
   * @param {number} wz
   * @param {string|number} type - string type or numeric id
   * @returns {boolean} - true if placed/changed
   */
  setBlockAt(wx, wy, wz, type) {
    const pos = this.worldToChunk(wx, wy, wz);
    const key = this._key(pos.cx, pos.cz);
    let chunk = this.chunks.get(key);
    if (!chunk) {
      // generate chunk so we can set into it
      this.generateChunk(pos.cx, pos.cz);
      chunk = this.chunks.get(key);
      if (!chunk) return false;
    }
    if (pos.ly < 0 || pos.ly >= this.chunkHeight) return false;

    const id = typeof type === 'string' ? this._typeToId(type) : Number(type);
    const prev = this._blocksGet(chunk.blocks, pos.lx, pos.ly, pos.lz);
    if (prev === id) return false;

    this._blocksSet(chunk.blocks, pos.lx, pos.ly, pos.lz, id);

    // async remesh chunk (do not block)
    this._remeshChunk(pos.cx, pos.cz, key);
    return true;
  }

  /**
   * Internal: remesh a chunk and replace its mesh geometry (async)
   * @param {number} cx
   * @param {number} cz
   * @private
   */
  _remeshChunk(cx, cz, key = null) {
    const k = key || this._key(cx, cz);
    const chunk = this.chunks.get(k);
    if (!chunk) return;
    // mark generating to avoid duplicate requests
    if (chunk.generating) return;
    chunk.generating = true;

    generateGeometryAsync(chunk.blocks, this.chunkSize, this.chunkHeight, this.chunkSize, this.blockSize, this.palette)
      .then((geom) => {
        // replace geometry
        if (chunk.mesh) {
          if (chunk.mesh.geometry) chunk.mesh.geometry.dispose();
          chunk.mesh.geometry = geom;
        } else {
          const mat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true });
          const mesh = new THREE.Mesh(geom, mat);
          mesh.castShadow = true;
          mesh.receiveShadow = true;
          mesh.position.set(cx * this.chunkSize * this.blockSize, 0, cz * this.chunkSize * this.blockSize);
          mesh.userData = { cx, cz };
          this.scene.add(mesh);
          chunk.mesh = mesh;
        }
        chunk.generating = false;

        // spawn a light particle burst to indicate remesh done
        if (this.particles) {
          const center = new THREE.Vector3(
            cx * this.chunkSize * this.blockSize + (this.chunkSize * 0.5),
            8,
            cz * this.chunkSize * this.blockSize + (this.chunkSize * 0.5)
          );
          this.particles.spawnBurst(center, 0x99ddff, 12, { size: 0.12, spread: 1.2, ttl: 0.8 });
        }
      })
      .catch((err) => {
        console.error('Remesh failed', err);
        chunk.generating = false;
      });
  }

  /**
   * Type string to numeric id
   * @param {string} t
   * @returns {number}
   * @private
   */
  _typeToId(t) {
    switch (t) {
      case 'dirt': return 1;
      case 'grass': return 2;
      case 'stone': return 3;
      case 'wood': return 4;
      default: return 1;
    }
  }

  /**
   * Place block (world API)
   * @param {number} x
   * @param {number} y
   * @param {number} z
   * @param {string} type
   */
  placeBlock(x, y, z, type = 'dirt') {
    const placed = this.setBlockAt(x, y, z, type);
    if (placed) {
      // do not auto-grant item when placing, but spawn particles
      if (this.particles) {
        const center = new THREE.Vector3(x + 0.5, y + 0.5, z + 0.5);
        const col = this.palette[this._typeToId(type)] || new THREE.Color(1,1,1);
        this.particles.spawnMiningEffect(center, col);
      }
      this._log(`Placed ${type} at ${x},${y},${z}`);
    }
  }

  /**
   * Remove block based on ray intersection (approx). Adds resource to inventory and remeshes.
   * @param {THREE.Intersection} intersect
   */
  removeBlock(intersect) {
    const pos = intersect.point;
    const n = intersect.face ? intersect.face.normal : new THREE.Vector3(0, 1, 0);
    const hitX = Math.floor(pos.x - n.x * 0.1);
    const hitY = Math.floor(pos.y - n.y * 0.1);
    const hitZ = Math.floor(pos.z - n.z * 0.1);

    const id = this.getBlockAt(hitX, hitY, hitZ);
    if (!id) return;

    const type = this._idToType(id);
    // remove block
    this.setBlockAt(hitX, hitY, hitZ, 0);
    // give item
    this.inventory.add(type, 1);
    this._log(`Mined ${type} at ${hitX},${hitY},${hitZ}`);

    // spawn mining particles at block center
    if (this.particles) {
      const center = new THREE.Vector3(hitX + 0.5, hitY + 0.5, hitZ + 0.5);
      const col = this.palette[id] || new THREE.Color(1,1,1);
      this.particles.spawnMiningEffect(center, col);
    }
  }

  /**
   * Convert numeric id to type string
   * @param {number} id
   * @returns {string}
   * @private
   */
  _idToType(id) {
    switch (id) {
      case 1: return 'dirt';
      case 2: return 'grass';
      case 3: return 'stone';
      case 4: return 'wood';
      default: return 'dirt';
    }
  }

  /**
   * Log message to UI
   * @param {string} text
   * @private
   */
  _log(text) { const el = document.getElementById('log-body'); if (el) { const p = document.createElement('div'); p.textContent = text; el.prepend(p); } }

  /**
   * Export world data (seed + per-chunk block data)
   * @returns {object}
   */
  /**
   * Export world data (seed + per-chunk block data).
   * Uses RLE compression for chunk blocks to reduce size.
   * @returns {object}
   */
  export() {
    const chunks = [];
    for (const [key, obj] of this.chunks.entries()) {
      const [cx, cz] = key.split(',').map(Number);
      if (obj && obj.blocks) {
        try {
          const compressed = compressChunk(obj.blocks);
          chunks.push({ cx, cz, blocksCompressed: compressed });
        } catch (e) {
          // fallback to raw array if compression fails
          chunks.push({ cx, cz, blocks: Array.from(obj.blocks) });
        }
      } else {
        // no blocks yet, skip or include empty
        chunks.push({ cx, cz, blocks: [] });
      }
    }
    return { seed: this.seed, chunks, chunkSize: this.chunkSize, chunkHeight: this.chunkHeight, compressed: true };
  }

  /**
   * Import world data and rebuild chunks
   * @param {any} data
   */
  /**
   * Import world data and rebuild chunks
   * Accepts both compressed (blocksCompressed) and raw (blocks) chunk payloads.
   * @param {any} data
   */
  import(data) {
    if (!data) return;
    this.seed = data.seed || this.seed;
    const savedChunks = data.chunks || [];
    for (const c of savedChunks) {
      const key = this._key(c.cx, c.cz);
      if (this.chunks.has(key)) continue;

      // decompress if necessary
      let arr;
      try {
        if (c.blocksCompressed) {
          arr = decompressChunk(c.blocksCompressed);
        } else if (c.blocks && c.blocks.length > 0) {
          arr = new Uint8Array(c.blocks);
        } else {
          arr = this._createEmptyBlocks();
        }
      } catch (e) {
        console.error('Failed to decompress chunk', e);
        arr = this._createEmptyBlocks();
      }

      // create entry and async mesh
      this.chunks.set(key, { mesh: null, blocks: arr, generating: true });
      generateGeometryAsync(arr, this.chunkSize, this.chunkHeight, this.chunkSize, this.blockSize, this.palette)
        .then((geom) => {
          const mat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true });
          const mesh = new THREE.Mesh(geom, mat);
          mesh.position.set(c.cx * this.chunkSize * this.blockSize, 0, c.cz * this.chunkSize * this.blockSize);
          mesh.userData = { cx: c.cx, cz: c.cz };
          this.scene.add(mesh);
          this.chunks.set(key, { mesh, blocks: arr, generating: false });
        })
        .catch((err) => {
          console.error('Failed to import chunk mesh', err);
        });
    }
  }
}