/**
 * File: js/save.js
 * Purpose: Provide chunk compression utilities (RLE) and simple local save/load helpers.
 *
 * Exports:
 *  - compressChunk(blocks: Uint8Array): string  // base64 compressed RLE
 *  - decompressChunk(str: string): Uint8Array
 *  - class Save { saveToLocal(obj), loadFromLocal(), exportToFile(obj), importFromFile(file, cb) }
 */

 /**
  * Convert a Uint8Array to a base64 string.
  * @param {Uint8Array} bytes
  * @returns {string}
  */
 function _u8ToBase64(bytes) {
   let bin = '';
   const chunk = 0x8000;
   for (let i = 0; i < bytes.length; i += chunk) {
     const sub = bytes.subarray(i, i + chunk);
     bin += String.fromCharCode.apply(null, sub);
   }
   return btoa(bin);
 }

 /**
  * Convert base64 string back to Uint8Array.
  * @param {string} str
  * @returns {Uint8Array}
  */
 function _base64ToU8(str) {
   const bin = atob(str);
   const len = bin.length;
   const bytes = new Uint8Array(len);
   for (let i = 0; i < len; i++) bytes[i] = bin.charCodeAt(i);
   return bytes;
 }

 /**
  * Compress a chunk Uint8Array using simple RLE.
  * Format: sequence of triples [value (1 byte), count_low (1), count_high (1)] where count = low + high*256.
  * Runs longer than 65535 are split.
  * Output is base64 string of the compressed bytes.
  *
  * @param {Uint8Array} blocks
  * @returns {string} base64 compressed payload
  */
 export function compressChunk(blocks) {
   if (!(blocks instanceof Uint8Array)) blocks = new Uint8Array(blocks);
   const out = [];
   const n = blocks.length;
   let i = 0;
   while (i < n) {
     const v = blocks[i];
     let run = 1;
     i++;
     while (i < n && blocks[i] === v && run < 0xFFFF) {
       run++; i++;
     }
     // encode as triple(s)
     let remaining = run;
     while (remaining > 0) {
       const chunkRun = Math.min(remaining, 0xFFFF);
       out.push(v & 0xFF);
       out.push(chunkRun & 0xFF);
       out.push((chunkRun >> 8) & 0xFF);
       remaining -= chunkRun;
     }
   }
   return _u8ToBase64(new Uint8Array(out));
 }

 /**
  * Decompress base64 RLE produced by compressChunk back into Uint8Array.
  * @param {string} compressedBase64
  * @returns {Uint8Array}
  */
 export function decompressChunk(compressedBase64) {
   if (!compressedBase64) return new Uint8Array(0);
   const bytes = _base64ToU8(compressedBase64);
   const out = [];
   for (let i = 0; i < bytes.length; i += 3) {
     const v = bytes[i];
     const low = bytes[i + 1];
     const high = bytes[i + 2];
     const count = low + (high << 8);
     for (let k = 0; k < count; k++) out.push(v);
   }
   return new Uint8Array(out);
 }

 /**
  * Save helper class for localStorage and file export/import.
  */
 export class Save {
   /**
    * @param {string} key Storage key
    */
   constructor(key = 'voxel_world_v1') {
     /** @type {string} */
     this.key = key;
     /** @type {number} */
     this.lastSaved = 0;
   }

   /**
    * Save world object to localStorage (stringified).
    * @param {any} worldData
    */
   saveToLocal(worldData) {
     try {
       const str = JSON.stringify(worldData);
       localStorage.setItem(this.key, str);
       this.lastSaved = Date.now();
     } catch (e) {
       console.error('Save failed', e);
       throw e;
     }
   }

   /**
    * Load world object from localStorage.
    * @returns {any|null}
    */
   loadFromLocal() {
     try {
       const s = localStorage.getItem(this.key);
       if (!s) return null;
       return JSON.parse(s);
     } catch (e) {
       console.error('Load failed', e);
       return null;
     }
   }

   /**
    * Export world to a downloadable JSON file.
    * @param {any} worldData
    */
   exportToFile(worldData) {
     try {
       const blob = new Blob([JSON.stringify(worldData)], { type: 'application/json' });
       const a = document.createElement('a');
       a.href = URL.createObjectURL(blob);
       a.download = `world-${Date.now()}.json`;
       document.body.appendChild(a);
       a.click();
       a.remove();
       setTimeout(() => URL.revokeObjectURL(a.href), 1000);
     } catch (e) {
       console.error('Export failed', e);
     }
   }

   /**
    * Import world from a File object asynchronously.
    * @param {File} file
    * @param {(err:Error|null, data:any|null) => void} cb
    */
   importFromFile(file, cb) {
     const r = new FileReader();
     r.onload = () => {
       try {
         const data = JSON.parse(String(r.result));
         cb(null, data);
       } catch (e) {
         cb(e, null);
       }
     };
     r.onerror = (e) => cb(e, null);
     r.readAsText(file);
   }
 }

 export default Save;