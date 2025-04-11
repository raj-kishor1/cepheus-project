import React, { useEffect, useRef } from "react";

const LivePoseDetection = () => {
    const videoRef = useRef(null);

    useEffect(() => {
        videoRef.current.src = "http://localhost:5000/video_feed";
    }, []);

    return (
        <div>
            <h2>Live Pose Detection</h2>
            <img ref={videoRef} alt="Live Pose Detection" style={{ width: "640px", height: "480px" }} />
        </div>
    );
};

export default LivePoseDetection;
