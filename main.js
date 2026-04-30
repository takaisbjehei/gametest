import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls.js';

// --- Assets for Vite/Vercel Build ---
import houseUrl from './granny_v1.8_house_w_v1.0_textures.glb?url';
import zombieUrl from './Zombie Run.fbx?url';
import waltherUrl from './walther_p88_gun.glb?url';
import pistolUrl from './animated_pistol.glb?url';

// --- Scene Setup ---
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x88ccff); // Lighter sky color
// scene.fog = new THREE.FogExp2(0x020202, 0.08); // Disabled fog to see the map

// --- Camera Setup ---
const PLAYER_HEIGHT = 4.5; // Increased size!
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(-16.50, PLAYER_HEIGHT, 13.34); // Granny Bedroom Spawn

// --- Renderer Setup ---
const renderer = new THREE.WebGLRenderer({ antialias: false }); // Disabled antialias for more FPS
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap; // Changed from Soft to Normal for massive FPS boost
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.body.appendChild(renderer.domElement);

// --- Lighting ---
// Bright ambient light to see everything
const ambientLight = new THREE.AmbientLight(0xffffff, 2.0); 
scene.add(ambientLight);

// Flashlight attached to the camera
const flashLight = new THREE.SpotLight(0xfff0e6, 2.5, 30, Math.PI / 5, 0.5, 1.5);
flashLight.position.set(0, 0, 0);
flashLight.target.position.set(0, 0, -1);
flashLight.castShadow = true;
flashLight.shadow.mapSize.width = 512;  // Lowered from 1024 to 512 for FPS boost
flashLight.shadow.mapSize.height = 512; // Lowered from 1024 to 512 for FPS boost
flashLight.shadow.bias = -0.001;
camera.add(flashLight);
camera.add(flashLight.target); // Flashlight follows camera

// --- Controls ---
const controls = new PointerLockControls(camera, document.body);
const ui = document.getElementById('ui');
const crosshair = document.getElementById('crosshair');
const loadingText = document.getElementById('loading');

let isModelLoaded = false;

ui.addEventListener('click', () => {
    if (isModelLoaded) {
        controls.lock();
    }
});

controls.addEventListener('lock', () => {
    ui.style.display = 'none';
    crosshair.style.display = 'block';
});

controls.addEventListener('unlock', () => {
    ui.style.display = 'flex';
    crosshair.style.display = 'none';
});

scene.add(controls.getObject());

// --- Movement Variables ---
let moveForward = false;
let moveBackward = false;
let moveLeft = false;
let moveRight = false;
let moveUp = false;
let moveDown = false;
let isSprinting = false;
let canJump = false;

const velocity = new THREE.Vector3();
const direction = new THREE.Vector3();

