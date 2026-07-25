/**
 * File: js/mesher.js
 * Purpose: Mesher wrapper — provides synchronous greedyMesh fallback and async worker-based meshing.
 *
 * Exports:
 *  - greedyMesh(blocks, sx, sy, sz, blockSize, palette) -> THREE.BufferGeometry
 *  - generateGeometryAsync(blocks, sx, sy, sz, blockSize, palette) -> Promise<THREE.BufferGeometry>
 */

/**
 * NOTE: This file runs in the main thread and creates THREE.BufferGeometry from worker results.
 */

import * as THREE from 'https://unpkg.com/three@0.152.2/build/three.module.js';

/**
 * Synchronous greedy mesher (fallback).
 * Produces a BufferGeometry with position, normal, color attributes.
 *
 * @param {Uint8Array} blocks
 * @param {number} sx
 * @param {number} sy
 * @param {number} sz
 * @param {number} blockSize
 * @param {Object<number, THREE.Color>} palette
 * @returns {THREE.BufferGeometry}
 */
export function greedyMesh(blocks, sx, sy, sz, blockSize = 1, palette = {}) {
  // Helper: get block id at (x,y,z)
  function get(x, y, z) {
    if (x < 0 || y < 0 || z < 0 || x >= sx || y >= sy || z >= sz) return 0;
    return blocks[x + sx * (y + sy * z)];
  }

  const positions = [];
  const normals = [];
  const colors = [];

  for (let axis = 0; axis < 3; axis++) {
    const u = (axis + 1) % 3;
    const v = (axis + 2) % 3;
    const dims = [sx, sy, sz];
    const dimsU = dims[u];
    const dimsV = dims[v];
    const dimsA = dims[axis];

    const mask = new Int32Array(dimsU * dimsV);

    for (let d = -1; d < dimsA; d++) {
      let n = 0;
      for (let j = 0; j < dimsV; j++) {
        for (let i = 0; i < dimsU; i++) {
          const posA = [0,0,0];
          const posB = [0,0,0];
          posA[axis] = d;
          posB[axis] = d + 1;
          posA[u] = i;
          posA[v] = j;
          posB[u] = i;
          posB[v] = j;
          const a = get(posA[0], posA[1], posA[2]);
          const b = get(posB[0], posB[1], posB[2]);
          if (a && !b) mask[n++] = a;
          else if (!a && b) mask[n++] = -b;
          else mask[n++] = 0;
        }
      }

      let idx = 0;
      for (let j = 0; j < dimsV; j++) {
        for (let i = 0; i < dimsU;) {
          const c = mask[idx];
          if (c === 0) { i++; idx++; continue; }
          let w = 1;
          while (i + w < dimsU && mask[idx + w] === c) w++;
          let h = 1;
          outer: while (j + h < dimsV) {
            for (let k = 0; k < w; k++) {
              if (mask[idx + k + h * dimsU] !== c) break outer;
            }
            h++;
          }

          const du = [0,0,0];
          const dv = [0,0,0];
          du[u] = w;
          dv[v] = h;

          const x = [0,0,0];
          x[axis] = d + (c > 0 ? 1 : 0);
          x[u] = i;
          x[v] = j;

          const normal = [0,0,0];
          normal[axis] = c > 0 ? -1 : 1;
          const blockId = Math.abs(c);

          const p0 = [x[0], x[1], x[2]];
          const p1 = [x[0] + du[0], x[1] + du[1], x[2] + du[2]];
          const p2 = [x[0] + du[0] + dv[0], x[1] + du[1] + dv[1], x[2] + du[2] + dv[2]];
          const p3 = [x[0] + dv[0], x[1] + dv[1], x[2] + dv[2]];

          const toWorld = (v) => v * blockSize;
          const verts = [p0,p1,p2,p3];
          const baseIdx = positions.length / 3;

          for (let k = 0; k < 4; k++) {
            const vx = toWorld(verts[k][0]);
            const vy = toWorld(verts[k][1]);
            const vz = toWorld(verts[k][2]);
            positions.push(vx, vy, vz);
            normals.push(normal[0], normal[1], normal[2]);
            const col = palette[blockId] || new THREE.Color(1,1,1);
            colors.push(col.r, col.g, col.b);
          }

          if (normal[0] + normal[1] + normal[2] > 0) {
            const b0 = (baseIdx+0)*3; const b1=(baseIdx+1)*3; const b2=(baseIdx+2)*3; const b3=(baseIdx+3)*3;
            positions.push(positions[b0],positions[b0+1],positions[b0+2]);
            positions.push(positions[b1],positions[b1+1],positions[b1+2]);
            positions.push(positions[b2],positions[b2+1],positions[b2+2]);
            normals.push(normals[b0],normals[b0+1],normals[b0+2]);
            normals.push(normals[b1],normals[b1+1],normals[b1+2]);
            normals.push(normals[b2],normals[b2+1],normals[b2+2]);
            colors.push(colors[b0],colors[b0+1],colors[b0+2]);
            colors.push(colors[b1],colors[b1+1],colors[b1+2]);
            colors.push(colors[b2],colors[b2+1],colors[b2+2]);

            positions.push(positions[b0],positions[b0+1],positions[b0+2]);
            positions.push(positions[b2],positions[b2+1],positions[b2+2]);
            positions.push(positions[b3],positions[b3+1],positions[b3+2]);
            normals.push(normals[b0],normals[b0+1],normals[b0+2]);
            normals.push(normals[b2],normals[b2+1],normals[b2+2]);
            normals.push(normals[b3],normals[b3+1],normals[b3+2]);
            colors.push(colors[b0],colors[b0+1],colors[b0+2]);
            colors.push(colors[b2],colors[b2+1],colors[b2+2]);
            colors.push(colors[b3],colors[b3+1],colors[b3+2]);

            positions.splice(baseIdx*3, 12);
            normals.splice(baseIdx*3, 12);
            colors.splice(baseIdx*3, 12);
          } else {
            const b0 = (baseIdx+0)*3; const b1=(baseIdx+1)*3; const b2=(baseIdx+2)*3; const b3=(baseIdx+3)*3;
            positions.push(positions[b0],positions[b0+1],positions[b0+2]);
            positions.push(positions[b2],positions[b2+1],positions[b2+2]);
            positions.push(positions[b1],positions[b1+1],positions[b1+2]);
            normals.push(normals[b0],normals[b0+1],normals[b0+2]);
            normals.push(normals[b2],normals[b2+1],normals[b2+2]);
            normals.push(normals[b1],normals[b1+1],normals[b1+2]);
            colors.push(colors[b0],colors[b0+1],colors[b0+2]);
            colors.push(colors[b2],colors[b2+1],colors[b2+2]);
            colors.push(colors[b1],colors[b1+1],colors[b1+2]);

            positions.push(positions[b0],positions[b0+1],positions[b0+2]);
            positions.push(positions[b3],positions[b3+1],positions[b3+2]);
            positions.push(positions[b2],positions[b2+1],positions[b2+2]);
            normals.push(normals[b0],normals[b0+1],normals[b0+2]);
            normals.push(normals[b3],normals[b3+1],normals[b3+2]);
            normals.push(normals[b2],normals[b2+1],normals[b2+2]);
            colors.push(colors[b0],colors[b0+1],colors[b0+2]);
            colors.push(colors[b3],colors[b3+1],colors[b3+2]);
            colors.push(colors[b2],colors[b2+1],colors[b2+2]);

            positions.splice(baseIdx*3, 12);
            normals.splice(baseIdx*3, 12);
            colors.splice(baseIdx*3, 12);
          }

          for (let yy = 0; yy < h; yy++) {
            for (let xx = 0; xx < w; xx++) {
              mask[idx + xx + yy * dimsU] = 0;
            }
          }

          i += w;
          idx += w;
        }
      }
    }
  }

  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(positions), 3));
  geom.setAttribute('normal', new THREE.Float32BufferAttribute(new Float32Array(normals), 3));
  geom.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(colors), 3));
  geom.computeBoundingSphere();
  return geom;
}

