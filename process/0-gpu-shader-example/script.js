//try to deconstruct the GPU example - birds from three.js

import * as THREE from 'https://unpkg.com/three@0.125.0/build/three.module.js';
import Stats from 'https://unpkg.com/three@0.127.0/examples/jsm/libs/stats.module.js';
import { GUI } from 'https://unpkg.com/three@0.127.0/examples/jsm/libs/dat.gui.module.js';

import { GPUComputationRenderer } from 'https://unpkg.com/three@0.127.0/examples/jsm/misc/GPUComputationRenderer.js';

/* TEXTURE WIDTH FOR SIMULATION */
const WIDTH = 32;
const BIRDS = WIDTH * WIDTH;

// Custom Geometry - using 3 triangles each. No UVs, no normals currently.
function BirdGeometry() {

    const triangles = BIRDS * 3;
    const points = triangles * 3;

    THREE.BufferGeometry.call(this);

    const vertices = new THREE.BufferAttribute(new Float32Array(points * 3), 3);
    const birdColors = new THREE.BufferAttribute(new Float32Array(points * 3), 3);
    const references = new THREE.BufferAttribute(new Float32Array(points * 2), 2);
    const birdVertex = new THREE.BufferAttribute(new Float32Array(points), 1);

    this.setAttribute('position', vertices);
    this.setAttribute('birdColor', birdColors);
    this.setAttribute('reference', references);
    this.setAttribute('birdVertex', birdVertex);

    // this.setAttribute( 'normal', new Float32Array( points * 3 ), 3 );

    let v = 0;
    function verts_push() {
        for (let i = 0; i < arguments.length; i++) {
            vertices.array[v++] = arguments[i];
        }
    }

    const wingsSpan = 20;
    for (let f = 0; f < BIRDS; f++) {//BIRDS = 32
        // Body
        verts_push(
            0, -0, -20,
            0, 4, -20,
            0, 0, 30
        );
        // Left Wing
        verts_push(
            0, 0, -15,
            -wingsSpan, 0, 0,
            0, 0, 15
        );
        // Right Wing
        verts_push(
            0, 0, 15,
            wingsSpan, 0, 0,
            0, 0, -15
        );
    }

    for (let v = 0; v < triangles * 3; v++) {//triangles = BIRDS * 3. BIRDS = 32(texture size)

        const i = ~~(v / 3);//~~ is a a faster substitute for Math.floor() for positive numbers. not for negative numbers.
        const x = (i % WIDTH) / WIDTH;
        const y = ~~(i / WIDTH) / WIDTH;

        const c = new THREE.Color(
            0x444444 +
            ~~(v / 9) / BIRDS * 0x666666
        );

        birdColors.array[v * 3 + 0] = c.r;
        birdColors.array[v * 3 + 1] = c.g;
        birdColors.array[v * 3 + 2] = c.b;

        references.array[v * 2] = x;
        references.array[v * 2 + 1] = y;

        birdVertex.array[v] = v % 9;

    }

    this.scale(0.2, 0.2, 0.2);
}

BirdGeometry.prototype = Object.create(THREE.BufferGeometry.prototype);


let container, stats;
let camera, scene, renderer;
let mouseX = 0, mouseY = 0;

let windowHalfX = window.innerWidth / 2;
let windowHalfY = window.innerHeight / 2;

const BOUNDS = 800, BOUNDS_HALF = BOUNDS / 2;
let last = performance.now();


let gpuCompute;
let velocityVariable;
let positionVariable;
let positionUniforms;
let velocityUniforms;
let birdUniforms;

init();
animate();

