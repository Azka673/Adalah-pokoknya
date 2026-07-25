/**
 * File: js/npc.js
 * Purpose: Simple NPC and enemy system. NPC wander and basic monster chase.
 */

import * as THREE from 'https://unpkg.com/three@0.152.2/build/three.module.js';

/**
 * Class NPCSystem
 * Spawns a few NPC/monster objects with simple AI
 */
export class NPCSystem {
  /**
   * @param {World} world
   * @param {Player} player
   * @param {THREE.Scene} scene
   */
  constructor(world, player, scene){
    this.world = world;
    this.player = player;
    this.scene = scene;
    this.entities = [];
    this._spawnEntities();
  }

  /**
   * Spawn initial entities
   * @private
   */
  _spawnEntities(){
    for (let i=0;i<6;i++){
      const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.6,12,12), new THREE.MeshStandardMaterial({color:0xff7b7b}));
      mesh.position.set((Math.random()-0.5)*40,2,(Math.random()-0.5)*40);
      mesh.castShadow = true;
      this.scene.add(mesh);
      this.entities.push({mesh, hp:20, type:'monster'});
    }
    // friendly NPC
    const npc = new THREE.Mesh(new THREE.ConeGeometry(0.6,1.8,10), new THREE.MeshStandardMaterial({color:0x7bd1ff}));
    npc.position.set(8,2,8);
    this.scene.add(npc);
    this.entities.push({mesh:npc, hp:999, type:'npc'});
  }

  /**
   * Update all entities
   * @param {number} dt
   */
  update(dt){
    for (const e of this.entities){
      if (e.type === 'monster') this._monsterAI(e, dt);
      else this._npcWander(e, dt);
    }
  }

  /**
   * Monster simple AI: chase player within radius
   * @private
   */
  _monsterAI(e, dt){
    const dir = this.player.position.clone().sub(e.mesh.position);
    const dist = dir.length();
    if (dist < 20){
      dir.normalize();
      e.mesh.position.add(dir.multiplyScalar(dt * 2.2));
      if (dist < 2.0){
        // attack player
        this.player.hp -= dt * 4;
        if (this.player.hp < 0) this.player.hp = 0;
      }
    } else {
      // idle bob
      e.mesh.position.y = 2 + Math.sin(performance.now()*0.001 + e.mesh.position.x)*0.1;
    }
  }

  /**
   * NPC wander behavior
   * @private
   */
  _npcWander(e, dt){
    if (!e._target || Math.random() < 0.005) {
      e._target = new THREE.Vector3((Math.random()-0.5)*30,2,(Math.random()-0.5)*30);
    }
    const dir = e._target.clone().sub(e.mesh.position);
    if (dir.length() > 0.2) {
      dir.normalize();
      e.mesh.position.add(dir.multiplyScalar(dt * 1.0));
    }
  }
} 