/* Worker management */
let _worker = null;
let _reqId = 1;
const _resolvers = new Map();

/**
 * Ensure a single worker instance (module worker)
 * @returns {Worker}
 * @private
 */
function _getWorker() {
  if (_worker) return _worker;
  try {
    _worker = new Worker(new URL('./mesher.worker.js', import.meta.url), { type: 'module' });
    _worker.addEventListener('message', (ev) => {
      const d = ev.data;
      const id = d.id;
      const resolver = _resolvers.get(id);
      if (!resolver) return;
      _resolvers.delete(id);
      // d.positions/normals/colors are ArrayBuffers
      resolver.resolve(d);
    });
    _worker.addEventListener('error', (err) => {
      // reject all pending
      for (const [id, r] of _resolvers.entries()) {
        r.reject(err);
      }
      _resolvers.clear();
      console.error('Mesher worker error', err);
    });
  } catch (e) {
    console.warn('Worker initialization failed, falling back to main-thread meshing', e);
    _worker = null;
  }
  return _worker;
}

/**
 * Convert palette (id -> THREE.Color) into Float32Array for worker.
 * Indexing: paletteArray[id * 3 + 0] = r, +1 = g, +2 = b
 * @param {Object<number, THREE.Color>} palette
 * @returns {Float32Array}
 * @private
 */
