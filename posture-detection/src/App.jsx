import React, { useRef, useEffect, useState } from "react";
import * as tf from "@tensorflow/tfjs";
import "@tensorflow/tfjs-backend-webgl";
import * as mpPose from "@mediapipe/pose";
import "./App.css";

function App() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  const [squatCount, setSquatCount] = useState(0);
  const [pushupCount, setPushupCount] = useState(0);
  const [jumpingJackCount, setJumpingJackCount] = useState(0);
  const [toeTouchCount, setToeTouchCount] = useState(0);
  const [curlCount, setCurlCount] = useState(0);
  const [exerciseStatus, setExerciseStatus] = useState("Ready");
  const [movementQuality, setMovementQuality] = useState("N/A");

  let lastSquatPos = "up",
    lastPushupPos = "up",
    lastJumpingJackPos = "closed";
  let lastToeTouchPos = "up";
  let curlStage = null;

  let squatCooldown = false,
    pushupCooldown = false,
    jumpingJackCooldown = false;
  let toeTouchCooldown = false;
  let curlCooldown = false;

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
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480 },
      });
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
      locateFile: (file) =>
        `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`,
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
    ctx.drawImage(
      videoRef.current,
      0,
      0,
      canvasRef.current.width,
      canvasRef.current.height
    );

    if (results.poseLandmarks) {
      drawSkeleton(results.poseLandmarks, ctx);
      drawKeypoints(results.poseLandmarks, ctx);
      drawStatusBox(ctx, curlCount, curlStage);

      countSquats(results.poseLandmarks);
      countPushups(results.poseLandmarks);
      countJumpingJacks(results.poseLandmarks);
      countAlternateToeTouch(results.poseLandmarks);
      countCurls(results.poseLandmarks, ctx);

      updateExerciseStatus(results.poseLandmarks);
    } else {
      setExerciseStatus("No pose detected. Please stand in frame.");
    }
  }

  function drawStatusBox(ctx, counter, stage) {
    ctx.fillStyle = "rgba(245, 117, 16, 0.75)";
    ctx.fillRect(0, 0, 225, 73);

    ctx.fillStyle = "black";
    ctx.font = "12px Arial";
    ctx.fillText("CURLS", 15, 12);

    ctx.fillStyle = "white";
    ctx.font = "40px Arial";
    ctx.fillText(counter, 10, 60);

    ctx.fillStyle = "black";
    ctx.font = "12px Arial";
    ctx.fillText("STAGE", 65, 12);

    ctx.fillStyle = "white";
    ctx.font = "40px Arial";
    ctx.fillText(stage || "", 60, 60);
  }

  function drawSkeleton(landmarks, ctx) {
    const connections = [
      [mpPose.POSE_LANDMARKS.LEFT_SHOULDER, mpPose.POSE_LANDMARKS.RIGHT_SHOULDER],
      [mpPose.POSE_LANDMARKS.LEFT_SHOULDER, mpPose.POSE_LANDMARKS.LEFT_HIP],
      [mpPose.POSE_LANDMARKS.RIGHT_SHOULDER, mpPose.POSE_LANDMARKS.RIGHT_HIP],
      [mpPose.POSE_LANDMARKS.LEFT_HIP, mpPose.POSE_LANDMARKS.RIGHT_HIP],
      [mpPose.POSE_LANDMARKS.LEFT_SHOULDER, mpPose.POSE_LANDMARKS.LEFT_ELBOW],
      [mpPose.POSE_LANDMARKS.LEFT_ELBOW, mpPose.POSE_LANDMARKS.LEFT_WRIST],
      [mpPose.POSE_LANDMARKS.RIGHT_SHOULDER, mpPose.POSE_LANDMARKS.RIGHT_ELBOW],
      [mpPose.POSE_LANDMARKS.RIGHT_ELBOW, mpPose.POSE_LANDMARKS.RIGHT_WRIST],
      [mpPose.POSE_LANDMARKS.LEFT_HIP, mpPose.POSE_LANDMARKS.LEFT_KNEE],
      [mpPose.POSE_LANDMARKS.LEFT_KNEE, mpPose.POSE_LANDMARKS.LEFT_ANKLE],
      [mpPose.POSE_LANDMARKS.RIGHT_HIP, mpPose.POSE_LANDMARKS.RIGHT_KNEE],
      [mpPose.POSE_LANDMARKS.RIGHT_KNEE, mpPose.POSE_LANDMARKS.RIGHT_ANKLE],
    ];

    ctx.strokeStyle = "#00ff00";
    ctx.lineWidth = 2;

    connections.forEach(([idx1, idx2]) => {
      const point1 = landmarks[idx1];
      const point2 = landmarks[idx2];
      if (point1 && point2 && point1.visibility > 0.5 && point2.visibility > 0.5) {
        ctx.beginPath();
        ctx.moveTo(
          point1.x * canvasRef.current.width,
          point1.y * canvasRef.current.height
        );
        ctx.lineTo(
          point2.x * canvasRef.current.width,
          point2.y * canvasRef.current.height
        );
        ctx.stroke();
      }
    });
  }

  function drawKeypoints(landmarks, ctx) {
    landmarks.forEach((point, index) => {
      if (index < 33) {
        ctx.beginPath();
        ctx.arc(
          point.x * canvasRef.current.width,
          point.y * canvasRef.current.height,
          5,
          0,
          2 * Math.PI
        );
        ctx.fillStyle = "red";
        ctx.fill();
      }
    });
  }

  function countCurls(landmarks, ctx) {
    const leftShoulder = landmarks[mpPose.POSE_LANDMARKS.LEFT_SHOULDER];
    const leftElbow = landmarks[mpPose.POSE_LANDMARKS.LEFT_ELBOW];
    const leftWrist = landmarks[mpPose.POSE_LANDMARKS.LEFT_WRIST];

    if (!leftShoulder || !leftElbow || !leftWrist) return;

    const shoulder = [
      leftShoulder.x * canvasRef.current.width,
      leftShoulder.y * canvasRef.current.height,
    ];
    const elbow = [
      leftElbow.x * canvasRef.current.width,
      leftElbow.y * canvasRef.current.height,
    ];
    const wrist = [
      leftWrist.x * canvasRef.current.width,
      leftWrist.y * canvasRef.current.height,
    ];

    const angle = calculateAngle(shoulder, elbow, wrist);

    ctx.fillStyle = "white";
    ctx.font = "16px Arial";
    ctx.fillText(Math.round(angle), elbow[0], elbow[1]);

    if (angle > 160 && curlStage !== "down") {
      curlStage = "down";
    }
    if (angle < 30 && curlStage === "down" && !curlCooldown) {
      curlStage = "up";
      setCurlCount((prev) => prev + 1);
      curlCooldown = true;
      setTimeout(() => (curlCooldown = false), 500);
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

    if (
      !leftHip ||
      !rightHip ||
      !leftKnee ||
      !rightKnee ||
      !leftAnkle ||
      !rightAnkle ||
      !leftShoulder ||
      !rightShoulder
    )
      return;

    const avgHipY =
      ((leftHip.y + rightHip.y) / 2) * canvasRef.current.height;
    const avgKneeY =
      ((leftKnee.y + rightKnee.y) / 2) * canvasRef.current.height;
    const avgAnkleY =
      ((leftAnkle.y + rightAnkle.y) / 2) * canvasRef.current.height;
    const avgShoulderY =
      ((leftShoulder.y + rightShoulder.y) / 2) * canvasRef.current.height;

    const leftHipKneeAngle = calculateAngle(
      [
        leftHip.x * canvasRef.current.width,
        leftHip.y * canvasRef.current.height,
      ],
      [
        leftKnee.x * canvasRef.current.width,
        leftKnee.y * canvasRef.current.height,
      ],
      [
        leftAnkle.x * canvasRef.current.width,
        leftAnkle.y * canvasRef.current.height,
      ]
    );
    const rightHipKneeAngle = calculateAngle(
      [
        rightHip.x * canvasRef.current.width,
        rightHip.y * canvasRef.current.height,
      ],
      [
        rightKnee.x * canvasRef.current.width,
        rightKnee.y * canvasRef.current.height,
      ],
      [
        rightAnkle.x * canvasRef.current.width,
        rightAnkle.y * canvasRef.current.height,
      ]
    );
    const avgKneeAngle = (leftHipKneeAngle + rightHipKneeAngle) / 2;
    const kneeAngleThreshold = 120;
    const hipPositionThreshold = 0.2;
    const hipKneeDistance = avgHipY - ((leftHip.y + rightHip.y) / 2) * canvasRef.current.height;
    const kneeAnkleDistance = avgAnkleY - avgKneeY;
    const hipLoweredEnough =
      hipKneeDistance < kneeAnkleDistance * hipPositionThreshold;

    if (
      avgKneeAngle < kneeAngleThreshold &&
      hipLoweredEnough &&
      lastSquatPos === "up" &&
      !squatCooldown
    ) {
      setSquatCount((prev) => prev + 1);
      lastSquatPos = "down";
      squatCooldown = true;
      setTimeout(() => (squatCooldown = false), 800);
    } else if (avgKneeAngle > 160 && lastSquatPos === "down") {
      lastSquatPos = "up";
    }
  }

  function countPushups(landmarks) {
    const leftShoulder = landmarks[mpPose.POSE_LANDMARKS.LEFT_SHOULDER];
    const rightShoulder = landmarks[mpPose.POSE_LANDMARKS.RIGHT_SHOULDER];
    const leftElbow = landmarks[mpPose.POSE_LANDMARKS.LEFT_ELBOW];
    const rightElbow = landmarks[mpPose.POSE_LANDMARKS.RIGHT_ELBOW];
    const leftWrist = landmarks[mpPose.POSE_LANDMARKS.LEFT_WRIST];
    const rightWrist = landmarks[mpPose.POSE_LANDMARKS.RIGHT_WRIST];
    const leftHip = landmarks[mpPose.POSE_LANDMARKS.LEFT_HIP];
    const rightHip = landmarks[mpPose.POSE_LANDMARKS.RIGHT_HIP];

    if (
      !leftShoulder ||
      !rightShoulder ||
      !leftElbow ||
      !rightElbow ||
      !leftWrist ||
      !rightWrist ||
      !leftHip ||
      !rightHip
    )
      return;

    const canvasWidth = canvasRef.current.width;
    const canvasHeight = canvasRef.current.height;
    const leftShoulderPos = {
      x: leftShoulder.x * canvasWidth,
      y: leftShoulder.y * canvasHeight,
    };
    const rightShoulderPos = {
      x: rightShoulder.x * canvasWidth,
      y: rightShoulder.y * canvasHeight,
    };
    const leftElbowPos = {
      x: leftElbow.x * canvasWidth,
      y: leftElbow.y * canvasHeight,
    };
    const rightElbowPos = {
      x: rightElbow.x * canvasWidth,
      y: rightElbow.y * canvasHeight,
    };
    const leftWristPos = {
      x: leftWrist.x * canvasWidth,
      y: leftWrist.y * canvasHeight,
    };
    const rightWristPos = {
      x: rightWrist.x * canvasWidth,
      y: rightWrist.y * canvasHeight,
    };
    const leftHipPos = {
      x: leftHip.x * canvasWidth,
      y: leftHip.y * canvasHeight,
    };
    const rightHipPos = {
      x: rightHip.x * canvasWidth,
      y: rightHip.y * canvasHeight,
    };

    const avgShoulderY = (leftShoulderPos.y + rightShoulderPos.y) / 2;
    const avgHipY = (leftHipPos.y + rightHipPos.y) / 2;
    const leftElbowAngle = calculateAngle(
      [leftShoulderPos.x, leftShoulderPos.y],
      [leftElbowPos.x, leftElbowPos.y],
      [leftWristPos.x, leftWristPos.y]
    );
    const rightElbowAngle = calculateAngle(
      [rightShoulderPos.x, rightShoulderPos.y],
      [rightElbowPos.x, rightElbowPos.y],
      [rightWristPos.x, rightWristPos.y]
    );
    const avgElbowAngle = (leftElbowAngle + rightElbowAngle) / 2;
    const elbowAngleThreshold = 90;
    if (
      avgElbowAngle < elbowAngleThreshold &&
      avgShoulderY > avgHipY &&
      lastPushupPos === "up" &&
      !pushupCooldown
    ) {
      setPushupCount((prev) => prev + 1);
      lastPushupPos = "down";
      pushupCooldown = true;
      setTimeout(() => (pushupCooldown = false), 800);
    } else if (avgElbowAngle > 160 && lastPushupPos === "down") {
      lastPushupPos = "up";
    }
  }

  function countJumpingJacks(landmarks) {
    const leftShoulder = landmarks[mpPose.POSE_LANDMARKS.LEFT_SHOULDER];
    const rightShoulder = landmarks[mpPose.POSE_LANDMARKS.RIGHT_SHOULDER];
    const leftWrist = landmarks[mpPose.POSE_LANDMARKS.LEFT_WRIST];
    const rightWrist = landmarks[mpPose.POSE_LANDMARKS.RIGHT_WRIST];
    const leftAnkle = landmarks[mpPose.POSE_LANDMARKS.LEFT_ANKLE];
    const rightAnkle = landmarks[mpPose.POSE_LANDMARKS.RIGHT_ANKLE];
    const leftHip = landmarks[mpPose.POSE_LANDMARKS.LEFT_HIP];
    const rightHip = landmarks[mpPose.POSE_LANDMARKS.RIGHT_HIP];

    if (
      !leftShoulder ||
      !rightShoulder ||
      !leftWrist ||
      !rightWrist ||
      !leftAnkle ||
      !rightAnkle ||
      !leftHip ||
      !rightHip
    )
      return;

    const canvasWidth = canvasRef.current.width;
    const canvasHeight = canvasRef.current.height;
    const leftWristPos = {
      x: leftWrist.x * canvasWidth,
      y: leftWrist.y * canvasHeight,
    };
    const rightWristPos = {
      x: rightWrist.x * canvasWidth,
      y: rightWrist.y * canvasHeight,
    };
    const leftShoulderPos = {
      x: leftShoulder.x * canvasWidth,
      y: leftShoulder.y * canvasHeight,
    };
    const rightShoulderPos = {
      x: rightShoulder.x * canvasWidth,
      y: rightShoulder.y * canvasHeight,
    };
    const leftAnklePos = {
      x: leftAnkle.x * canvasWidth,
      y: leftAnkle.y * canvasHeight,
    };
    const rightAnklePos = {
      x: rightAnkle.x * canvasWidth,
      y: rightAnkle.y * canvasHeight,
    };
    const leftHipPos = {
      x: leftHip.x * canvasWidth,
      y: leftHip.y * canvasHeight,
    };
    const rightHipPos = {
      x: rightHip.x * canvasWidth,
      y: rightHip.y * canvasRef.current.height,
    };

    const feetDistance = Math.abs(leftAnklePos.x - rightAnklePos.x);
    const hipDistance = Math.abs(leftHipPos.x - rightHipPos.x);
    const normalizedFeetDistance = feetDistance / hipDistance;
    const leftHandAboveShoulder = leftWristPos.y < leftShoulderPos.y;
    const rightHandAboveShoulder = rightWristPos.y < rightShoulderPos.y;
    const handsDistance = Math.abs(leftWristPos.x - rightWristPos.x);
    const shoulderDistance = Math.abs(leftShoulderPos.x - rightShoulderPos.x);
    const normalizedHandsDistance = handsDistance / shoulderDistance;
    const feetApartThreshold = 1.5;
    const handsApartThreshold = 1.8;
    const inOpenPosition =
      leftHandAboveShoulder &&
      rightHandAboveShoulder &&
      normalizedHandsDistance > handsApartThreshold &&
      normalizedFeetDistance > feetApartThreshold;
    const inClosedPosition =
      !leftHandAboveShoulder &&
      !rightHandAboveShoulder &&
      normalizedFeetDistance < 1.2;

    if (
      inOpenPosition &&
      lastJumpingJackPos === "closed" &&
      !jumpingJackCooldown
    ) {
      setJumpingJackCount((prev) => prev + 1);
      lastJumpingJackPos = "open";
      jumpingJackCooldown = true;
      setTimeout(() => (jumpingJackCooldown = false), 500);
    } else if (inClosedPosition && lastJumpingJackPos === "open") {
      lastJumpingJackPos = "closed";
    }
  }

  function countAlternateToeTouch(landmarks) {
    const leftShoulder = landmarks[mpPose.POSE_LANDMARKS.LEFT_SHOULDER];
    const rightShoulder = landmarks[mpPose.POSE_LANDMARKS.RIGHT_SHOULDER];
    const leftHip = landmarks[mpPose.POSE_LANDMARKS.LEFT_HIP];
    const rightHip = landmarks[mpPose.POSE_LANDMARKS.RIGHT_HIP];
    const leftWrist = landmarks[mpPose.POSE_LANDMARKS.LEFT_WRIST];
    const rightWrist = landmarks[mpPose.POSE_LANDMARKS.RIGHT_WRIST];
    const leftAnkle = landmarks[mpPose.POSE_LANDMARKS.LEFT_ANKLE];
    const rightAnkle = landmarks[mpPose.POSE_LANDMARKS.RIGHT_ANKLE];

    if (
      !leftShoulder ||
      !rightShoulder ||
      !leftHip ||
      !rightHip ||
      !leftWrist ||
      !rightWrist ||
      !leftAnkle ||
      !rightAnkle
    )
      return;

    const canvasWidth = canvasRef.current.width;
    const canvasHeight = canvasRef.current.height;
    const leftWristPos = {
      x: leftWrist.x * canvasWidth,
      y: leftWrist.y * canvasHeight,
    };
    const rightWristPos = {
      x: rightWrist.x * canvasWidth,
      y: rightWrist.y * canvasHeight,
    };
    const leftAnklePos = {
      x: leftAnkle.x * canvasWidth,
      y: leftAnkle.y * canvasHeight,
    };
    const rightAnklePos = {
      x: rightAnkle.x * canvasWidth,
      y: rightAnkle.y * canvasHeight,
    };

    const leftWristToRightAnkleDistance = Math.sqrt(
      Math.pow(leftWristPos.x - rightAnklePos.x, 2) +
        Math.pow(leftWristPos.y - rightAnklePos.y, 2)
    );
    const rightWristToLeftAnkleDistance = Math.sqrt(
      Math.pow(rightWristPos.x - leftAnklePos.x, 2) +
        Math.pow(rightWristPos.y - leftAnklePos.y, 2)
    );
    const toeTouchThreshold = 50;
    if (
      (leftWristToRightAnkleDistance < toeTouchThreshold ||
        rightWristToLeftAnkleDistance < toeTouchThreshold) &&
      lastToeTouchPos === "up" &&
      !toeTouchCooldown
    ) {
      setToeTouchCount((prev) => prev + 1);
      lastToeTouchPos = "down";
      toeTouchCooldown = true;
      setTimeout(() => (toeTouchCooldown = false), 500);
    } else if (
      leftWristToRightAnkleDistance > toeTouchThreshold &&
      rightWristToLeftAnkleDistance > toeTouchThreshold &&
      lastToeTouchPos === "down"
    ) {
      lastToeTouchPos = "up";
    }
  }

  function calculateAngle(p1, p2, p3) {
    const vector1 = [p1[0] - p2[0], p1[1] - p2[1]];
    const vector2 = [p3[0] - p2[0], p3[1] - p2[1]];
    const dotProduct = vector1[0] * vector2[0] + vector1[1] * vector2[1];
    const magnitude1 = Math.sqrt(vector1[0] ** 2 + vector1[1] ** 2);
    const magnitude2 = Math.sqrt(vector2[0] ** 2 + vector2[1] ** 2);
    const angleRadians = Math.acos(dotProduct / (magnitude1 * magnitude2));
    const angleDegrees = angleRadians * (180 / Math.PI);
    return angleDegrees;
  }

  function updateExerciseStatus(landmarks) {
    const leftHip = landmarks[mpPose.POSE_LANDMARKS.LEFT_HIP];
    const rightHip = landmarks[mpPose.POSE_LANDMARKS.RIGHT_HIP];
    const leftKnee = landmarks[mpPose.POSE_LANDMARKS.LEFT_KNEE];
    const rightKnee = landmarks[mpPose.POSE_LANDMARKS.RIGHT_KNEE];

    if (!leftHip || !rightHip || !leftKnee || !rightKnee) {
      setExerciseStatus("Move into frame completely");
      return;
    }

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
      landmarks[mpPose.POSE_LANDMARKS.RIGHT_ANKLE],
    ];

    const avgVisibility =
      keypoints.reduce((sum, p) => sum + (p?.visibility || 0), 0) /
      keypoints.length;

    // Update movement quality as a percentage based on average visibility.
    const quality = Math.round(avgVisibility * 100) + "%";
    setMovementQuality(quality);

    if (avgVisibility < 0.7) {
      setExerciseStatus("Low visibility. Adjust lighting or position");
      return;
    }

    if (curlStage === "down") {
      setExerciseStatus("Curl - Arm down ⬇");
    } else if (curlStage === "up") {
      setExerciseStatus("Curl - Arm up ⬆");
    } else if (lastSquatPos === "down") {
      setExerciseStatus("Squat - Going down ⬇");
    } else if (lastPushupPos === "down") {
      setExerciseStatus("Pushup - Lowering ⬇");
    } else if (lastJumpingJackPos === "open") {
      setExerciseStatus("Jumping Jack - Arms up ⬆");
    } else {
      setExerciseStatus("Ready - Position detected ✓");
    }
  }

  // NEW: Handler to save exercise results (including movement quality) to a text file
  function handleSaveResult() {
    const resultText = `
Exercise Counts:
Squats: ${squatCount}
Pushups: ${pushupCount}
Jumping Jacks: ${jumpingJackCount}
Toe Touches: ${toeTouchCount}
Curls: ${curlCount}

Movement Quality: ${movementQuality}
    `.trim();

    const blob = new Blob([resultText], { type: "text/plain" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "exercise_results.txt";
    a.click();
    window.URL.revokeObjectURL(url);
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1>Exercise Counter App</h1>
        <p>
          Track your Squats, Pushups, Jumping Jacks, Toe Touches, and Curls in real
          time!
        </p>
      </header>
      <main className="app-main">
        <section className="video-section">
          <div className="video-container">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              style={{ display: "none" }}
            />
            <canvas ref={canvasRef} className="video-canvas"></canvas>
            <div className="status-overlay">
              <p>Status: {exerciseStatus}</p>
            </div>
          </div>
        </section>
        <section className="dashboard">
          <div className="counter-card">
            <h2>Squats</h2>
            <p className="counter">{squatCount}</p>
          </div>
          <div className="counter-card">
            <h2>Pushups</h2>
            <p className="counter">{pushupCount}</p>
          </div>
          <div className="counter-card">
            <h2>Jumping Jacks</h2>
            <p className="counter">{jumpingJackCount}</p>
          </div>
          <div className="counter-card">
            <h2>Toe Touch</h2>
            <p className="counter">{toeTouchCount}</p>
          </div>
          <div className="counter-card">
            <h2>Curls</h2>
            <p className="counter">{curlCount}</p>
          </div>
          <div className="counter-card">
    <h2>Movement Quality</h2>
    <p className="counter">{movementQuality}</p>
  </div>
        </section>
        {/* NEW: Save Result Button */}
        <section className="save-section">
          <button onClick={handleSaveResult}>Save Result</button>
        </section>
      </main>
      <footer className="app-footer">
        <p>&copy; {new Date().getFullYear()} Exercise Counter App. All rights reserved.</p>
      </footer>
    </div>
  );
}

export default App;