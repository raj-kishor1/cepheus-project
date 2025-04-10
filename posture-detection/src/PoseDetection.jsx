import React, { useState } from "react";
import axios from "axios";

const PoseDetection = () => {
    const [selectedFile, setSelectedFile] = useState(null);
    const [processedImage, setProcessedImage] = useState(null);

    const handleFileChange = (event) => {
        setSelectedFile(event.target.files[0]);
    };

    const handleUpload = async () => {
        if (!selectedFile) return;

        const formData = new FormData();
        formData.append("image", selectedFile);

        try {
            const response = await axios.post("http://localhost:5000/process-frame", formData, {
                headers: { "Content-Type": "multipart/form-data" }
            });

            setProcessedImage(`data:image/jpeg;base64,${response.data.processed_image}`);
        } catch (error) {
            console.error("Error processing image:", error);
        }
    };

    return (
        <div>
            <h2>Upload an Image for Pose Detection</h2>
            <input type="file" accept="image/*" onChange={handleFileChange} />
            <button onClick={handleUpload}>Upload & Detect Pose</button>
            {processedImage && <img src={processedImage} alt="Processed Pose" />}
        </div>
    );
};

export default PoseDetection;