function init() {

    container = document.createElement('div');
    document.body.appendChild(container);

    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 1, 3000);
    camera.position.z = 10;

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xffffff);
    scene.fog = new THREE.Fog(0xffffff, 100, 1000);

    renderer = new THREE.WebGLRenderer();
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    container.appendChild(renderer.domElement);

    initComputeRenderer();

    stats = new Stats();
    container.appendChild(stats.dom);

    container.style.touchAction = 'none';
    container.addEventListener('pointermove', onPointerMove);

    window.addEventListener('resize', onWindowResize);

    const gui = new GUI();


    const effectController = {
        separation: 20.0,
        alignment: 20.0,
        cohesion: 20.0,
        freedom: 0.75,
        preyRadius: 150.0
    };

    const valuesChanger = function () {
        velocityUniforms["separationDistance"].value = effectController.separation;
        velocityUniforms["alignmentDistance"].value = effectController.alignment;
        velocityUniforms["cohesionDistance"].value = effectController.cohesion;
        velocityUniforms["freedomFactor"].value = effectController.freedom;
        velocityUniforms["preyRadius"].value = effectController.preyRadius;//the distance to away from the predator.

    };

    valuesChanger();

    gui.add(effectController, "separation", 0.0, 100.0, 1.0).onChange(valuesChanger);
    gui.add(effectController, "alignment", 0.0, 100, 0.001).onChange(valuesChanger);
    gui.add(effectController, "cohesion", 0.0, 100, 0.025).onChange(valuesChanger);
    gui.add(effectController, "preyRadius", 0.0, 200, 0.025).onChange(valuesChanger);
    gui.close();

    initBirds();

}

function initComputeRenderer() {

    //Initialization-create computation renderer
    gpuCompute = new GPUComputationRenderer(WIDTH, WIDTH, renderer);

    if (isSafari()) {
        gpuCompute.setDataType(THREE.HalfFloatType);
    }

    //create initial state float textures.
    const dtPosition = gpuCompute.createTexture();
    const dtVelocity = gpuCompute.createTexture();
    //fill the position and velocity data in to two textures.
    fillPositionTexture(dtPosition);
    fillVelocityTexture(dtVelocity);
    //add texture variables.
    velocityVariable = gpuCompute.addVariable("textureVelocity", document.getElementById('fragmentShaderVelocity').textContent, dtVelocity);
    positionVariable = gpuCompute.addVariable("texturePosition", document.getElementById('fragmentShaderPosition').textContent, dtPosition);
    //add variable dependencies
    gpuCompute.setVariableDependencies(velocityVariable, [positionVariable, velocityVariable]);
    gpuCompute.setVariableDependencies(positionVariable, [positionVariable, velocityVariable]);
    //add custom uniforms
    positionUniforms = positionVariable.material.uniforms;
    velocityUniforms = velocityVariable.material.uniforms;
    positionUniforms["time"] = {value: 0.0};
    positionUniforms["delta"] = {value: 0.0};
    velocityUniforms["time"] = {value: 1.0};
    velocityUniforms["delta"] = {value: 0.0};
    velocityUniforms["testing"] = {value: 1.0};
    velocityUniforms["separationDistance"] = {value: 1.0};
    velocityUniforms["alignmentDistance"] = {value: 1.0};
    velocityUniforms["cohesionDistance"] = {value: 1.0};
    velocityUniforms["freedomFactor"] = {value: 1.0};
    velocityUniforms["predator"] = {value: new THREE.Vector3()};
    velocityUniforms["preyRadius"] = {value: 1.0};
    velocityVariable.material.defines.BOUNDS = BOUNDS.toFixed(2);
    //texture setting - wrap
    velocityVariable.wrapS = THREE.RepeatWrapping;
    velocityVariable.wrapT = THREE.RepeatWrapping;
    positionVariable.wrapS = THREE.RepeatWrapping;
    positionVariable.wrapT = THREE.RepeatWrapping;
    //check for completeness
    const error = gpuCompute.init();
    if (error !== null) {
        console.error(error);
    }

}

function isSafari() {
    return !!navigator.userAgent.match(/Safari/i) && !navigator.userAgent.match(/Chrome/i);
}

