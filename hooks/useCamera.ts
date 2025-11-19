import { useState, useCallback, useRef } from 'react';

export const useCamera = () => {
    const [stream, setStream] = useState<MediaStream | null>(null);
    const [error, setError] = useState<string | null>(null);
    const streamRef = useRef<MediaStream | null>(null);

    const startCamera = useCallback(async () => {
        try {
            if (streamRef.current) {
                streamRef.current.getTracks().forEach(track => track.stop());
            }
            const mediaStream = await navigator.mediaDevices.getUserMedia({ video: true });
            streamRef.current = mediaStream;
            setStream(mediaStream);
            setError(null);
        } catch (err) {
            console.error("Error accessing camera:", err);
            setError("Could not access camera. Please grant permission in your browser settings.");
            setStream(null);
        }
    }, []);

    const stopCamera = useCallback(() => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
            setStream(null);
        }
    }, []);

    return { stream, isCameraActive: !!stream, error, startCamera, stopCamera };
};
