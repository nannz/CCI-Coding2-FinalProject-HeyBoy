import * as THREE from 'https://unpkg.com/three@0.127.0/build/three.module.js';
import { OrbitControls } from 'https://unpkg.com/three@0.127.0/examples/jsm/controls/OrbitControls.js';

//canvas
//renderer
//camera
//scene
//light, scene.add(light)
//geometry, material, texture, mesh

//add the renderer into the canvas
// const renderer = new THREE.WebGLRenderer({canvas});

const fov = 70;//75;
const aspect = window.innerWidth / window.innerHeight;//2;  // the canvas default
const near = 1;//0.1;
const far = 1000;
var camera = new THREE.PerspectiveCamera(fov, aspect, near, far);
camera.position.z = 10;

//create a scene
var scene = new THREE.Scene();//create a renderer, set the size as the window size and append it into the html webpage.
const renderer = new THREE.WebGLRenderer();
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize( window.innerWidth, window.innerHeight );
document.body.appendChild( renderer.domElement );
window.addEventListener('resize', onWindowResize, false);

//add a light
const lightColor = 0xFFFFFF;
const intensity = 1;
var light = new THREE.DirectionalLight(lightColor, intensity);//color,intensity//"rgb(255,255,255)"
light.position.set(0, 2, 2);
scene.add(light);

//add a simple box geometry
const box_geo = new THREE.BoxGeometry();
const box_mat = new THREE.MeshPhongMaterial( { color: 0x00ff00 } );
const cube = new THREE.Mesh( box_geo, box_mat );
cube.position.set(0,2,0);
//scene.add( cube );

//get video
//in script.js, we get the video from the document already
const video_tex = new THREE.VideoTexture(video);
const video_mat = new THREE.MeshBasicMaterial( { map: video_tex } );
//add a plane, map the video mat on the geometry.
const plane_geo = new THREE.PlaneGeometry( 16, 9 );
// const plane = new THREE.Mesh( plane_geo, plane_mat );
const video_Plane  = new THREE.Mesh( plane_geo, video_mat );
video_Plane.position.set( -10, 0, -10 );
video_Plane.rotateY(Math.PI / 6);//in rad
video_Plane.lookAt(camera.position);
scene.add( video_Plane );

//create a texture for canvas.
//canvas in script.js: webcamCanvas, id=webcamC
const ctx2three = webcamCanvas.getContext('2d');
const canvas_tex = new THREE.CanvasTexture(ctx2three.canvas);
const canvas_geo = new THREE.PlaneGeometry( 16, 9 );
const canvas_mat = new THREE.MeshBasicMaterial( { map: canvas_tex } );
const canvas_Plane = new THREE.Mesh( canvas_geo, canvas_mat );
canvas_Plane.position.set(10,0,-10);
canvas_Plane.rotateY( -Math.PI / 6);
canvas_Plane.lookAt(camera.position);
scene.add( canvas_Plane );

//create 17 meshes for body
var segReady = false;
const bodyPart_geo = new THREE.BoxGeometry();
const body_mat = new THREE.MeshPhongMaterial( { color: 0xffffff } );
var bodyMeshesArr = new Array(17);
var bodyMeshesGroup = new THREE.Group();
for(let i = 0; i < 17; i ++){
    bodyMeshesArr[i] = new THREE.Mesh( bodyPart_geo, body_mat );
    bodyMeshesArr[i].name = i;
    bodyMeshesArr[i].scale.set(0.5,0.5,0.5);
    bodyMeshesGroup.add(bodyMeshesArr[i]);
}
scene.add(bodyMeshesGroup);

//create a clock for getting time.
var clock = new THREE.Clock();




const animate = function () {
    requestAnimationFrame( animate );
    //cube.rotation.x += 0.01;
    //cube.rotation.y += 0.01;

    //update the canvasTexture contain in bodypix result.
    canvas_tex.needsUpdate = true;

    //create a mesh when there is segmentations from bodypix model
    if(seg2three != null){
        // console.log(seg2three);
        let allPoses = seg2three.allPoses[0];//suppose only 1 person
        console.log(allPoses);
        segReady = true;
        for (let i = 0; i < 17; i ++){
            if(allPoses.keypoints[i].score > 0.7) {
                bodyMeshesArr[i].visible = true;
                console.log(allPoses.keypoints[i]);
                let xRatio = allPoses.keypoints[i].position.x / seg2three.width;
                let yRatio = allPoses.keypoints[i].position.y / seg2three.height;

                //更好的方法是window ratio屏幕空间算出来。
                bodyMeshesArr[i].position.x = xRatio * 10 - 5;
                bodyMeshesArr[i].position.y = yRatio * -10 + 5;
            }else{
                bodyMeshesArr[i].visible = false;
            }

        }

    }

    renderer.render( scene, camera );
};

animate();


// This is the thing that does the resizing
function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}