/**
 * File: js/inventory.js
 * Purpose: Simple inventory system with counts and basic UI mapping.
 */

/**
 * Class Inventory
 * Tracks item counts and exposes add/remove API
 */
export class Inventory {
  constructor(){
    this.items = { dirt:0, stone:0, wood:0 };
    this._renderUI();
  }

  /**
   * Add item(s)
   * @param {string} type
   * @param {number} amount
   */
  add(type, amount=1){
    this.items[type] = (this.items[type] || 0) + amount;
    this._updateUI();
  }

  /**
   * Remove item(s)
   * @param {string} type
   * @param {number} amount
   * @returns {boolean} success
   */
  remove(type, amount=1){
    if ((this.items[type] || 0) >= amount){
      this.items[type] -= amount;
      this._updateUI();
      return true;
    }
    return false;
  }

  /**
   * Render inventory UI
   * @private
   */
  _renderUI(){
    const grid = document.getElementById('inventory-grid');
    if (!grid) return;
    grid.innerHTML = '';
    ['dirt','stone','wood'].forEach(k=>{
      const el = document.createElement('div');
      el.className = 'inventory-item';
      el.id = `inv-${k}`;
      el.innerHTML = `<div>${k}</div><div class="count">${this.items[k]}</div>`;
      grid.appendChild(el);
    });
    this._updateUI();
  }

  /**
   * Update UI counts
   * @private
   */
  _updateUI(){
    for (const k of Object.keys(this.items)){
      const el = document.querySelector(`#inv-${k} .count`);
      if (el) el.textContent = String(this.items[k]);
      const slot = document.querySelector(`#toolbar .slot[data-block="${k}"] .count`);
      if (slot) slot.textContent = String(this.items[k]);
    }
  }

  /**
   * Export inventory data
   */
  export(){ return { items: this.items }; }

  /**
   * Import inventory data
   * @param {any} data
   */
  import(data){
    if (!data) return;
    this.items = data.items || this.items;
    this._updateUI();
  }
}