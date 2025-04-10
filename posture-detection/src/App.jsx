import React, { useRef, useEffect, useState } from "react";
import * as tf from "@tensorflow/tfjs";
import "@tensorflow/tfjs-backend-webgl";
import * as mpPose from "@mediapipe/pose";
function App() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  const [squatCount, setSquatCount] = useState(0);
  const [pushupCount, setPushupCount] = useState(0);
  const [jumpingJackCount, setJumpingJackCount] = useState(0);
  const [toeTouchCount, setToeTouchCount] = useState(0);
  const [curlCount, setCurlCount] = useState(0); // New state for curl counter
  const [exerciseStatus, setExerciseStatus] = useState("Ready");

  let lastSquatPos = "up", lastPushupPos = "up", lastJumpingJackPos = "closed";
  let lastToeTouchPos = "up";
  let curlStage = null; // New variable for curl stage tracking

  let squatCooldown = false, pushupCooldown = false, jumpingJackCooldown = false;
  let toeTouchCooldown = false;
  let curlCooldown = false; // New cooldown for curl counter

  useEffect(() => {
      async function initialize() {
          await tf.setBackend("webgl");
          await tf.ready();
          await setupCamera();
      }

      initialize();
  }, []);
  async function setupCamera() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 } });
        if (videoRef.current) {
            videoRef.current.srcObject = stream;
            videoRef.current.onloadedmetadata = () => {
                videoRef.current.play();
                loadPoseModel();
            };
        }
    } catch (error) {
        console.error("❌ Camera access error:", error);
    }
}

