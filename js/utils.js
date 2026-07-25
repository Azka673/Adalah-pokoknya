/**
 * File: js/utils.js
 * Purpose: Small utility functions used across modules.
 */

/**
 * Generate unique id
 * @returns {string}
 */
export function uid(){
  return Math.random().toString(36).slice(2,9);
}

/**
 * Simple clamp
 * @param {number} v
 * @param {number} a
 * @param {number} b
 */
export function clamp(v,a,b){ return Math.max(a, Math.min(b,v)); }