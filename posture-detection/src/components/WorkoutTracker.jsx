// WorkoutTracker.jsx
import { useState, useEffect, useRef } from 'react';
import './WorkoutTracker.css';

const EXERCISES = {
  SQUAT: 'Squat',
  PUSHUP: 'Push-Up',
  CRUNCH: 'Crunch',
  JUMPING_JACK: 'Jumping Jack',
};