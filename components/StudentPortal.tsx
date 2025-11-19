
import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { useAppContext } from '../context/AppContext.tsx';
import { Student, TimetableEntry, AttendanceRecord, SessionData } from '../types.ts';
import { verifyFace, setManualApiKey } from '../services/geminiService.ts';
import { getCurrentLocation, calculateDistance } from '../services/locationService.ts';
import { MAX_DISTANCE_METERS, QR_REFRESH_INTERVAL_MS, RETRY_CONFIDENCE_THRESHOLD, DEFAULT_CLASS_DURATION_MINS } from '../constants.ts';
import FaceCapture from './FaceCapture.tsx';
import { LogoutIcon, MoonIcon, SunIcon, ClipboardCheckIcon, CalendarIcon, ChartPieIcon, MenuIcon, XIcon, UserIcon } from './Icons.tsx';
import { getScheduleStatus } from '../utils/timeUtils.ts';
import { useTheme } from '../context/ThemeContext.tsx';

declare var jsQR: any;

type View = 'dashboard' | 'history' | 'timetable' | 'profile';

interface QRCodeScannerProps {
    onScan: (data: string) => void;
    onClose: () => void;
}

const QRCodeScanner: React.FC<QRCodeScannerProps> = ({ onScan, onClose }) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [error, setError] = useState<string | null>(null);
    const [zoom, setZoom] = useState(1.0);
    const [isZoomSupported, setIsZoomSupported] = useState(false);
    // FIX: Use 'any' for zoom capabilities as 'zoom' is a non-standard property.
    const zoomCapabilitiesRef = useRef<any | null>(null);
    const trackRef = useRef<MediaStreamTrack | null>(null);
    const autoZoomPauseRef = useRef<number | null>(null);

    const handleManualZoom = () => {
        if (!trackRef.current || !zoomCapabilitiesRef.current) return;

        // Clear any existing pause timeout
        if (autoZoomPauseRef.current) {
            clearTimeout(autoZoomPauseRef.current);
        }
        // Pause auto-zoom for 5 seconds after a manual click
        autoZoomPauseRef.current = window.setTimeout(() => {
            autoZoomPauseRef.current = null;
        }, 5000);

        setZoom(prevZoom => {
            const capabilities = zoomCapabilitiesRef.current!;
            let nextZoom = prevZoom + capabilities.step;

            // Cycle zoom: if we go past max, loop back to min
            if (nextZoom > capabilities.max) {
                nextZoom = capabilities.min;
            }
            
            // FIX: Cast constraints to 'any' to allow for the non-standard 'zoom' property.
            trackRef.current!.applyConstraints({ advanced: [{ zoom: nextZoom }] } as any).catch(e => console.warn("Could not apply manual zoom", e));
            
            return nextZoom;
        });
    };

    useEffect(() => {
        let animationFrameId: number;
        let stream: MediaStream | null = null;
        let frameCounter = 0;

        const tick = () => {
            if (videoRef.current && videoRef.current.readyState === videoRef.current.HAVE_ENOUGH_DATA && canvasRef.current) {
                const canvas = canvasRef.current;
                const video = videoRef.current;
                const context = canvas.getContext('2d');

                if (context) {
                    canvas.height = video.videoHeight;
                    canvas.width = video.videoWidth;
                    context.drawImage(video, 0, 0, canvas.width, canvas.height);
                    const imageData = context.getImageData(0, 0, canvas.width, canvas.height);

                    if (typeof jsQR === 'undefined') {
                        console.error("jsQR library not loaded. Please check the script tag in index.html.");
                        setError("QR scanning library failed to load.");
                        if (animationFrameId) cancelAnimationFrame(animationFrameId);
                        return;
                    }

                    const code = jsQR(imageData.data, imageData.width, imageData.height, {
                        inversionAttempts: "dontInvert",
                    });

                    if (code) {
                        onScan(code.data);
                        return; // Stop scanning
                    } else if (trackRef.current && zoomCapabilitiesRef.current && autoZoomPauseRef.current === null) { // Auto-zoom is paused if user interacted manually
                        frameCounter++;
                        const ZOOM_INTERVAL_FRAMES = 180; // Approx 3 seconds at 60fps
                        if (frameCounter > ZOOM_INTERVAL_FRAMES) {
                            frameCounter = 0;
                            
                            setZoom(prevZoom => {
                                const capabilities = zoomCapabilitiesRef.current!;
                                let nextZoom = prevZoom + capabilities.step;
                                
                                if (nextZoom > capabilities.max) {
                                    nextZoom = capabilities.min;
                                }
                                
                                trackRef.current!.applyConstraints({ advanced: [{ zoom: nextZoom }] } as any).catch(e => console.warn("Could not apply auto-zoom", e));
                                
                                return nextZoom;
                            });
                        }
                    }
                }
            }
            animationFrameId = requestAnimationFrame(tick);
        };

        const startCamera = async () => {
            try {
                stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
                if (videoRef.current) {
                    videoRef.current.srcObject = stream;
                    videoRef.current.play();

                    const track = stream.getVideoTracks()[0];
                    if (track) {
                        trackRef.current = track;
                        const capabilities = track.getCapabilities();
                        // @ts-ignore
                        if ('zoom' in capabilities && capabilities.zoom.max > capabilities.zoom.min) {
                            // @ts-ignore
                            zoomCapabilitiesRef.current = capabilities.zoom;
                            setIsZoomSupported(true);
                            if (zoomCapabilitiesRef.current) {
                                setZoom(zoomCapabilitiesRef.current.min);
                            }
                        }
                    }
                    animationFrameId = requestAnimationFrame(tick);
                }
            } catch (err) {
                console.error("Error accessing camera:", err);
                setError("Could not access camera. Please ensure permissions are granted and try again.");
            }
        };

        startCamera();

        return () => {
            if (animationFrameId) {
                cancelAnimationFrame(animationFrameId);
            }
            if (stream) {
                stream.getTracks().forEach(track => track.stop());
            }
            if (autoZoomPauseRef.current) {
                clearTimeout(autoZoomPauseRef.current);
            }
        };
    }, [onScan]);

    return (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-xl max-w-lg w-full text-center">
                <h2 className="text-2xl font-bold mb-4 text-teal-500 dark:text-teal-400">Scan QR Code</h2>
                {error ? (
                    <p className="text-red-500 dark:text-red-400 mb-4">{error}</p>
                ) : (
                    <p className="text-gray-600 dark:text-gray-400 mb-4">Point your camera at the QR code. You can manually zoom if needed.</p>
                )}
                <div className="relative w-full aspect-square bg-gray-200 dark:bg-gray-900 rounded-lg overflow-hidden mb-4">
                    <video ref={videoRef} playsInline className="w-full h-full object-cover"></video>
                    <canvas ref={canvasRef} className="hidden"></canvas>
                    {isZoomSupported && (
                        <>
                            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/60 text-white text-sm font-semibold px-3 py-1.5 rounded-full shadow-lg pointer-events-none">
                                Zoom: {zoom.toFixed(1)}x
                            </div>
                            <button 
                                onClick={handleManualZoom}
                                className="absolute bottom-4 right-4 w-12 h-12 bg-black/60 text-white font-bold text-2xl rounded-full flex items-center justify-center hover:bg-black/80 transition-colors shadow-lg"
                                aria-label="Increase zoom"
                            >
                                +
                            </button>
                        </>
                    )}
                </div>
                <button onClick={onClose} className="w-full bg-gray-300 hover:bg-gray-400 text-gray-800 dark:bg-gray-600 dark:hover:bg-gray-700 dark:text-white font-bold py-3 px-4 rounded transition-colors">
                    Cancel
                </button>
            </div>
        </div>
    );
};

