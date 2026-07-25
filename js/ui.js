/**
 * File: js/ui.js
 * Purpose: Wire UI elements to systems (toolbar, start button, logs), provide Save/Load UI + autosave,
 * toast notifications, import confirmation modal, automatic backup, and support for importing .json.gz files.
 */

/**
 * Class UI
 * Connects world, player, inventory, save and crafting to the DOM
 */
export class UI {
  /**
   * @param {object} deps
   */
  constructor(deps){
    this.world = deps.world;
    this.player = deps.player;
    this.inventory = deps.inventory;
    this.save = deps.save;
    this.crafting = deps.crafting;
    this.npc = deps.npc;
    this.engine = deps.engine;

    /** Autosave configuration (ms) */
    this._autosaveIntervalMs = 30 * 1000; // 30s
    this._minSaveIntervalMs = 10 * 1000; // throttle minimum 10s between saves
    this._lastSaved = 0;
    this._autosaveEnabled = true;
    this._autosaveTimer = null;

    /** Pending import file reference */
    this._pendingImportFile = null;
    /** LocalStorage key used for pre-import backup */
    this._backupKey = 'sider_save_preimport_backup';

    this._bindToolbar();
    this._bindStart();
    this._bindSaveLoad();
    this._ensureToastContainer();
    this._createImportConfirmationModal();
    this._startAutosave();
    this.update(0);
  }

  /**
   * Bind toolbar interactions
   * @private
   */
  _bindToolbar(){
    const slots = document.querySelectorAll('#toolbar .slot');
    slots.forEach(s=>{
      s.addEventListener('click', ()=>{
        document.querySelectorAll('#toolbar .slot').forEach(x=>x.classList.remove('active'));
        s.classList.add('active');
      });
    });
    // right-click menu to craft wood
    const stoneSlot = document.querySelector('#toolbar .slot[data-block="wood"]');
    if (stoneSlot){
      stoneSlot.addEventListener('contextmenu', (e)=>{
        e.preventDefault();
        this.crafting.craft('wood');
      });
    }
  }

  /**
   * Bind start button to pointer lock (already in engine) - show controls
   * @private
   */
  _bindStart(){
    const startBtn = document.getElementById('start-btn');
    if (startBtn) {
      startBtn.addEventListener('click', ()=> {
        const intro = document.getElementById('intro');
        if (intro) intro.style.display = 'none';
      });
    }
  }

