/**
 * File: js/mesher.worker.js
 * Purpose: WebWorker implementation of greedy meshing algorithm.
 *
 * The worker receives a message:
 * { id, blocks: ArrayBuffer, sx, sy, sz, blockSize, palette: ArrayBuffer }
 *
 * It responds with:
 * { id, positions: ArrayBuffer, normals: ArrayBuffer, colors: ArrayBuffer }
 *
 * Note: palette is Float32Array (length = (maxId+1) * 3) containing RGB floats 0..1
 */

/* eslint-disable no-restricted-globals */
self.addEventListener('message', (ev) => {
  const data = ev.data;
  const id = data.id;
  const blocks = new Uint8Array(data.blocks);
  const sx = data.sx;
  const sy = data.sy;
  const sz = data.sz;
  const blockSize = data.blockSize;
  const palette = new Float32Array(data.palette);

  // Helper: get block id at (x,y,z)
  function get(x, y, z) {
    if (x < 0 || y < 0 || z < 0 || x >= sx || y >= sy || z >= sz) return 0;
    return blocks[x + sx * (y + sy * z)];
  }

  const positions = [];
  const normals = [];
  const colors = [];

  // For each axis (0=X,1=Y,2=Z)
  for (let axis = 0; axis < 3; axis++) {
    const u = (axis + 1) % 3;
    const v = (axis + 2) % 3;
    const dims = [sx, sy, sz];
    const dimsU = dims[u];
    const dimsV = dims[v];
    const dimsA = dims[axis];

    const mask = new Int32Array(dimsU * dimsV);

    for (let d = -1; d < dimsA; d++) {
      // build mask
      let n = 0;
      for (let j = 0; j < dimsV; j++) {
        for (let i = 0; i < dimsU; i++) {
          const posA = [0, 0, 0];
          const posB = [0, 0, 0];
          posA[axis] = d;
          posB[axis] = d + 1;
          posA[u] = i;
          posA[v] = j;
          posB[u] = i;
          posB[v] = j;
          const a = get(posA[0], posA[1], posA[2]);
          const b = get(posB[0], posB[1], posB[2]);
          if (a && !b) mask[n++] = a; // face towards -axis
          else if (!a && b) mask[n++] = -b; // face towards +axis
          else mask[n++] = 0;
        }
      }

      // greedy merge on mask
      let idx = 0;
      for (let j = 0; j < dimsV; j++) {
        for (let i = 0; i < dimsU;) {
          const c = mask[idx];
          if (c === 0) {
            i++; idx++; continue;
          }
          // width
          let w = 1;
          while (i + w < dimsU && mask[idx + w] === c) w++;
          // height
          let h = 1;
          outer: while (j + h < dimsV) {
            for (let k = 0; k < w; k++) {
              if (mask[idx + k + h * dimsU] !== c) break outer;
            }
            h++;
          }

          // compute quad corner in voxel coords
          const du = [0,0,0];
          const dv = [0,0,0];
          du[u] = w;
          dv[v] = h;

          const x = [0,0,0];
          x[axis] = d + (c > 0 ? 1 : 0); // position of face plane
          x[u] = i;
          x[v] = j;

          const blockId = Math.abs(c);
          const normal = [0,0,0];
          normal[axis] = c > 0 ? -1 : 1;

          // quad corners (in voxel grid coordinates)
          const p0 = [x[0], x[1], x[2]];
          const p1 = [x[0] + du[0], x[1] + du[1], x[2] + du[2]];
          const p2 = [x[0] + du[0] + dv[0], x[1] + du[1] + dv[1], x[2] + du[2] + dv[2]];
          const p3 = [x[0] + dv[0], x[1] + dv[1], x[2] + dv[2]];

          // convert to world coords (multiply by blockSize)
          const toWorld = (v) => v * blockSize;

          // push vertices in order then create two triangles
          const verts = [p0,p1,p2,p3];
          const idxBase = positions.length / 3;

          for (let k=0;k<4;k++){
            const vx = toWorld(verts[k][0]);
            const vy = toWorld(verts[k][1]);
            const vz = toWorld(verts[k][2]);
            positions.push(vx, vy, vz);
            normals.push(normal[0], normal[1], normal[2]);
            // palette index: blockId*3 -> r,g,b
            const pi = blockId * 3;
            const r = palette[pi] || 1.0;
            const g = palette[pi+1] || 1.0;
            const b = palette[pi+2] || 1.0;
            colors.push(r,g,b);
          }

          // create triangle indices (non-indexed emission)
          if (normal[0] + normal[1] + normal[2] > 0) {
            // wind: 0,1,2 and 0,2,3
            // emit triangles by duplicating vertex data
            // copy tri1
            const b0 = (idxBase+0)*3;
            const b1 = (idxBase+1)*3;
            const b2 = (idxBase+2)*3;
            // push tri1
            positions.push(positions[b0], positions[b0+1], positions[b0+2]);
            positions.push(positions[b1], positions[b1+1], positions[b1+2]);
            positions.push(positions[b2], positions[b2+1], positions[b2+2]);
            normals.push(normals[b0], normals[b0+1], normals[b0+2]);
            normals.push(normals[b1], normals[b1+1], normals[b1+2]);
            normals.push(normals[b2], normals[b2+1], normals[b2+2]);
            colors.push(colors[b0], colors[b0+1], colors[b0+2]);
            colors.push(colors[b1], colors[b1+1], colors[b1+2]);
            colors.push(colors[b2], colors[b2+1], colors[b2+2]);
            // tri2 (0,2,3)
            const b3 = (idxBase+3)*3;
            positions.push(positions[b0], positions[b0+1], positions[b0+2]);
            positions.push(positions[b2], positions[b2+1], positions[b2+2]);
            positions.push(positions[b3], positions[b3+1], positions[b3+2]);
            normals.push(normals[b0], normals[b0+1], normals[b0+2]);
            normals.push(normals[b2], normals[b2+1], normals[b2+2]);
            normals.push(normals[b3], normals[b3+1], normals[b3+2]);
            colors.push(colors[b0], colors[b0+1], colors[b0+2]);
            colors.push(colors[b2], colors[b2+1], colors[b2+2]);
            colors.push(colors[b3], colors[b3+1], colors[b3+2]);
          } else {
            // reverse winding
            const b0 = (idxBase+0)*3;
            const b1 = (idxBase+1)*3;
            const b2 = (idxBase+2)*3;
            const b3 = (idxBase+3)*3;
            // tri1: 0,2,1
            positions.push(positions[b0], positions[b0+1], positions[b0+2]);
            positions.push(positions[b2], positions[b2+1], positions[b2+2]);
            positions.push(positions[b1], positions[b1+1], positions[b1+2]);
            normals.push(normals[b0], normals[b0+1], normals[b0+2]);
            normals.push(normals[b2], normals[b2+1], normals[b2+2]);
            normals.push(normals[b1], normals[b1+1], normals[b1+2]);
            colors.push(colors[b0], colors[b0+1], colors[b0+2]);
            colors.push(colors[b2], colors[b2+1], colors[b2+2]);
            colors.push(colors[b1], colors[b1+1], colors[b1+2]);
            // tri2: 0,3,2
            positions.push(positions[b0], positions[b0+1], positions[b0+2]);
            positions.push(positions[b3], positions[b3+1], positions[b3+2]);
            positions.push(positions[b2], positions[b2+1], positions[b2+2]);
            normals.push(normals[b0], normals[b0+1], normals[b0+2]);
            normals.push(normals[b3], normals[b3+1], normals[b3+2]);
            normals.push(normals[b2], normals[b2+1], normals[b2+2]);
            colors.push(colors[b0], colors[b0+1], colors[b0+2]);
            colors.push(colors[b3], colors[b3+1], colors[b3+2]);
            colors.push(colors[b2], colors[b2+1], colors[b2+2]);
          }

          // remove mask region
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

  // Convert arrays to Float32Array and transfer back
  const posBuf = new Float32Array(positions).buffer;
  const norBuf = new Float32Array(normals).buffer;
  const colBuf = new Float32Array(colors).buffer;

  // Post back with transferable buffers
  self.postMessage({ id, positions: posBuf, normals: norBuf, colors: colBuf }, [posBuf, norBuf, colBuf]);
});