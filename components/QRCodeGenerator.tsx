

import React, { useEffect, useRef, useState } from 'react';
import { QR_REFRESH_INTERVAL_MS } from '../constants.ts';
import { SessionData } from '../types.ts';

declare var QRious: any;

interface QRCodeGeneratorProps {
    sessionData: SessionData;
    size?: number;
}

const QRCodeGenerator: React.FC<QRCodeGeneratorProps> = ({ sessionData, size = 256 }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [countdown, setCountdown] = useState(QR_REFRESH_INTERVAL_MS / 1000);
    const countdownIntervalRef = useRef<number | null>(null);

    // Effect for handling the visual countdown timer
    useEffect(() => {
        // When sessionData changes, it means a refresh happened. Reset the countdown.
        setCountdown(QR_REFRESH_INTERVAL_MS / 1000);
        
        // Clear previous interval to avoid memory leaks
        if (countdownIntervalRef.current) {
            clearInterval(countdownIntervalRef.current);
        }

        // Start a new countdown interval
        countdownIntervalRef.current = window.setInterval(() => {
            setCountdown(prev => (prev > 0 ? prev - 1 : 0));
        }, 1000);

        // Cleanup function for when the component unmounts
        return () => {
            if (countdownIntervalRef.current) {
                clearInterval(countdownIntervalRef.current);
            }
        };
    }, [sessionData]); // This effect re-runs every time the session data is updated from the parent

    // Effect for drawing the QR code
    useEffect(() => {
        if (canvasRef.current && sessionData) {
            if (typeof QRious === 'undefined') {
                console.error("QRious library not loaded. Please check the script tag in index.html.");
                return;
            }
            // The value includes a random component to ensure the QR code image is unique each time,
            // even if location/timestamp were somehow identical.
            const qrValue = JSON.stringify({ ...sessionData, random: Math.random() });
            new QRious({
                element: canvasRef.current,
                value: qrValue,
                size: size,
                background: 'white',
                foreground: 'black',
            });
        }
    }, [sessionData, size]); // This effect also re-runs on session data update

    return (
        <div className="text-center p-4 bg-gray-100 dark:bg-gray-700 rounded-lg">
            <h3 className="text-lg font-semibold mb-2">Scan to Mark Attendance</h3>
            <canvas ref={canvasRef} className="mx-auto rounded-md"></canvas>
            <p className="mt-4 text-gray-600 dark:text-gray-300">QR code refreshes in: <span className="font-bold text-cyan-500 dark:text-cyan-400">{countdown}s</span></p>
        </div>
    );
};

export default QRCodeGenerator;