  /**
   * Create Save / Load / Export / Import UI panel and bind events.
   * Adds a checkbox to enable gzip compression for export if the browser supports CompressionStream.
   * Adds a Restore Backup button to revert pre-import backup saved in localStorage.
   * @private
   */
  _bindSaveLoad() {
    // Create a simple floating panel if not present in DOM
    let panel = document.getElementById('save-panel');
    if (!panel) {
      panel = document.createElement('div');
      panel.id = 'save-panel';
      panel.style.position = 'fixed';
      panel.style.right = '16px';
      panel.style.bottom = '16px';
      panel.style.background = 'rgba(17,24,39,0.85)'; // dark bg
      panel.style.color = '#e6eef8';
      panel.style.padding = '10px';
      panel.style.borderRadius = '8px';
      panel.style.boxShadow = '0 6px 20px rgba(0,0,0,0.4)';
      panel.style.zIndex = '9999';
      panel.style.fontFamily = 'Inter, system-ui, Arial, sans-serif';
      panel.style.fontSize = '13px';
      panel.style.display = 'flex';
      panel.style.flexDirection = 'column';
      panel.style.gap = '8px';

      const row = document.createElement('div');
      row.style.display = 'flex';
      row.style.gap = '8px';
      row.style.alignItems = 'center';

      const saveBtn = document.createElement('button');
      saveBtn.id = 'btn-save';
      saveBtn.textContent = 'Save';
      saveBtn.style.padding = '6px 10px';
      saveBtn.style.borderRadius = '6px';
      saveBtn.style.border = '1px solid rgba(255,255,255,0.06)';
      saveBtn.style.background = 'linear-gradient(180deg,#2b6cb0,#2c5282)';
      saveBtn.style.color = '#fff';
      saveBtn.style.cursor = 'pointer';

      const loadBtn = document.createElement('button');
      loadBtn.id = 'btn-load';
      loadBtn.textContent = 'Load';
      loadBtn.style.padding = '6px 10px';
      loadBtn.style.borderRadius = '6px';
      loadBtn.style.border = '1px solid rgba(255,255,255,0.06)';
      loadBtn.style.background = 'linear-gradient(180deg,#4a5568,#2d3748)';
      loadBtn.style.color = '#fff';
      loadBtn.style.cursor = 'pointer';

      const exportBtn = document.createElement('button');
      exportBtn.id = 'btn-export';
      exportBtn.textContent = 'Export';
      exportBtn.style.padding = '6px 10px';
      exportBtn.style.borderRadius = '6px';
      exportBtn.style.border = '1px solid rgba(255,255,255,0.06)';
      exportBtn.style.background = 'linear-gradient(180deg,#68d391,#38a169)';
      exportBtn.style.color = '#062e16';
      exportBtn.style.cursor = 'pointer';

      const importBtn = document.createElement('button');
      importBtn.id = 'btn-import';
      importBtn.textContent = 'Import';
      importBtn.style.padding = '6px 10px';
      importBtn.style.borderRadius = '6px';
      importBtn.style.border = '1px solid rgba(255,255,255,0.06)';
      importBtn.style.background = 'linear-gradient(180deg,#f6ad55,#dd6b20)';
      importBtn.style.color = '#2b1b0b';
      importBtn.style.cursor = 'pointer';

      const restoreBtn = document.createElement('button');
      restoreBtn.id = 'btn-restore-backup';
      restoreBtn.textContent = 'Restore Backup';
      restoreBtn.style.padding = '6px 10px';
      restoreBtn.style.borderRadius = '6px';
      restoreBtn.style.border = '1px solid rgba(255,255,255,0.06)';
      restoreBtn.style.background = 'linear-gradient(180deg,#9f7aea,#805ad5)';
      restoreBtn.style.color = '#2a1650';
      restoreBtn.style.cursor = 'pointer';

      row.appendChild(saveBtn);
      row.appendChild(loadBtn);
      row.appendChild(exportBtn);
      row.appendChild(importBtn);
      row.appendChild(restoreBtn);

      // Compression toggle row
      const compressRow = document.createElement('div');
      compressRow.style.display = 'flex';
      compressRow.style.alignItems = 'center';
      compressRow.style.gap = '8px';

      const compressCheckbox = document.createElement('input');
      compressCheckbox.type = 'checkbox';
      compressCheckbox.id = 'export-compress-checkbox';
      compressCheckbox.style.width = '16px';
      compressCheckbox.style.height = '16px';

      const compressLabel = document.createElement('label');
      compressLabel.htmlFor = 'export-compress-checkbox';
      compressLabel.style.fontSize = '12px';
      compressLabel.style.opacity = '0.9';
      compressLabel.textContent = 'Compressed export (gzip)';

      compressRow.appendChild(compressCheckbox);
      compressRow.appendChild(compressLabel);

      const status = document.createElement('div');
      status.id = 'save-status';
      status.style.opacity = '0.9';
      status.textContent = 'Autosave: every 30s';

      panel.appendChild(row);
      panel.appendChild(compressRow);
      panel.appendChild(status);
      document.body.appendChild(panel);

      // Hidden file input for import (accept gz too)
      const fileInput = document.createElement('input');
      fileInput.type = 'file';
      fileInput.accept = '.json,.json.gz,application/json,application/gzip,.gz';
      fileInput.style.display = 'none';
      fileInput.id = 'save-file-input';
      document.body.appendChild(fileInput);

      // events
      saveBtn.addEventListener('click', () => this._manualSave());
      loadBtn.addEventListener('click', () => this._manualLoad());
      exportBtn.addEventListener('click', () => this._exportToFile());
      importBtn.addEventListener('click', () => fileInput.click());
      fileInput.addEventListener('change', (e) => this._handleFileImport(e));
      restoreBtn.addEventListener('click', () => this._restoreBackup());
    }
  }

  /**
   * Ensure toast container exists in DOM.
   * @private
   */
  _ensureToastContainer() {
    if (document.getElementById('toast-container')) return;
    const c = document.createElement('div');
    c.id = 'toast-container';
    c.style.position = 'fixed';
    c.style.right = '16px';
    c.style.top = '16px';
    c.style.zIndex = '10000';
    c.style.display = 'flex';
    c.style.flexDirection = 'column';
    c.style.gap = '8px';
    document.body.appendChild(c);
  }