// --- Mobile Check & Controls Setup ---
const isMobile = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
if (isMobile) {
    document.getElementById('mobile-controls').style.display = 'block';
    
    // Joystick Logic
    const zone = document.getElementById('joystick-zone');
    const knob = document.getElementById('joystick-knob');
    let joyActive = false;
    let joyStart = { x: 0, y: 0 };

    zone.addEventListener('touchstart', (e) => {
        joyActive = true;
        const rect = zone.getBoundingClientRect();
        joyStart = { x: rect.left + 75, y: rect.top + 75 }; // Center of 150x150 zone
        updateJoystick(e.changedTouches[0]);
    }, { passive: false });

    zone.addEventListener('touchmove', (e) => {
        if (!joyActive) return;
        e.preventDefault(); 
        updateJoystick(e.changedTouches[0]);
    }, { passive: false });

    zone.addEventListener('touchend', () => {
        joyActive = false;
        knob.style.left = '75px';
        knob.style.top = '75px';
        moveForward = false;
        moveBackward = false;
        moveLeft = false;
        moveRight = false;
    });

    function updateJoystick(touch) {
        let dx = touch.clientX - joyStart.x;
        let dy = touch.clientY - joyStart.y;
        const maxDist = 50; 
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > maxDist) { dx = (dx / dist) * maxDist; dy = (dy / dist) * maxDist; }
        
        knob.style.left = `${75 + dx}px`;
        knob.style.top = `${75 + dy}px`;

        const threshold = 15;
        moveForward = dy < -threshold;
        moveBackward = dy > threshold;
        moveRight = dx > threshold;
        moveLeft = dx < -threshold;
    }

    // Look Logic
    const lookZone = document.getElementById('look-zone');
    let lookActive = false;
    let lastLook = { x: 0, y: 0 };
    const euler = new THREE.Euler(0, 0, 0, 'YXZ');
    const PI_2 = Math.PI / 2;

    lookZone.addEventListener('touchstart', (e) => {
        lookActive = true;
        lastLook = { x: e.changedTouches[0].clientX, y: e.changedTouches[0].clientY };
    }, { passive: false });

    lookZone.addEventListener('touchmove', (e) => {
        if (!lookActive) return;
        e.preventDefault();
        const touch = e.changedTouches[0];
        const dx = touch.clientX - lastLook.x;
        const dy = touch.clientY - lastLook.y;
        lastLook = { x: touch.clientX, y: touch.clientY };

        euler.setFromQuaternion(camera.quaternion);
        euler.y -= dx * 0.005;
        euler.x -= dy * 0.005;
        euler.x = Math.max(-PI_2, Math.min(PI_2, euler.x));
        camera.quaternion.setFromEuler(euler);
    }, { passive: false });

    lookZone.addEventListener('touchend', () => { lookActive = false; });

    // Action Buttons
    document.getElementById('btn-jump').addEventListener('touchstart', (e) => { e.preventDefault(); if (canJump) velocity.y += 4; canJump = false; });
    const btnSprint = document.getElementById('btn-sprint');
    btnSprint.addEventListener('touchstart', (e) => { e.preventDefault(); isSprinting = true; btnSprint.style.background = 'rgba(255,255,255,0.6)'; });
    btnSprint.addEventListener('touchend', (e) => { e.preventDefault(); isSprinting = false; btnSprint.style.background = 'rgba(255,255,255,0.2)'; });
    document.getElementById('btn-shoot').addEventListener('touchstart', (e) => { e.preventDefault(); handleShoot(); });
    document.getElementById('btn-interact').addEventListener('touchstart', (e) => { e.preventDefault(); handleInteract(); });
}

// Ensure PointerLock doesn't activate on mobile
if (isMobile) {
    ui.addEventListener('click', () => {
        if (isModelLoaded) {
            ui.style.display = 'none';
            crosshair.style.display = 'block';
            controls.isLocked = true; // Fake lock to allow movement logic to run
        }
    });
}

// --- Input Listeners (Desktop) ---
const onKeyDown = function (event) {
    switch (event.code) {
        case 'ArrowUp':
        case 'KeyW': moveForward = true; break;
        case 'ArrowLeft':
        case 'KeyA': moveLeft = true; break;
        case 'ArrowDown':
        case 'KeyS': moveBackward = true; break;
        case 'ArrowRight':
        case 'KeyD': moveRight = true; break;
        case 'KeyE': 
            moveUp = true; 
            handleInteract();
            break;
        case 'KeyQ': moveDown = true; break;
        case 'ShiftLeft': isSprinting = true; break;
        case 'Space':
            if (canJump === true) velocity.y += 4;
            canJump = false;
            break;
    }
};

function handleInteract() {
    if (gunPickup && !hasGun) {
        const pickupDist = camera.position.distanceTo(gunPickup.position);
        if (pickupDist < 4.0) {
            hasGun = true;
            scene.remove(gunPickup); // Remove from world
            gunPickup = null;
            if (fpGunModel) fpGunModel.visible = true; // Show FP gun
            const pickupPrompt = document.getElementById('pickup-prompt');
            if (pickupPrompt) pickupPrompt.style.display = 'none';
            if (isMobile) document.getElementById('btn-interact').style.display = 'none';
            console.log('Gun picked up!');
        }
    }
}

const onKeyUp = function (event) {
    switch (event.code) {
        case 'ArrowUp':
        case 'KeyW': moveForward = false; break;
        case 'ArrowLeft':
        case 'KeyA': moveLeft = false; break;
        case 'ArrowDown':
        case 'KeyS': moveBackward = false; break;
        case 'ArrowRight':
        case 'KeyD': moveRight = false; break;
        case 'KeyE': moveUp = false; break;
        case 'KeyQ': moveDown = false; break;
        case 'ShiftLeft': isSprinting = false; break;
    }
};

document.addEventListener('keydown', onKeyDown);
document.addEventListener('keyup', onKeyUp);

// --- Load the 3D Model ---
const loader = new GLTFLoader();
let houseModel = null;

