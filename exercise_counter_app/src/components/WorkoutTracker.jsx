// WorkoutTracker.jsx
import { useState, useEffect, useRef } from 'react';
import './WorkoutTracker.css';

const EXERCISES = {
  SQUAT: 'Squat',
  PUSHUP: 'Push-Up',
  CRUNCH: 'Crunch',
  JUMPING_JACK: 'Jumping Jack',
};
// Define pose landmark indices with their names for better reference
const POSE_LANDMARKS = {
    NOSE: 0,
    LEFT_EYE_INNER: 1,
    LEFT_EYE: 2,
    LEFT_EYE_OUTER: 3,
    RIGHT_EYE_INNER: 4,
    RIGHT_EYE: 5,
    RIGHT_EYE_OUTER: 6,
    LEFT_EAR: 7,
    RIGHT_EAR: 8,
    MOUTH_LEFT: 9,
    MOUTH_RIGHT: 10,
    LEFT_SHOULDER: 11,
    RIGHT_SHOULDER: 12,
    LEFT_ELBOW: 13,
    RIGHT_ELBOW: 14,
    LEFT_WRIST: 15,
    RIGHT_WRIST: 16,
    LEFT_PINKY: 17,
    RIGHT_PINKY: 18,
    LEFT_INDEX: 19,
    RIGHT_INDEX: 20,
    LEFT_THUMB: 21,
    RIGHT_THUMB: 22,
    LEFT_HIP: 23,
    RIGHT_HIP: 24,
    LEFT_KNEE: 25,
    RIGHT_KNEE: 26,
    LEFT_ANKLE: 27,
    RIGHT_ANKLE: 28,
    LEFT_HEEL: 29,
    RIGHT_HEEL: 30,
    LEFT_FOOT_INDEX: 31,
    RIGHT_FOOT_INDEX: 32
  };
