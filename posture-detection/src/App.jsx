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
    
    const avgVisibility = keypoints.reduce((sum, point) => sum + (point?.visibility || 0), 0) / keypoints.length;
        
    if (avgVisibility < 0.7) {
        setExerciseStatus("Low visibility. Adjust lighting or position");
        return;
    }
    
    // Different statuses for different exercises based on pose
    if (curlStage === "down") {
        setExerciseStatus("Curl - Arm down ⬇️");
    } else if (curlStage === "up") {
        setExerciseStatus("Curl - Arm up ⬆️");
    } else if (lastSquatPos === "down") {
        setExerciseStatus("Squat - Going down ⬇️");
    } else if (lastPushupPos === "down") {
        setExerciseStatus("Pushup - Lowering ⬇️");
    } else if (lastJumpingJackPos === "open") {
        setExerciseStatus("Jumping Jack - Arms up ⬆️");
    } else {
        setExerciseStatus("Ready - Position detected ✓");
    }
}
function drawKeypoints(landmarks, ctx) {
  landmarks.forEach((point, index) => {
      if (index < 33) {
          ctx.beginPath();
          ctx.arc(point.x * canvasRef.current.width, point.y * canvasRef.current.height, 5, 0, 2 * Math.PI);
          ctx.fillStyle = "red";
          ctx.fill();
      }
  });
}

// New function to count bicep curls (converted from Python code)
function countCurls(landmarks, ctx) {
  const leftShoulder = landmarks[mpPose.POSE_LANDMARKS.LEFT_SHOULDER];
  const leftElbow = landmarks[mpPose.POSE_LANDMARKS.LEFT_ELBOW];
  const leftWrist = landmarks[mpPose.POSE_LANDMARKS.LEFT_WRIST];
  
  if (!leftShoulder || !leftElbow || !leftWrist) return;
  
  // Get coordinates
  const shoulder = [
      leftShoulder.x * canvasRef.current.width,
      leftShoulder.y * canvasRef.current.height
  ];
  const elbow = [
      leftElbow.x * canvasRef.current.width,
      leftElbow.y * canvasRef.current.height
  ];
  const wrist = [
      leftWrist.x * canvasRef.current.width,
      leftWrist.y * canvasRef.current.height
  ];
  
  // Calculate angle
  const angle = calculateAngle(shoulder, elbow, wrist);
  
  // Visualize angle
  ctx.fillStyle = "white";
  ctx.font = "16px Arial";
  ctx.fillText(Math.round(angle), elbow[0], elbow[1]);
  
  // Curl counter logic
  if (angle > 160 && curlStage !== "down") {
      curlStage = "down";
  }
  if (angle < 30 && curlStage === "down" && !curlCooldown) {
      curlStage = "up";
      setCurlCount(prev => prev + 1);
      curlCooldown = true;
      setTimeout(() => curlCooldown = false, 500);
  }
}
function countSquats(landmarks) {
  const leftHip = landmarks[mpPose.POSE_LANDMARKS.LEFT_HIP];
  const rightHip = landmarks[mpPose.POSE_LANDMARKS.RIGHT_HIP];
  const leftKnee = landmarks[mpPose.POSE_LANDMARKS.LEFT_KNEE];
  const rightKnee = landmarks[mpPose.POSE_LANDMARKS.RIGHT_KNEE];
  const leftAnkle = landmarks[mpPose.POSE_LANDMARKS.LEFT_ANKLE];
  const rightAnkle = landmarks[mpPose.POSE_LANDMARKS.RIGHT_ANKLE];
  const leftShoulder = landmarks[mpPose.POSE_LANDMARKS.LEFT_SHOULDER];
  const rightShoulder = landmarks[mpPose.POSE_LANDMARKS.RIGHT_SHOULDER];

  if (!leftHip || !rightHip || !leftKnee || !rightKnee || !leftAnkle || !rightAnkle || 
      !leftShoulder || !rightShoulder) return;

  // Calculate joint positions in pixel coordinates
  const avgHipY = ((leftHip.y + rightHip.y) / 2) * canvasRef.current.height;
  const avgKneeY = ((leftKnee.y + rightKnee.y) / 2) * canvasRef.current.height;
  const avgAnkleY = ((leftAnkle.y + rightAnkle.y) / 2) * canvasRef.current.height;
  const avgShoulderY = ((leftShoulder.y + rightShoulder.y) / 2) * canvasRef.current.height;

  // Calculate knee angle to detect proper squat form
  const leftHipKneeAngle = calculateAngle(
      [leftHip.x * canvasRef.current.width, leftHip.y * canvasRef.current.height],
      [leftKnee.x * canvasRef.current.width, leftKnee.y * canvasRef.current.height],
      [leftAnkle.x * canvasRef.current.width, leftAnkle.y * canvasRef.current.height]
  );
  
  const rightHipKneeAngle = calculateAngle(
      [rightHip.x * canvasRef.current.width, rightHip.y * canvasRef.current.height],
      [rightKnee.x * canvasRef.current.width, rightKnee.y * canvasRef.current.height],
      [rightAnkle.x * canvasRef.current.width, rightAnkle.y * canvasRef.current.height]
  );

  const avgKneeAngle = (leftHipKneeAngle + rightHipKneeAngle) / 2;
  
  // More accurate squat detection using both hip position and knee angle
  // A proper squat should have:
  // 1. Hip lowered below a certain point
  // 2. Knee angle decreased significantly (more bent knees)
  const kneeAngleThreshold = 120; // Degrees - lower value means deeper bend
  const hipPositionThreshold = 0.2; // Relative to knee position
  
  const hipKneeDistance = avgKneeY - avgHipY;
  const kneeAnkleDistance = avgAnkleY - avgKneeY;
  
  // Hip should lower to close to knee level for a proper squat
  const hipLoweredEnough = hipKneeDistance < kneeAnkleDistance * hipPositionThreshold;
  
  // Check if user is in squat position (knees bent significantly and hips lowered)
  if (avgKneeAngle < kneeAngleThreshold && hipLoweredEnough && lastSquatPos === "up" && !squatCooldown) {
      // Valid squat detected
      setSquatCount(prev => prev + 1);
      lastSquatPos = "down";
      squatCooldown = true;
      setTimeout(() => squatCooldown = false, 800);
  } else if (avgKneeAngle > 160 && lastSquatPos === "down") {
      // Standing up position detected
      lastSquatPos = "up";
  }
}