const ApiKeyInput: React.FC<{ onSubmit: (key: string) => void, onClose: () => void }> = ({ onSubmit, onClose }) => {
    const [key, setKey] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (key.trim()) {
            onSubmit(key);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-xl max-w-md w-full">
                <div className="flex justify-between items-start mb-4">
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">Enter API Key</h2>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
                        <XIcon className="w-6 h-6" />
                    </button>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                    The application requires a valid Gemini API Key for face verification. 
                    You can get a free key from <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className="text-cyan-600 hover:underline">Google AI Studio</a>.
                </p>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <input 
                        type="text" 
                        value={key} 
                        onChange={(e) => setKey(e.target.value)} 
                        placeholder="Paste your API Key here..."
                        className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-md bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-cyan-500 outline-none"
                        autoFocus
                    />
                    <div className="flex gap-2 justify-end">
                        <button type="button" onClick={onClose} className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md">Cancel</button>
                        <button type="submit" disabled={!key.trim()} className="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white font-bold rounded-md disabled:bg-gray-400">Save Key</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

const AttendanceDashboard: React.FC<{ user: Student; timetable: TimetableEntry[] }> = ({ user, timetable }) => {
    const { addAttendanceRecord } = useAppContext();
    const [isLoading, setIsLoading] = useState(false);
    const [status, setStatus] = useState('');
    const [showFaceCapture, setShowFaceCapture] = useState(false);
    const [showScanner, setShowScanner] = useState(false);
    const [scannedSession, setScannedSession] = useState<SessionData | null>(null);
    const [retryAttempted, setRetryAttempted] = useState(false);
    const [showApiKeyInput, setShowApiKeyInput] = useState(false);

    const CONFIDENCE_THRESHOLD = 0.9; // 90% confidence required for higher security

    const handleQrScan = useCallback(async (data: string) => {
        setShowScanner(false);
        setIsLoading(true);
        setStatus('QR Code Scanned. Verifying...');
        setRetryAttempted(false); // Reset retry on new scan
        
        try {
            const sessionData: SessionData = JSON.parse(data);

            if (!sessionData.location || !sessionData.timestamp) {
                throw new Error("Invalid QR code data.");
            }
            
            if (Date.now() - sessionData.timestamp > QR_REFRESH_INTERVAL_MS + 5000) {
                 throw new Error("QR code has expired. Please scan a new one.");
            }
            
            setStatus('QR Code accepted. Verifying your location...');
            const studentLocation = await getCurrentLocation();
            const distance = calculateDistance(studentLocation, sessionData.location);

            if (distance > MAX_DISTANCE_METERS) {
                throw new Error(`You are ${Math.round(distance)}m away. You must be within ${MAX_DISTANCE_METERS}m.`);
            }

            setScannedSession(sessionData);
            setStatus('Location verified. Please confirm your identity.');
            setShowFaceCapture(true);
            return;

        } catch (err: any) {
            setStatus(`Error: ${err.message}`);
        }
        setIsLoading(false);
    }, []);
    
    const handleVerification = async (verificationFace: string) => {
        setShowFaceCapture(false);

        if (!scannedSession) {
            setStatus('Error: Session data not found. Please scan the QR code again.');
            setIsLoading(false);
            return;
        }
        
        setStatus('Verifying face...');
        try {
            const verificationResult = await verifyFace(user.registeredFace, verificationFace);
            const confidencePercent = Math.round(verificationResult.confidence * 100);

            // Case 1: Successful match with high confidence
            if (verificationResult.match && verificationResult.confidence >= CONFIDENCE_THRESHOLD) {
                setStatus(`Face verified with ${confidencePercent}% confidence. Checking timetable...`);
                
                const now = new Date();
                const daysOfWeek: TimetableEntry['day'][] = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
                const currentDay = daysOfWeek[now.getDay()];
                const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
                
                const currentClass = timetable.find(entry => {
                    if (entry.day !== currentDay) return false;

                    const classTime = new Date(`1970-01-01T${entry.time}:00`);
                    const classDuration = entry.duration || DEFAULT_CLASS_DURATION_MINS; // Use duration from timetable
                    const endTime = new Date(classTime.getTime() + classDuration * 60000);
                    const nowTime = new Date(`1970-01-01T${currentTime}:00`);

                    return nowTime >= classTime && nowTime <= endTime;
                });

                if (!currentClass) {
                    throw new Error("No class scheduled at this time.");
                }

                const today = new Date().toISOString().split('T')[0];
                const newRecord: Omit<AttendanceRecord, 'id'> = {
                    studentId: user.uid,
                    studentName: user.name,
                    subject: currentClass.subject,
                    date: today,
                    status: 'present',
                };
                await addAttendanceRecord(newRecord);
                setStatus(`Attendance marked for ${currentClass.subject}!`);
                setRetryAttempted(false); // Reset on success

            // Case 2: Match with medium confidence, allow one retry
            } else if (
                verificationResult.match &&
                verificationResult.confidence >= RETRY_CONFIDENCE_THRESHOLD &&
                !retryAttempted
            ) {
                setRetryAttempted(true);
                setStatus(`Almost there! Confidence is ${confidencePercent}%. The minimum required is ${CONFIDENCE_THRESHOLD * 100}%. Please try again in better lighting.`);
                setShowFaceCapture(true);
                setIsLoading(false); // Stop loading indicator while user retakes photo
                return; // Exit function to await retry

            // Case 3: Failed match or low confidence after retry
            } else {
                let errorMessage: string;
                if (!verificationResult.match) {
                     errorMessage = `Face not recognized. The system could not confirm your identity. (Confidence: ${confidencePercent}%)`;
                } else { // Match is true but confidence is below retry threshold, or it's the second attempt
                     errorMessage = `Face match confidence was too low (${confidencePercent}%). Required: ${CONFIDENCE_THRESHOLD * 100}%. Please ensure your face is clear and in good lighting.`;
                }
                throw new Error(errorMessage);
            }

        } catch (err: any) {
            const errorMessage = err.message || "";
            
            // Special handling for API Key errors to allow user to input one
            if (
                errorMessage.includes('API key not valid') || 
                errorMessage.includes('API_KEY_INVALID') || 
                errorMessage.includes('Gemini API key is not configured')
            ) {
                setStatus('Configuration Error: API Key missing or invalid.');
                setShowApiKeyInput(true);
            } else {
                setStatus(`Error: ${errorMessage}`);
                setRetryAttempted(false); // Reset on any final error
            }
        }
        setIsLoading(false);
    };

    const handleApiKeySubmit = (key: string) => {
        setManualApiKey(key);
        setShowApiKeyInput(false);
        setStatus('API Key saved. Please try verification again.');
        // Re-open face capture to let them try immediately
        setShowFaceCapture(true);
    };

    return (
        <div className="w-full">
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-xl w-full text-center">
                <h2 className="text-2xl font-bold text-teal-500 dark:text-teal-400 mb-2">Mark Your Attendance</h2>
                <p className="text-gray-600 dark:text-gray-400 mb-6">Scan the QR code provided by your faculty to begin.</p>
                <button 
                    onClick={() => {
                        setShowScanner(true);
                        setStatus('');
                    }} 
                    className="w-full max-w-xs mx-auto bg-teal-600 hover:bg-teal-700 text-white font-bold py-3 px-4 rounded-lg transition-colors text-lg"
                >
                    Scan QR Code
                </button>
                {isLoading && (
                     <div className="flex items-center justify-center mt-4 text-gray-600 dark:text-gray-300">
                        <svg className="animate-spin -ml-1 mr-3 h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Processing...
                    </div>
                )}
                {status && (
                    <p className={`mt-4 text-lg font-medium ${status.startsWith('Error:') || status.startsWith('Configuration Error') ? 'text-red-500 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                        {status}
                    </p>
                )}
            </div>

            {showScanner && <QRCodeScanner onScan={handleQrScan} onClose={() => setShowScanner(false)} />}
            {showFaceCapture && <FaceCapture onCapture={handleVerification} onClose={() => { setShowFaceCapture(false); setIsLoading(false); setStatus('Verification cancelled.'); setRetryAttempted(false); }} purpose="verification"/>}
            {showApiKeyInput && <ApiKeyInput onSubmit={handleApiKeySubmit} onClose={() => { setShowApiKeyInput(false); setIsLoading(false); }} />}
        </div>
    );
};


const AttendanceHistory: React.FC<{ attendance: AttendanceRecord[] }> = ({ attendance }) => {
    return (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-xl w-full">
            <h2 className="text-2xl font-bold text-teal-500 dark:text-teal-400 mb-4">Your Attendance History</h2>
            {attendance.length > 0 ? (
                <div className="overflow-x-auto max-h-96 overflow-y-auto">
                    <table className="w-full text-left">
                        <thead className="bg-gray-100 dark:bg-gray-700/50 text-gray-600 dark:text-gray-300 sticky top-0">
                            <tr>
                                <th className="p-3">Date</th>
                                <th className="p-3">Subject</th>
                                <th className="p-3 text-center">Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {attendance.map(record => (
                                <tr key={record.id} className="border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/30">
                                    <td className="p-3">{record.date}</td>
                                    <td className="p-3 font-semibold">{record.subject}</td>
                                    <td className="p-3 text-center">
                                        <span className={`px-2 py-1 rounded-full text-xs font-bold ${record.status === 'present' ? 'bg-green-100 text-green-800 dark:bg-green-500/20 dark:text-green-400' : 'bg-red-100 text-red-800 dark:bg-red-500/20 dark:text-red-400'}`}>
                                            {record.status.charAt(0).toUpperCase() + record.status.slice(1)}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            ) : (
                <p className="text-gray-500 dark:text-gray-400 text-center py-4">You have no attendance records yet.</p>
            )}
        </div>
    );
};

const DAYS_OF_WEEK: TimetableEntry['day'][] = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const StudentTimetable: React.FC<{ timetable: TimetableEntry[] }> = ({ timetable }) => {
    const [scheduleStatus, setScheduleStatus] = useState({ currentClassId: null, nextClassId: null });
    const [viewedDay, setViewedDay] = useState<TimetableEntry['day']>(DAYS_OF_WEEK[new Date().getDay() === 0 ? 6 : new Date().getDay() - 1]);

    useEffect(() => {
        const updateStatus = () => setScheduleStatus(getScheduleStatus(timetable));
        updateStatus(); // Initial check
        const intervalId = setInterval(updateStatus, 60000); // Check every minute
        return () => clearInterval(intervalId);
    }, [timetable]);

    const entriesForViewedDay = timetable.filter(entry => entry.day === viewedDay);

    return (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-xl w-full">
            <h2 className="text-2xl font-bold text-teal-500 dark:text-teal-400 mb-4">Your Timetable</h2>

            <div className="flex flex-wrap border-b border-gray-200 dark:border-gray-700 mb-4">
                {DAYS_OF_WEEK.map(day => (
                    <button
                        key={day}
                        onClick={() => setViewedDay(day)}
                        className={`px-4 py-2 -mb-px font-semibold text-sm transition-colors duration-200 focus:outline-none ${
                            viewedDay === day
                                ? 'border-b-2 border-teal-500 dark:border-teal-400 text-teal-500 dark:text-teal-400'
                                : 'text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-white'
                        }`}
                    >
                        {day}
                    </button>
                ))}
            </div>

            {timetable.length > 0 ? (
                <div className="overflow-x-auto max-h-96 overflow-y-auto">
                    <table className="w-full text-left">
                        <thead className="bg-gray-100 dark:bg-gray-700/50 text-gray-600 dark:text-gray-300 sticky top-0">
                            <tr>
                                <th className="p-3">Time</th>
                                <th className="p-3">Subject</th>
                                <th className="p-3">Faculty</th>
                                <th className="p-3">Duration</th>
                                <th className="p-3">Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {entriesForViewedDay.length > 0 ? (
                                entriesForViewedDay.map(entry => {
                                    const isCurrent = entry.id === scheduleStatus.currentClassId;
                                    const isNext = entry.id === scheduleStatus.nextClassId;
                                    const rowClass = `border-b border-gray-200 dark:border-gray-700 transition-colors duration-200 ${
                                        isCurrent ? 'bg-green-50 dark:bg-green-900/50 border-l-4 border-green-500' :
                                        isNext ? 'bg-cyan-50 dark:bg-cyan-900/50 border-l-4 border-cyan-500' :
                                        'hover:bg-gray-50 dark:hover:bg-gray-700/30'
                                    }`;
                                    
                                    return (
                                        <tr key={entry.id} className={rowClass}>
                                            <td className={`p-3 text-black dark:text-gray-300 ${isCurrent || isNext ? 'font-semibold dark:text-white' : ''}`}>{entry.time}</td>
                                            <td className={`p-3 font-semibold text-black ${isCurrent ? 'dark:text-green-300' : isNext ? 'dark:text-cyan-300' : 'dark:text-gray-300'}`}>{entry.subject}</td>
                                            <td className="p-3 text-gray-500 dark:text-gray-400">{entry.facultyName}</td>
                                            <td className="p-3 text-gray-500 dark:text-gray-400">{entry.duration || DEFAULT_CLASS_DURATION_MINS} mins</td>
                                            <td className="p-3">
                                                {isCurrent && <span className="px-2 py-1 text-xs font-bold tracking-wider text-green-800 bg-green-200 dark:text-green-100 dark:bg-green-600 rounded-full">NOW</span>}
                                                {isNext && <span className="px-2 py-1 text-xs font-bold tracking-wider text-cyan-800 bg-cyan-200 dark:text-cyan-100 dark:bg-cyan-600 rounded-full">NEXT</span>}
                                            </td>
                                        </tr>
                                    );
                                })
                            ) : (
                                <tr>
                                    <td colSpan={5} className="text-center p-8 text-gray-500">No classes scheduled for {viewedDay}.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            ) : (
                <p className="text-gray-500 dark:text-gray-400 text-center py-4">The timetable has not been set up yet.</p>
            )}
        </div>
    );
};

const AttendanceStatsAndHistory: React.FC<{ attendance: AttendanceRecord[] }> = ({ attendance }) => {
    const stats = useMemo(() => {
        if (!attendance || attendance.length === 0) return null;

        const totalPresent = attendance.filter(r => r.status === 'present').length;
        const overallPercentage = (totalPresent / attendance.length) * 100;

        const subjectStats: { [subject: string]: { present: number, total: number } } = {};
        attendance.forEach(record => {
            if (!subjectStats[record.subject]) {
                subjectStats[record.subject] = { present: 0, total: 0 };
            }
            subjectStats[record.subject].total++;
            if (record.status === 'present') {
                subjectStats[record.subject].present++;
            }
        });

        const perSubject = Object.entries(subjectStats).map(([subject, data]) => ({
            subject,
            present: data.present,
            total: data.total,
            percentage: (data.present / data.total) * 100,
        })).sort((a,b) => a.subject.localeCompare(b.subject));

        return { overallPercentage, perSubject, totalPresent };
    }, [attendance]);

    if (!stats) {
        return (
            <div className="space-y-8">
                <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-xl text-center">
                    <h2 className="text-2xl font-bold text-teal-500 dark:text-teal-400 mb-4">Your Attendance Stats</h2>
                    <p className="text-gray-500 dark:text-gray-400">No attendance records found to calculate statistics.</p>
                </div>
                <AttendanceHistory attendance={attendance} />
            </div>
        );
    }

    return (
        <div className="space-y-8">
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-xl">
                <h2 className="text-2xl font-bold text-teal-500 dark:text-teal-400 mb-4">Attendance Summary</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-gray-100/50 dark:bg-gray-700/50 p-6 rounded-lg flex flex-col items-center justify-center text-center">
                         <span className="text-sm font-semibold text-gray-500 dark:text-gray-400">OVERALL ATTENDANCE</span>
                         <p className="text-5xl font-bold text-gray-900 dark:text-white mt-2">
                             {stats.overallPercentage.toFixed(1)}<span className="text-3xl text-gray-500 dark:text-gray-400">%</span>
                         </p>
                         <p className="text-gray-600 dark:text-gray-300 mt-2">
                             {stats.totalPresent} of {attendance.length} classes attended
                         </p>
                    </div>
                     <div className="bg-gray-100/50 dark:bg-gray-700/50 p-4 rounded-lg">
                        <h4 className="font-semibold text-gray-800 dark:text-gray-200 mb-3 px-2">By Subject</h4>
                        <div className="space-y-2 max-h-60 overflow-y-auto">
                            {stats.perSubject.map(s => (
                                <div key={s.subject} className="flex items-center justify-between text-sm p-2 rounded-md hover:bg-gray-200/50 dark:hover:bg-gray-600/50">
                                    <div>
                                        <p className="font-medium text-gray-900 dark:text-white">{s.subject}</p>
                                        <p className="text-gray-500 dark:text-gray-400">{s.present} / {s.total} attended</p>
                                    </div>
                                    <span className="font-bold text-lg text-teal-600 dark:text-teal-300">{s.percentage.toFixed(0)}%</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
            <AttendanceHistory attendance={attendance} />
        </div>
    );
}

const StudentProfile: React.FC<{ student: Student }> = ({ student }) => {
    return (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-xl max-w-lg mx-auto">
            <h2 className="text-2xl font-bold text-teal-500 dark:text-teal-400 mb-6">Your Profile</h2>
            
            <div className="flex flex-col items-center gap-6">
                <div className="relative">
                    <img src={student.registeredFace} alt="Registered Face" className="w-48 h-48 rounded-full object-cover border-4 border-teal-500/50 shadow-lg"/>
                </div>
                
                <div className="w-full text-left space-y-4">
                    <div>
                        <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Name</label>
                        <p className="w-full mt-1 text-lg p-3 bg-gray-100/50 dark:bg-gray-700/50 rounded-md">
                            {student.name}
                        </p>
                    </div>
                    <div>
                        <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Roll Number</label>
                        <p className="w-full mt-1 text-lg p-3 bg-gray-100/50 dark:bg-gray-700/50 rounded-md">
                            {student.rollNo}
                        </p>
                    </div>
                    <div>
                        <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Email Address</label>
                        <p className="text-lg p-3 bg-gray-100/50 dark:bg-gray-700/50 rounded-md mt-1">{student.email}</p>
                    </div>
                    <div>
                        <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Department</label>
                        <p className="text-lg p-3 bg-gray-100/50 dark:bg-gray-700/50 rounded-md mt-1">{student.department}</p>
                    </div>
                </div>
            </div>
        </div>
    );
};


const StudentPortal: React.FC = () => {
    const { currentStudent, timetable, attendance, logout } = useAppContext();
    const { theme, setTheme } = useTheme();
    const [view, setView] = useState<View>('dashboard');
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);


    if (!currentStudent) {
        return <p>Loading student data...</p>;
    }
    
    const menuItems = [
        { id: 'dashboard', label: 'Mark Attendance', icon: ClipboardCheckIcon },
        { id: 'history', label: 'History & Stats', icon: ChartPieIcon },
        { id: 'timetable', label: 'Timetable', icon: CalendarIcon },
        { id: 'profile', label: 'Profile', icon: UserIcon },
    ];
    
    const viewTitles: Record<View, string> = {
        dashboard: `Welcome, ${currentStudent.name}`,
        history: 'Attendance History & Statistics',
        timetable: 'Your Class Timetable',
        profile: 'Your Profile',
    };

    const renderView = () => {
        switch (view) {
            case 'history':
                return <AttendanceStatsAndHistory attendance={attendance} />;
            case 'timetable':
                return <StudentTimetable timetable={timetable} />;
            case 'profile':
                return <StudentProfile student={currentStudent} />;
            case 'dashboard':
            default:
                return <AttendanceDashboard user={currentStudent} timetable={timetable} />;
        }
    };

    return (
        <div className="min-h-screen bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100">
            {isSidebarOpen && (
                <div 
                    className="fixed inset-0 bg-black/60 z-30 lg:hidden" 
                    onClick={() => setIsSidebarOpen(false)}
                    aria-hidden="true"
                ></div>
            )}
            
            <aside className={`fixed top-0 left-0 h-full w-64 bg-white dark:bg-gray-800 flex flex-col shadow-lg z-40 transition-transform duration-300 ease-in-out transform ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0 lg:flex border-r border-gray-200 dark:border-gray-700`}>
                <div className="h-20 flex items-center justify-between px-4 border-b border-gray-200 dark:border-gray-700">
                    <h1 className="text-2xl font-bold text-teal-500 dark:text-teal-400">Student Portal</h1>
                     <button onClick={() => setIsSidebarOpen(false)} className="p-2 text-gray-500 dark:text-gray-400 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 lg:hidden">
                        <span className="sr-only">Close sidebar</span>
                        <XIcon className="w-6 h-6" />
                    </button>
                </div>
                <nav className="flex-1 p-4 space-y-2">
                    {menuItems.map(item => (
                        <button 
                            key={item.id} 
                            onClick={() => {
                                setView(item.id as View)
                                setIsSidebarOpen(false)
                            }} 
                            className={`w-full flex items-center gap-3 px-4 py-3 rounded-md text-lg font-medium transition-colors ${
                                view === item.id 
                                ? 'bg-teal-600 text-white shadow-md' 
                                : 'text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 dark:hover:text-white'
                            }`}
                        >
                            <item.icon className="w-6 h-6" />
                            <span>{item.label}</span>
                        </button>
                    ))}
                </nav>
                 <div className="p-4 border-t border-gray-200 dark:border-gray-700">
                     <div className="flex items-center gap-3">
                         <img src={currentStudent.registeredFace} alt="Profile" className="w-12 h-12 rounded-full object-cover"/>
                         <div>
                             <p className="font-semibold text-gray-800 dark:text-white truncate" title={currentStudent.name}>{currentStudent.name}</p>
                             <p className="text-xs text-gray-500 dark:text-gray-400 truncate" title={currentStudent.rollNo}>{currentStudent.rollNo}</p>
                         </div>
                     </div>
                 </div>
                 <div className="p-4 border-t border-gray-200 dark:border-gray-700">
                    <button onClick={logout} className="w-full flex items-center gap-3 px-4 py-3 rounded-md text-lg font-medium text-red-600 hover:bg-red-100 dark:text-red-400 dark:hover:bg-red-500/20 dark:hover:text-red-300 transition-colors">
                        <LogoutIcon className="w-6 h-6" />
                        <span>Logout</span>
                    </button>
                </div>
            </aside>
            
            <main className="flex-1 flex flex-col min-h-screen lg:pl-64">
                 <header className="bg-white dark:bg-gray-800 shadow-md h-20 flex-shrink-0 flex items-center justify-between px-4 sm:px-8">
                    <div className="flex items-center">
                        <button 
                            onClick={() => setIsSidebarOpen(true)} 
                            className="p-2 mr-4 rounded-md text-gray-500 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-teal-500 lg:hidden"
                            aria-label="Open sidebar"
                        >
                            <MenuIcon className="w-6 h-6" />
                        </button>
                        <div>
                            <h2 className="text-2xl sm:text-3xl font-bold">{viewTitles[view]}</h2>
                            {view === 'dashboard' && <p className="text-gray-500 dark:text-gray-400 text-sm sm:text-base">Roll No: {currentStudent.rollNo}</p>}
                        </div>
                    </div>
                     <div className="flex items-center bg-gray-200 dark:bg-gray-700 rounded-full p-1">
                        <button
                            onClick={() => setTheme('light')}
                            className={`p-1.5 rounded-full transition-colors duration-300 ${theme === 'light' ? 'bg-white shadow text-teal-500' : 'text-gray-500 hover:bg-gray-300/50'}`}
                            aria-label="Switch to light theme"
                        >
                            <SunIcon className="w-5 h-5" />
                        </button>
                        <button
                            onClick={() => setTheme('dark')}
                            className={`p-1.5 rounded-full transition-colors duration-300 ${theme === 'dark' ? 'bg-gray-900 text-white shadow' : 'text-gray-500 hover:bg-gray-600/50'}`}
                            aria-label="Switch to dark theme"
                        >
                            <MoonIcon className="w-5 h-5" />
                        </button>
                    </div>
                </header>
                <div className="flex-1 p-4 sm:p-8 overflow-y-auto">
                    {renderView()}
                </div>
            </main>
        </div>
    );
};

export default StudentPortal;