function loadPoseModel() {
    const pose = new mpPose.Pose({
        locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`,
    });

    pose.setOptions({
        modelComplexity: 1,
        smoothLandmarks: true,
        enableSegmentation: false,
        minDetectionConfidence: 0.7,
        minTrackingConfidence: 0.7,
    });

    pose.onResults(onResults);
    startTracking(pose);
}

function startTracking(pose) {
    async function detectPose() {
        if (!videoRef.current) return;
        await pose.send({ image: videoRef.current });
        requestAnimationFrame(detectPose);
    }
    detectPose();
}

function onResults(results) {
    if (!canvasRef.current || !videoRef.current) return;
    const ctx = canvasRef.current.getContext("2d");
    
    // Set canvas dimensions to match video
    if (videoRef.current.videoWidth && videoRef.current.videoHeight) {
        canvasRef.current.width = videoRef.current.videoWidth;
        canvasRef.current.height = videoRef.current.videoHeight;
    }
    
    ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    ctx.drawImage(videoRef.current, 0, 0, canvasRef.current.width, canvasRef.current.height);

    if (results.poseLandmarks) {
        // Draw skeleton connections for better visualization
        drawSkeleton(results.poseLandmarks, ctx);
        drawKeypoints(results.poseLandmarks, ctx);
        
        // Draw the status box (similar to the Python code)
        drawStatusBox(ctx, curlCount, curlStage);
        
        // Detect exercises
        countSquats(results.poseLandmarks);
        countPushups(results.poseLandmarks);
        countJumpingJacks(results.poseLandmarks);
        countAlternateToeTouch(results.poseLandmarks);
        countCurls(results.poseLandmarks, ctx); // New function for counting curls
        
        // Update exercise status based on poses
        updateExerciseStatus(results.poseLandmarks);
    } else {
        setExerciseStatus("No pose detected. Please stand in frame.");
    }
}

// New function to draw status box similar to Python code
function drawStatusBox(ctx, counter, stage) {
    // Setup status box
    ctx.fillStyle = "rgba(245, 117, 16, 0.75)";
    ctx.fillRect(0, 0, 225, 73);
    
    // Rep data
    ctx.fillStyle = "black";
    ctx.font = "12px Arial";
    ctx.fillText('CURLS', 15, 12);
    
    ctx.fillStyle = "white";
    ctx.font = "40px Arial";
    ctx.fillText(counter, 10, 60);
    
    // Stage data
    ctx.fillStyle = "black";
    ctx.font = "12px Arial";
    ctx.fillText('STAGE', 65, 12);
    
    ctx.fillStyle = "white";
    ctx.font = "40px Arial";
    ctx.fillText(stage || "", 60, 60);
}

// Draw skeleton to visualize body position better
function drawSkeleton(landmarks, ctx) {
    // Define connections between keypoints
    const connections = [
        // Torso
        [mpPose.POSE_LANDMARKS.LEFT_SHOULDER, mpPose.POSE_LANDMARKS.RIGHT_SHOULDER],
        [mpPose.POSE_LANDMARKS.LEFT_SHOULDER, mpPose.POSE_LANDMARKS.LEFT_HIP],
        [mpPose.POSE_LANDMARKS.RIGHT_SHOULDER, mpPose.POSE_LANDMARKS.RIGHT_HIP],
        [mpPose.POSE_LANDMARKS.LEFT_HIP, mpPose.POSE_LANDMARKS.RIGHT_HIP],
        
        // Arms
        [mpPose.POSE_LANDMARKS.LEFT_SHOULDER, mpPose.POSE_LANDMARKS.LEFT_ELBOW],
        [mpPose.POSE_LANDMARKS.LEFT_ELBOW, mpPose.POSE_LANDMARKS.LEFT_WRIST],
        [mpPose.POSE_LANDMARKS.RIGHT_SHOULDER, mpPose.POSE_LANDMARKS.RIGHT_ELBOW],
        [mpPose.POSE_LANDMARKS.RIGHT_ELBOW, mpPose.POSE_LANDMARKS.RIGHT_WRIST],
        
        // Legs
        [mpPose.POSE_LANDMARKS.LEFT_HIP, mpPose.POSE_LANDMARKS.LEFT_KNEE],
        [mpPose.POSE_LANDMARKS.LEFT_KNEE, mpPose.POSE_LANDMARKS.LEFT_ANKLE],
        [mpPose.POSE_LANDMARKS.RIGHT_HIP, mpPose.POSE_LANDMARKS.RIGHT_KNEE],
        [mpPose.POSE_LANDMARKS.RIGHT_KNEE, mpPose.POSE_LANDMARKS.RIGHT_ANKLE]
    ];
    
    // Draw each connection
    ctx.strokeStyle = "#00ff00";
    ctx.lineWidth = 2;
    
    connections.forEach(connection => {
        const [idx1, idx2] = connection;
        const point1 = landmarks[idx1];
        const point2 = landmarks[idx2];
        
        if (point1 && point2 && point1.visibility > 0.5 && point2.visibility > 0.5) {
            ctx.beginPath();
            ctx.moveTo(point1.x * canvasRef.current.width, point1.y * canvasRef.current.height);
            ctx.lineTo(point2.x * canvasRef.current.width, point2.y * canvasRef.current.height);
            ctx.stroke();
        }
    });
}

// Update status message based on current exercise detection
function updateExerciseStatus(landmarks) {
    const leftHip = landmarks[mpPose.POSE_LANDMARKS.LEFT_HIP];
    const rightHip = landmarks[mpPose.POSE_LANDMARKS.RIGHT_HIP];
    const leftKnee = landmarks[mpPose.POSE_LANDMARKS.LEFT_KNEE];
    const rightKnee = landmarks[mpPose.POSE_LANDMARKS.RIGHT_KNEE];
    
    if (!leftHip || !rightHip || !leftKnee || !rightKnee) {
        setExerciseStatus("Move into frame completely");
        return;
    }
    
    // Check visibility scores
    const keypoints = [
        landmarks[mpPose.POSE_LANDMARKS.LEFT_SHOULDER],
        landmarks[mpPose.POSE_LANDMARKS.RIGHT_SHOULDER],
        landmarks[mpPose.POSE_LANDMARKS.LEFT_ELBOW],
        landmarks[mpPose.POSE_LANDMARKS.RIGHT_ELBOW],
        landmarks[mpPose.POSE_LANDMARKS.LEFT_WRIST],
        landmarks[mpPose.POSE_LANDMARKS.RIGHT_WRIST],
        landmarks[mpPose.POSE_LANDMARKS.LEFT_HIP],
        landmarks[mpPose.POSE_LANDMARKS.RIGHT_HIP],
        landmarks[mpPose.POSE_LANDMARKS.LEFT_KNEE],
        landmarks[mpPose.POSE_LANDMARKS.RIGHT_KNEE],
        landmarks[mpPose.POSE_LANDMARKS.LEFT_ANKLE],
        landmarks[mpPose.POSE_LANDMARKS.RIGHT_ANKLE]
    ];