// test
// src/components/ExerciseCounter.jsx
import { useEffect, useState } from 'react';
// import './ExerciseCounter.css';

const ExerciseCounter = ({ exercise, count, state }) => {
  const [animation, setAnimation] = useState('');
  
  useEffect(() => {
    // Apply animation based on exercise state
    if (state === 'ready') {
      setAnimation('');
    } else if (state === 'down' || state === 'up' || state === 'out') {
      setAnimation('pulse');
      // Reset animation after 1 second
      const timer = setTimeout(() => {
        setAnimation('');
      }, 1000);
      
      return () => clearTimeout(timer);
    }
  }, [state]);
  
  useEffect(() => {
    // Flash animation when rep count increases
    if (count > 0) {
      setAnimation('count-up');
      
      const timer = setTimeout(() => {
        setAnimation('');
      }, 500);
      
      return () => clearTimeout(timer);
    }
  }, [count]);
  
  return (
    <div className="exercise-counter">
      <div className="exercise-name">
        {exercise}
      </div>
      <div className={`counter-display ${animation}`}>
        <span className="count-number">{count}</span>
        <span className="count-label">REPS</span>
      </div>
      <div className="counter-state">
        {state === 'ready' && <span className="state-indicator ready">Ready</span>}
        {state === 'down' && <span className="state-indicator down">Down</span>}
        {state === 'up' && <span className="state-indicator up">Up</span>}
        {state === 'out' && <span className="state-indicator out">Out</span>}
      </div>
    </div>
  );
};

export default ExerciseCounter;