//create birds geometry,
function initBirds() {

    //create BirdGeometry. It is defined at the beginning of this script.
    const geometry = new BirdGeometry();

    // For Vertex and Fragment
    birdUniforms = {
        "color": {value: new THREE.Color(0xff2200)},
        "texturePosition": {value: null},
        "textureVelocity": {value: null},
        "time": {value: 1.0},
        "delta": {value: 0.0}
    };

    // THREE.ShaderMaterial
    const material = new THREE.ShaderMaterial({
        uniforms: birdUniforms,
        vertexShader: document.getElementById('birdVS').textContent,
        fragmentShader: document.getElementById('birdFS').textContent,
        side: THREE.DoubleSide

    });

    const birdMesh = new THREE.Mesh(geometry, material);
    birdMesh.rotation.y = Math.PI / 2;
    birdMesh.matrixAutoUpdate = false;
    birdMesh.updateMatrix();

    scene.add(birdMesh);
}

//put the position data into the texture.
function fillPositionTexture(texture) {
    const theArray = texture.image.data;
    //put the position data into the texture.
    for (let k = 0, kl = theArray.length; k < kl; k += 4) {
        const x = Math.random() * BOUNDS - BOUNDS_HALF;// BOUNDS = 800, BOUNDS_HALF = BOUNDS / 2;
        const y = Math.random() * BOUNDS - BOUNDS_HALF;
        const z = Math.random() * BOUNDS - BOUNDS_HALF;
        theArray[k + 0] = x;
        theArray[k + 1] = y;
        theArray[k + 2] = z;
        theArray[k + 3] = 1;
    }
}
//put the random velocity into the texture's data.
function fillVelocityTexture(texture) {
    const theArray = texture.image.data;
    //put the random velocity into the texture's data.
    for (let k = 0, kl = theArray.length; k < kl; k += 4) {
        const x = Math.random() - 0.5;
        const y = Math.random() - 0.5;
        const z = Math.random() - 0.5;
        theArray[k + 0] = x * 10;
        theArray[k + 1] = y * 10;
        theArray[k + 2] = z * 10;
        theArray[k + 3] = 1;
    }
}

function onWindowResize() {

    windowHalfX = window.innerWidth / 2;
    windowHalfY = window.innerHeight / 2;

    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();

    renderer.setSize(window.innerWidth, window.innerHeight);

}

function onPointerMove(event) {

    if (event.isPrimary === false) return;

    mouseX = event.clientX - windowHalfX;
    mouseY = event.clientY - windowHalfY;

}

//-------
//run the threeJS animation and render the scene.
function animate() {
    requestAnimationFrame(animate);
    render();
    stats.update();
}

function render() {

    const now = performance.now();
    let delta = (now - last) / 1000;

    if (delta > 1) delta = 1; // safety cap on large deltas
    last = now;

    //update the uniforms with the current time.
    positionUniforms["time"].value = now;
    positionUniforms["delta"].value = delta;
    velocityUniforms["time"].value = now;
    velocityUniforms["delta"].value = delta;
    birdUniforms["time"].value = now;
    birdUniforms["delta"].value = delta;

    //it is where the mouse interaction comes.
    // velocityUniforms["predator"].value.set(0.5 * mouseX / windowHalfX, -0.5 * mouseY / windowHalfY, 0);
    velocityUniforms["predator"].value.set(0, 0, 0);
    //reset the mouse?
    mouseX = 10000;
    mouseY = 10000;
    //compute the GPU.
    gpuCompute.compute();
    //update texture uniforms in the visualization materials with the GPU renderer output.
    birdUniforms["texturePosition"].value = gpuCompute.getCurrentRenderTarget(positionVariable).texture;
    birdUniforms["textureVelocity"].value = gpuCompute.getCurrentRenderTarget(velocityVariable).texture;
    //do the rendering.
    renderer.render(scene, camera);

}
