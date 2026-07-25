/**
 * File: js/main.js
 * Purpose: Application bootstrap. Initializes engine, particle system, UI and game modules.
 */

import { Engine } from './engine.js';
import { World } from './world.js';
import { Player } from './player.js';
import { Inventory } from './inventory.js';
import { SaveSystem } from './save.js';
import { NPCSystem } from './npc.js';
import { Crafting } from './crafting.js';
import { UI } from './ui.js';
import { ParticleSystem } from './particles.js';

/**
 * Bootstrap function to initialize all systems
 */
function bootstrap() {
  const canvas = document.getElementById('viewport');
  const engine = new Engine(canvas);

  // Particle system (visual feedback)
  const particles = new ParticleSystem(engine.scene);

  const inventory = new Inventory();
  const world = new World(engine.scene, inventory, particles);
  const player = new Player(engine.camera, world, inventory, engine, particles);
  const save = new SaveSystem(world, player, inventory);
  const npc = new NPCSystem(world, player, engine.scene);
  const crafting = new Crafting(inventory);
  const ui = new UI({ world, player, inventory, save, crafting, npc, engine, particles });

  // Connect engine update loop
  engine.setUpdate((dt) => {
    world.update(dt, player);
    player.update(dt);
    npc.update(dt);
    particles.update(dt);
    ui.update(dt);
  });

  engine.start();
}

/* Start after DOM loaded */
window.addEventListener('DOMContentLoaded', () => {
  bootstrap();
});