  /**
   * Show a lightweight toast notification.
   * @param {string} message - Text to show
   * @param {'info'|'success'|'error'} [type='info'] - Visual style
   * @param {number} [timeout=3000] - Time in ms before auto-dismiss
   * @private
   */
  _showToast(message, type = 'info', timeout = 3000) {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const t = document.createElement('div');
    t.className = 'toast';
    t.textContent = message;
    t.style.minWidth = '180px';
    t.style.padding = '10px 12px';
    t.style.borderRadius = '8px';
    t.style.color = '#fff';
    t.style.boxShadow = '0 6px 20px rgba(0,0,0,0.35)';
    t.style.opacity = '0';
    t.style.transform = 'translateY(-6px)';
    t.style.transition = 'opacity 220ms ease, transform 220ms ease';
    t.style.fontFamily = 'Inter, system-ui, Arial, sans-serif';
    t.style.fontSize = '13px';

    if (type === 'success') {
      t.style.background = 'linear-gradient(180deg,#2f855a,#276749)';
    } else if (type === 'error') {
      t.style.background = 'linear-gradient(180deg,#c53030,#822727)';
    } else {
      t.style.background = 'linear-gradient(180deg,#2b6cb0,#2c5282)';
    }

    container.appendChild(t);
    // animate in
    requestAnimationFrame(() => {
      t.style.opacity = '1';
      t.style.transform = 'translateY(0)';
    });

    // auto remove
    const remove = () => {
      t.style.opacity = '0';
      t.style.transform = 'translateY(-6px)';
      setTimeout(() => { try { container.removeChild(t); } catch (e) {} }, 240);
    };
    const to = setTimeout(remove, timeout);

    // allow click to dismiss early
    t.addEventListener('click', () => {
      clearTimeout(to);
      remove();
    });
  }

  /**
   * Start autosave timer.
   * @private
   */
  _startAutosave() {
    if (this._autosaveTimer) clearInterval(this._autosaveTimer);
    this._autosaveTimer = setInterval(() => this._autoSave(), this._autosaveIntervalMs);
  }

  /**
   * Perform autosave (throttled).
   * @private
   */
  _autoSave() {
    if (!this._autosaveEnabled) return;
    const now = Date.now();
    if (now - this._lastSaved < this._minSaveIntervalMs) return; // throttle
    if (!this.save || !this.world) return;
    try {
      const data = this.world.export();
      this.save.saveToLocal(data);
      this._lastSaved = now;
      this._setStatus(`Autosaved • ${new Date(now).toLocaleTimeString()}`);
      this._showToast('Autosaved', 'success', 2000);
    } catch (e) {
      console.error('Autosave failed', e);
      this._setStatus('Autosave failed');
      this._showToast('Autosave failed', 'error', 3000);
    }
  }

  /**
   * Manual save triggered by user.
   * @private
   */
  _manualSave() {
    if (!this.save || !this.world) {
      this._setStatus('Save unavailable');
      this._showToast('Save unavailable', 'error', 2500);
      return;
    }
    const now = Date.now();
    if (now - this._lastSaved < 1000) {
      this._setStatus('Already saved recently');
      this._showToast('Already saved recently', 'info', 1500);
      return;
    }
    try {
      const data = this.world.export();
      this.save.saveToLocal(data);
      this._lastSaved = Date.now();
      this._setStatus(`Saved • ${new Date(this._lastSaved).toLocaleTimeString()}`);
      this._showToast('Saved successfully', 'success', 2500);
    } catch (e) {
      console.error('Manual save failed', e);
      this._setStatus('Save failed');
      this._showToast('Save failed', 'error', 3000);
    }
  }

  /**
   * Manual load - loads from localStorage and imports into world.
   * @private
   */
  _manualLoad() {
    if (!this.save || !this.world) {
      this._setStatus('Load unavailable');
      this._showToast('Load unavailable', 'error', 2500);
      return;
    }
    try {
      const data = this.save.loadFromLocal();
      if (!data) {
        this._setStatus('No save found');
        this._showToast('No save found', 'info', 2200);
        return;
      }
      // import into world
      this.world.import(data);
      this._setStatus(`Loaded • ${new Date().toLocaleTimeString()}`);
      this._showToast('World loaded', 'success', 2500);
    } catch (e) {
      console.error('Load failed', e);
      this._setStatus('Load failed');
      this._showToast('Load failed', 'error', 3000);
    }
  }

