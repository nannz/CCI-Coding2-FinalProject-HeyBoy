import * as THREE from 'https://unpkg.com/three@0.127.0/build/three.module.js';
import { OrbitControls } from 'https://unpkg.com/three@0.127.0/examples/jsm/controls/OrbitControls.js';

let camera, scene, renderer, video;
let bodyPixMask;
init();
animate();

function init() {

    camera = new THREE.PerspectiveCamera( 60, window.innerWidth / window.innerHeight, 0.1, 100 );
    camera.position.z = 0.01;

    scene = new THREE.Scene();

    video = document.getElementById( 'video' );

    const texture = new THREE.VideoTexture( video );

    const geometry = new THREE.PlaneGeometry( 16, 9 );
    geometry.scale( 0.5, 0.5, 0.5 );
    const material = new THREE.MeshBasicMaterial( { map: texture } );

    const count = 128;
    const radius = 32;

    for ( let i = 1, l = count; i <= l; i ++ ) {

        const phi = Math.acos( - 1 + ( 2 * i ) / l );
        const theta = Math.sqrt( l * Math.PI ) * phi;

        const mesh = new THREE.Mesh( geometry, material );
        mesh.position.setFromSphericalCoords( radius, phi, theta );
        mesh.lookAt( camera.position );
        scene.add( mesh );

    }

    renderer = new THREE.WebGLRenderer( { antialias: true } );
    renderer.setPixelRatio( window.devicePixelRatio );
    renderer.setSize( window.innerWidth, window.innerHeight );
    document.body.appendChild( renderer.domElement );

    const controls = new OrbitControls( camera, renderer.domElement );
    controls.enableZoom = false;
    controls.enablePan = false;

    window.addEventListener( 'resize', onWindowResize );

    //get the webcam
    if ( navigator.mediaDevices && navigator.mediaDevices.getUserMedia ) {

        const constraints = { video: { width: 1280, height: 720, facingMode: 'user' } };
        navigator.mediaDevices.getUserMedia( constraints ).then( function ( stream ) {
            // apply the stream to the video element used in the texture
            video.srcObject = stream;
            video.play();
            //🌈FAIL🌈tfjs@1.2:2 Uncaught (in promise) Error: cropSize must be atleast [1,1], but was 0,0
            // video.onloadeddata = function() {
            //     alert("Browser has loaded the current frame");
            //     //load the bodyPix;
            //     loadAndPredict();
            // };

        } ).catch( function ( error ) {
            console.error( 'Unable to access the camera/webcam.', error );
        } );


    } else {
        console.error( 'MediaDevices interface not available.' );
    }



}

//load bodypix and get segmentation information
async function loadAndPredict() {
    // const net = await bodyPix.load(architecture: 'MobileNetV1', outputStride: 16, multiplier: 0.75,quantBytes: 4);//0.5 for mobile
    const net = await bodyPix.load();
    //https://github.com/tensorflow/tfjs-models/tree/master/body-pix
    // const segmentation = await net.segmentPersonParts(img);
    const partSegmentation = await net.segmentMultiPersonParts(video);
    console.log(partSegmentation);
    // The colored part image is an rgb image with a corresponding color from the
    // rainbow colors for each part at each pixel, and black pixels where there is
    // no part.
    const coloredPartImage = bodyPix.toColoredPartMask(partSegmentation);
    console.log(coloredPartImage);
    const opacity = 0.7;
    const flipHorizontal = false;
    const maskBlurAmount = 0;
    const canvas = document.getElementById('canvas');
// Draw the colored part image on top of the original image onto a canvas.
// The colored part image will be drawn semi-transparent, with an opacity of
// 0.7, allowing for the original image to be visible under.
    bodyPixMask = bodyPix.drawMask(
        canvas, img, coloredPartImage, opacity, maskBlurAmount,
        flipHorizontal);

}

function onWindowResize() {

    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();

    renderer.setSize( window.innerWidth, window.innerHeight );

}

function animate() {

    requestAnimationFrame( animate );
    renderer.render( scene, camera );

}
