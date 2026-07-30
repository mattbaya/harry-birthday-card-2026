/**
 * Boppers Engine — reusable core for Harry's Boppers composed vidtracks.
 *
 * Guiding principles:
 *  - Human composition first: cues and lyrics are authored, not generated.
 *  - Real-time audio analysis is an accent, not the driver.
 *  - No build step: vanilla JS, loaded with a <script> tag.
 */

(function (global) {
    'use strict';

    // ============================================================
    // BoppersScene — reusable Three.js setup
    // ============================================================
    class BoppersScene {
        constructor(options = {}) {
            this.container = options.container || document.body;
            this.background = options.background || 0x0a0a15;
            this.cameraFov = options.cameraFov || 75;
            this.cameraZ = options.cameraZ || 30;
            this.cameraY = options.cameraY || 5;
            this.showGrid = options.showGrid !== false;

            this.scene = new THREE.Scene();
            this.scene.background = new THREE.Color(this.background);

            this.camera = new THREE.PerspectiveCamera(
                this.cameraFov,
                window.innerWidth / window.innerHeight,
                0.1,
                1000
            );
            this.camera.position.set(0, this.cameraY, this.cameraZ);

            // Some privacy-hardened browsers block antialiased WebGL contexts.
            // Try with antialias first, then fall back to the simplest possible
            // context before giving up.
            try {
                this.renderer = new THREE.WebGLRenderer({ antialias: true });
            } catch (e) {
                try {
                    this.renderer = new THREE.WebGLRenderer({ antialias: false });
                } catch (e2) {
                    throw new Error('Error creating WebGL context');
                }
            }
            this.renderer.setSize(window.innerWidth, window.innerHeight);
            this.container.appendChild(this.renderer.domElement);

            this.ambientLight = new THREE.AmbientLight(0x404040, 0.5);
            this.scene.add(this.ambientLight);

            this.directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
            this.directionalLight.position.set(10, 20, 10);
            this.scene.add(this.directionalLight);

            if (this.showGrid) {
                this.gridHelper = new THREE.GridHelper(50, 20, 0x222244, 0x111133);
                this.gridHelper.position.y = -5;
                this.scene.add(this.gridHelper);
            }

            this.root = new THREE.Group();
            this.scene.add(this.root);

            this.resizeHandler = () => this._onResize();
            window.addEventListener('resize', this.resizeHandler);
        }

        _onResize() {
            this.camera.aspect = window.innerWidth / window.innerHeight;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(window.innerWidth, window.innerHeight);
        }

        render() {
            this.renderer.render(this.scene, this.camera);
        }

        destroy() {
            window.removeEventListener('resize', this.resizeHandler);
            this.renderer.dispose();
            if (this.renderer.domElement.parentNode) {
                this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
            }
        }
    }

    // ============================================================
    // BoppersPlayer — audio playback with precise timing
    // ============================================================
    class BoppersPlayer {
        constructor(audioUrl, options = {}) {
            this.audioUrl = audioUrl;
            // Use an existing <audio id="boppersAudio"> element if present;
            // some privacy-hardened browsers trust a declared media element
            // more than one created dynamically in JS.
            this.audio = options.audioElement || (typeof document !== 'undefined' && document.getElementById('boppersAudio')) || new Audio(audioUrl);
            if (!this.audio.getAttribute('src')) {
                this.audio.src = audioUrl;
            }
            // Same-origin audio; leave crossOrigin unset so privacy-hardened
            // browsers don't apply extra CORS restrictions.
            this.audioContext = null;
            this.analyser = null;
            this.source = null;
            this.isPlaying = false;
            this._startedAt = 0;
            this._callbacks = {
                play: [],
                pause: [],
                ended: [],
                seek: [],
                error: []
            };

            this.audio.addEventListener('play', () => {
                this.isPlaying = true;
                this._emit('play');
            });
            this.audio.addEventListener('pause', () => {
                this.isPlaying = false;
                this._emit('pause');
            });
            this.audio.addEventListener('ended', () => {
                this.isPlaying = false;
                this._emit('ended');
            });
            this.audio.addEventListener('error', (e) => this._emit('error', e));
        }

        on(event, cb) {
            if (this._callbacks[event]) this._callbacks[event].push(cb);
            return this;
        }

        _emit(event, ...args) {
            if (this._callbacks[event]) {
                this._callbacks[event].forEach(cb => cb(...args));
            }
        }

        async unlock() {
            if (!this.audioContext) {
                this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            }
            if (this.audioContext.state === 'suspended') {
                await this.audioContext.resume();
            }
        }

        enableAnalysis(fftSize = 512) {
            if (!this.audioContext) this.unlock();
            if (!this.audioContext) return null;
            if (!this.analyser) {
                try {
                    this.analyser = this.audioContext.createAnalyser();
                    this.analyser.fftSize = fftSize;
                    if (!this.source) {
                        this.source = this.audioContext.createMediaElementSource(this.audio);
                        this.source.connect(this.analyser);
                        this.analyser.connect(this.audioContext.destination);
                    }
                } catch (e) {
                    // Some privacy-hardened browsers block Web Audio analysis.
                    // Disable analysis but let playback continue.
                    console.warn('Boppers: Web Audio analysis unavailable', e);
                    this.analyser = null;
                }
            }
            return this.analyser;
        }

        play() {
            // Start playback immediately so it stays inside a user-gesture stack
            // (required by stricter browsers like Brave). Unlock the audio context
            // in parallel; if it fails, playback still continues.
            const playPromise = this.audio.play();
            this.unlock().catch(() => {});
            playPromise.catch((e) => this._emit('error', e));
            return playPromise;
        }

        pause() {
            this.audio.pause();
        }

        toggle() {
            if (this.isPlaying) this.pause();
            else this.play();
        }

        seek(time) {
            this.audio.currentTime = Math.max(0, Math.min(time, this.audio.duration || time));
            this._emit('seek', this.audio.currentTime);
        }

        get currentTime() {
            return this.audio.currentTime;
        }

        get duration() {
            return this.audio.duration || 0;
        }

        destroy() {
            this.pause();
            if (this.source) {
                try { this.source.disconnect(); } catch (e) {}
            }
            if (this.analyser) {
                try { this.analyser.disconnect(); } catch (e) {}
            }
            if (this.audioContext && this.audioContext.state !== 'closed') {
                try { this.audioContext.close(); } catch (e) {}
            }
        }
    }

    // ============================================================
    // BoppersAudioAnalyzer — FFT band energies and beat accents
    // ============================================================
    class BoppersAudioAnalyzer {
        constructor(player, options = {}) {
            this.player = player;
            this._fftSize = options.fftSize || 512;
            this.smoothing = options.smoothing || 0.8;
            this.bassRange = options.bassRange || [0, 0.1];
            this.midRange = options.midRange || [0.1, 0.4];
            this.trebleRange = options.trebleRange || [0.4, 1.0];
            this._lastBass = 0;
            this._beatCooldown = 0;
            this._bands = { bass: 0, mid: 0, treble: 0 };
            this.analyser = null;
            this.dataArray = null;
        }

        enable() {
            if (this.analyser) return this.analyser;
            this.analyser = this.player.enableAnalysis(this._fftSize);
            if (this.analyser) {
                this.dataArray = new Uint8Array(this.analyser.frequencyBinCount);
            }
            return this.analyser;
        }

        update() {
            if (!this.analyser || !this.dataArray) return this._bands;
            this.analyser.getByteFrequencyData(this.dataArray);

            const binCount = this.dataArray.length;
            const bassEnd = Math.floor(binCount * this.bassRange[1]);
            const midEnd = Math.floor(binCount * this.midRange[1]);

            let bassSum = 0, midSum = 0, trebleSum = 0;
            for (let i = 0; i < bassEnd; i++) bassSum += this.dataArray[i];
            for (let i = bassEnd; i < midEnd; i++) midSum += this.dataArray[i];
            for (let i = midEnd; i < binCount; i++) trebleSum += this.dataArray[i];

            const raw = {
                bass: bassSum / bassEnd / 255,
                mid: midSum / (midEnd - bassEnd) / 255,
                treble: trebleSum / (binCount - midEnd) / 255
            };

            // Smooth
            this._bands.bass = this._bands.bass * this.smoothing + raw.bass * (1 - this.smoothing);
            this._bands.mid = this._bands.mid * this.smoothing + raw.mid * (1 - this.smoothing);
            this._bands.treble = this._bands.treble * this.smoothing + raw.treble * (1 - this.smoothing);

            if (this._beatCooldown > 0) this._beatCooldown--;

            return this._bands;
        }

        get bands() {
            return this._bands;
        }

        detectBeat(threshold = 0.55, delta = 0.08, cooldownFrames = 12) {
            const bass = this._bands.bass;
            if (this._beatCooldown === 0 && bass > threshold && bass > this._lastBass + delta) {
                this._beatCooldown = cooldownFrames;
                this._lastBass = bass;
                return true;
            }
            this._lastBass = bass;
            return false;
        }
    }

    // ============================================================
    // BoppersTimeline — sorted cue list with seek-safe dispatch
    // ============================================================
    class BoppersTimeline {
        constructor() {
            this.cues = [];
            this._index = 0;
            this._lastTime = -1;
            this._handlers = {};
        }

        load(cues) {
            this.cues = (cues || []).slice().sort((a, b) => a.time - b.time);
            this.reset();
            return this;
        }

        reset() {
            this._index = 0;
            this._lastTime = -1;
        }

        on(action, handler) {
            if (!this._handlers[action]) this._handlers[action] = [];
            this._handlers[action].push(handler);
            return this;
        }

        _dispatch(cue) {
            if (this._handlers[cue.action]) {
                this._handlers[cue.action].forEach(h => h(cue.params, cue));
            }
            if (this._handlers['*']) {
                this._handlers['*'].forEach(h => h(cue));
            }
        }

        update(currentTime) {
            // Handle seek backwards: if time moved back, reset index
            if (currentTime < this._lastTime) {
                this._index = 0;
            }
            this._lastTime = currentTime;

            while (this._index < this.cues.length && this.cues[this._index].time <= currentTime) {
                this._dispatch(this.cues[this._index]);
                this._index++;
            }
        }

        add(cue) {
            this.cues.push(cue);
            this.cues.sort((a, b) => a.time - b.time);
            // Reset if needed so added cues before current time fire correctly
            this.reset();
        }
    }

    // ============================================================
    // BoppersLyricsRenderer — display timed lyrics
    // ============================================================
    class BoppersLyricsRenderer {
        constructor(container, options = {}) {
            this.container = typeof container === 'string' ? document.getElementById(container) : container;
            this.lines = [];
            this.currentIndex = -1;
            this.offset = options.offset || 0;
            this.activeClass = options.activeClass || 'active';
            this.pastClass = options.pastClass || 'past';
            this.futureClass = options.futureClass || 'future';

            if (this.container) {
                this.container.classList.add('boppers-lyrics');
            }
        }

        load(data) {
            this.lines = (data.lines || []).slice().sort((a, b) => a.time - b.time);
            this.duration = data.duration || (this.lines.length ? this.lines[this.lines.length - 1].end : 0);
            this.currentIndex = -1;
            this.render();
            return this;
        }

        setOffset(seconds) {
            this.offset = seconds;
        }

        update(currentTime) {
            const t = currentTime + this.offset;
            let idx = -1;
            for (let i = 0; i < this.lines.length; i++) {
                if (t >= this.lines[i].time && t < this.lines[i].end) {
                    idx = i;
                    break;
                }
                if (i === this.lines.length - 1 && t >= this.lines[i].time) {
                    idx = i;
                }
            }

            if (idx !== this.currentIndex) {
                this.currentIndex = idx;
                this.render();
            }
        }

        render() {
            if (!this.container) return;
            this.container.innerHTML = '';

            // Render a window of lines around current
            const start = Math.max(0, this.currentIndex - 1);
            const end = Math.min(this.lines.length, this.currentIndex + 3);

            for (let i = start; i < end; i++) {
                const line = this.lines[i];
                const el = document.createElement('div');
                el.className = 'lyric-line';
                el.textContent = line.text;
                if (i === this.currentIndex) el.classList.add(this.activeClass);
                else if (i < this.currentIndex) el.classList.add(this.pastClass);
                else el.classList.add(this.futureClass);
                this.container.appendChild(el);
            }
        }
    }

    // ============================================================
    // BoppersPath — parametric and custom 3D paths
    // ============================================================
    class BoppersPath {
        constructor(type, options = {}) {
            this.type = type || 'custom';
            this.options = options;
            this.center = Object.assign({ x: 0, y: 0, z: 0 }, options.center);
            this.scale = Object.assign({ x: 1, y: 1, z: 1 }, options.scale);
            this.rotation = Object.assign({ x: 0, y: 0, z: 0 }, options.rotation);
            this.pointsQty = options.pointsQty || 100;
            this._rawPoints = options.points || [];
            this._points = [];
            this._lengths = [];
            this._totalLength = 0;
            this._generate();
        }

        _generate() {
            this._points = [];
            const n = this.pointsQty;
            for (let i = 0; i <= n; i++) {
                const t = i / n;
                this._points.push(this._parametricPoint(t));
            }
            this._computeLengths();
        }

        _parametricPoint(t) {
            if (this.type === 'custom') {
                // Interpolate along the supplied raw points.
                const pts = this._rawPoints;
                if (!pts.length) return { x: 0, y: 0, z: 0 };
                const scaled = t * (pts.length - 1);
                const idx = Math.floor(scaled);
                const frac = scaled - idx;
                const a = pts[Math.min(idx, pts.length - 1)];
                const b = pts[Math.min(idx + 1, pts.length - 1)];
                return {
                    x: a[0] + (b[0] - a[0]) * frac,
                    y: a[1] + (b[1] - a[1]) * frac,
                    z: a[2] + (b[2] - a[2]) * frac
                };
            }

            let p = { x: 0, y: 0, z: 0 };
            const s = this.scale;
            const c = this.center;

            switch (this.type) {
                case 'circle':
                    p.x = Math.cos(t * Math.PI * 2);
                    p.z = Math.sin(t * Math.PI * 2);
                    break;
                case 'ellipse':
                    p.x = Math.cos(t * Math.PI * 2);
                    p.z = Math.sin(t * Math.PI * 2);
                    break;
                case 'spiral':
                    {
                        const loops = this.options.loops || 3;
                        const r = t * 1.0;
                        p.x = r * Math.cos(t * Math.PI * 2 * loops);
                        p.z = r * Math.sin(t * Math.PI * 2 * loops);
                        p.y = t;
                    }
                    break;
                case 'figure8':
                    p.x = Math.sin(t * Math.PI * 2);
                    p.z = Math.sin(t * Math.PI * 4) * 0.5;
                    break;
                case 'sine':
                    {
                        const freq = this.options.frequency || 2;
                        p.x = (t - 0.5) * 2;
                        p.z = Math.sin(t * Math.PI * 2 * freq);
                    }
                    break;
                case 'square':
                    {
                        const side = Math.floor(t * 4) % 4;
                        const u = (t * 4) % 1;
                        if (side === 0) { p.x = -1 + u * 2; p.z = -1; }
                        else if (side === 1) { p.x = 1; p.z = -1 + u * 2; }
                        else if (side === 2) { p.x = 1 - u * 2; p.z = 1; }
                        else { p.x = -1; p.z = 1 - u * 2; }
                    }
                    break;
                case 'stair':
                    {
                        const steps = this.options.steps || 6;
                        const step = Math.floor(t * steps);
                        const u = (t * steps) - step;
                        p.x = (t - 0.5) * 2;
                        p.y = step / steps;
                        p.z = (u < 0.5) ? -0.5 : 0.5;
                    }
                    break;
                default:
                    break;
            }

            // Apply scale, rotation, center.
            p.x *= s.x; p.y *= s.y; p.z *= s.z;
            p = this._rotate(p, this.rotation);
            p.x += c.x; p.y += c.y; p.z += c.z;
            return p;
        }

        _rotate(p, r) {
            let x = p.x, y = p.y, z = p.z;
            // Rotate around X
            if (r.x) {
                const cos = Math.cos(r.x), sin = Math.sin(r.x);
                const ny = y * cos - z * sin;
                const nz = y * sin + z * cos;
                y = ny; z = nz;
            }
            // Rotate around Y
            if (r.y) {
                const cos = Math.cos(r.y), sin = Math.sin(r.y);
                const nx = x * cos + z * sin;
                const nz = -x * sin + z * cos;
                x = nx; z = nz;
            }
            // Rotate around Z
            if (r.z) {
                const cos = Math.cos(r.z), sin = Math.sin(r.z);
                const nx = x * cos - y * sin;
                const ny = x * sin + y * cos;
                x = nx; y = ny;
            }
            return { x, y, z };
        }

        _computeLengths() {
            this._lengths = [0];
            let len = 0;
            for (let i = 1; i < this._points.length; i++) {
                const a = this._points[i - 1], b = this._points[i];
                const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z;
                len += Math.sqrt(dx * dx + dy * dy + dz * dz);
                this._lengths.push(len);
            }
            this._totalLength = len;
        }

        // Return a point along the path, t in [0,1].
        getPoint(t) {
            if (!this._points.length) return { x: 0, y: 0, z: 0 };
            t = Math.max(0, Math.min(1, t));
            // Find segment by arc length for even speed distribution.
            const target = t * this._totalLength;
            let idx = 0;
            while (idx < this._lengths.length - 1 && this._lengths[idx + 1] < target) {
                idx++;
            }
            const a = this._points[idx];
            const b = this._points[Math.min(idx + 1, this._points.length - 1)];
            const segLen = this._lengths[idx + 1] - this._lengths[idx];
            const frac = segLen > 0 ? (target - this._lengths[idx]) / segLen : 0;
            return {
                x: a.x + (b.x - a.x) * frac,
                y: a.y + (b.y - a.y) * frac,
                z: a.z + (b.z - a.z) * frac
            };
        }

        getTangent(t, delta = 0.01) {
            const a = this.getPoint(Math.max(0, t - delta));
            const b = this.getPoint(Math.min(1, t + delta));
            const len = Math.sqrt((b.x - a.x) ** 2 + (b.y - a.y) ** 2 + (b.z - a.z) ** 2) || 1;
            return { x: (b.x - a.x) / len, y: (b.y - a.y) / len, z: (b.z - a.z) / len };
        }

        getTotalLength() {
            return this._totalLength;
        }

        getPoints() {
            return this._points.slice();
        }
    }

    // ============================================================
    // BoppersClock — stable time source
    // ============================================================
    class BoppersClock {
        constructor() {
            this._start = performance.now();
        }

        now() {
            return performance.now() * 0.001;
        }

        elapsed() {
            return this.now();
        }
    }

    // ============================================================
    // BoppersSymbol — font-symbol sprite for lyrics/scenes
    // ============================================================
    class BoppersSymbol {
        constructor(options = {}) {
            this.font = options.font || 'bold 180px sans-serif';
            this.size = options.size || 256;
            this.textColor = options.textColor || '#ffffff';
            this.bgColor = options.bgColor || null;
        }

        _makeCanvas(text) {
            const canvas = document.createElement('canvas');
            canvas.width = this.size;
            canvas.height = this.size;
            const ctx = canvas.getContext('2d');

            if (this.bgColor) {
                ctx.fillStyle = this.bgColor;
                ctx.fillRect(0, 0, this.size, this.size);
            }

            ctx.font = this.font;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = this.textColor;
            ctx.fillText(text, this.size / 2, this.size / 2 + this.size * 0.06);

            return canvas;
        }

        createMesh(text, options = {}) {
            const canvas = this._makeCanvas(text);
            const texture = new THREE.CanvasTexture(canvas);
            texture.needsUpdate = true;

            const scale = options.scale || 1;
            const depth = options.depth || 0.12;
            const colorHex = options.color ? parseInt(options.color.replace('#', ''), 16) : 0xfbbc04;
            const emissiveHex = options.emissive ? parseInt(options.emissive.replace('#', ''), 16) : 0x000000;

            const group = new THREE.Group();

            // Colored backing/coin so the symbol is visible even from a distance.
            const backingGeo = new THREE.BoxGeometry(scale * 1.1, scale * 1.1, depth);
            const backingMat = new THREE.MeshStandardMaterial({
                color: colorHex,
                roughness: 0.5,
                metalness: 0.3
            });
            const backing = new THREE.Mesh(backingGeo, backingMat);
            group.add(backing);

            // Front face with the glyph texture.
            const faceGeo = new THREE.PlaneGeometry(scale, scale);
            const faceMat = new THREE.MeshStandardMaterial({
                map: texture,
                transparent: true,
                alphaTest: 0.15,
                side: THREE.DoubleSide,
                emissive: emissiveHex,
                emissiveIntensity: options.emissiveIntensity || 0,
                roughness: 0.4,
                metalness: 0.1
            });
            const face = new THREE.Mesh(faceGeo, faceMat);
            face.position.z = depth / 2 + 0.005;
            group.add(face);

            // Duplicate the face on the back so the symbol is readable from behind.
            const backFace = face.clone();
            backFace.rotation.y = Math.PI;
            backFace.position.z = -depth / 2 - 0.005;
            group.add(backFace);

            return group;
        }
    }

    // ============================================================
    // Export
    // ============================================================
    global.BoppersScene = BoppersScene;
    global.BoppersPlayer = BoppersPlayer;
    global.BoppersAudioAnalyzer = BoppersAudioAnalyzer;
    global.BoppersTimeline = BoppersTimeline;
    global.BoppersLyricsRenderer = BoppersLyricsRenderer;
    global.BoppersClock = BoppersClock;
    global.BoppersPath = BoppersPath;
    global.BoppersSymbol = BoppersSymbol;

})(window);
