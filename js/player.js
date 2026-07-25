/**
 * File: js/player.js
 * Purpose: Player controls, movement, mining/building interactions, RPG stats.
 */

import * as THREE from 'https://unpkg.com/three@0.152.2/build/three.module.js';
import { Vector3 } from 'https://unpkg.com/three@0.152.2/build/three.module.js';

/**
 * Class Player
 * Handles player position, movement and interactions
 */
export class Player {
  /**
   * @param {THREE.Camera} camera
   * @param {World} world
   * @param {Inventory} inventory
   * @param {Engine} engine
   */
  constructor(camera, world, inventory, engine) {
    this.camera = camera;
    this.world = world;
    this.inventory = inventory;
    this.engine = engine;

    this.position = new THREE.Vector3(0, 6, 0);
    this.velocity = new THREE.Vector3();
    this.speed = 6;
    this.isGrounded = false;

    // RPG stats
    this.hp = 100;
    this.maxHp = 100;
    this.xp = 0;
    this.level = 1;
    this._updateHUD();

    // movement input
    this.input = { forward:false, back:false, left:false, right:false, jump:false };
    this._setupInput();

    // Raycaster for mining/interaction
    this.raycaster = new THREE.Raycaster();
    this.interactDistance = 6;

    // pointer lock movement integration
    this._bindPointerControls();
  }

  /**
   * Setup keyboard events
   * @private
   */
  _setupInput() {
    window.addEventListener('keydown', (e) => {
      if (e.key === 'w') this.input.forward = true;
      if (e.key === 's') this.input.back = true;
      if (e.key === 'a') this.input.left = true;
      if (e.key === 'd') this.input.right = true;
      if (e.key === ' ') this.input.jump = true;
      if (e.key === 'e') this._interact();
    });
    window.addEventListener('keyup', (e) => {
      if (e.key === 'w') this.input.forward = false;
      if (e.key === 's') this.input.back = false;
      if (e.key === 'a') this.input.left = false;
      if (e.key === 'd') this.input.right = false;
      if (e.key === ' ') this.input.jump = false;
    });

    window.addEventListener('mousedown', (e) => {
      if (e.button === 0) this._mine();
      if (e.button === 2) this._place();
    });
  }

  /**
   * Update per frame
   * @param {number} dt
   */
  update(dt) {
    // simple movement relative to camera
    const dir = new THREE.Vector3();
    this.camera.getWorldDirection(dir);
    dir.y = 0;
    dir.normalize();
    const right = new THREE.Vector3().crossVectors(this.camera.up, dir).normalize();

    let move = new THREE.Vector3();
    if (this.input.forward) move.add(dir);
    if (this.input.back) move.sub(dir);
    if (this.input.left) move.add(right);
    if (this.input.right) move.sub(right);
    if (move.lengthSq() > 0) move.normalize();

    move.multiplyScalar(this.speed * dt);
    this.position.add(move);
    // small gravity
    this.velocity.y -= 9.8 * dt;
    this.position.y += this.velocity.y * dt;
    if (this.position.y < 2) { this.position.y = 2; this.velocity.y = 0; this.isGrounded = true; }
    this.camera.position.copy(this.position);

    this._updateHUD();
  }

  /**
   * Interact with objects/NPC
   * @private
   */
  _interact() {
    // raycast forward to check for NPCs or chests
    const dir = new THREE.Vector3();
    this.camera.getWorldDirection(dir);
    this.raycaster.set(this.camera.position, dir);
    const intersects = this.raycaster.intersectObjects(this.world.scene.children, true);
    if (intersects.length > 0 && intersects[0].distance < this.interactDistance) {
      // placeholder: pickup if mesh named 'pickup'
      const obj = intersects[0].object;
      if (obj.userData && obj.userData.pickup) {
        this.inventory.add(obj.userData.type || 'dirt', 1);
        obj.parent.remove(obj);
      }
    }
  }

  /**
   * Mining action — raycast and call world.removeBlock
   * @private
   */
  _mine() {
    const dir = new THREE.Vector3();
    this.camera.getWorldDirection(dir);
    this.raycaster.set(this.camera.position, dir);
    const intersects = this.raycaster.intersectObjects(this.world.scene.children, true);
    if (intersects.length > 0 && intersects[0].distance < this.interactDistance) {
      this.world.removeBlock(intersects[0]);
      this.gainXP(5);
    }
  }

  /**
   * Place block action — place block at target
   * @private
   */
  _place() {
    const dir = new THREE.Vector3();
    this.camera.getWorldDirection(dir);
    this.raycaster.set(this.camera.position, dir);
    const intersects = this.raycaster.intersectObjects(this.world.scene.children, true);
    if (intersects.length > 0 && intersects[0].distance < this.interactDistance) {
      const p = intersects[0].point;
      const x = Math.floor(p.x);
      const y = Math.floor(p.y);
      const z = Math.floor(p.z);
      if (this.inventory.remove('dirt',1)) {
        this.world.placeBlock(x, y+1, z, 'dirt');
      } else {
        this._log('Not enough dirt to place.');
      }
    }
  }

  /**
   * Gain XP and level up
   * @param {number} amount
   */
  gainXP(amount) {
    this.xp += amount;
    if (this.xp >= this._xpForNext()) {
      this.xp -= this._xpForNext();
      this.level++;
      this.maxHp += 10;
      this.hp = this.maxHp;
      this._log(`Level up! Now LV ${this.level}`);
    }
  }

  /**
   * XP required for next level
   * @private
   */
  _xpForNext() { return 50 + this.level * 25; }

  /**
   * Update HUD elements
   * @private
   */
  _updateHUD() {
    const hpEl = document.getElementById('hp');
    const xpEl = document.getElementById('xp');
    const lvlEl = document.getElementById('lvl');
    if (hpEl) hpEl.textContent = String(this.hp);
    if (xpEl) xpEl.textContent = String(this.xp);
    if (lvlEl) lvlEl.textContent = String(this.level);
  }

  /**
   * Logging helper
   * @private
   */
  _log(text){ const el = document.getElementById('log-body'); if (el){ const p=document.createElement('div'); p.textContent=text; el.prepend(p); } }

  /**
   * Bind pointer lock movement (forward/back handled via input)
   * @private
   */
  _bindPointerControls(){
    // nothing else for now; camera pointer lock already handled by engine
  }

  /**
   * Export player data
   */
  export(){
    return {
      position: {x:this.position.x,y:this.position.y,z:this.position.z},
      hp:this.hp,xp:this.xp,level:this.level
    };
  }

  /**
   * Import player data
   * @param {any} data
   */
  import(data){
    if (!data) return;
    const p = data.position || {};
    this.position.set(p.x||0, p.y||5, p.z||0);
    this.hp = data.hp || this.hp;
    this.xp = data.xp || this.xp;
    this.level = data.level || this.level;
  }
}