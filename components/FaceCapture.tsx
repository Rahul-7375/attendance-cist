import React, { useRef, useEffect } from 'react';

interface FaceCaptureProps {
    onCapture: (base64Image: string) => void;
    onClose: () => void;
    purpose: 'registration' | 'verification' | 'profileUpdate';
}

const FaceCapture: React.FC<FaceCaptureProps> = ({ onCapture, onClose, purpose }) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const streamRef = useRef<MediaStream | null>(null);

    useEffect(() => {
        const startCamera = async () => {
            try {
                const mediaStream = await navigator.mediaDevices.getUserMedia({ video: true });
                streamRef.current = mediaStream;
                if (videoRef.current) {
                    videoRef.current.srcObject = mediaStream;
                }
            } catch (err) {
                console.error("Error accessing camera:", err);
                alert("Could not access camera. Please ensure permissions are granted.");
                onClose();
            }
        };

        startCamera();

        return () => {
            if (streamRef.current) {
                streamRef.current.getTracks().forEach(track => track.stop());
            }
        };
    }, [onClose]);
    
    const handleCapture = () => {
        if (videoRef.current && canvasRef.current) {
            const context = canvasRef.current.getContext('2d');
            if (context) {
                const video = videoRef.current;
                const canvas = canvasRef.current;
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;

                // Flip the canvas context horizontally to create a non-mirrored image
                // from the mirrored video stream often provided by front-facing cameras.
                context.translate(canvas.width, 0);
                context.scale(-1, 1);
                
                context.drawImage(video, 0, 0, canvas.width, canvas.height);
                const dataUrl = canvas.toDataURL('image/jpeg');
                onCapture(dataUrl);
            }
        }
    };

    const titleText = {
        registration: 'Register Your Face',
        verification: 'Face Verification',
        profileUpdate: 'Update Profile Photo'
    };
    
    return (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-xl max-w-lg w-full text-center">
                <h2 className="text-2xl font-bold mb-4 text-cyan-500 dark:text-cyan-400">
                    {titleText[purpose]}
                </h2>
                <p className="text-gray-600 dark:text-gray-400 mb-4">Please position your face in the center of the frame.</p>
                <div className="relative w-full aspect-square bg-gray-200 dark:bg-gray-900 rounded-lg overflow-hidden mb-4">
                     <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover transform scale-x-[-1]"></video>
                </div>
                <canvas ref={canvasRef} className="hidden"></canvas>
                <div className="flex gap-4">
                    <button onClick={onClose} className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-800 dark:bg-gray-600 dark:hover:bg-gray-700 dark:text-white font-bold py-2 px-4 rounded transition-colors">
                        Cancel
                    </button>
                    <button onClick={handleCapture} className="flex-1 bg-teal-600 hover:bg-teal-700 text-white font-bold py-2 px-4 rounded transition-colors">
                        Capture
                    </button>
                </div>
            </div>
        </div>
    );
};

export default FaceCapture;