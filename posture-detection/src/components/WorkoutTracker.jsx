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
    