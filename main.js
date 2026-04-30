import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls.js';

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

// --- Input Listeners ---
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
        case 'KeyE': moveUp = true; break;
        case 'KeyQ': moveDown = true; break;
        case 'ShiftLeft': isSprinting = true; break;
        case 'Space':
            if (canJump === true) velocity.y += 4;
            canJump = false;
            break;
    }
};

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

// It expects the file to be in the same folder during dev server
loader.load(
    './granny_v1.8_house_w_v1.0_textures.glb',
    function (gltf) {
        const model = gltf.scene;

        // Ensure everything receives shadows but ONLY specific things cast them to save FPS
        model.traverse((child) => {
            if (child.isMesh) {
                child.receiveShadow = true;
                //child.castShadow = true; // Disabled for the whole house to fix lag!
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

// We are loading the Zombie Run file
fbxLoader.load(
    './Zombie Run.fbx',
    (object) => {
        // Mixamo models are usually 100x bigger than standard, so we scale it down
        object.scale.set(0.01, 0.01, 0.01);

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

        // --- Horror Flashlight Effect ---
        flashlightFlickerTimer += delta;
        // Random flickering
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
            enemyChest.y += 1.5;
            const playerChest = camera.position.clone();
            playerChest.y -= (PLAYER_HEIGHT / 2);

            const distToPlayer = enemyModel.position.distanceTo(camera.position);

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
                enemySpeed = 4.8; // Sprint
                moveDir.copy(dirToPlayer);
                moveDir.y = 0;
                moveDir.normalize();
            } else {
                // Patrol mode - wander the house
                enemyModel.userData.state = 'patrol';
                enemySpeed = 1.5; // Slow creepy walk
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
            raycaster.set(new THREE.Vector3(enemyModel.position.x, enemyModel.position.y + 1.5, enemyModel.position.z), downVector);
            const enemyIntersects = raycaster.intersectObject(houseModel, true);
            if (enemyIntersects.length > 0) {
                if (enemyIntersects[0].point.y <= enemyModel.position.y + 1.5) {
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
                enemyScreenPos.y += 2.0; // Point slightly above their feet
                enemyScreenPos.project(camera); // Convert 3D world pos to 2D screen pos

                // Check if enemy is in front of the camera (Z < 1)
                if (enemyScreenPos.z < 1) {
                    const x = (enemyScreenPos.x * 0.5 + 0.5) * window.innerWidth;
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