loader.load(
    houseUrl,
    function (gltf) {
        const model = gltf.scene;
        
        // Ensure everything receives shadows but ONLY specific things cast them to save FPS
        model.traverse((child) => {
            if (child.isMesh) {
                child.receiveShadow = true;
                // child.castShadow = true; // Disabled for the whole house to fix lag!
            }
        });
        
        houseModel = model; // Store model for collision detection
        scene.add(model);
        
        isModelLoaded = true;
        loadingText.innerHTML = "<span style='color:#0f0'>Ready. Click anywhere to enter.</span>";
        loadingText.style.cursor = 'pointer';
    },
    function (xhr) {
        if (xhr.total > 0) {
            const percent = Math.round((xhr.loaded / xhr.total) * 100);
            loadingText.innerText = `Loading Hospital... ${percent}%`;
        } else {
            loadingText.innerText = `Loading Hospital... ${(xhr.loaded / 1024 / 1024).toFixed(2)} MB`;
        }
    },
    function (error) {
        console.error(error);
        loadingText.innerHTML = "<span style='color:red'>Error loading granny_v1.8_house_w_v1.0_textures.glb!<br>Make sure the file is copied inside the 'horor game' folder!</span>";
    }
);

// --- Load Enemy (Mixamo FBX) ---
let mixer = null;
let enemyModel = null;
const fbxLoader = new FBXLoader();

fbxLoader.load(
    zombieUrl,
    (object) => {
        // EVEN BIGGER MONSTER
        object.scale.set(0.035, 0.035, 0.035);
        
        // Spawn the enemy a bit down the hallway
        object.position.set(-16.50, 1.60, 25.0); 

        // Setup Animation
        if (object.animations && object.animations.length > 0) {
            mixer = new THREE.AnimationMixer(object);
            const action = mixer.clipAction(object.animations[0]);
            action.play();
        }

        object.traverse((child) => {
            if (child.isMesh) {
                child.castShadow = true; // Enemy casts scary shadows
                child.receiveShadow = true;
            }
        });

        scene.add(object);
        enemyModel = object;
        console.log("Enemy loaded!");
    },
    undefined,
    (error) => {
        console.error("Error loading enemy:", error);
    }
);

// --- Load Walther P88 (World Pickup) ---
let gunPickup = null;
let hasGun = false;

loader.load(
    waltherUrl,
    (gltf) => {
        const gun = gltf.scene;
        gun.scale.set(3.0, 3.0, 3.0); // Big enough to see on the ground
        gun.position.set(-15.0, 0.5, 12.0); // Near the bedroom spawn point, on the floor
        gun.rotation.set(Math.PI / 2, 0, Math.PI / 4); // Laying flat on its side
        gun.traverse((child) => {
            if (child.isMesh) {
                child.castShadow = true;
                // Add a glowing emissive outline so you can spot it
                child.material = child.material.clone();
                child.material.emissive = new THREE.Color(0x44aaff);
                child.material.emissiveIntensity = 0.3;
            }
        });
        scene.add(gun);
        gunPickup = gun;
        console.log('Walther P88 pickup loaded!');
    },
    undefined,
    (error) => console.error('Error loading Walther P88:', error)
);

// --- Load Animated Pistol (First-Person Hand) ---
let fpGunModel = null;
let fpGunMixer = null;
let fpGunShootAction = null;
let fpGunIdleAction = null;

loader.load(
    pistolUrl,
    (gltf) => {
        const gun = gltf.scene;
        gun.scale.set(7.0, 7.0, 7.0); // ABSOLUTE UNIT scale
        gun.position.set(1.5, -2.0, -2.5); // Keep it proportioned in the corner
        gun.rotation.set(0, Math.PI, 0); // Point forward
        gun.visible = false; // Hidden until you pick up the Walther

        // Setup animations if they exist
        if (gltf.animations && gltf.animations.length > 0) {
            fpGunMixer = new THREE.AnimationMixer(gun);
            console.log('Gun animations found:', gltf.animations.map(a => a.name));
            // Try to find shoot/fire animation, fallback to first one
            const shootClip = gltf.animations.find(a => 
                a.name.toLowerCase().includes('shoot') || 
                a.name.toLowerCase().includes('fire') ||
                a.name.toLowerCase().includes('shot')
            ) || gltf.animations[0];
            
            fpGunShootAction = fpGunMixer.clipAction(shootClip);
            fpGunShootAction.setLoop(THREE.LoopOnce);
            fpGunShootAction.clampWhenFinished = true;

            // If there's an idle animation, play it
            const idleClip = gltf.animations.find(a => 
                a.name.toLowerCase().includes('idle')
            );
            if (idleClip) {
                fpGunIdleAction = fpGunMixer.clipAction(idleClip);
                fpGunIdleAction.play();
            }
        }

        camera.add(gun); // Attach to camera so it follows your view
        fpGunModel = gun;
        console.log('Animated pistol loaded!');
    },
    undefined,
    (error) => console.error('Error loading animated pistol:', error)
);

