/**
 * File: js/particles.js
 * Purpose: Lightweight particle system for visual feedback (mining, placing, remesh).
 */

import * as THREE from 'https://unpkg.com/three@0.152.2/build/three.module.js';

/**
 * Class ParticleSystem
 * Manages short-lived particle bursts (Points) and updates them each frame.
 */
export class ParticleSystem {
  /**
   * Create ParticleSystem
   * @param {THREE.Scene} scene - Three.js scene to add particles into
   */
  constructor(scene) {
    /** @type {THREE.Scene} */
    this.scene = scene;
    /** @type {Array<Object>} */
    this.bursts = [];
    // Reusable vector for updates
    this._tmpVec = new THREE.Vector3();
  }

  /**
   * Spawn a particle burst at a given position
   * @param {THREE.Vector3} position - world position
   * @param {number} color - hex color (0xRRGGBB)
   * @param {number} count - number of particles
   * @param {object} [opts] - optional settings: size, spread, ttl
   */
  spawnBurst(position, color = 0xffffff, count = 24, opts = {}) {
    const size = opts.size ?? 0.12;
    const spread = opts.spread ?? 0.6;
    const ttl = opts.ttl ?? 1.0;

    // Create buffers
    const posArr = new Float32Array(count * 3);
    const velArr = new Float32Array(count * 3);

    for (let i = 0; i < count; i++) {
      // random placement inside sphere
      const rx = (Math.random() * 2 - 1) * spread;
      const ry = (Math.random() * 1.5 - 0.2) * spread;
      const rz = (Math.random() * 2 - 1) * spread;
      posArr[i * 3 + 0] = position.x + rx;
      posArr[i * 3 + 1] = position.y + ry;
      posArr[i * 3 + 2] = position.z + rz;

      // velocity away from center with random variance
      const vx = rx * (1.5 + Math.random());
      const vy = ry * (1.5 + Math.random()) + 1.0 * Math.random();
      const vz = rz * (1.5 + Math.random());
      velArr[i * 3 + 0] = vx;
      velArr[i * 3 + 1] = vy;
      velArr[i * 3 + 2] = vz;
    }

    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.Float32BufferAttribute(posArr, 3));

    const mat = new THREE.PointsMaterial({
      color,
      size,
      sizeAttenuation: true,
      transparent: true,
      opacity: 1.0,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });

    const points = new THREE.Points(geom, mat);
    points.userData = {
      vel: velArr,
      life: ttl,
      ttl,
      count
    };

    this.scene.add(points);
    this.bursts.push(points);
  }

  /**
   * Update particle system (move particles, apply gravity, fade).
   * @param {number} dt - delta time in seconds
   */
  update(dt) {
    const gravity = -6.0;
    for (let i = this.bursts.length - 1; i >= 0; i--) {
      const pts = this.bursts[i];
      const ud = pts.userData;
      ud.life -= dt;
      const alive = ud.life > 0;
      const geom = pts.geometry;
      const posAttr = geom.getAttribute('position');

      // update positions
      for (let j = 0; j < ud.count; j++) {
        const idx = j * 3;
        // velocity
        ud.vel[idx + 1] += gravity * dt * 0.6; // gentle gravity
        posAttr.array[idx + 0] += ud.vel[idx + 0] * dt;
        posAttr.array[idx + 1] += ud.vel[idx + 1] * dt;
        posAttr.array[idx + 2] += ud.vel[idx + 2] * dt;
      }
      posAttr.needsUpdate = true;

      // fade opacity
      const t = Math.max(0, ud.life / ud.ttl);
      pts.material.opacity = t;

      // shrink size slightly
      pts.material.size = Math.max(0.01, pts.material.size * (0.98));

      if (!alive) {
        // remove and dispose
        this.scene.remove(pts);
        geom.dispose();
        pts.material.dispose();
        this.bursts.splice(i, 1);
      }
    }
  }

  /**
   * Quick helper to spawn a mining burst based on block id/color
   * @param {THREE.Vector3} position
   * @param {THREE.Color|number|string} color
   */
  spawnMiningEffect(position, color) {
    let hex = 0xffffff;
    if (typeof color === 'number') hex = color;
    else if (color && color.isColor) hex = color.getHex();
    else if (typeof color === 'string') hex = new THREE.Color(color).getHex();
    this.spawnBurst(position, hex, 26, { size: 0.12, spread: 0.45, ttl: 0.9 });
  }
}
