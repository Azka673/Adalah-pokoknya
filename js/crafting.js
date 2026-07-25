/**
 * File: js/crafting.js
 * Purpose: Basic crafting recipes and API to craft items from inventory.
 */

/**
 * Class Crafting
 */
export class Crafting {
  /**
   * @param {Inventory} inventory
   */
  constructor(inventory){
    this.inventory = inventory;
    this.recipes = [
      { out: 'wood', requires: { dirt:2 } }
    ];
  }

  /**
   * Attempt to craft a recipe by name
   * @param {string} name
   * @returns {boolean}
   */
  craft(out){
    const recipe = this.recipes.find(r => r.out === out);
    if (!recipe) return false;
    // check ingredients
    for (const k of Object.keys(recipe.requires)){
      if ((this.inventory.items[k] || 0) < recipe.requires[k]) return false;
    }
    // remove ingredients
    for (const k of Object.keys(recipe.requires)){
      this.inventory.remove(k, recipe.requires[k]);
    }
    this.inventory.add(out, 1);
    this._log(`Crafted ${out}`);
    return true;
  }

  _log(t){ const el=document.getElementById('log-body'); if(el){ const p=document.createElement('div'); p.textContent=t; el.prepend(p);} }
} 