//clean up the code(tidy up, delete the yellow cubes which represent the face, delete unnecessary functions.
//make the ui better
//give the webpage a name.

import * as THREE from 'https://unpkg.com/three@0.125.0/build/three.module.js';
//for GLTFLoader. The version on unpkg does not work. returns error for MIME type.
import {GLTFLoader} from 'https://threejsfundamentals.org/threejs/resources/threejs/r125/examples/jsm/loaders/GLTFLoader.js';

//canvas
//renderer
//camera
//scene
//light, scene.add(light)
//geometry, material, texture, mesh

function main(){

    //create the renderer
    const renderer = new THREE.WebGLRenderer();
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize( window.innerWidth, window.innerHeight );
    //important to have shadow in the scene.
    renderer.shadowMap.enabled = true;
    document.body.appendChild( renderer.domElement );
    window.addEventListener('resize', onWindowResize, false);

    //create the camera
    const fov = 70;//45;
    const aspect = window.innerWidth / window.innerHeight;//2;  // the canvas default
    const near = 1;//0.1;
    const far = 1000;
    var camera = new THREE.PerspectiveCamera(fov, aspect, near, far);
    camera.position.set(0, 1, 10);//0,1,20

    //create the scene
    const backgroundColor = 0xf1f1f1;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(backgroundColor);
    scene.fog = new THREE.Fog(backgroundColor, 60, 100);

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
                //check the name of the bones.
                if (o.isBone) {
                    //console.log(o.name); to get the name of the bodyparts to control.
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
            playModifierAnimation(idle, 0.25, jump, 0.25);
        }
    }

    //if mouse click, play the jump animation (prepare for the body interaction to trigger jump)
    document.addEventListener('click',function(e){
        console.log("Clicked and Jump!");
        if(!jumpIsPlaying){
            //play the jumpAnim
            //stop linking the head with the model
            //stop the idle
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

    //start animate/render
    function render() {

        //update the canvasTexture contain in bodypix result.
        canvas_tex.needsUpdate = true;

        //create/update bodypix mesh when there is segmentations from bodypix model
        //seg2three is initialized and updated in bodypix-script js.
        if(seg2three != null){
            let allPoses = seg2three.allPoses[0];//suppose only 1 person
            computeBodyPixDegree(allPoses);
            triggerJump(allPoses);
            /* uncomment to see & update the bodyParts' meshes;
            for (let i = 0; i < 17; i ++){
                if(allPoses.keypoints[i].score > 0.7) {
                    bodyMeshesArr[i].visible = true;
                    // console.log(allPoses.keypoints[i]);
                    let xRatio = allPoses.keypoints[i].position.x / seg2three.width;
                    let yRatio = allPoses.keypoints[i].position.y / seg2three.height;
                    //
                    bodyMeshesArr[i].position.x = xRatio * 10 - 5;
                    bodyMeshesArr[i].position.y = yRatio * -10 + 6;
                }else{
                    bodyMeshesArr[i].visible = false;
                }
            }*/
        }

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
