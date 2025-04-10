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