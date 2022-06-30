import {
    ApplicationContext,
    FacemojiAPI,
    FaceTracker,
    FaceTrackerResult,
    FaceTrackerResultDeserializer,
    FaceTrackerResultSerializer,
    FPS,
    Logger,
    LogLevel,
    Quaternion,
    ResourceFileSystem,
    Vec2,
} from '@0xalter/mocap4face'

import { DebugoutOptions, Debugout } from 'debugout.js';

import './styles/main.scss'

Logger.logLevel = LogLevel.Info // Set LogLevel.Debug to increase logging verbosity when debugging
const videoElement = document.getElementById('videoSource') as HTMLVideoElement
const webcamButton = document.getElementById('webcam')!
const webcamOverlay = webcamButton.parentElement!
const contentElement = document.getElementById('blendshapes')!
const statusElement = document.getElementById('status')!
const fpsElement = document.getElementById('fps')
const fallbackVideo = videoElement.currentSrc
var tmpResult: FaceTrackerResult
var count: number = 2;
var line: number = 0;
var videoName: string = `${count}.mp4`;



var names:string[] = [
    "browInnerUp_L",
    "browInnerUp_R",
    //(browInnerUp_L + browInnerUp_R) / 2
    "browDown_L",
    "eyeBlink_L",
    "eyeSquint_L",
    "eyeWide_L",
    "eyeLookUp_L",
    "eyeLookOut_L",
    "eyeLookIn_L",
    "eyeLookDown_L",
    "noseSneer_L",
    "mouthUpperUp_L",
    "mouthSmile_L",
    "mouthLeft",
    "mouthFrown_L",
    "mouthLowerDown_L",
    "jawLeft",
    "cheekPuff",
    "mouthShrugUpper",
    "mouthFunnel",
    "mouthRollLower",
    "jawOpen",
    "tongueOut",
    "mouthPucker",
    "mouthRollUpper",
    "jawRight",
    "mouthLowerDown_R",
    "mouthFrown_R",
    "mouthRight",
    "mouthSmile_R",
    "mouthUpperUp_R",
    "noseSneer_R",
    "eyeLookDown_R",
    "eyeLookIn_R",
    "eyeLookOut_R",
    "eyeLookUp_R",
    "eyeWide_R",
    "eyeSquint_R",
    "eyeBlink_R",
    "browDown_R",
    "browOuterUp_R"]

