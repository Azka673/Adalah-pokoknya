/**
 * File: js/engine.js
 * Purpose: Wraps Three.js renderer, scene, camera, lights and main loop. Handles day-night cycle and basic weather.
 */

/**
 * @module Engine
 */
import * as THREE from 'https://unpkg.com/three@0.152.2/build/three.module.js';
import { PointerLockControls } from 'https://unpkg.com/three@0.152.2/examples/jsm/controls/PointerLockControls.js';

/**
 * Class Engine
 * Manages Three.js scene, renderer, basic environment (day-night and weather)
 */
export class Engine {
  /**
   * Create Engine
   * @param {HTMLCanvasElement} canvas
   */
  constructor(canvas) {
    /** @type {HTMLCanvasElement} */
    this.canvas = canvas;
    /** @type {THREE.Scene} */
    this.scene = new THREE.Scene();
    /** @type {THREE.PerspectiveCamera} */
    this.camera = new THREE.PerspectiveCamera(75, window.innerWidth/window.innerHeight, 0.1, 1000);
    this.camera.position.set(0, 5, 10);

    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;

    // Lighting
    this.ambient = new THREE.AmbientLight(0xffffff, 0.6);
    this.scene.add(this.ambient);

    this.sun = new THREE.DirectionalLight(0xfff4d6, 0.9);
    this.sun.position.set(50, 80, 0);
    this.sun.castShadow = true;
    this.scene.add(this.sun);

    // Fog for atmosphere
    this.scene.fog = new THREE.FogExp2(0x9fbbe6, 0.002);

    // Controls (pointer lock)
    this.controls = new PointerLockControls(this.camera, document.body);
    this._setupPointerLock();

    // Ground helper axis
    const grid = new THREE.GridHelper(200, 40, 0x2b3b4f, 0x20303f);
    grid.material.opacity = 0.25;
    grid.material.transparent = true;
    this.scene.add(grid);

    // Time variables
    this.time = 6 * 60 * 60; // seconds, start at 6:00
    this.timeSpeed = 30; // how many in-game seconds pass per real second

    // Weather
    this.weather = 'clear'; // clear, rain, storm
    this._updateSkyColors();

    // Loop
    this._last = performance.now();
    this._running = false;
    this._userUpdate = null;

    window.addEventListener('resize', () => this._onResize());
  }

  /**
   * Set per-frame update callback
   * @param {function(number):void} fn
   */
  setUpdate(fn) { this._userUpdate = fn; }

  /**
   * Start the engine loop
   */
  start() {
    this._running = true;
    this._last = performance.now();
    this._loop();
  }

  /**
   * Internal loop
   * @private
   */
  _loop() {
    if (!this._running) return;
    const now = performance.now();
    const dt = (now - this._last) / 1000;
    this._last = now;

    // advance time
    this.time += dt * this.timeSpeed;
    if (this.time >= 24*3600) this.time -= 24*3600;
    this._updateDayNight();

    if (this._userUpdate) this._userUpdate(dt);
    this.renderer.render(this.scene, this.camera);
    requestAnimationFrame(() => this._loop());
  }

  /**
   * Update lighting/colors according to time and weather
   * @private
   */
  _updateDayNight() {
    const t = this.time / (24*3600); // 0..1
    // simple sun angle
    const angle = t * Math.PI * 2;
    this.sun.position.set(Math.cos(angle)*80, Math.sin(angle)*80, 0);
    // ambient intensity vary
    const dayFactor = Math.max(0.15, Math.sin(angle)*0.8 + 0.2);
    this.ambient.intensity = 0.2 + 0.8 * dayFactor;
    this.sun.intensity = Math.max(0.1, dayFactor);
    this._updateSkyColors();
    // update HUD
    const hours = Math.floor(this.time/3600);
    const mins = Math.floor((this.time%3600)/60);
    const el = document.getElementById('time');
    if (el) el.textContent = `Day 1 • ${String(hours).padStart(2,'0')}:${String(mins).padStart(2,'0')}`;
  }

  /**
   * Apply sky/fog color depending on weather and time
   * @private
   */
  _updateSkyColors() {
    // compute color blend day/night
    const t = this.time / (24*3600);
    const dayFactor = Math.max(0, Math.sin(t*Math.PI*2)*0.7 + 0.3);
    const skyDay = new THREE.Color(0x8fc7ff);
    const skyNight = new THREE.Color(0x081028);
    const skyColor = skyNight.lerp(skyDay, dayFactor);
    this.renderer.setClearColor(skyColor);
    this.scene.fog.color.copy(skyColor);
  }

  /**
   * Resize handler
   * @private
   */
  _onResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  /**
   * Setup pointer lock to allow first-person controls
   * @private
   */
  _setupPointerLock() {
    const intro = document.getElementById('intro');
    const startBtn = document.getElementById('start-btn');
    const canvas = this.canvas;
    startBtn.addEventListener('click', () => {
      intro.style.display = 'none';
      this.controls.lock();
    });
    // unlock also shows intro if needed
    this.controls.addEventListener('unlock', () => {
      // show intro panel on unlock
      intro.style.display = 'block';
    });
  }
}