  /**
   * Export current world data to a downloadable file.
   * Supports optional gzip compression via the browser CompressionStream API.
   * @private
   */
  async _exportToFile() {
    if (!this.world) {
      this._showToast('Export failed: world unavailable', 'error', 2500);
      return;
    }
    const compressCheckbox = document.getElementById('export-compress-checkbox');
    const useCompression = !!(compressCheckbox && compressCheckbox.checked);

    try {
      const data = this.world.export();
      const json = JSON.stringify(data);
      const now = new Date();

      if (useCompression && typeof CompressionStream === 'function') {
        try {
          // gzip compress using CompressionStream (modern browsers)
          const cs = new CompressionStream('gzip');
          const encoder = new TextEncoder();
          const uint8 = encoder.encode(json);
          const inStream = new Blob([uint8]).stream();
          const compressedStream = inStream.pipeThrough(cs);
          const compressedBlob = await new Response(compressedStream).blob();
          const url = URL.createObjectURL(compressedBlob);
          const a = document.createElement('a');
          const name = `sider-save-${now.toISOString().replace(/[:.]/g,'-')}.json.gz`;
          a.href = url;
          a.download = name;
          document.body.appendChild(a);
          a.click();
          a.remove();
          URL.revokeObjectURL(url);
          this._showToast('Compressed export started', 'success', 2200);
          this._setStatus(`Exported (gz) • ${now.toLocaleTimeString()}`);
          return;
        } catch (e) {
          console.warn('CompressionStream error, falling back to plain export', e);
          // fallthrough to plain export
          this._showToast('Compression failed, exporting plain JSON', 'info', 2800);
        }
      } else if (useCompression) {
        // Compression requested but not supported
        this._showToast('Compression not supported by this browser — exporting plain JSON', 'info', 3000);
      }

      // Plain JSON export fallback
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const name = `sider-save-${now.toISOString().replace(/[:.]/g,'-')}.json`;
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      this._showToast('Export started', 'success', 2000);
      this._setStatus(`Exported • ${now.toLocaleTimeString()}`);
    } catch (e) {
      console.error('Export failed', e);
      this._showToast('Export failed', 'error', 3000);
    }
  }

  /**
   * Handle file input change event for importing a save file.
   * Shows a confirmation modal before performing the actual import to avoid accidental overwrites.
   * @param {Event} e
   * @private
   */
  _handleFileImport(e) {
    const input = e.target;
    if (!input || !input.files || input.files.length === 0) return;
    const file = input.files[0];
    // store pending file and show confirmation modal
    this._pendingImportFile = file;
    this._showImportConfirmation(file);
  }