function startTracking() {
    const faceRectangleElement = document.getElementById('rectangle')
    const blendshapeSliders = new Map<String, HTMLElement>()
    const context = new ApplicationContext(window.location.href) // Set a different URL here if you host application resources elsewhere
    const fs = new ResourceFileSystem(context)
    
    // uncomment for de/serialization example bellow
    // const serializer = FaceTrackerResultSerializer.create()
    // const deserializer = FaceTrackerResultDeserializer.create(serializer.serializationFormat)

    // Initialize the API and activate API key
    // Note that without an API key the SDK works only for a short period of time
    FacemojiAPI.initialize('caxiyijtxyappzlg2nklhgxemqmidtqicakjyme6vnyms5cp34im4oa', context).then((activated) => {
        if (activated) {
            console.info('API successfully activated')
        } else {
            console.info('API could not be activated')
        }
    })

    const webcamAvailable = checkWebcamAvailable()
    videoElement.oncanplay = ()=> {
        bugout.log(videoName)
        videoElement.playbackRate = 0.2

        if (count == 2){
            videoElement.currentTime = 970.92
        }
        videoElement.play()
        videoElement.requestVideoFrameCallback(track)
    }

    function videoEnd(){
        console.log("end")
    
        count++
        if (count == 7){
            bugout.downloadLog()
            //bugout.clear()
            return
        }
        videoName = `${count}.mp4`
        videoElement.setAttribute('src', videoName)
        videoElement.load()
        
    
    }

    const bugout = new Debugout()
    bugout.autoTrim = false
    bugout.realTimeLoggingOn = true

    // Initialize
    const asyncTracker = FaceTracker.createVideoTracker(fs)
        .then((tracker) => {
            console.log('Started tracking')

            // Collect all blendshape names and prepare UI
            const blendshapeNames = tracker.blendshapeNames
                .toArray()
                .concat(faceRotationToBlendshapes(Quaternion.createWithFloat(0, 0, 0, 1)).map((e) => e[0]))
                .sort()

            hideLoading()
            contentElement.replaceChildren() // remove dummy loading elements
            for (const blendshape of blendshapeNames) {
                const [li, div] = createBlendshapeElement(blendshape)
                contentElement.appendChild(li)
                blendshapeSliders.set(blendshape, div)
            }
            statusElement.hidden = true
            videoElement.load()
            return tracker
        })
        .logError('Could not start tracking')


    // Show webcam button after tracker loads and when webcam is available
    Promise.all([webcamAvailable, asyncTracker.promise()]).then(() => {
        webcamOverlay.classList.remove('hidden')
    })
 
    /**
     * Shows or hides rectangle around the detected face
     * @param show whether to show the face rectangle
     */

    /**
     * Performs face tracking, called every animation frame.
     */
     function setFaceRectangleVisible(show: boolean) {
        if (faceRectangleElement !== null) {
            faceRectangleElement.style.display = show ? 'block' : 'none'
        }
    }
    function track() {
        const tracker = asyncTracker.currentValue

        // Track only when everything is fully loaded and video is running
        if (!tracker || videoElement === null || contentElement === null) {
            console.log("oh no")
            videoElement.requestVideoFrameCallback(track)
            return
        }

        videoElement.pause()
        const timeStamp = videoElement.currentTime
        // Face tracking
        var lastResult = tracker.track(videoElement)

        
        if (lastResult != null){

            var result: number[] = new Array(40)
            videoElement.className = videoResolutionClass(lastResult.inputImageSize)
            result[0] = ((lastResult.blendshapes.get(names[0]) as number) + 
                        (lastResult.blendshapes.get(names[1]) as number) ) / 2.0
                
            for (var j = 2; j < names.length; j++){
                result[j -1] = lastResult.blendshapes.get(names[j]) as number
            }
            bugout.log(timeStamp)
            bugout.log(result)
            line ++
            if (line == 500){
                bugout.downloadLog()
                bugout.clear()
                line = 0
            }


            if (faceRectangleElement !== null) {
                // Align overlay parent size with video size
                const parent = faceRectangleElement.parentElement
                if (parent !== null) {
                    parent.style.left = videoElement.offsetLeft + 'px'
                    parent.style.top = videoElement.offsetTop + 'px'
                    parent.style.width = videoElement.clientWidth + 'px'
                    parent.style.height = videoElement.clientHeight + 'px'
                }

                // Convert face rectangle from tracker coordinates to HTML coordinates
                const rect = lastResult.faceRectangle
                    .flipY(lastResult.inputImageSize.y)
                    .normalizeBy(lastResult.inputImageSize)
                    .scale(videoElement.clientWidth, videoElement.clientHeight)
                    .scaleAroundCenter(0.8, 0.8) // mocap4face uses a wider rect for better detection, a smaller one is more pleasing to the eye though
                faceRectangleElement.style.position = 'relative'
                faceRectangleElement.style.left = rect.x.toString() + 'px'
                faceRectangleElement.style.top = rect.y.toString() + 'px'
                faceRectangleElement.style.width = rect.width.toString() + 'px'
                faceRectangleElement.style.height = rect.height.toString() + 'px'

                // At this point the tracker always detected some face but it might be a low confidence one.
                // hasFace() checks whether the tracker is confident enough about the detection.
                // You can also read the confidence value itself by checking lastResult.confidence
                setFaceRectangleVisible(lastResult.hasFace())
            }
        }   else{
            setFaceRectangleVisible(false)
        }
        
        videoElement.currentTime += 0.05
        if (videoElement.ended){
            videoEnd()
            return
        }
        videoElement.play()
        videoElement.requestVideoFrameCallback(track)
    }

    /**
     * Creates a progressbar-like component for a blendshape key
     * @param blendshape blendshape name
     * @returns label and progressbar elements
     */
    function createBlendshapeElement(blendshape: string): [HTMLElement, HTMLElement] {
        const li = document.createElement('li')
        const span = document.createElement('code')
        span.innerHTML = blendshape
        li.appendChild(span)
        const div = document.createElement('div')
        div.classList.add('value')
        li.appendChild(div)
        return [li, div]
    }

    /**
     * Update UI for the given blendshape
     * @param blendShape blendshape name
     * @param value new value
     */
    function updateBlendshapeValue(blendShape: string, value: number) {
        const div = blendshapeSliders.get(blendShape)
        if (div) {
            div.style.width = `${(value * 100).toFixed(0)}%`
        }
    }

    /**
     * Converts head rotation to blendshape-like values so that we can show it in the UI as well.
     * @param rotation rotation from the tracker
     * @returns rotation represented as 6 blendshapes
     */
    function faceRotationToBlendshapes(rotation: Quaternion): Array<[string, number]> {
        let euler = rotation.toEuler()
        let halfPi = Math.PI * 0.5
        return [
            ['headLeft', Math.max(0, euler.y) / halfPi],
            ['headRight', -Math.min(0, euler.y) / halfPi],
            ['headUp', -Math.min(0, euler.x) / halfPi],
            ['headDown', Math.max(0, euler.x) / halfPi],
            ['headRollLeft', -Math.min(0, euler.z) / halfPi],
            ['headRollRight', Math.max(0, euler.z) / halfPi],
        ]
    }
}

