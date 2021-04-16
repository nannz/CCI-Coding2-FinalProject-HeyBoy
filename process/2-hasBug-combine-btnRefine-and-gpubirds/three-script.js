//add gpu particles, using artificial life theory.

import * as THREE from 'https://unpkg.com/three@0.125.0/build/three.module.js';
//for GLTFLoader. The version on unpkg does not work. returns error for MIME type.
import {GLTFLoader} from 'https://threejsfundamentals.org/threejs/resources/threejs/r125/examples/jsm/loaders/GLTFLoader.js';
import { GPUComputationRenderer } from 'https://unpkg.com/three@0.127.0/examples/jsm/misc/GPUComputationRenderer.js';

//canvas
//renderer
//camera
//scene
//light, scene.add(light)
//geometry, material, texture, mesh

//***********************************************************************
/*GPU PARTICLES - BIRDS*/
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
//***********************************************************************
let container;
function main(){

    //create the renderer
    const renderer = new THREE.WebGLRenderer();
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize( window.innerWidth, window.innerHeight );
    //important to have shadow in the scene.
    renderer.shadowMap.enabled = true;

    container = document.createElement('div');
    document.body.appendChild(container);
    container.appendChild(renderer.domElement);
    container.style.touchAction = 'none';
    container.addEventListener('pointermove', onPointerMove);

    // document.body.appendChild( renderer.domElement );
    window.addEventListener('resize', onWindowResize, false);

    //create the camera
    const fov = 70;//45;
    const aspect = window.innerWidth / window.innerHeight;//2;  // the canvas default
    const near = 1;//0.1;
    const far = 2000;
    var camera = new THREE.PerspectiveCamera(fov, aspect, near, far);
    camera.position.set(0, 1, 10);//0,1,20

    //create the scene
    const backgroundColor = 0xf1f1f1;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(backgroundColor);
    scene.fog = new THREE.Fog(backgroundColor, 60, 100);

    //**initialize the GPU renderer.
    initComputeRenderer();
    const effectController = {
        separation: 20.0,
        alignment: 20.0,
        cohesion: 20.0,
        freedom: 0.75,
        preyRadius: 200.0
    };
    const valuesChanger = function () {
        velocityUniforms["separationDistance"].value = effectController.separation;
        velocityUniforms["alignmentDistance"].value = effectController.alignment;
        velocityUniforms["cohesionDistance"].value = effectController.cohesion;
        velocityUniforms["freedomFactor"].value = effectController.freedom;
        velocityUniforms["preyRadius"].value = effectController.preyRadius;//the distance to away from the predator.

    };
    valuesChanger();
    initBirds();

    //floor
    {
        const planeSize = 40;

        const loader = new THREE.TextureLoader();
        const texture = loader.load('assets/checker.png');
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        texture.magFilter = THREE.NearestFilter;
        const repeats = planeSize / 2;
        texture.repeat.set(repeats, repeats);

        const planeGeo = new THREE.PlaneGeometry(planeSize, planeSize);
        const planeMat = new THREE.MeshPhongMaterial({
            map: texture,
            side: THREE.DoubleSide,
        });
        const mesh = new THREE.Mesh(planeGeo, planeMat);
        mesh.rotation.x = Math.PI * -.5;
        mesh.receiveShadow = true;
        mesh.position.y = -5;
        scene.add(mesh);
    }
    //light 1 HemisphereLight
    {
        const skyColor = 0xB1E1FF;  // light blue
        const groundColor = 0xB97A20;  // brownish orange
        const intensity = 1;
        const light = new THREE.HemisphereLight(skyColor, groundColor, intensity);
        scene.add(light);
    }
    //light 2 directional light
    {
        const color = 0xFFFFFF;
        const intensity = 1;
        const light = new THREE.DirectionalLight(color, intensity);
        light.position.set(5, 10, 8);
        light.castShadow = true;
        light.shadow.mapSize = new THREE.Vector2(1024, 1024);
        scene.add(light);
        scene.add(light.target);
    }
    //video canvas
    {
        //get video
        //in script.js, I got the video from the document already
        const video_tex = new THREE.VideoTexture(video);
        const video_mat = new THREE.MeshBasicMaterial( { map: video_tex } );
        //add a plane, map the video mat on the geometry.
        const plane_geo = new THREE.PlaneGeometry( 16, 9 );
        // const plane = new THREE.Mesh( plane_geo, plane_mat );
        const video_Plane  = new THREE.Mesh( plane_geo, video_mat );
        video_Plane.scale.set(0.9,0.9,0.9);
        video_Plane.position.set( -10, 0, -10 );
        video_Plane.rotateY(Math.PI / 6);//in rad
        video_Plane.lookAt(camera.position);
        scene.add( video_Plane );
    }
    //create a texture for canvas.
    //canvas in script.js: webcamCanvas, id=webcamC
    var canvas_tex;
    {
        const ctx2three = webcamCanvas.getContext('2d');
        canvas_tex = new THREE.CanvasTexture(ctx2three.canvas);
        const canvas_geo = new THREE.PlaneGeometry( 16, 9 );
        const canvas_mat = new THREE.MeshBasicMaterial( { map: canvas_tex } );
        const canvas_Plane = new THREE.Mesh( canvas_geo, canvas_mat );
        canvas_Plane.scale.set(0.9,0.9,0.9);
        canvas_Plane.position.set(10,0,-10);
        canvas_Plane.rotateY( -Math.PI / 6);
        canvas_Plane.lookAt(camera.position);
        scene.add( canvas_Plane );
    }

    //17 meshes for the bodypix
    //create 17 meshes for body
    //they are not for being shown in the experience. but for early-stage development.
    var bodyMeshesArr = new Array(17);
    var bodyMeshesGroup = new THREE.Group();
    {
        const bodyPart_geo = new THREE.BoxGeometry();
        const body_mat = new THREE.MeshBasicMaterial({color: 0x49a7df});
        for (let i = 0; i < 17; i++) {
            bodyMeshesArr[i] = new THREE.Mesh(bodyPart_geo, body_mat);
            bodyMeshesArr[i].name = i;
            bodyMeshesArr[i].scale.set(0.5, 0.5, 0.5);
            bodyMeshesArr[i].position.z=-5;
            bodyMeshesGroup.add(bodyMeshesArr[i]);
        }
        scene.add(bodyMeshesGroup);
    }

    //load the model-boy
    var clock = new THREE.Clock();//initialize a clock for updating animation(idle)
    var model, mixer, idle,jump;//reference to the model and the animation
    var neck, head, waist, leftHand, rightHand; //reference to the model's bone
    //add gltf through GLTFLoader for test
    {
        const gltfLoader = new GLTFLoader();
        gltfLoader.load('assets/boy.glb', (gltf) => {
            model = gltf.scene;
            let fileAnimations = gltf.animations;
            model.traverse(o => {
                //get the name of the bones. for referring the body part and splice them from the animation
                if (o.isBone) {
                    //console.log(o.name);
                    /*
                    * mixamorig6Neck
                      mixamorig6Head
                      mixamorig6HeadTop_End
                      *
                      * mixamorig6LeftShoulder
                      * mixamorig6LeftArm
                      * mixamorig6LeftForeArm
                      * mixamorig6LeftHand
                      * mixamorig6LeftHandThumb1
                      *
                      * mixamorig6Hips
                      * mixamorig6Spine
                      * mixamorig6Spine1
                      * mixamorig6Spine2
                    */
                }
                if (o.isMesh) {
                    o.castShadow = true;
                    o.receiveShadow = true;
                }
                //check the bones, reference the bone to the variables.
                if (o.isBone && o.name === 'mixamorig6Neck') {
                    neck = o;
                }
                if (o.isBone && o.name === 'mixamorig6Spine2') {
                    waist = o;
                }
            });
            model.scale.set(7, 7, 7);
            model.position.y = -5;
            model.position.z = -3;
            model.castShadow = true;
            scene.add(model);

            //initialize the mixer animation
            mixer = new THREE.AnimationMixer(model);
            var idleAnim = THREE.AnimationClip.findByName(fileAnimations, 'idle');//idle, jump
            var jumpAnim = THREE.AnimationClip.findByName(fileAnimations, 'jump');

            //splice: 9-11 spine2; 12-14 neck(9-11 after splicing the spine2)
            idleAnim.tracks.splice(9,3);//spine2
            idleAnim.tracks.splice(9,3);//neck

            idle = mixer.clipAction(idleAnim);
            jump = mixer.clipAction(jumpAnim);
            idle.play();
        }, undefined, function(error){console.error(error);});
    }

    function isSafari() {
        return !!navigator.userAgent.match(/Safari/i) && !navigator.userAgent.match(/Chrome/i);
    }

    //resize function
    function resizeRendererToDisplaySize(renderer) {
        const canvas = renderer.domElement;
        const width = canvas.clientWidth;
        const height = canvas.clientHeight;
        const needResize = canvas.width !== width || canvas.height !== height;
        if (needResize) {
            renderer.setSize(width, height, false);
        }
        return needResize;
    }
    // window resize
    function onWindowResize() {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    }

    //************compute the interactions between bodypix and model's animation
    let eyeL, eyeR, nose, earL, earR;
    let wristL, wristR;
    let rotateRatioX,xdiff;
    let ydiff,yPer, dy;
    let scrH = 480;
    let dx,degreeLimit,xPer;//Convert that to a percentage of the maximum rotation we allow for the neck
    function computeBodyPixDegree(_allPoses){
        nose =  _allPoses.keypoints[0].position;
        eyeL = _allPoses.keypoints[1].position;//locate right in the screen
        eyeR = _allPoses.keypoints[2].position;//locate left in the screen
        earL = _allPoses.keypoints[3].position;
        earR = _allPoses.keypoints[4].position;

        rotateRatioX = (nose.x - eyeR.x) / (eyeL.x - eyeR.x);//0-1
        rotateRatioX = Math.min(Math.max(0.001,rotateRatioX), 0.999);//clamp between 0-1

        // for neck's degreeLimit
        //for left and right, calculate the relative position of nose between two eyes.
        degreeLimit = 50;
        if (rotateRatioX < 0.5){//rotate left
            xdiff = 0.5 - rotateRatioX;
            xPer = (xdiff /0.5) * 100;
            dx = (degreeLimit * xPer) / 100 * -1;
        }
        if(rotateRatioX >= 0.5){//rotate right
            xdiff = rotateRatioX - 0.5;
            xPer = (xdiff/0.5) * 100;
            dx = (degreeLimit * xPer) / 100;
        }
        //for up and down, calculate the relative position of nose towards the screen
        if(nose.y < scrH/2 ){
            ydiff = scrH/2 - nose.y;
            yPer = (ydiff / (scrH/2)) * 100;
            dy = (degreeLimit * 0.5) * yPer / 100 * -1;
        }
        if(nose.y >= scrH/2 ){
            ydiff = nose.y - scrH/2;
            yPer= (ydiff / (scrH/2))*100;
            dy = (degreeLimit * yPer)/100;
        }

        if(neck && waist && !jumpIsPlaying){//control the neck only when jump animation is not playing.
            neck.rotation.y = THREE.Math.degToRad(dx);
            neck.rotation.x = THREE.Math.degToRad(dy);
        }
    }

    var jumpIsPlaying = false;
    var toExplodeBirds = false;
    var recordedTime;
    let scoreBool, lastScoBool;
    function  triggerJump(_allPoses){
        //if 0-10 face and upperbody score > 0.7
        //play Jump
        nose =  _allPoses.keypoints[0].position;
        wristL = _allPoses.keypoints[9].position;
        wristR = _allPoses.keypoints[10].position;
        scoreBool = (_allPoses.keypoints[0].score>=0.7 && _allPoses.keypoints[9].score>=0.7 );//both nose and leftWrist is on the screen

        if(scoreBool && !jumpIsPlaying){
            //play the jump animation, not sensitive enough...but works.
            console.log(scoreBool, "playJump!");
            jumpIsPlaying = true;

            toExplodeBirds = true;
            // velocityUniforms["preyRadius"].value=0;
            recordedTime = clock.getElapsedTime();

            playModifierAnimation(idle, 0.25, jump, 0.25);
        }

        //here it also affects the jump animation......The model's animation would become glichy
        if (recordedTime != null && clock.getElapsedTime - recordedTime < 3.1) {
            console.log(clock.getElapsedTime - recordedTime);
        } else {
            //console.log("time's up!");
            velocityUniforms["preyRadius"].value = 200;
            recordedTime = clock.getElapsedTime();
        }

    }

    //if mouse click, play the jump animation (prepare for the body interaction to trigger jump)
    document.addEventListener('click',function(e){
        console.log("Clicked and Jump!");
        if(!jumpIsPlaying){
            //play the jumpAnim, stop linking the head with the model,stop the idle
            jumpIsPlaying = true;
            playModifierAnimation(idle, 0.25, jump, 0.25);
        }
    });

    function playModifierAnimation(from, fSpeed, to, tSpeed) {
        to.setLoop(THREE.LoopOnce);
        to.reset();
        to.play();
        from.crossFadeTo(to, fSpeed, true);
        setTimeout(function() {
            from.enabled = true;
            to.crossFadeTo(from, tSpeed, true);
            jumpIsPlaying = false;
        }, to._clip.duration * 1000 - ((tSpeed + fSpeed) * 1000));
    }

    //*****RENDER
    //start animate/render
    function render() {

        //update the canvasTexture contain in bodypix result.
        canvas_tex.needsUpdate = true;

        //*****
        //render and update the birds.
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

        //reset the mouse
        mouseX = 10000;
        mouseY = 10000;
        //*compute the GPU.
        gpuCompute.compute();
        //update texture uniforms in the visualization materials with the GPU renderer output.
        birdUniforms["texturePosition"].value = gpuCompute.getCurrentRenderTarget(positionVariable).texture;
        birdUniforms["textureVelocity"].value = gpuCompute.getCurrentRenderTarget(velocityVariable).texture;

        //***determine & check the bird's preyRadius
        //I tried to have the timer here. But it led to the jump animation not working.
        //perhaps because the timer is ahead of the jump leading to the stop of animation.

        //*****
        //about the boy animation and movement
        //create/update bodypix mesh when there is segmentations from bodypix model
        //seg2three is initialized and updated in bodypix-script js.
        if(seg2three != null){
            let allPoses = seg2three.allPoses[0];//suppose only 1 person
            computeBodyPixDegree(allPoses);
            triggerJump(allPoses);
        }
        //update the model animation, to make it move/play
        if (mixer) {
            mixer.update(clock.getDelta());
        }

        //**********
        //resize function
        if (resizeRendererToDisplaySize(renderer)) {
            const canvas = renderer.domElement;
            camera.aspect = canvas.clientWidth / canvas.clientHeight;
            camera.updateProjectionMatrix();
        }
        renderer.render(scene, camera);
        requestAnimationFrame(render);
    }
    requestAnimationFrame(render);

    //*****birds functions
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
    function onPointerMove(event) {

        if (event.isPrimary === false) return;

        mouseX = event.clientX - windowHalfX;
        mouseY = event.clientY - windowHalfY;

    }
}

main();