  /**
   * Create the import confirmation modal and attach handlers.
   * The modal is hidden by default and shown via _showImportConfirmation().
   * Before performing import it creates an automatic backup of current world state.
   * @private
   */
  _createImportConfirmationModal() {
    if (document.getElementById('import-confirm-overlay')) return;

    const overlay = document.createElement('div');
    overlay.id = 'import-confirm-overlay';
    overlay.style.position = 'fixed';
    overlay.style.left = '0';
    overlay.style.top = '0';
    overlay.style.width = '100vw';
    overlay.style.height = '100vh';
    overlay.style.background = 'rgba(2,6,23,0.6)';
    overlay.style.display = 'none';
    overlay.style.zIndex = '10001';
    overlay.style.alignItems = 'center';
    overlay.style.justifyContent = 'center';

    const panel = document.createElement('div');
    panel.id = 'import-confirm-panel';
    panel.style.width = '360px';
    panel.style.maxWidth = '92%';
    panel.style.background = '#0b1220';
    panel.style.color = '#e6eef8';
    panel.style.padding = '16px';
    panel.style.borderRadius = '10px';
    panel.style.boxShadow = '0 10px 30px rgba(0,0,0,0.6)';
    panel.style.fontFamily = 'Inter, system-ui, Arial, sans-serif';

    const title = document.createElement('div');
    title.textContent = 'Import Save — Confirm';
    title.style.fontWeight = '600';
    title.style.marginBottom = '8px';

    const fileInfo = document.createElement('div');
    fileInfo.id = 'import-file-info';
    fileInfo.style.fontSize = '13px';
    fileInfo.style.opacity = '0.95';
    fileInfo.style.marginBottom = '10px';

    const warn = document.createElement('div');
    warn.textContent = 'Importing will overwrite the current world in memory. A backup will be created automatically.';
    warn.style.fontSize = '12px';
    warn.style.color = '#ffdce0';
    warn.style.marginBottom = '12px';

    const buttons = document.createElement('div');
    buttons.style.display = 'flex';
    buttons.style.justifyContent = 'flex-end';
    buttons.style.gap = '8px';

    const cancelBtn = document.createElement('button');
    cancelBtn.id = 'import-cancel';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.style.padding = '8px 10px';
    cancelBtn.style.borderRadius = '8px';
    cancelBtn.style.background = 'transparent';
    cancelBtn.style.color = '#fff';
    cancelBtn.style.border = '1px solid rgba(255,255,255,0.06)';
    cancelBtn.style.cursor = 'pointer';

    const confirmBtn = document.createElement('button');
    confirmBtn.id = 'import-confirm';
    confirmBtn.textContent = 'Confirm Import';
    confirmBtn.style.padding = '8px 10px';
    confirmBtn.style.borderRadius = '8px';
    confirmBtn.style.background = 'linear-gradient(180deg,#2b6cb0,#2c5282)';
    confirmBtn.style.color = '#fff';
    confirmBtn.style.border = 'none';
    confirmBtn.style.cursor = 'pointer';

    buttons.appendChild(cancelBtn);
    buttons.appendChild(confirmBtn);

    panel.appendChild(title);
    panel.appendChild(fileInfo);
    panel.appendChild(warn);
    panel.appendChild(buttons);
    overlay.appendChild(panel);
    document.body.appendChild(overlay);

    // Event handlers
    const closeModal = () => {
      overlay.style.display = 'none';
      this._pendingImportFile = null;
      // reset file input so the same file can be selected again
      const input = document.getElementById('save-file-input');
      if (input) input.value = '';
    };

    cancelBtn.addEventListener('click', () => {
      closeModal();
      this._showToast('Import cancelled', 'info', 1300);
    });

    /**
     * Confirm import flow:
     * 1. Create an automatic backup of current world to localStorage
     * 2. Process the imported file (possibly using worker for large gz)
     */
    confirmBtn.addEventListener('click', async () => {
      overlay.style.display = 'none';
      if (!this._pendingImportFile) {
        this._showToast('No file selected', 'error', 1800);
        return;
      }
      try {
        // create backup before import
        const backed = this._saveBackup();
        if (backed) {
          this._showToast('Backup created before import', 'success', 1800);
        } else {
          this._showToast('Backup failed (localStorage may be full)', 'error', 2200);
        }
        await this._processImportFile(this._pendingImportFile);
      } finally {
        this._pendingImportFile = null;
        const input = document.getElementById('save-file-input');
        if (input) input.value = '';
      }
    });

    // allow ESC to cancel
    window.addEventListener('keydown', (ev) => {
      if (ev.key === 'Escape' && overlay.style.display === 'flex') {
        closeModal();
      }
    });

    // store references for later use
    this._importConfirmOverlay = overlay;
    this._importConfirmFileInfo = fileInfo;
  }

  /**
   * Show the import confirmation modal populated with file metadata.
   * @param {File} file
   * @private
   */
  _showImportConfirmation(file) {
    if (!this._importConfirmOverlay || !this._importConfirmFileInfo) return;
    const sizeKb = (file.size / 1024).toFixed(1);
    this._importConfirmFileInfo.textContent = `${file.name} — ${sizeKb} KB`;
    this._importConfirmOverlay.style.display = 'flex';
  }

  /**
   * Save an automatic backup of the current world into localStorage.
   * Returns true on success, false on failure (e.g. storage quota).
   * @returns {boolean}
   * @private
   */
  _saveBackup() {
    if (!this.world) return false;
    try {
      const data = this.world.export();
      const payload = JSON.stringify({ ts: Date.now(), data });
      localStorage.setItem(this._backupKey, payload);
      this._setStatus(`Backup saved • ${new Date().toLocaleTimeString()}`);
      return true;
    } catch (err) {
      console.error('Backup save failed', err);
      return false;
    }
  }

  /**
   * Restore backup stored in localStorage (if exists) by importing it into the world.
   * Shows user feedback via toasts. Does nothing if no backup found.
   * @private
   */
  _restoreBackup() {
    try {
      const raw = localStorage.getItem(this._backupKey);
      if (!raw) {
        this._showToast('No backup available', 'info', 1800);
        return;
      }
      const parsed = JSON.parse(raw);
      if (!parsed || !parsed.data) {
        throw new Error('Malformed backup');
      }
      this.world.import(parsed.data);
      this._showToast('Backup restored', 'success', 2200);
      this._setStatus(`Backup restored • ${new Date(parsed.ts).toLocaleTimeString()}`);
    } catch (err) {
      console.error('Restore failed', err);
      this._showToast('Restore failed', 'error', 3000);
    }
  }