// --- Shooting Mechanics ---
let ammo = 12;
let canShoot = true;
let enemyHP = 5; // Enemy takes 5 shots to die
let recoilAmount = 0;

document.addEventListener('mousedown', (e) => {
    if (e.button !== 0 || !controls.isLocked || !hasGun || isMobile) return;
    handleShoot();
});

function handleShoot() {
    if (!hasGun || !canShoot || ammo <= 0) return;

    canShoot = false;
    ammo--;

    // Play shoot animation
    if (fpGunShootAction) {
        fpGunShootAction.reset();
        fpGunShootAction.play();
    }

    // Recoil kick
    recoilAmount = 0.08;

    // Muzzle flash (brief white light burst)
    const muzzleFlash = new THREE.PointLight(0xffaa33, 8, 10);
    muzzleFlash.position.set(0.3, -0.2, -1.0);
    camera.add(muzzleFlash);
    setTimeout(() => camera.remove(muzzleFlash), 60);

    // Raycast from camera center to check if we hit the enemy
    const shootRay = new THREE.Raycaster();
    shootRay.setFromCamera(new THREE.Vector2(0, 0), camera);
    
    if (enemyModel) {
        const hits = shootRay.intersectObject(enemyModel, true);
        if (hits.length > 0) {
            enemyHP--;
            console.log(`HIT! Enemy HP: ${enemyHP}`);
            
            // Flash the enemy red on hit
            enemyModel.traverse((child) => {
                if (child.isMesh && child.material) {
                    const origColor = child.material.color.clone();
                    child.material.color.set(0xff0000);
                    setTimeout(() => child.material.color.copy(origColor), 150);
                }
            });

            if (enemyHP <= 0) {
                // Enemy dies! Remove and respawn after 10s
                enemyModel.visible = false;
                setTimeout(() => {
                    enemyModel.position.set(-16.50, PLAYER_HEIGHT, 25.0);
                    enemyModel.visible = true;
                    enemyHP = 5;
                }, 10000);
            }
        }
    }

    // Fire rate cooldown
    setTimeout(() => { canShoot = true; }, 300);
}

// --- Game Loop ---
let prevTime = performance.now();
let flashlightFlickerTimer = 0;
let frames = 0;
let lastFpsTime = performance.now();
const fpsText = document.getElementById('fps');

const raycaster = new THREE.Raycaster();
const downVector = new THREE.Vector3(0, -1, 0);

