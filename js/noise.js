/**
 * File: js/noise.js
 * Purpose: Lightweight Perlin-like noise for terrain generation.
 */

/**
 * Simple value-noise generator with interpolation
 */
export class Noise {
  /**
   * Create noise generator
   * @param {number} seed
   */
  constructor(seed = 1337) {
    this.seed = seed;
    this.perm = this._buildPerm(seed);
  }

  /**
   * Hash function
   * @private
   */
  _buildPerm(seed) {
    const p = new Uint8Array(512);
    for (let i=0;i<256;i++) p[i]=i;
    let j=0;
    for (let i=255;i>0;i--) {
      j = (j + seed + i) & 255;
      const tmp = p[i];
      p[i] = p[j];
      p[j] = tmp;
    }
    for (let i=0;i<512;i++) p[i]=p[i&255];
    return p;
  }

  /**
   * Smooth interpolation
   * @private
   */
  _fade(t){ return t * t * (3 - 2 * t); }

  /**
   * Linear interpolation
   * @private
   */
  _lerp(a,b,t){ return a + (b-a)*t; }

  /**
   * 2D value noise
   * @param {number} x
   * @param {number} y
   */
  get(x,y) {
    const xi = Math.floor(x) & 255;
    const yi = Math.floor(y) & 255;
    const xf = x - Math.floor(x);
    const yf = y - Math.floor(y);
    const aa = this.perm[this.perm[xi] + yi] / 255;
    const ab = this.perm[this.perm[xi] + yi + 1] / 255;
    const ba = this.perm[this.perm[xi + 1] + yi] / 255;
    const bb = this.perm[this.perm[xi + 1] + yi + 1] / 255;
    const u = this._fade(xf);
    const v = this._fade(yf);
    const x1 = this._lerp(aa, ba, u);
    const x2 = this._lerp(ab, bb, u);
    return this._lerp(x1, x2, v);
  }
}