  /**
   * Read and process the imported file, validate and import into the world.
   * Supports plain JSON and gzipped JSON (.gz).
   * For large .gz files, uses a web worker to decompress to avoid blocking the main thread.
   * @param {File} file
   * @returns {Promise<void>}
   * @private
   */
  async _processImportFile(file) {
    try {
      const isGzByName = typeof file.name === 'string' && file.name.toLowerCase().endsWith('.gz');
      const isGzByType = file.type === 'application/gzip' || file.type === 'application/x-gzip' || file.type === 'application/octet-stream';
      const isGz = isGzByName || isGzByType;

      let txt;

      if (isGz) {
        // If file is large and worker is available, offload decompression to worker
        const LARGE_THRESHOLD = 1 * 1024 * 1024; // 1MB
        if (file.size >= LARGE_THRESHOLD && typeof Worker !== 'undefined') {
          // Use worker approach if DecompressionStream is supported in worker (worker will check)
          try {
            const arrayBuffer = await file.arrayBuffer();
            // Create worker relative path (worker file added at js/decompress.worker.js)
            const worker = new Worker('js/decompress.worker.js');
            txt = await new Promise((resolve, reject) => {
              const timeout = setTimeout(() => {
                worker.terminate();
                reject(new Error('Decompression worker timed out'));
              }, 30000); // 30s timeout for worker

              worker.addEventListener('message', (ev) => {
                clearTimeout(timeout);
                const d = ev.data;
                if (d && d.ok) {
                  resolve(d.text);
                } else {
                  const err = d && d.error ? d.error : 'Worker decompression failed';
                  reject(new Error(err));
                }
                worker.terminate();
              });

              worker.addEventListener('error', (err) => {
                clearTimeout(timeout);
                worker.terminate();
                reject(err || new Error('Worker error'));
              });

              // Transfer the ArrayBuffer to the worker
              worker.postMessage({ type: 'decompress', buffer: arrayBuffer }, [arrayBuffer]);
            });
          } catch (err) {
            console.error('Worker decompression failed', err);
            this._showToast('Decompression failed — import aborted', 'error', 3500);
            return;
          }
        } else if (typeof DecompressionStream === 'function') {
          // Small gz or worker unavailable: decompress on main thread via DecompressionStream
          try {
            const ds = new DecompressionStream('gzip');
            const stream = file.stream().pipeThrough(ds);
            txt = await new Response(stream).text();
          } catch (err) {
            console.error('Main-thread decompression failed', err);
            this._showToast('Decompression failed — import aborted', 'error', 3500);
            return;
          }
        } else {
          // No decompression support
          this._showToast('Cannot import .gz: browser lacks DecompressionStream support', 'error', 3800);
          return;
        }
      } else {
        // Plain JSON
        try {
          txt = await file.text();
        } catch (err) {
          console.error('File read failed', err);
          this._showToast('File read failed', 'error', 3000);
          return;
        }
      }

      // Parse and validate JSON
      let parsed;
      try {
        parsed = JSON.parse(txt);
      } catch (err) {
        console.error('JSON parse error', err);
        this._showToast('Import failed: invalid JSON', 'error', 3500);
        return;
      }

      if (!parsed || typeof parsed !== 'object' || (!parsed.chunks && !parsed.seed && !parsed.chunkSize)) {
        this._showToast('Import failed: invalid save format', 'error', 3500);
        return;
      }

      // perform import
      this.world.import(parsed);
      this._showToast('Import successful', 'success', 2500);
      this._setStatus(`Imported • ${new Date().toLocaleTimeString()}`);
    } catch (err) {
      console.error('Import failed', err);
      this._showToast('Import failed: unexpected error', 'error', 3500);
    }
  }

  /**
   * Update save panel status text.
   * @param {string} txt
   * @private
   */
  _setStatus(txt) {
    const s = document.getElementById('save-status');
    if (s) s.textContent = txt;
  }

  /**
   * Per-frame update
   * @param {number} dt
   */
  update(dt){
    // update weather display
    const w = document.getElementById('weather');
    if (w) w.textContent = this.engine.weather || 'Clear';
    // optionally update save status timestamp if nothing else
    const s = document.getElementById('save-status');
    if (s && this._lastSaved && s.textContent.indexOf('Saved') === -1 && s.textContent.indexOf('Autosaved') === -1) {
      // keep existing status if user set it; do not overwrite frequently
    }
  }
}