function animate() {
    requestAnimationFrame(animate);
    const time = performance.now();

    if (controls.isLocked === true) {
        // Cap delta to 50ms maximum to prevent exponential velocity explosion on lag or errors!
        const delta = Math.min((time - prevTime) / 1000, 0.05);

        // Friction / Deceleration
        velocity.x -= velocity.x * 10.0 * delta;
        velocity.z -= velocity.z * 10.0 * delta;
        velocity.y -= 9.8 * 1.5 * delta; // Restore Gravity!

        direction.z = Number(moveForward) - Number(moveBackward);
        direction.x = Number(moveRight) - Number(moveLeft);
        
        direction.normalize();

        const speedMultiplier = isSprinting ? 120.0 : 60.0; // Adjusted for bigger size

        if (moveForward || moveBackward) velocity.z -= direction.z * speedMultiplier * delta;
        if (moveLeft || moveRight) velocity.x -= direction.x * speedMultiplier * delta;

        // --- WALL COLLISION ---
        if (houseModel) {
            const forwardVector = new THREE.Vector3();
            camera.getWorldDirection(forwardVector);
            forwardVector.y = 0;
            forwardVector.normalize();
            
            const rightVector = new THREE.Vector3();
            rightVector.copy(forwardVector).cross(new THREE.Vector3(0, 1, 0)).normalize();
            
            const wallDistance = 1.5; // Player radius
            const rayOriginHorizontal = camera.position.clone();
            rayOriginHorizontal.y -= (PLAYER_HEIGHT / 2); // Cast from chest level to avoid ceilings
            
            // Check Forward
            raycaster.set(rayOriginHorizontal, forwardVector);
            if (raycaster.intersectObject(houseModel, true).some(i => i.distance < wallDistance)) {
                if (velocity.z < 0) velocity.z = 0;
            }
            // Check Backward
            raycaster.set(rayOriginHorizontal, forwardVector.clone().negate());
            if (raycaster.intersectObject(houseModel, true).some(i => i.distance < wallDistance)) {
                if (velocity.z > 0) velocity.z = 0;
            }
            // Check Right
            raycaster.set(rayOriginHorizontal, rightVector);
            if (raycaster.intersectObject(houseModel, true).some(i => i.distance < wallDistance)) {
                if (velocity.x < 0) velocity.x = 0;
            }
            // Check Left
            raycaster.set(rayOriginHorizontal, rightVector.clone().negate());
            if (raycaster.intersectObject(houseModel, true).some(i => i.distance < wallDistance)) {
                if (velocity.x > 0) velocity.x = 0;
            }
        }

        controls.moveRight(-velocity.x * delta);
        controls.moveForward(-velocity.z * delta);
        controls.getObject().position.y += (velocity.y * delta);

        // Dynamic Floor Collision (Stairs & Floors)
        if (houseModel) {
            const currentFeetY = controls.getObject().position.y - PLAYER_HEIGHT;
            const rayOriginDown = controls.getObject().position.clone();
            rayOriginDown.y = currentFeetY + 1.5; // Cast from slightly above the feet, NOT the head

            raycaster.set(rayOriginDown, downVector);
            const intersects = raycaster.intersectObject(houseModel, true);
            
            if (intersects.length > 0) {
                const floorHeight = intersects[0].point.y;
                
                // We only snap UP if the floor is no higher than our knees (1.5 units).
                // This lets us climb stairs safely, and safely fall to any floor below us!
                if (floorHeight <= currentFeetY + 1.5) {
                    if (controls.getObject().position.y < floorHeight + PLAYER_HEIGHT) {
                        velocity.y = 0;
                        controls.getObject().position.y = floorHeight + PLAYER_HEIGHT;
                        canJump = true;
                    }
                }
            } else {
                // If we fall off the map into the void, respawn
                if (controls.getObject().position.y < -20) {
                    controls.getObject().position.set(-16.50, PLAYER_HEIGHT, 13.34);
                    velocity.y = 0;
                    velocity.x = 0;
                    velocity.z = 0;
                }
            }
        }

        // Flashlight base logic (The extreme horror effects are added below when she is close)
        flashlightFlickerTimer += delta;
        if (Math.random() > 0.98 && flashlightFlickerTimer > 2.0) {
            flashLight.intensity = Math.random() * 0.5 + 0.5; // Dim heavily
            if (Math.random() > 0.8) {
                flashLight.intensity = 0; // Completely off for a split second!
            }
        } else {
            flashLight.intensity = 2.5; // Normal brightness
        }

        // --- ENEMY HUNTING & PATROL AI ---
        if (mixer) mixer.update(delta); // Play running animation

        if (enemyModel && houseModel) {
            // Setup AI state if it doesn't exist
            if (!enemyModel.userData.state) {
                enemyModel.userData = { state: 'patrol', targetDir: new THREE.Vector3(1, 0, 0) };
            }

            const enemyChest = enemyModel.position.clone();
            enemyChest.y += 2.2; // Raised to match new giant size
            const playerChest = camera.position.clone();
            playerChest.y -= (PLAYER_HEIGHT / 2);

            const distToPlayer = enemyModel.position.distanceTo(camera.position);

            // --- HORROR EFFECTS (Flashlight & Terror Pulse) ---
            const blood = document.getElementById('blood-overlay');
            if (distToPlayer < 10.0) {
                // Flashlight breaks and goes crazy when she is close!
                if (Math.random() > 0.3) flashLight.intensity = Math.random() * 0.5;
            }
            if (distToPlayer < 6.0 && distToPlayer >= 1.5) {
                // Heartbeat blood pulse when she is right next to you
                blood.style.background = 'radial-gradient(circle, rgba(255,0,0,0) 20%, rgba(150,0,0,0.8) 100%)';
                blood.style.opacity = (Math.sin(time * 0.015) * 0.5 + 0.5).toString(); // Pulsing effect
            } else if (distToPlayer >= 6.0) {
                blood.style.opacity = '0';
            }

            // 1. LINE OF SIGHT CHECK
            const dirToPlayer = playerChest.clone().sub(enemyChest).normalize();
            raycaster.set(enemyChest, dirToPlayer);
            const sightHits = raycaster.intersectObject(houseModel, true);
            
            let canSeePlayer = true;
            if (sightHits.length > 0 && sightHits[0].distance < distToPlayer) {
                canSeePlayer = false; // A wall is blocking her view
            }

            // 2. DECIDE BEHAVIOR (Chase or Patrol)
            let moveDir = new THREE.Vector3();
            let enemySpeed = 0;

            if (canSeePlayer || distToPlayer < 5.0) { 
                // She sees you, or you are close enough for her to hear you!
                enemyModel.userData.state = 'chase';
                enemySpeed = 7.5; // Extremely fast sprint!
                moveDir.copy(dirToPlayer);
                moveDir.y = 0;
                moveDir.normalize();
            } else {
                // Patrol mode - wander the house
                enemyModel.userData.state = 'patrol';
                enemySpeed = 2.5; // Faster patrol walk
                moveDir.copy(enemyModel.userData.targetDir);
                
                // Randomly change direction occasionally while roaming
                if (Math.random() < 0.01) {
                    enemyModel.userData.targetDir.set(Math.random() - 0.5, 0, Math.random() - 0.5).normalize();
                }
            }

            // 3. ROTATE ENEMY VISUALLY
            if (moveDir.lengthSq() > 0.01) {
                const targetRotation = Math.atan2(moveDir.x, moveDir.z);
                enemyModel.rotation.y = targetRotation; // Face the direction she is walking
            }

            // 4. WALL COLLISION (Independent X and Z sliding)
            let velocityX = moveDir.x * enemySpeed * delta;
            let velocityZ = moveDir.z * enemySpeed * delta;
            const eRadius = 1.0; // Enemy collision radius

            // Check Z Axis wall
            if (Math.abs(velocityZ) > 0) {
                raycaster.set(enemyChest, new THREE.Vector3(0, 0, Math.sign(velocityZ)));
                if (raycaster.intersectObject(houseModel, true).some(i => i.distance < eRadius)) {
                    velocityZ = 0; // Blocked!
                    if (enemyModel.userData.state === 'patrol') {
                        enemyModel.userData.targetDir.set(Math.random() - 0.5, 0, Math.random() - 0.5).normalize(); // Pick new path
                    }
                }
            }

            // Check X Axis wall
            if (Math.abs(velocityX) > 0) {
                raycaster.set(enemyChest, new THREE.Vector3(Math.sign(velocityX), 0, 0));
                if (raycaster.intersectObject(houseModel, true).some(i => i.distance < eRadius)) {
                    velocityX = 0; // Blocked!
                    if (enemyModel.userData.state === 'patrol') {
                        enemyModel.userData.targetDir.set(Math.random() - 0.5, 0, Math.random() - 0.5).normalize(); // Pick new path
                    }
                }
            }

            // Apply safe movement
            enemyModel.position.x += velocityX;
            enemyModel.position.z += velocityZ;
            
            // 5. FLOOR ALIGNMENT
            raycaster.set(new THREE.Vector3(enemyModel.position.x, enemyModel.position.y + 2.5, enemyModel.position.z), downVector);
            const enemyIntersects = raycaster.intersectObject(houseModel, true);
            if (enemyIntersects.length > 0) {
                if (enemyIntersects[0].point.y <= enemyModel.position.y + 2.5) {
                    enemyModel.position.y = enemyIntersects[0].point.y; 
                }
            }

            // 6. KILL CONDITION
            if (distToPlayer < 1.5) {
                // JUMPSCARE & DEATH
                document.getElementById('blood-overlay').style.opacity = '1';
                document.getElementById('blood-overlay').style.background = 'radial-gradient(circle, rgba(255,0,0,0.5) 20%, rgba(100,0,0,0.9) 100%)';
                document.getElementById('ui').style.display = 'flex';
                document.getElementById('ui').innerHTML = "<h1 style='color:red;font-size:8rem;text-shadow: 5px 5px 20px black;'>YOU DIED</h1>";
                controls.unlock();
                
                // Reset enemy so you can try again
                enemyModel.position.set(-16.50, PLAYER_HEIGHT, 25.0); 
            }

            // --- ESP (Wallhack) LOGIC ---
            const espBox = document.getElementById('esp-box');
            if (espBox) {
                const enemyScreenPos = enemyModel.position.clone();
                enemyScreenPos.y += 4.5; // Point floating over her new giant head
                enemyScreenPos.project(camera); // Convert 3D world pos to 2D screen pos

                // Check if enemy is in front of the camera (Z < 1)
                if (enemyScreenPos.z < 1) {
                    const x = (enemyScreenPos.x *  0.5 + 0.5) * window.innerWidth;
                    const y = (enemyScreenPos.y * -0.5 + 0.5) * window.innerHeight;
                    
                    espBox.style.display = 'block';
                    espBox.style.left = `${x}px`;
                    espBox.style.top = `${y}px`;
                    espBox.innerText = `[ TARGET: ${distToPlayer.toFixed(1)}m ]`;
                } else {
                    espBox.style.display = 'none'; // Enemy is behind you
                }
            }
        }
        
        // Debug Coordinates
        const debugText = document.getElementById('debug');
        if (debugText) {
            debugText.innerText = `X: ${camera.position.x.toFixed(2)} Y: ${camera.position.y.toFixed(2)} Z: ${camera.position.z.toFixed(2)}`;
        }

        // --- GUN PICKUP LOGIC ---
        if (gunPickup && !hasGun) {
            // Floating & rotating animation for the pickup
            gunPickup.position.y = 0.5 + Math.sin(time * 0.003) * 0.15; // Subtle float while laying down
            gunPickup.rotation.z = Math.PI / 4 + Math.sin(time * 0.002) * 0.05; // Gentle wobble

            // Check if player is close enough to pick it up
            const pickupDist = camera.position.distanceTo(gunPickup.position);
            const pickupPrompt = document.getElementById('pickup-prompt');
            if (pickupDist < 4.0) {
                if (pickupPrompt) pickupPrompt.style.display = 'block';
                if (isMobile) document.getElementById('btn-interact').style.display = 'flex';
            } else {
                if (pickupPrompt) pickupPrompt.style.display = 'none';
                if (isMobile) document.getElementById('btn-interact').style.display = 'none';
            }
        }

        // --- FP GUN ANIMATION UPDATE ---
        if (fpGunMixer) fpGunMixer.update(Math.min(delta, 0.05));

        // Smooth recoil recovery
        if (recoilAmount > 0) {
            recoilAmount *= 0.85; // Smooth decay
            if (fpGunModel) {
                fpGunModel.position.z = -2.5 + (recoilAmount * 3.0);
                fpGunModel.rotation.x = -recoilAmount * 3.5;
            }
            if (recoilAmount < 0.001) {
                recoilAmount = 0;
                if (fpGunModel) {
                    fpGunModel.position.z = -2.5;
                    fpGunModel.rotation.x = 0;
                }
            }
        }

        // Walking gun sway
        if (fpGunModel && fpGunModel.visible && recoilAmount <= 0) {
            const isMoving = moveForward || moveBackward || moveLeft || moveRight;
            if (isMoving) {
                fpGunModel.position.x = 1.5 + Math.sin(time * 0.008) * 0.08;
                fpGunModel.position.y = -2.0 + Math.sin(time * 0.012) * 0.06;
            } else {
                fpGunModel.position.x = 1.5;
                fpGunModel.position.y = -2.0;
            }
        }

        // Ammo HUD
        const ammoHud = document.getElementById('ammo-hud');
        if (ammoHud) {
            if (hasGun) {
                ammoHud.style.display = 'block';
                ammoHud.innerText = `🔫 ${ammo} / 12`;
                if (ammo <= 3) ammoHud.style.color = '#ff3333';
                else ammoHud.style.color = '#ffffff';
            } else {
                ammoHud.style.display = 'none';
            }
        }
    }
    
    // FPS Calculation
    frames++;
    if (time > lastFpsTime + 1000) {
        if (fpsText) fpsText.innerText = `FPS: ${Math.round((frames * 1000) / (time - lastFpsTime))}`;
        frames = 0;
        lastFpsTime = time;
    }

    prevTime = time;
    renderer.render(scene, camera);
}

animate();

// --- Handle Window Resize ---
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});