function _paletteToFloatArray(palette) {
  let maxId = 0;
  for (const k of Object.keys(palette)) {
    const id = Number(k);
    if (!Number.isNaN(id) && id > maxId) maxId = id;
  }
  const arr = new Float32Array((maxId + 1) * 3);
  for (let id = 0; id <= maxId; id++) {
    const col = palette[id];
    if (col) {
      arr[id * 3 + 0] = col.r;
      arr[id * 3 + 1] = col.g;
      arr[id * 3 + 2] = col.b;
    } else {
      arr[id * 3 + 0] = 1.0;
      arr[id * 3 + 1] = 1.0;
      arr[id * 3 + 2] = 1.0;
    }
  }
  return arr;
}

/**
 * Generate BufferGeometry asynchronously using the worker.
 * Falls back to synchronous greedyMesh if Worker is unavailable.
 *
 * @param {Uint8Array} blocks
 * @param {number} sx
 * @param {number} sy
 * @param {number} sz
 * @param {number} blockSize
 * @param {Object<number, THREE.Color>} palette
 * @returns {Promise<THREE.BufferGeometry>}
 */
export async function generateGeometryAsync(blocks, sx, sy, sz, blockSize = 1, palette = {}) {
  const worker = _getWorker();
  if (!worker) {
    // fallback
    return greedyMesh(blocks, sx, sy, sz, blockSize, palette);
  }

  const id = _reqId++;
  const blocksCopy = new Uint8Array(blocks); // copy so original is untouched
  const paletteArr = _paletteToFloatArray(palette);

  return new Promise((resolve, reject) => {
    _resolvers.set(id, { resolve: (d) => {
      // build geometry from returned buffers
      const pos = new Float32Array(d.positions);
      const nor = new Float32Array(d.normals);
      const col = new Float32Array(d.colors);
      const geom = new THREE.BufferGeometry();
      geom.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      geom.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
      geom.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
      geom.computeBoundingSphere();
      resolve(geom);
    }, reject });
    try {
      worker.postMessage({
        id,
        blocks: blocksCopy.buffer,
        sx, sy, sz,
        blockSize,
        palette: paletteArr.buffer
      }, [blocksCopy.buffer, paletteArr.buffer]);
    } catch (e) {
      _resolvers.delete(id);
      reject(e);
    }
  });
}