// Convert the object to a lookup array for index to name conversion
  const LANDMARK_NAMES = Object.entries(POSE_LANDMARKS).reduce((acc, [name, index]) => {
    acc[index] = name;
    return acc;
  }, []);
  
  const WorkoutTracker = () => {
    const [poseLandmarker, setPoseLandmarker] = useState(null);
    const [webcamRunning, setWebcamRunning] = useState(false);
    const [currentExercise, setCurrentExercise] = useState(EXERCISES.SQUAT);
    const [repCount, setRepCount] = useState(0);
    const [exerciseState, setExerciseState] = useState('ready'); // ready, up, down
    const [feedback, setFeedback] = useState('');
    
    // State for storing landmarks
    const [currentLandmarks, setCurrentLandmarks] = useState(null);
    const [showLandmarks, setShowLandmarks] = useState(false);
    const [selectedLandmark, setSelectedLandmark] = useState(null);
    const [showLandmarksOnVideo, setShowLandmarksOnVideo] = useState(true); // Always show landmarks on video
    
    const videoRef = useRef(null);
    const canvasRef = useRef(null);
    
    // Previous landmarks for tracking movement
    const prevLandmarksRef = useRef(null);
    // Position history to track exercise motion
    const positionHistoryRef = useRef([]);
    const lastRepTimeRef = useRef(Date.now());
    useEffect(() => {
      // Import MediaPipe dynamically
      const loadMediaPipe = async () => {
        try {
          const { PoseLandmarker, FilesetResolver, DrawingUtils } = await import("@mediapipe/tasks-vision");
          window.PoseLandmarker = PoseLandmarker;
          window.FilesetResolver = FilesetResolver;
          window.DrawingUtils = DrawingUtils;
          
          createPoseLandmarker();
        } catch (error) {
          console.error("Error loading MediaPipe:", error);
          setFeedback("Error loading AI model. Please check console for details.");
        }
      };
      
      loadMediaPipe();
      
      return () => {
        if (videoRef.current && videoRef.current.srcObject) {
          const tracks = videoRef.current.srcObject.getTracks();
          tracks.forEach(track => track.stop());
        }
      };
    }, []);
    const createPoseLandmarker = async () => {
      try {
        const { PoseLandmarker, FilesetResolver } = window;
        const vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/wasm"
        );
        
        const landmarker = await PoseLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: `https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task`,
            delegate: "GPU"
          },
          runningMode: "VIDEO",
          numPoses: 1
        });
        
        setPoseLandmarker(landmarker);
        setFeedback("AI model loaded! Ready to track exercises.");
      } catch (error) {
        console.error("Error creating pose landmarker:", error);
        setFeedback("Error initializing AI model. Please refresh and try again.");
      }
    };
    
    const toggleWebcam = async () => {
      if (webcamRunning) {
        stopWebcam();
      } else {
        startWebcam();
      }
    };
    
    const startWebcam = async () => {
      if (!poseLandmarker) {
        setFeedback("AI model is still loading. Please wait...");
        return;
      }
      
      try {
        const constraints = { video: true };
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.addEventListener('loadeddata', startPredictions);
        }
        
        setWebcamRunning(true);
        resetExerciseState();
        setFeedback("Camera started! Position yourself and start exercising.");
      } catch (error) {
        console.error("Error accessing webcam:", error);
        setFeedback("Could not access webcam. Please check permissions.");
      }
    };
    
    const stopWebcam = () => {
      if (videoRef.current && videoRef.current.srcObject) {
        const tracks = videoRef.current.srcObject.getTracks();
        tracks.forEach(track => track.stop());
        videoRef.current.srcObject = null;
      }
      
      setWebcamRunning(false);
      setFeedback("Workout stopped.");
    };
    
    const resetExerciseState = () => {
      setRepCount(0);
      setExerciseState('ready');
      setFeedback('Get ready! Position yourself in front of the camera.');
      prevLandmarksRef.current = null;
      positionHistoryRef.current = [];
      lastRepTimeRef.current = Date.now();
      setCurrentLandmarks(null);
      setSelectedLandmark(null);
    };
  
    let lastVideoTime = -1;
    
    const startPredictions = async () => {
      if (!poseLandmarker || !videoRef.current || !canvasRef.current) return;
      
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      const drawingUtils = new window.DrawingUtils(ctx);
      
      // Match canvas dimensions to video
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      
      const predictFrame = async () => {
        if (!webcamRunning) return;
        
        if (lastVideoTime !== video.currentTime) {
          lastVideoTime = video.currentTime;
          
          // Clear canvas
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          
          // Make detection
          const startTimeMs = performance.now();
          const results = poseLandmarker.detectForVideo(video, startTimeMs);
          
          // Process results
          if (results.landmarks && results.landmarks.length > 0) {
            // Draw landmarks and connections if enabled
            if (showLandmarksOnVideo) {
              for (const landmark of results.landmarks) {
                // Draw landmarks with larger radius and vibrant colors
                drawingUtils.drawLandmarks(landmark, {
                  radius: (data) => 8, // Larger fixed size for visibility
                  color: "#00FF00", // Bright green color
                  fillColor: "#FF0000" // Red fill
                });
                
                // Draw connections with thicker lines
                drawingUtils.drawConnectors(landmark, window.PoseLandmarker.POSE_CONNECTIONS, {
                  color: "#FFFF00", // Yellow color
                  lineWidth: 4 // Thicker lines
                });
                
                // Draw landmark labels on canvas
                if (selectedLandmark !== null) {
                  // Only label the selected landmark for clarity
                  const point = landmark[selectedLandmark];
                  ctx.font = "16px Arial";
                  ctx.fillStyle = "#FFFFFF";
                  ctx.strokeStyle = "#000000";
                  ctx.lineWidth = 2;
                  const text = LANDMARK_NAMES[selectedLandmark] || `Point ${selectedLandmark}`;
                  ctx.strokeText(text, point.x * canvas.width, point.y * canvas.height - 10);
                  ctx.fillText(text, point.x * canvas.width, point.y * canvas.height - 10);
                }
              }
            }
            
            // Store the current landmarks for display in the UI
            const landmarksData = {
              // Image coordinates (normalized 2D points from the model)
              imagePoints: results.landmarks[0],
              // 3D world coordinates
              worldPoints: results.worldLandmarks[0]
            };
            
            setCurrentLandmarks(landmarksData);
            
            // Log coordinates to console for debugging
            if (selectedLandmark !== null) {
              const imagePoint = results.landmarks[0][selectedLandmark];
              const worldPoint = results.worldLandmarks[0][selectedLandmark];
              console.log(`Landmark: ${LANDMARK_NAMES[selectedLandmark]} (${selectedLandmark})`);
              console.log(`  Image (normalized): x=${imagePoint.x.toFixed(4)}, y=${imagePoint.y.toFixed(4)}, z=${imagePoint.z.toFixed(4)}`);
              console.log(`  World (meters): x=${worldPoint.x.toFixed(4)}, y=${worldPoint.y.toFixed(4)}, z=${worldPoint.z.toFixed(4)}`);
            }
            
            // Process landmarks for exercise counting
            processLandmarks(results.landmarks[0]);
          } else {
            setFeedback("No person detected. Please position yourself in the camera view.");
            setCurrentLandmarks(null);
          }
        }
        
        // Continue prediction loop
        if (webcamRunning) {
          requestAnimationFrame(predictFrame);
        }
      };
      
      requestAnimationFrame(predictFrame);
    };
    
    const processLandmarks = (landmarks) => {
      switch(currentExercise) {
        case EXERCISES.SQUAT:
          detectSquat(landmarks);
          break;
        case EXERCISES.PUSHUP:
          detectPushup(landmarks);
          break;
        case EXERCISES.CRUNCH:
          detectCrunch(landmarks);
          break;
        case EXERCISES.JUMPING_JACK:
          detectJumpingJack(landmarks);
          break;
        default:
          detectSquat(landmarks);
      }
      
      // Update ref for next frame comparison
      prevLandmarksRef.current = landmarks;
    };
    
    const detectSquat = (landmarks) => {
      // Get key points
      const leftHip = landmarks[23]; // Left hip
      const rightHip = landmarks[24]; // Right hip
      const leftKnee = landmarks[25]; // Left knee
      const rightKnee = landmarks[26]; // Right knee
      const leftAnkle = landmarks[27]; // Left ankle
      const rightAnkle = landmarks[28]; // Right ankle
      
      // Calculate knee angle (simplified)
      const leftKneeAngle = calculateAngle(leftHip, leftKnee, leftAnkle);
      const rightKneeAngle = calculateAngle(rightHip, rightKnee, rightAnkle);
      
      // Average knee angle
      const kneeAngle = (leftKneeAngle + rightKneeAngle) / 2;
      
      // Track position history
      positionHistoryRef.current.push(kneeAngle);
      if (positionHistoryRef.current.length > 10) {
        positionHistoryRef.current.shift();
      }
      
      // Detect squat phases
      if (exerciseState === 'ready' && kneeAngle < 110) {
        setExerciseState('down');
        setFeedback("Going down... Good!");
      } else if (exerciseState === 'down' && kneeAngle > 160) {
        setExerciseState('ready');
        countRep();
        setFeedback("Great job! Keep going!");
      }
      
      // Form feedback
      if (exerciseState === 'down' && kneeAngle < 90) {
        setFeedback("Deep squat! Excellent depth!");
      } else if (kneeAngle < 160 && kneeAngle > 140) {
        setFeedback("Bend your knees more for a proper squat");
      }
    };
    
    const detectPushup = (landmarks) => {
      // Get key points
      const leftShoulder = landmarks[11]; // Left shoulder
      const rightShoulder = landmarks[12]; // Right shoulder
      const leftElbow = landmarks[13]; // Left elbow
      const rightElbow = landmarks[14]; // Right elbow
      const leftWrist = landmarks[15]; // Left wrist
      const rightWrist = landmarks[16]; // Right wrist
      
      // Calculate elbow angle
      const leftElbowAngle = calculateAngle(leftShoulder, leftElbow, leftWrist);
      const rightElbowAngle = calculateAngle(rightShoulder, rightElbow, rightWrist);
      
      // Average elbow angle
      const elbowAngle = (leftElbowAngle + rightElbowAngle) / 2;
      
      // Track position history
      positionHistoryRef.current.push(elbowAngle);
      if (positionHistoryRef.current.length > 10) {
        positionHistoryRef.current.shift();
      }
      
      // Detect pushup phases
      if (exerciseState === 'ready' && elbowAngle < 110) {
        setExerciseState('down');
        setFeedback("Going down... Good!");
      } else if (exerciseState === 'down' && elbowAngle > 160) {
        setExerciseState('ready');
        countRep();
        setFeedback("Great pushup! Keep going!");
      }
      
      // Form feedback
      if (exerciseState === 'down' && elbowAngle < 90) {
        setFeedback("Deep pushup! Great form!");
      } else if (elbowAngle < 160 && elbowAngle > 140) {
        setFeedback("Go lower for a complete pushup");
      }
    };
    
    const detectCrunch = (landmarks) => {
      // Implementation for crunches
      // Using shoulder and hip landmarks to detect the crunch motion
      const leftShoulder = landmarks[11]; // Left shoulder
      const rightShoulder = landmarks[12]; // Right shoulder
      const leftHip = landmarks[23]; // Left hip
      const rightHip = landmarks[24]; // Right hip
      
      // Calculate angle between shoulders and hips
      const torsoAngle = calculateTorsoAngle(
        (leftShoulder.x + rightShoulder.x) / 2, 
        (leftShoulder.y + rightShoulder.y) / 2,
        (leftHip.x + rightHip.x) / 2,
        (leftHip.y + rightHip.y) / 2
      );
      
      // Track position history
      positionHistoryRef.current.push(torsoAngle);
      if (positionHistoryRef.current.length > 10) {
        positionHistoryRef.current.shift();
      }
      
      // Detect crunch phases
      if (exerciseState === 'ready' && torsoAngle < 130) {
        setExerciseState('up');
        setFeedback("Crunching up... Good!");
      } else if (exerciseState === 'up' && torsoAngle > 160) {
        setExerciseState('ready');
        countRep();
        setFeedback("Great crunch! Keep going!");
      }
    };
    
    const detectJumpingJack = (landmarks) => {
      // Implementation for jumping jacks
      // Using wrist and ankle positions to detect the jumping jack motion
      const leftWrist = landmarks[15]; 
      const rightWrist = landmarks[16]; 
      const leftAnkle = landmarks[27]; 
      const rightAnkle = landmarks[28]; 
      
      // Calculate distance between wrists and ankles
      const wristDistance = Math.sqrt(
        Math.pow(leftWrist.x - rightWrist.x, 2) +
        Math.pow(leftWrist.y - rightWrist.y, 2)
      );
      
      const ankleDistance = Math.sqrt(
        Math.pow(leftAnkle.x - rightAnkle.x, 2) +
        Math.pow(leftAnkle.y - rightAnkle.y, 2)
      );
      
      // Track position history
      positionHistoryRef.current.push({wristDistance, ankleDistance});
      if (positionHistoryRef.current.length > 10) {
        positionHistoryRef.current.shift();
      }
      
      // Detect jumping jack phases
      if (exerciseState === 'ready' && wristDistance > 0.5 && ankleDistance > 0.3) {
        setExerciseState('out');
        setFeedback("Arms and legs out... Good!");
      } else if (exerciseState === 'out' && wristDistance < 0.3 && ankleDistance < 0.2) {
        setExerciseState('ready');
        countRep();
        setFeedback("Great jumping jack! Keep going!");
      }
    };
    
    const calculateAngle = (a, b, c) => {
      // Calculate angle between three points
      const radians = Math.atan2(c.y - b.y, c.x - b.x) - Math.atan2(a.y - b.y, a.x - b.x);
      let angle = Math.abs(radians * 180.0 / Math.PI);
      
      if (angle > 180.0) {
        angle = 360.0 - angle;
      }
      
      return angle;
    };
    
    const calculateTorsoAngle = (shoulderX, shoulderY, hipX, hipY) => {
      // Calculate angle of torso from vertical
      const dx = shoulderX - hipX;
      const dy = shoulderY - hipY;
      const radians = Math.atan2(dx, dy);
      let angle = Math.abs(radians * 180.0 / Math.PI);
      return angle;
    };
    
    const countRep = () => {
      // Avoid counting reps too quickly (prevent false positives)
      const now = Date.now();
      if (now - lastRepTimeRef.current < 500) {
        return;
      }
      
      setRepCount(prev => prev + 1);
      lastRepTimeRef.current = now;
    };
    
    const handleExerciseChange = (exercise) => {
      setCurrentExercise(exercise);
      resetExerciseState();
    };
    
    const toggleLandmarksDisplay = () => {
      setShowLandmarks(!showLandmarks);
    };
    
    const handleLandmarkClick = (index) => {
      setSelectedLandmark(index === selectedLandmark ? null : index);
      // Log the selected landmark to console
      if (index !== selectedLandmark && currentLandmarks) {
        const imagePoint = currentLandmarks.imagePoints[index];
        const worldPoint = currentLandmarks.worldPoints[index];
        console.log(`Selected Landmark: ${LANDMARK_NAMES[index]} (${index})`);
        console.log(`  Image (normalized): x=${imagePoint.x.toFixed(4)}, y=${imagePoint.y.toFixed(4)}, z=${imagePoint.z.toFixed(4)}`);
        console.log(`  World (meters): x=${worldPoint.x.toFixed(4)}, y=${worldPoint.y.toFixed(4)}, z=${worldPoint.z.toFixed(4)}`);
      }
    };
    
    // Convert normalized coordinates to pixel coordinates for display
    const normalizedToPixelCoords = (point, canvasWidth, canvasHeight) => {
      return {
        x: Math.round(point.x * canvasWidth),
        y: Math.round(point.y * canvasHeight)
      };
    };
    
    // Format coordinates for display
    const formatCoord = (value) => {
      return value?.toFixed(4) || 'N/A';
    };
    
    return (
      <div className="workout-tracker">
        <h2>FLEX-IT-OUT Workout Tracker</h2>
        
        <div className="exercise-selection">
          <h3>Select Exercise:</h3>
          <div className="exercise-buttons">
            {Object.values(EXERCISES).map(exercise => (
              <button 
                key={exercise}
                className={currentExercise === exercise ? 'active' : ''}
                onClick={() => handleExerciseChange(exercise)}
                disabled={webcamRunning}
              >
                {exercise}
              </button>
            ))}
          </div>
        </div>
        
        <div className="workout-stats">
          <div className="stat-box">
            <span className="stat-label">Exercise:</span>
            <span className="stat-value">{currentExercise}</span>
          </div>
          <div className="stat-box">
            <span className="stat-label">Reps:</span>
            <span className="stat-value">{repCount}</span>
          </div>
          <div className="stat-box">
            <span className="stat-label">State:</span>
            <span className="stat-value">{exerciseState}</span>
          </div>
        </div>
        
        <div className="feedback-box">
          <p>{feedback}</p>
        </div>
        
        <div className="webcam-container">
          <video 
            ref={videoRef}
            className="webcam-video" 
            autoPlay 
            playsInline
          ></video>
          <canvas 
            ref={canvasRef}
            className="overlay-canvas"
          ></canvas>
          
          <div className="exercise-counter">
            <div className="counter-circle">
              <span className="counter-number">{repCount}</span>
              <span className="counter-label">REPS</span>
            </div>
          </div>
        </div>
        
        <div className="controls">
          <button 
            className={`webcam-button ${webcamRunning ? 'stop' : 'start'}`}
            onClick={toggleWebcam}
          >
            {webcamRunning ? 'Stop Workout' : 'Start Workout'}
          </button>
          <button 
            className={`landmark-toggle ${showLandmarks ? 'active' : ''}`}
            onClick={toggleLandmarksDisplay}
          >
            {showLandmarks ? 'Hide Landmark Data' : 'Show Landmark Data'}
          </button>
        </div>
        
        {/* Landmark Coordinates Display */}
        {showLandmarks && (
          <div className="landmarks-display">
            <h3>Pose Landmarks</h3>
            <p className="landmarks-info">Click on a landmark to see detailed coordinates and highlight it on video</p>
            
            <div className="landmarks-grid">
              {currentLandmarks && currentLandmarks.imagePoints.map((point, index) => {
                const pixelCoords = normalizedToPixelCoords(
                  point,
                  videoRef.current?.videoWidth || 640,
                  videoRef.current?.videoHeight || 480
                );
                
                const isSelected = index === selectedLandmark;
                
                return (
                  <div 
                    key={index}
                    className={`landmark-item ${isSelected ? 'selected' : ''}`}
                    onClick={() => handleLandmarkClick(index)}
                  >
                    <div className="landmark-name">{LANDMARK_NAMES[index] || `Landmark ${index}`}</div>
                    
                    {isSelected && (
                      <div className="landmark-details">
                        <div className="detail-section">
                          <h4>Image Coordinates (Normalized)</h4>
                          <div className="coordinate-item">
                            <span className="coord-label">x:</span>
                            <span className="coord-value">{formatCoord(point.x)}</span>
                          </div>
                          <div className="coordinate-item">
                            <span className="coord-label">y:</span>
                            <span className="coord-value">{formatCoord(point.y)}</span>
                          </div>
                          <div className="coordinate-item">
                            <span className="coord-label">z:</span>
                            <span className="coord-value">{formatCoord(point.z)}</span>
                          </div>
                          <div className="coordinate-item">
                            <span className="coord-label">visibility:</span>
                            <span className="coord-value">{formatCoord(point.visibility)}</span>
                          </div>
                        </div>
                        
                        <div className="detail-section">
                          <h4>Pixel Coordinates</h4>
                          <div className="coordinate-item">
                            <span className="coord-label">x:</span>
                            <span className="coord-value">{pixelCoords.x}px</span>
                          </div>
                          <div className="coordinate-item">
                            <span className="coord-label">y:</span>
                            <span className="coord-value">{pixelCoords.y}px</span>
                          </div>
                        </div>
                        
                        <div className="detail-section">
                          <h4>3D World Coordinates (meters)</h4>
                          <div className="coordinate-item">
                            <span className="coord-label">x:</span>
                            <span className="coord-value">{formatCoord(currentLandmarks.worldPoints[index].x)}</span>
                          </div>
                          <div className="coordinate-item">
                            <span className="coord-label">y:</span>
                            <span className="coord-value">{formatCoord(currentLandmarks.worldPoints[index].y)}</span>
                          </div>
                          <div className="coordinate-item">
                            <span className="coord-label">z:</span>
                            <span className="coord-value">{formatCoord(currentLandmarks.worldPoints[index].z)}</span>
                          </div>
                        </div>
                      </div>
                    )}
                    
                    {!isSelected && currentLandmarks && (
                      <div className="landmark-summary">
                        <span className="coord-value">({formatCoord(point.x)}, {formatCoord(point.y)}, {formatCoord(point.z)})</span>
                      </div>
                    )}
                  </div>
                );
              })}
              
              {!currentLandmarks && (
                <div className="no-landmarks-message">
                  No landmarks detected. Start the webcam and ensure a person is visible.
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };
  
  export default WorkoutTracker;
  //end