/**
 * Boppers Symbols — reusable composed-object factories for Harry's Boppers.
 *
 * Depends on THREE.js and BoppersSymbol from boppers-engine.js.
 * Returns THREE.Group (or Mesh) objects ready to be spawned by a demo.
 */
(function (global) {
    'use strict';

    const DEFAULT_OPTIONS = { scale: 1 };

    function _scale(options) {
        return (options && options.scale) || 1;
    }

    function _color(options, fallback) {
        return (options && options.color !== undefined) ? options.color : (fallback || 0xffffff);
    }

    function _toHex(color) {
        if (typeof color === 'number') return '#' + color.toString(16).padStart(6, '0');
        return color;
    }

    let _symbolFactory = null;
    function _getSymbolFactory() {
        if (!_symbolFactory) {
            _symbolFactory = new BoppersSymbol({ font: 'bold 180px sans-serif', size: 256 });
        }
        return _symbolFactory;
    }

    const BoppersSymbols = {
        // ============================================================
        // Glyph / billboard symbols ($, ♪, etc.)
        // ============================================================
        makeSymbolBillboard: function (char, options) {
            options = options || {};
            const scale = options.scale || 1;
            const colorHex = _toHex(_color(options, 0xffffff));
            const emissiveHex = options.emissive !== undefined ? _toHex(options.emissive) : colorHex;
            return _getSymbolFactory().createMesh(char || '$', {
                scale: scale,
                color: colorHex,
                emissive: emissiveHex,
                emissiveIntensity: options.emissiveIntensity !== undefined ? options.emissiveIntensity : 0.4,
                depth: options.depth
            });
        },

        // ============================================================
        // Coal chunk (single jagged piece)
        // ============================================================
        makeCoalChunk: function (options) {
            options = options || {};
            const s = _scale(options);
            const geometry = new THREE.TetrahedronGeometry(0.18 * s);
            const material = new THREE.MeshStandardMaterial({
                color: _color(options, 0x111111),
                roughness: 0.9
            });
            return new THREE.Mesh(geometry, material);
        },

        // ============================================================
        // Wheelbarrow full of coal
        // ============================================================
        makeWheelbarrow: function (options) {
            options = options || {};
            const color = _color(options, 0x8d6e63);
            const s = _scale(options);
            const group = new THREE.Group();
            const mat = new THREE.MeshStandardMaterial({ color: color, roughness: 0.6, metalness: 0.2 });
            const darkMat = new THREE.MeshStandardMaterial({ color: 0x332211, roughness: 0.9 });

            // Basin (tilted box)
            const basin = new THREE.Mesh(new THREE.BoxGeometry(2.4 * s, 0.8 * s, 1.4 * s), darkMat);
            basin.position.set(0, 0.2 * s, 0);
            basin.rotation.z = 0.15;
            group.add(basin);

            // Wheel
            const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.45 * s, 0.45 * s, 0.2 * s, 24), mat);
            wheel.rotation.x = Math.PI / 2;
            wheel.position.set(1.1 * s, -0.45 * s, 0);
            group.add(wheel);

            // Handles
            const handleGeo = new THREE.CylinderGeometry(0.06 * s, 0.06 * s, 2.2 * s, 8);
            const leftHandle = new THREE.Mesh(handleGeo, mat);
            leftHandle.position.set(-1.2 * s, 0.5 * s, 0.5 * s);
            leftHandle.rotation.z = -0.25;
            group.add(leftHandle);
            const rightHandle = new THREE.Mesh(handleGeo, mat);
            rightHandle.position.set(-1.2 * s, 0.5 * s, -0.5 * s);
            rightHandle.rotation.z = -0.25;
            group.add(rightHandle);

            // A small man pushing from behind
            const manMat = new THREE.MeshStandardMaterial({ color: 0x8d6e63, roughness: 0.7 });
            const manScale = s * 0.35;
            const man = new THREE.Group();
            const torso = new THREE.Mesh(new THREE.BoxGeometry(0.8 * manScale, 1.4 * manScale, 0.5 * manScale), manMat);
            torso.position.y = 0.7 * manScale;
            man.add(torso);
            const head = new THREE.Mesh(new THREE.SphereGeometry(0.3 * manScale, 12, 12), manMat);
            head.position.y = 1.55 * manScale;
            man.add(head);
            const limbGeo = new THREE.CylinderGeometry(0.12 * manScale, 0.12 * manScale, 1.2 * manScale, 8);
            const leftLeg = new THREE.Mesh(limbGeo, manMat);
            leftLeg.position.set(-0.25 * manScale, -0.6 * manScale, 0);
            man.add(leftLeg);
            const rightLeg = new THREE.Mesh(limbGeo, manMat);
            rightLeg.position.set(0.25 * manScale, -0.6 * manScale, 0);
            man.add(rightLeg);
            man.position.set(-1.8 * s, -0.1 * s, 0);
            man.rotation.y = -0.4;
            group.add(man);

            // 16 coal chunks inside the basin
            for (let i = 0; i < 16; i++) {
                const chunk = BoppersSymbols.makeCoalChunk({ scale: s });
                const row = Math.floor(i / 4);
                const col = i % 4;
                chunk.position.set(
                    -0.7 * s + col * 0.45 * s + (Math.random() - 0.5) * 0.1 * s,
                    0.5 * s + row * 0.22 * s,
                    -0.35 * s + (i % 2) * 0.7 * s + (Math.random() - 0.5) * 0.1 * s
                );
                chunk.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
                group.add(chunk);
            }

            return group;
        },

        // ============================================================
        // Human figure
        // ============================================================
        makeFigure: function (options) {
            options = options || {};
            const color = _color(options, 0x8d6e63);
            const s = _scale(options);
            const group = new THREE.Group();
            const mat = new THREE.MeshPhongMaterial({ color: color, shininess: 80 });

            // Torso
            const torso = new THREE.Mesh(new THREE.BoxGeometry(1.2 * s, 2.2 * s, 0.8 * s), mat);
            torso.position.set(0, 0, 0);
            group.add(torso);

            // Head
            const head = new THREE.Mesh(new THREE.SphereGeometry(0.5 * s, 16, 16), mat);
            head.position.set(0, 1.6 * s, 0);
            group.add(head);

            // Limbs
            const limbGeo = new THREE.CylinderGeometry(0.25 * s, 0.25 * s, 2 * s, 10);
            const leftArm = new THREE.Mesh(limbGeo, mat);
            leftArm.position.set(-0.9 * s, 0.3 * s, 0);
            leftArm.rotation.z = 0.3;
            group.add(leftArm);
            const rightArm = new THREE.Mesh(limbGeo, mat);
            rightArm.position.set(0.9 * s, 0.3 * s, 0);
            rightArm.rotation.z = -0.3;
            group.add(rightArm);
            const leftLeg = new THREE.Mesh(limbGeo, mat);
            leftLeg.position.set(-0.4 * s, -2.2 * s, 0);
            group.add(leftLeg);
            const rightLeg = new THREE.Mesh(limbGeo, mat);
            rightLeg.position.set(0.4 * s, -2.2 * s, 0);
            group.add(rightLeg);

            return group;
        },

        // ============================================================
        // Company store building
        // ============================================================
        makeCompanyStore: function (options) {
            options = options || {};
            const color = _color(options, 0x8d6e63);
            const s = _scale(options);
            const group = new THREE.Group();
            const mat = new THREE.MeshPhongMaterial({ color: color, shininess: 60 });
            const glowMat = new THREE.MeshPhongMaterial({ color: 0xe94560, emissive: 0xe94560, emissiveIntensity: 0.8 });

            // Main building
            const body = new THREE.Mesh(new THREE.BoxGeometry(4 * s, 5 * s, 3 * s), mat);
            body.position.set(0, 0, 0);
            group.add(body);

            // Roof
            const roof = new THREE.Mesh(new THREE.ConeGeometry(3 * s, 1.5 * s, 4), mat);
            roof.position.set(0, 3.25 * s, 0);
            roof.rotation.y = Math.PI / 4;
            group.add(roof);

            // Doorway (glowing red maw)
            const door = new THREE.Mesh(new THREE.BoxGeometry(1.4 * s, 2.4 * s, 0.3 * s), glowMat);
            door.position.set(0, -1 * s, 1.6 * s);
            group.add(door);

            // Sign beam
            const signBeam = new THREE.Mesh(new THREE.CylinderGeometry(0.1 * s, 0.1 * s, 2.5 * s, 8), mat);
            signBeam.rotation.z = Math.PI / 2;
            signBeam.position.set(0, 2.2 * s, 1.8 * s);
            group.add(signBeam);

            // Sign board
            const sign = new THREE.Mesh(new THREE.BoxGeometry(2.2 * s, 0.8 * s, 0.15 * s), mat);
            sign.position.set(0, 2.2 * s, 1.9 * s);
            group.add(sign);

            return group;
        },

        // ============================================================
        // Fist (raised hand)
        // ============================================================
        makeFist: function (options) {
            options = options || {};
            const color = _color(options, 0x8899a6);
            const s = _scale(options);
            const group = new THREE.Group();
            const mat = new THREE.MeshPhongMaterial({ color: color, shininess: 100 });

            // Palm/back of hand
            const palm = new THREE.Mesh(new THREE.BoxGeometry(3.2 * s, 3 * s, 1.2 * s), mat);
            palm.position.set(0, 0, 0);
            group.add(palm);

            // Fingers (4 cylinders)
            const fingerGeo = new THREE.CylinderGeometry(0.35 * s, 0.35 * s, 2.2 * s, 12);
            for (let i = 0; i < 4; i++) {
                const finger = new THREE.Mesh(fingerGeo, mat);
                finger.position.set(-1.05 * s + i * 0.7 * s, 2.2 * s, 0);
                group.add(finger);
            }

            // Thumb
            const thumb = new THREE.Mesh(new THREE.CylinderGeometry(0.4 * s, 0.4 * s, 1.6 * s, 12), mat);
            thumb.position.set(-1.8 * s, 0.5 * s, 0.2 * s);
            thumb.rotation.z = 0.6;
            group.add(thumb);

            // Wrist
            const wrist = new THREE.Mesh(new THREE.CylinderGeometry(0.9 * s, 0.9 * s, 1.8 * s, 12), mat);
            wrist.position.set(0, -2.2 * s, 0);
            group.add(wrist);

            return group;
        },

        // ============================================================
        // Shovel
        // ============================================================
        makeShovel: function (options) {
            options = options || {};
            const color = _color(options, 0x8d6e63);
            const s = _scale(options);
            const group = new THREE.Group();
            const mat = new THREE.MeshPhongMaterial({ color: color, shininess: 80 });

            // Handle (long cylinder)
            const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.15 * s, 0.15 * s, 5 * s, 12), mat);
            handle.position.set(0, 2.5 * s, 0);
            group.add(handle);

            // Blade (flattened box, angled)
            const blade = new THREE.Mesh(new THREE.BoxGeometry(1.6 * s, 2.2 * s, 0.25 * s), mat);
            blade.position.set(0, -0.8 * s, 0.2 * s);
            blade.rotation.x = 0.4;
            group.add(blade);

            // Blade point (wedge cone)
            const tip = new THREE.Mesh(new THREE.ConeGeometry(0.8 * s, 1.4 * s, 16), mat);
            tip.position.set(0, -2.2 * s, 0.5 * s);
            tip.rotation.x = 3.14;
            group.add(tip);

            // Footrest (small bar across top of blade)
            const rest = new THREE.Mesh(new THREE.CylinderGeometry(0.1 * s, 0.1 * s, 2 * s, 8), mat);
            rest.rotation.z = Math.PI / 2;
            rest.position.set(0, 0.2 * s, 0.4 * s);
            group.add(rest);

            return group;
        },

        // ============================================================
        // Mine entrance arch
        // ============================================================
        makeMineEntrance: function (options) {
            options = options || {};
            const color = _color(options, 0x8d6e63);
            const s = _scale(options);
            const group = new THREE.Group();
            const mat = new THREE.MeshPhongMaterial({ color: color, shininess: 60 });

            // Arch (half torus)
            const arch = new THREE.Mesh(new THREE.TorusGeometry(2 * s, 0.4 * s, 12, 32, Math.PI), mat);
            arch.position.set(0, 0, 0);
            group.add(arch);

            // Side posts
            const postGeo = new THREE.CylinderGeometry(0.4 * s, 0.4 * s, 4 * s, 12);
            const left = new THREE.Mesh(postGeo, mat);
            left.position.set(-2 * s, -2 * s, 0);
            group.add(left);
            const right = new THREE.Mesh(postGeo, mat);
            right.position.set(2 * s, -2 * s, 0);
            group.add(right);

            // Dark tunnel back
            const tunnel = new THREE.Mesh(new THREE.CylinderGeometry(1.8 * s, 1.8 * s, 4 * s, 16), new THREE.MeshPhongMaterial({ color: 0x050505 }));
            tunnel.rotation.z = Math.PI / 2;
            tunnel.position.set(0, -1 * s, -2 * s);
            group.add(tunnel);

            return group;
        },

        // ============================================================
        // Balance scale
        // ============================================================
        makeBalanceScale: function (options) {
            options = options || {};
            const color = _color(options, 0xffd700);
            const s = _scale(options);
            const group = new THREE.Group();
            const mat = new THREE.MeshPhongMaterial({ color: color, shininess: 80 });

            // Central pillar
            const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.15 * s, 0.25 * s, 4 * s, 10), mat);
            pillar.position.set(0, 0, 0);
            group.add(pillar);

            // Base
            const base = new THREE.Mesh(new THREE.CylinderGeometry(1.2 * s, 1.4 * s, 0.3 * s, 16), mat);
            base.position.set(0, -2 * s, 0);
            group.add(base);

            // Beam
            const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.08 * s, 0.08 * s, 5 * s, 8), mat);
            beam.rotation.z = Math.PI / 2;
            beam.position.set(0, 1.8 * s, 0);
            group.add(beam);

            // Pans (tori)
            const panGeo = new THREE.TorusGeometry(0.6 * s, 0.12 * s, 8, 24);
            const leftPan = new THREE.Mesh(panGeo, mat);
            leftPan.position.set(-2.2 * s, 1.2 * s, 0);
            leftPan.rotation.x = Math.PI / 2;
            group.add(leftPan);
            const rightPan = new THREE.Mesh(panGeo, mat);
            rightPan.position.set(2.2 * s, 1.2 * s, 0);
            rightPan.rotation.x = Math.PI / 2;
            group.add(rightPan);

            return group;
        },

        // ============================================================
        // Mud pool (flat cylinder)
        // ============================================================
        makeMudPool: function (options) {
            options = options || {};
            const color = _color(options, 0x8d6e63);
            const s = _scale(options);
            const group = new THREE.Group();
            const geometry = new THREE.CylinderGeometry(1 * s, 1 * s, 0.15, 32);
            const material = new THREE.MeshStandardMaterial({ color: color, roughness: 0.9, metalness: 0.0 });
            const mesh = new THREE.Mesh(geometry, material);
            group.add(mesh);
            return group;
        }
    };

    global.BoppersSymbols = BoppersSymbols;
})(window);