/**
 * Checks whether there are any webcameras available on this device
 * @returns true if at least one camera is available
 */
function checkWebcamAvailable(): Promise<boolean> {
    const supportsWebcam = navigator.mediaDevices !== undefined && navigator.mediaDevices.getUserMedia !== undefined
    if (supportsWebcam) {
        return navigator.mediaDevices.enumerateDevices().then(
            (devices) => {
                if (devices.some((device) => device.kind === 'videoinput')) {
                    return true
                } else {
                    console.warn('No webcamera available')
                    return false
                }
            },
            (error) => {
                console.warn('Error enumerating devices ' + error)
                return false
            }
        )
    } else {
        return Promise.resolve(false)
    }
}

/**
 * Gets CSS class for the given video resolution, used only for UI tweaks
 * @param resolution video resolution
 * @returns css class
 */
function videoResolutionClass(resolution: Vec2): string {
    const knownRatios: Array<[string, number]> = [
        ['1_1', 1],
        ['16_9', 16 / 9],
        ['4_3', 4 / 3],
        ['9_16', 9 / 16],
        ['3_4', 3 / 4],
    ]
    const currentRatio = resolution.x / resolution.y
    var mm = 1000
    var choose: string = '123';
    for (const clsAndRatio of knownRatios) {
        if (Math.abs(clsAndRatio[1] - currentRatio) <= mm) {
            mm = Math.abs(clsAndRatio[1] - currentRatio)
            choose = 'ratio_' + clsAndRatio[0]
        }
    }
    return choose
}

/**
 * Hide loading status in the UI
 */
function hideLoading() {
    statusElement.classList.remove('loading')
    contentElement.classList.remove('loading')
    webcamButton.classList.remove('loading')
    videoElement.classList.remove('hidden', 'loading')
    videoElement.parentElement?.classList?.remove('loading')
}

// Handle webcam button
webcamButton.addEventListener('click', () => {
    if (videoElement.currentSrc === fallbackVideo) {
        navigator.mediaDevices
            .getUserMedia({ video: true })
            .then((stream) => {
                videoElement.srcObject = stream
                videoElement.autoplay = true
                videoElement.parentElement?.classList.remove('video')
                videoElement.parentElement?.classList.add('webcam')
                webcamButton.title = 'Disable webcam'
                webcamButton.classList.remove('webcam_error')
                webcamButton.classList.add('disable_webcam')
                return
            })
            // fallback to test video if user blocked the camera or it is not available for some reason
            .catch((err) => {
                webcamButton.classList.add('webcam_error')
                webcamButton.title = 'Error enabling webcam: ' + err.message
                console.warn(err)
            })
    } else {
        webcamButton.title = 'Enable webcam'
        webcamButton.classList.remove('disable_webcam')
        if (videoElement.srcObject !== null) {
            ;(videoElement.srcObject as MediaStream)?.getTracks().forEach((t) => t.stop())
            videoElement.srcObject = null
        }
        videoElement.setAttribute('src', fallbackVideo)
        videoElement.parentElement?.classList.remove('webcam')
        videoElement.parentElement?.classList.add('video')
    }
})

// Do not eat resources when our tab is in the background
window.onfocus = () => {
    //videoElement.play()
}
window.onblur = () => {
    //videoElement.pause()
}

// Start tracking
startTracking()
