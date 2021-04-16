

const video = document.getElementById('webcam');
const wrapSection = document.getElementById('modelWrap');

// An object to configure parameters to set for the bodypix model.
// See github docs for explanations.
const bodyPixProperties = {
    architecture: 'MobileNetV1',
    outputStride: 16,
    multiplier: 0.75,
    quantBytes: 2
};

// An object to configure parameters for detection. I have raised
// the segmentation threshold to 90% confidence to reduce the
// number of false positives.
const segmentationProperties = {
    flipHorizontal: true,
    internalResolution: 'high',
    segmentationThreshold: 0.7
};


// This array will hold the colours we wish to use to highlight different body parts we find.
// RGBA (Red, Green, Blue, and Alpha (transparency) channels can be specified).
const colourMap = [];

// Left_face
colourMap.push({r: 244, g: 67, b: 54, a: 255});
// Right_face
colourMap.push({r: 183, g: 28, b: 28, a: 255});
// left_upper_arm_front
colourMap.push({r: 233, g: 30, b: 99, a: 255});
// left_upper_arm_back
colourMap.push({r: 136, g: 14, b: 79, a: 255});
// right_upper_arm_front
colourMap.push({r: 233, g: 30, b: 99, a: 255});
// 	right_upper_arm_back
colourMap.push({r: 136, g: 14, b: 79, a: 255});
// 	left_lower_arm_front
colourMap.push({r: 233, g: 30, b: 99, a: 255});
// 	left_lower_arm_back
colourMap.push({r: 136, g: 14, b: 79, a: 255});
// right_lower_arm_front
colourMap.push({r: 233, g: 30, b: 99, a: 255});
// right_lower_arm_back
colourMap.push({r: 136, g: 14, b: 79, a: 255});
// left_hand
colourMap.push({r: 156, g: 39, b: 176, a: 255});
// right_hand
colourMap.push({r: 156, g: 39, b: 176, a: 255});
// torso_front
colourMap.push({r: 63, g: 81, b: 181, a: 255});
// torso_back
colourMap.push({r: 26, g: 35, b: 126, a: 255});
// left_upper_leg_front
colourMap.push({r: 33, g: 150, b: 243, a: 255});
// left_upper_leg_back
colourMap.push({r: 13, g: 71, b: 161, a: 255});
// right_upper_leg_front
colourMap.push({r: 33, g: 150, b: 243, a: 255});
// right_upper_leg_back
colourMap.push({r: 13, g: 71, b: 161, a: 255});
// left_lower_leg_front
colourMap.push({r: 0, g: 188, b: 212, a: 255});
// left_lower_leg_back
colourMap.push({r: 0, g: 96, b: 100, a: 255});
// right_lower_leg_front
colourMap.push({r: 0, g: 188, b: 212, a: 255});
// right_lower_leg_back
colourMap.push({r: 0, g: 188, b: 212, a: 255});
// left_feet
colourMap.push({r: 255, g: 193, b: 7, a: 255});
// right_feet
colourMap.push({r: 255, g: 193, b: 7, a: 255});

var seg2three;

// A function to render returned segmentation data to a given canvas context.
function processSegmentation(canvas, segmentation) {
    var ctx = canvas.getContext('2d');

    var imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    var data = imageData.data;

    let n = 0;
    for (let i = 0; i < data.length; i += 4) {
        if (segmentation.data[n] !== -1) {
            data[i] = colourMap[segmentation.data[n]].r;     // red
            data[i + 1] = colourMap[segmentation.data[n]].g; // green
            data[i + 2] = colourMap[segmentation.data[n]].b; // blue
            data[i + 3] = colourMap[segmentation.data[n]].a; // alpha
        } else {
            data[i] = 255;
            data[i + 1] = 255;
            data[i + 2] = 255;
            data[i + 3] = 0.5;
        }
        n++;
    }
    ctx.putImageData(imageData, 0, 0);
}

// Let's load the model with our parameters defined above.
// Before we can use bodypix class we must wait for it to finish loading.
var modelHasLoaded = false;
var model = undefined;

model = bodyPix.load(bodyPixProperties).then(function (loadedModel) {
    model = loadedModel;
    modelHasLoaded = true;
    // Show demo section now model is ready to use.
    wrapSection.classList.remove('invisible');
});


 // Continuously grab image from webcam stream and classify it.
 // Webcam Demo credit to Jason Mayes 2020.Twitter: @jason_mayes

var previousSegmentationComplete = true;

// This function will repeatidly call itself when the browser is ready to process
// the next frame from webcam.
function predictWebcam() {
    if (previousSegmentationComplete) {
        // Copy the video frame from webcam to a tempory canvas in memory only (not in the DOM).
        videoRenderCanvasCtx.drawImage(video, 0, 0);
        previousSegmentationComplete = false;
        // Now classify the canvas image we have available.
        model.segmentPersonParts(videoRenderCanvas, segmentationProperties).then(function(segmentation) {
            //console.log(segmentation);
            seg2three = segmentation;
            //draw the segmentations.in to the webcamCanvas's putimageData.
            processSegmentation(webcamCanvas, segmentation);
            previousSegmentationComplete = true;
        });
    }
    // Call this function again to keep predicting when the browser is ready.
    window.requestAnimationFrame(predictWebcam);
}

// create a canvas to render our findings to the DOM.
var webcamCanvas = document.createElement('canvas');

// We will also create a temporary canvas to render to that is in memory only
// to store frames from the web cam stream for classification.
var videoRenderCanvas = document.createElement('canvas');
videoRenderCanvas.setAttribute("id", "videoRenderC")
var videoRenderCanvasCtx = videoRenderCanvas.getContext('2d');

// If webcam supported, add event listener to button for when user wants to activate it.
if (hasGetUserMedia()) {
    const enableWebcamButton = document.getElementById('webcamButton');
    enableWebcamButton.addEventListener('click', enableCam);
} else {
    console.warn('getUserMedia() is not supported by your browser');
}

// Enable the live webcam view and start classification.
function enableCam(event) {
    if (!modelHasLoaded) {
        return;
    }

    // Hide the button.
    wrapSection.classList.add('removed');
    event.target.classList.add('removed');


    // getUsermedia parameters.
    const constraints = {
        video: true
    };
    // Activate the webcam stream.
    navigator.mediaDevices.getUserMedia(constraints).then(function(stream) {
        video.addEventListener('loadedmetadata', function() {
            // Update widths and heights once video is successfully played otherwise
            // it will have width and height of zero initially causing classification to fail.
            webcamCanvas.width = video.videoWidth;
            webcamCanvas.height = video.videoHeight;
            videoRenderCanvas.width = video.videoWidth;
            videoRenderCanvas.height = video.videoHeight;
        });
        video.srcObject = stream;
        video.addEventListener('loadeddata', predictWebcam);
    });
}

// Check if webcam access is supported.
function hasGetUserMedia() {
    return !!(navigator.mediaDevices &&
        navigator.mediaDevices.getUserMedia);
}