import * as THREE from 'https://threejsfundamentals.org/threejs/resources/threejs/r125/build/three.module.js';
import {OrbitControls} from 'https://threejsfundamentals.org/threejs/resources/threejs/r125/examples/jsm/controls/OrbitControls.js';
//for GLTFLoader. The version 127 on unpkg does not work. returns error for MIME type.
import {GLTFLoader} from 'https://threejsfundamentals.org/threejs/resources/threejs/r125/examples/jsm/loaders/GLTFLoader.js';


function main() {

    const renderer = new THREE.WebGLRenderer();
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize( window.innerWidth, window.innerHeight );
    //❗ important to have shadow in the scene.
    renderer.shadowMap.enabled = true;
    document.body.appendChild( renderer.domElement );
    window.addEventListener('resize', onWindowResize, false);

    const fov = 45;
    const aspect = 2;  // the canvas default
    const near = 0.1;
    const far = 1000;
    const camera = new THREE.PerspectiveCamera(fov, aspect, near, far);
    camera.position.set(0, 1, 20);

    // const controls = new OrbitControls(camera, canvas);
    // controls.target.set(0, 5, 0);
    // controls.update();

    const backgroundColor = 0xf1f1f1;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(backgroundColor);
    scene.fog = new THREE.Fog(backgroundColor, 60, 100);

    //floor
    {
        const planeSize = 40;

        const loader = new THREE.TextureLoader();
        const texture = loader.load('https://threejsfundamentals.org/threejs/resources/images/checker.png');
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

    function frameArea(sizeToFitOnScreen, boxSize, boxCenter, camera) {
        const halfSizeToFitOnScreen = sizeToFitOnScreen * 0.5;
        const halfFovY = THREE.MathUtils.degToRad(camera.fov * .5);
        const distance = halfSizeToFitOnScreen / Math.tan(halfFovY);
        // compute a unit vector that points in the direction the camera is now
        // in the xz plane from the center of the box
        const direction = (new THREE.Vector3())
            .subVectors(camera.position, boxCenter)
            .multiply(new THREE.Vector3(1, 0, 1))
            .normalize();

        // move the camera to a position distance units way from the center
        // in whatever direction the camera was from the center already
        camera.position.copy(direction.multiplyScalar(distance).add(boxCenter));

        // pick some near and far values for the frustum that
        // will contain the box.
        camera.near = boxSize / 100;
        camera.far = boxSize * 100;

        camera.updateProjectionMatrix();

        // point the camera to look at the center of the box
        camera.lookAt(boxCenter.x, boxCenter.y, boxCenter.z);
    }
    //the house model
    {
        const gltfLoader = new GLTFLoader();
        gltfLoader.load('https://threejsfundamentals.org/threejs/resources/models/cartoon_lowpoly_small_city_free_pack/scene.gltf', (gltf) => {
            const root = gltf.scene;
            //dis-visivle the house temporarily
            root.visible = false;
            scene.add(root);

            /*
            // compute the box that contains all the stuff
            // from root and below
            const box = new THREE.Box3().setFromObject(root);
            const boxSize = box.getSize(new THREE.Vector3()).length();
            const boxCenter = box.getCenter(new THREE.Vector3());
            // set the camera to frame the box
            frameArea(boxSize * 0.5, boxSize, boxCenter, camera);

            // update the Trackball controls to handle the new size
            // controls.maxDistance = boxSize * 10;
            // controls.target.copy(boxCenter);
            // controls.update();
            */
        });
    }

    var clock = new THREE.Clock();//initialize a clock for updating animation(idle)
    var model, mixer, idle;//reference to the model and the animation
    var loaderAnim = document.getElementById('js-loader');
    var neck, head, waist, leftHand, rightHand; //reference to the model's bone
    //add gltf through GLTFLoader for test
    {
        const gltfLoader = new GLTFLoader();
        gltfLoader.load('assets/boy.glb', (gltf) => {
            model = gltf.scene;
            console.log(model);
            let fileAnimations = gltf.animations;
            model.traverse(o => {
                //check the name of the bones.
                if (o.isBone) {
                    console.log(o.name);
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
            model.castShadow = true;
            scene.add(model);

            //remove the loader in html document
            loaderAnim.remove();

            //initialize the mixer animation
            mixer = new THREE.AnimationMixer(model);
            let idleAnim = THREE.AnimationClip.findByName(fileAnimations, 'idle');//idle, jump

            // console.log(idleAnim);// idleAnima.tracks array
            //splice: 9-11 spine2; 12-14 neck(9-11 after splicing the spine2)
            idleAnim.tracks.splice(9,3);//spine2
            idleAnim.tracks.splice(9,3);//neck

            idle = mixer.clipAction(idleAnim);
            idle.play();
        }, undefined, function(error){console.error(error);});
    }

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
    // This is the thing that does the resizing
    function onWindowResize() {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    }

    document.addEventListener('mousemove', function(e) {
        var mousecoords = getMousePos(e);
        if (neck && waist) {
            moveJoint(mousecoords, neck, 50);
            moveJoint(mousecoords, waist, 30);
        }
    });

    function render() {
        //update the model animation, to make it move/play
        if (mixer) {
            mixer.update(clock.getDelta());
        }

        if (resizeRendererToDisplaySize(renderer)) {
            const canvas = renderer.domElement;
            camera.aspect = canvas.clientWidth / canvas.clientHeight;
            camera.updateProjectionMatrix();
        }

        renderer.render(scene, camera);

        requestAnimationFrame(render);
    }

    requestAnimationFrame(render);
}

main();

//event listener for mouse position


function getMousePos(e) {
    return { x: e.clientX, y: e.clientY };
}
//connect mouse to the joint of the model
function moveJoint(mouse, joint, degreeLimit) {
    let degrees = getMouseDegrees(mouse.x, mouse.y, degreeLimit);
    joint.rotation.y = THREE.Math.degToRad(degrees.x);
    joint.rotation.x = THREE.Math.degToRad(degrees.y);
}
//mouse interaction function credit to Kyle Wetton(twitter @Kyle Wetton)
function getMouseDegrees(x, y, degreeLimit) {
    let dx = 0,
        dy = 0,
        xdiff,
        xPercentage,
        ydiff,
        yPercentage;

    let w = { x: window.innerWidth, y: window.innerHeight };

    // Left (Rotates neck left between 0 and -degreeLimit)

    // 1. If cursor is in the left half of screen
    if (x <= w.x / 2) {
        // 2. Get the difference between middle of screen and cursor position
        xdiff = w.x / 2 - x;
        // 3. Find the percentage of that difference (percentage toward edge of screen)
        xPercentage = (xdiff / (w.x / 2)) * 100;
        // 4. Convert that to a percentage of the maximum rotation we allow for the neck
        dx = ((degreeLimit * xPercentage) / 100) * -1; }
// Right (Rotates neck right between 0 and degreeLimit)
    if (x >= w.x / 2) {
        xdiff = x - w.x / 2;
        xPercentage = (xdiff / (w.x / 2)) * 100;
        dx = (degreeLimit * xPercentage) / 100;
    }
    // Up (Rotates neck up between 0 and -degreeLimit)
    if (y <= w.y / 2) {
        ydiff = w.y / 2 - y;
        yPercentage = (ydiff / (w.y / 2)) * 100;
        // Note that I cut degreeLimit in half when she looks up
        dy = (((degreeLimit * 0.5) * yPercentage) / 100) * -1;
    }

    // Down (Rotates neck down between 0 and degreeLimit)
    if (y >= w.y / 2) {
        ydiff = y - w.y / 2;
        yPercentage = (ydiff / (w.y / 2)) * 100;
        dy = (degreeLimit * yPercentage) / 100;
    }
    return { x: dx, y: dy };
}