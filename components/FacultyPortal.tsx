
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useAppContext } from '../context/AppContext.tsx';
import { getCurrentLocation, calculateDistance } from '../services/locationService.ts';
// FIX: Changed GeolocationCoordinates to LocationCoordinate as it is the correct exported type.
import { Student, TimetableEntry, AttendanceRecord, Faculty, LocationCoordinate } from '../types.ts';
import { LogoutIcon, TrashIcon, DashboardIcon, CalendarIcon, UsersIcon, ClipboardCheckIcon, UserIcon, MenuIcon, XIcon, SunIcon, MoonIcon, CameraIcon } from './Icons.tsx';
import QRCodeGenerator from './QRCodeGenerator.tsx';
import { QR_REFRESH_INTERVAL_MS, MAX_FACULTY_MOVEMENT_METERS, DEFAULT_CLASS_DURATION_MINS } from '../constants.ts';
import { getScheduleStatus } from '../utils/timeUtils.ts';
import FullScreenQRCode from './FullScreenQRCode.tsx';
import { useTheme } from '../context/ThemeContext.tsx';
import { fileToBase64 } from '../utils/fileUtils.ts';

type View = 'dashboard' | 'timetable' | 'students' | 'attendance' | 'profile';

const FacultyPortal: React.FC = () => {
    const { 
        students, timetable, attendance, activeSession, setActiveSession, logout, deleteStudent, markManualAttendance, 
        addTimetableEntry, updateTimetableEntry, deleteTimetableEntry, currentFaculty, updateFacultyProfile, deleteAttendanceRecord,
        systemError, studentsError, timetableError, attendanceError
    } = useAppContext();
    const [view, setView] = useState<View>('dashboard');
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    // FIX: Changed GeolocationCoordinates to LocationCoordinate to match the imported type.
    const [initialSessionLocation, setInitialSessionLocation] = useState<LocationCoordinate | null>(null);
    const [selectedStudentForReport, setSelectedStudentForReport] = useState<Student | null>(null);
    const [showFullScreenQR, setShowFullScreenQR] = useState(false);
    const { theme, setTheme } = useTheme();
    const [countdown, setCountdown] = useState(0);
    const countdownIntervalRef = useRef<number | null>(null);


    const facultySubjects = useMemo(() => {
        return currentFaculty?.subjects || [];
    }, [currentFaculty]);

    const facultyAttendance = useMemo(() => {
        if (facultySubjects.length === 0) return [];
        return attendance.filter(record => facultySubjects.includes(record.subject));
    }, [attendance, facultySubjects]);


    const stopSession = useCallback(() => {
        setActiveSession(null);
        setInitialSessionLocation(null);
        setShowFullScreenQR(false);
    }, [setActiveSession]);

    // This effect manages the countdown timer for the dashboard view.
    useEffect(() => {
        if (activeSession) {
            // When a session starts or the QR code refreshes, reset the countdown.
            setCountdown(QR_REFRESH_INTERVAL_MS / 1000);

            // Clear any existing interval to prevent duplicates.
            if (countdownIntervalRef.current) {
                clearInterval(countdownIntervalRef.current);
            }

            // Start a new interval to tick down the timer every second.
            countdownIntervalRef.current = window.setInterval(() => {
                setCountdown(prev => (prev > 0 ? prev - 1 : 0));
            }, 1000);

        } else {
            // If the session stops, clear the interval.
            if (countdownIntervalRef.current) {
                clearInterval(countdownIntervalRef.current);
            }
            setCountdown(0);
        }

        // Cleanup: Ensure the interval is cleared when the component unmounts or the session changes.
        return () => {
            if (countdownIntervalRef.current) {
                clearInterval(countdownIntervalRef.current);
            }
        };
    }, [activeSession]);


    // This hook manages updating the faculty's location for an active session.
    // It ensures the QR code always contains a recent location and verifies the faculty hasn't moved too far.
    useEffect(() => {
        if (!activeSession || !initialSessionLocation) {
            return;
        }

        const locationRefreshInterval = setInterval(async () => {
            try {
                const newLocation = await getCurrentLocation();
                
                // Real-time check to ensure faculty hasn't moved too far from the starting point.
                const distanceFromStart = calculateDistance(newLocation, initialSessionLocation);

                if (distanceFromStart > MAX_FACULTY_MOVEMENT_METERS) {
                    stopSession();
                    setError(`Session stopped: You moved more than ${MAX_FACULTY_MOVEMENT_METERS}m from your starting location.`);
                    return; // Stop further execution for this interval.
                }

                // If check passes, update the session with the new location and a fresh timestamp.
                setActiveSession({ location: newLocation, timestamp: Date.now() });

            } catch (err: any) {
                console.error("Failed to update faculty location:", err);
                setError(`Could not update location: ${err.message}. Please ensure location services are enabled.`);
            }
        }, QR_REFRESH_INTERVAL_MS);

        return () => {
            clearInterval(locationRefreshInterval);
        };
    }, [activeSession, initialSessionLocation, setActiveSession, stopSession]);


    const startSession = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const location = await getCurrentLocation();
            setActiveSession({ location, timestamp: Date.now() });
            setInitialSessionLocation(location); // Store the starting location for distance checks.
            setShowFullScreenQR(true); // Show the QR code in a fullscreen modal
        } catch (err: any) {
            setError(err.message);
            setActiveSession(null);
            setInitialSessionLocation(null);
        } finally {
            setIsLoading(false);
        }
    };

    const handleViewStudentReport = (student: Student) => {
        setSelectedStudentForReport(student);
        setView('attendance');
    };

    const renderErrorBanner = (msg: string) => (
        <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-4 rounded shadow-sm relative">
             <h3 className="font-bold text-sm">Data Fetch Error</h3>
             <p className="text-sm">{msg}</p>
        </div>
    );

    const renderView = () => {
        switch (view) {
            case 'timetable':
                return (
                    <>
                        {timetableError && renderErrorBanner(timetableError)}
                        <TimetableManager 
                            timetable={timetable}
                            subjects={facultySubjects}
                            currentFaculty={currentFaculty}
                            addEntry={addTimetableEntry}
                            updateEntry={updateTimetableEntry}
                            deleteEntry={deleteTimetableEntry}
                        />
                    </>
                );
            case 'students':
                return (
                    <>
                        {studentsError && renderErrorBanner(studentsError)}
                        <StudentList students={students} deleteStudent={deleteStudent} onViewReport={handleViewStudentReport} />
                    </>
                );
            case 'attendance':
                return (
                    <>
                        {attendanceError && renderErrorBanner(attendanceError)}
                        <AttendanceReport 
                                students={students} 
                                attendance={facultyAttendance}
                                subjects={facultySubjects}
                                selectedStudentId={selectedStudentForReport?.uid}
                                onClearSelection={() => setSelectedStudentForReport(null)}
                                deleteRecord={deleteAttendanceRecord}
                        />
                    </>
                );
            case 'profile':
                return <FacultyProfile faculty={currentFaculty} updateProfile={updateFacultyProfile} />;
            case 'dashboard':
            default:
                return (
                    <div className="max-w-2xl mx-auto space-y-6">
                        {systemError && (
                             <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded shadow-sm relative">
                                <h3 className="font-bold">System Error</h3>
                                <p className="text-sm">{systemError}</p>
                            </div>
                        )}
                        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-xl w-full">
                            <h2 className="text-2xl font-bold text-cyan-500 dark:text-cyan-400 mb-4">Attendance Session</h2>
                            {error && <p className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300 p-3 rounded mb-4 text-sm">{error}</p>}
                            {activeSession ? (
                                <div className="space-y-4">
                                    <div className="text-center p-4 bg-gray-100 dark:bg-gray-700 rounded-lg">
                                        <h3 className="text-lg font-semibold text-green-600 dark:text-green-400">Session is Active</h3>
                                        <p className="mt-2 text-gray-600 dark:text-gray-300">A unique QR code is being generated for students.</p>
                                        
                                        <div className={`mt-4 p-3 rounded-md transition-colors duration-300 ${countdown <= 3 ? 'bg-red-100 dark:bg-red-900/40 border border-red-200 dark:border-red-800/50' : 'bg-yellow-100 dark:bg-yellow-900/40 border border-yellow-200 dark:border-yellow-800/50'}`}>
                                            <p className={`font-semibold text-sm ${countdown <= 3 ? 'text-red-700 dark:text-red-300' : 'text-yellow-700 dark:text-yellow-400'}`}>
                                                QR code refreshes in {countdown}s
                                            </p>
                                        </div>

                                        <button 
                                            onClick={() => setShowFullScreenQR(true)} 
                                            className="w-full mt-4 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded transition-colors"
                                        >
                                            Show QR Code
                                        </button>
                                    </div>
                                    <button
                                        onClick={stopSession}
                                        className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded transition-colors"
                                    >
                                        Stop Session
                                    </button>
                                </div>
                            ) : (
                                <button
                                    onClick={startSession}
                                    disabled={isLoading}
                                    className="w-full bg-cyan-600 hover:bg-cyan-700 text-white font-bold py-3 px-4 rounded transition-colors disabled:bg-gray-500 flex items-center justify-center"
                                >
                                    {isLoading ? (
                                        <>
                                        <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                        </svg>
                                        Getting Location...
                                        </>
                                    ) : 'Start Session'}
                                </button>
                            )}
                        </div>
                        <ManualAttendance students={students} subjects={facultySubjects} markManualAttendance={markManualAttendance} />
                    </div>
                );
        }
    };
    
    const menuItems = [
        { id: 'dashboard', label: 'Dashboard', icon: DashboardIcon },
        { id: 'timetable', label: 'Timetable', icon: CalendarIcon },
        { id: 'students', label: 'Students', icon: UsersIcon },
        { id: 'attendance', label: 'Attendance', icon: ClipboardCheckIcon },
        { id: 'profile', label: 'Profile', icon: UserIcon },
    ];
    
    const viewTitles: Record<View, string> = {
        dashboard: 'Dashboard',
        timetable: 'Timetable Management',
        students: 'Student Roster',
        attendance: 'Attendance Records',
        profile: 'Your Profile',
    };

    return (
        <div className="min-h-screen bg-cyan-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100">
            {/* Sidebar Overlay */}
            {isSidebarOpen && (
                <div 
                    className="fixed inset-0 bg-black/60 z-30 lg:hidden" 
                    onClick={() => setIsSidebarOpen(false)}
                    aria-hidden="true"
                ></div>
            )}
            
            {/* Sidebar */}
            <aside className={`fixed top-0 left-0 h-full w-64 bg-white dark:bg-gray-800 flex flex-col shadow-lg z-40 transition-transform duration-300 ease-in-out transform ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0 lg:flex border-r border-gray-200 dark:border-r-0`}>
                <div className="h-20 flex items-center justify-between px-4 border-b border-gray-200 dark:border-gray-700">
                    <h1 className="text-2xl font-bold text-cyan-500 dark:text-cyan-400">Faculty Portal</h1>
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
                                ? 'bg-cyan-600 text-white shadow-md' 
                                : 'text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 dark:hover:text-white'
                            }`}
                        >
                            <item.icon className="w-6 h-6" />
                            <span>{item.label}</span>
                        </button>
                    ))}
                </nav>
                <div className="p-4">
                    <div className="flex items-center gap-3">
                        {currentFaculty?.profilePicture ? (
                            <img src={currentFaculty.profilePicture} alt="Profile" className="w-12 h-12 rounded-full object-cover"/>
                        ) : (
                             <div className="w-12 h-12 rounded-full bg-cyan-200 dark:bg-cyan-700/50 flex items-center justify-center text-xl font-bold text-cyan-700 dark:text-cyan-100">
                                {currentFaculty?.name.charAt(0)}
                            </div>
                        )}
                        <div>
                            <p className="font-semibold text-gray-800 dark:text-white truncate" title={currentFaculty?.name}>{currentFaculty?.name}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400 truncate" title={currentFaculty?.email}>{currentFaculty?.email}</p>
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
            
            {/* Main Content */}
            <main className="flex-1 flex flex-col min-h-screen lg:pl-64">
                <header className="bg-white dark:bg-gray-800 shadow-md h-20 flex-shrink-0 flex items-center justify-between px-4 sm:px-8">
                    <div className="flex items-center">
                        <button 
                            onClick={() => setIsSidebarOpen(true)} 
                            className="p-2 mr-4 rounded-md text-gray-500 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-cyan-500 lg:hidden"
                            aria-label="Open sidebar"
                        >
                            <MenuIcon className="w-6 h-6" />
                        </button>
                        <h2 className="text-2xl sm:text-3xl font-bold">{viewTitles[view]}</h2>
                    </div>
                    <div className="flex items-center bg-gray-200 dark:bg-gray-700 rounded-full p-1">
                        <button
                            onClick={() => setTheme('light')}
                            className={`p-1.5 rounded-full transition-colors duration-300 ${theme === 'light' ? 'bg-white shadow text-cyan-500' : 'text-gray-500 hover:bg-gray-300/50'}`}
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

            {showFullScreenQR && activeSession && (
                <FullScreenQRCode 
                    sessionData={activeSession} 
                    onClose={() => setShowFullScreenQR(false)} 
                />
            )}
        </div>
    );
};

const DAYS_OF_WEEK: TimetableEntry['day'][] = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const TimetableManager: React.FC<{ 
    timetable: TimetableEntry[]; 
    subjects: string[];
    currentFaculty: Faculty | null;
    // FIX: Changed type to Omit 'department' as it's handled by the context.
    addEntry: (entry: Omit<TimetableEntry, 'id' | 'facultyId' | 'facultyName' | 'department'>) => Promise<void>;
    updateEntry: (entry: TimetableEntry) => Promise<void>;
    deleteEntry: (id: string) => Promise<void>;
}> = ({ timetable, subjects, currentFaculty, addEntry, updateEntry, deleteEntry }) => {
    const [day, setDay] = useState<TimetableEntry['day']>('Monday');
    const [time, setTime] = useState('');
    const [subject, setSubject] = useState(subjects.length > 0 ? subjects[0] : '');
    const [duration, setDuration] = useState(DEFAULT_CLASS_DURATION_MINS);
    const [editingEntry, setEditingEntry] = useState<TimetableEntry | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>('');
    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    const [scheduleStatus, setScheduleStatus] = useState({ currentClassId: null, nextClassId: null });
    const [viewedDay, setViewedDay] = useState<TimetableEntry['day']>(DAYS_OF_WEEK[new Date().getDay() === 0 ? 6 : new Date().getDay() - 1]);

    useEffect(() => {
        const updateStatus = () => setScheduleStatus(getScheduleStatus(timetable));
        updateStatus(); // Initial check
        const intervalId = setInterval(updateStatus, 60000); // Check every minute
        return () => clearInterval(intervalId);
    }, [timetable]);

    useEffect(() => {
        if (subjects.length > 0 && !subjects.includes(subject)) {
            setSubject(subjects[0]);
        } else if (subjects.length === 0) {
            setSubject('');
        }
    }, [subjects, subject]);

    const resetForm = () => {
        setDay('Monday');
        setTime('');
        setSubject(subjects.length > 0 ? subjects[0] : '');
        setDuration(DEFAULT_CLASS_DURATION_MINS);
        setEditingEntry(null);
        setError('');
    };
    
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSuccessMessage(null);
        setError(null);
        
        if (!time || !subject || duration <= 0) {
            setError('Time, Subject, and a valid Duration are required.');
            return;
        }

        if (!editingEntry) {
            const entriesForDay = timetable.filter(entry => entry.day === day).length;
            if (entriesForDay >= 7) {
                setError(`Cannot add more than 7 classes for ${day}.`);
                return;
            }
        }

        // Check for overlaps
        const timeToMinutes = (t: string) => {
            const [h, m] = t.split(':').map(Number);
            return h * 60 + m;
        };

        const newStart = timeToMinutes(time);
        const newEnd = newStart + duration;
        
        // Filter entries for the same day, excluding the one being edited
        const conflictingEntry = timetable.find(entry => {
            if (entry.day !== day) return false;
            if (editingEntry && entry.id === editingEntry.id) return false;
            
            const existStart = timeToMinutes(entry.time);
            const existDuration = entry.duration || DEFAULT_CLASS_DURATION_MINS;
            const existEnd = existStart + existDuration;

            // Check if new interval overlaps with existing interval
            return (newStart < existEnd && existStart < newEnd);
        });

        if (conflictingEntry) {
            setError(`Conflict: This overlaps with "${conflictingEntry.subject}" at ${conflictingEntry.time}.`);
            return;
        }

        setIsLoading(true);
        
        try {
            if (editingEntry) {
                await updateEntry({ ...editingEntry, day, time, subject, duration });
                setSuccessMessage("Timetable entry updated successfully.");
            } else {
                await addEntry({ day, time, subject, duration });
                setSuccessMessage("Timetable entry added successfully.");
            }
            resetForm();
        } catch (err: any) {
            console.error("Timetable save error:", err);
            // Better error handling to display the specific message thrown by the backend
            let errorMessage = 'Failed to save entry. Please try again.';
            if (err?.message) {
                errorMessage = err.message;
            } else if (typeof err === 'string') {
                errorMessage = err;
            } else if (err && typeof err === 'object' && 'message' in err) {
                 errorMessage = String((err as any).message);
            }
            setError(errorMessage);
        } finally {
            setIsLoading(false);
        }
    };
    
    const handleEdit = (entry: TimetableEntry) => {
        setEditingEntry(entry);
        setSuccessMessage(null);
        setError(null);
        setDay(entry.day as TimetableEntry['day']); // Cast to ensure type safety
        setTime(entry.time);
        setSubject(entry.subject);
        setDuration(entry.duration || DEFAULT_CLASS_DURATION_MINS);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleDelete = async (id: string) => {
        if(!window.confirm("Are you sure you want to delete this class?")) return;
        setSuccessMessage(null);
        try {
            await deleteEntry(id);
            setSuccessMessage("Class deleted successfully.");
        } catch (err: any) {
            alert(`Failed to delete entry: ${err.message}`);
            console.error(err);
        }
    };

    const handleJumpToToday = () => {
        const todayIndex = new Date().getDay(); // Sunday: 0, Monday: 1, ...
        const todayDay = DAYS_OF_WEEK[todayIndex === 0 ? 6 : todayIndex - 1];
        setViewedDay(todayDay);
    };

    const entriesForSelectedDay = timetable.filter(e => e.day === day).length;
    const canAddMore = entriesForSelectedDay < 7;
    const entriesForViewedDay = timetable.filter(entry => entry.day === viewedDay);


    return (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-xl space-y-8">
            <div>
                <h2 className="text-2xl font-bold text-cyan-500 dark:text-cyan-400 mb-4">{editingEntry ? 'Edit Timetable Entry' : 'Add New Timetable Entry'}</h2>
                
                {error && (
                    <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-4 rounded shadow-sm relative" role="alert">
                        <p className="font-bold">Error</p>
                        <p>{error}</p>
                        <button onClick={() => setError(null)} className="absolute top-2 right-2 text-red-700 hover:text-red-900">
                            <XIcon className="w-5 h-5" />
                        </button>
                    </div>
                )}

                {successMessage && (
                    <div className="bg-green-100 border-l-4 border-green-500 text-green-700 p-4 mb-4 rounded shadow-sm relative" role="alert">
                        <p className="font-bold">Success</p>
                        <p>{successMessage}</p>
                        <button onClick={() => setSuccessMessage(null)} className="absolute top-2 right-2 text-green-700 hover:text-green-900">
                            <XIcon className="w-5 h-5" />
                        </button>
                    </div>
                )}

                <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
                    <div className="flex flex-col">
                        <label htmlFor="day" className="mb-1 text-sm font-medium text-gray-500 dark:text-gray-400">Day</label>
                        <select id="day" value={day} onChange={e => setDay(e.target.value as TimetableEntry['day'])} className="w-full p-3 bg-gray-100 dark:bg-gray-700 rounded-md focus:ring-2 focus:ring-cyan-500 outline-none">
                            {DAYS_OF_WEEK.map(d => <option key={d} value={d}>{d}</option>)}
                        </select>
                    </div>
                    <div className="flex flex-col">
                        <label htmlFor="time" className="mb-1 text-sm font-medium text-gray-500 dark:text-gray-400">Time</label>
                        <input id="time" type="time" value={time} onChange={e => setTime(e.target.value)} required className="w-full p-3 bg-gray-100 dark:bg-gray-700 rounded-md focus:ring-2 focus:ring-cyan-500 outline-none" />
                    </div>
                    <div className="flex flex-col">
                        <label htmlFor="subject" className="mb-1 text-sm font-medium text-gray-500 dark:text-gray-400">Subject</label>
                        <select id="subject" value={subject} onChange={e => setSubject(e.target.value)} required className="w-full p-3 bg-gray-100 dark:bg-gray-700 rounded-md focus:ring-2 focus:ring-cyan-500 outline-none" disabled={subjects.length === 0}>
                            {subjects.length > 0 ? (
                                subjects.map(sub => <option key={sub} value={sub}>{sub}</option>)
                            ) : (
                                <option value="" disabled>No subjects assigned</option>
                            )}
                        </select>
                    </div>
                     <div className="flex flex-col">
                        <label htmlFor="duration" className="mb-1 text-sm font-medium text-gray-500 dark:text-gray-400">Duration (mins)</label>
                        <input id="duration" type="number" placeholder="e.g. 45" value={duration} onChange={e => setDuration(parseInt(e.target.value, 10) || 0)} required className="w-full p-3 bg-gray-100 dark:bg-gray-700 rounded-md focus:ring-2 focus:ring-cyan-500 outline-none" min="1"/>
                    </div>
                    <div className="flex gap-2">
                         <button type="submit" disabled={isLoading || (!editingEntry && !canAddMore) || subjects.length === 0} className="flex-grow p-3 bg-cyan-600 hover:bg-cyan-700 text-white font-bold rounded-md transition-colors disabled:bg-gray-500 disabled:cursor-not-allowed">
                            {isLoading ? 'Saving...' : (editingEntry ? 'Save Changes' : 'Add')}
                        </button>
                        {editingEntry && (
                             <button type="button" onClick={resetForm} className="p-3 bg-gray-600 hover:bg-gray-500 text-white font-bold rounded-md transition-colors">
                                Cancel
                            </button>
                        )}
                    </div>
                </form>
                
                {!editingEntry && !canAddMore && <p className="text-yellow-600 dark:text-yellow-500 mt-2 text-center">Cannot add more than 7 classes for {day}.</p>}
                {subjects.length === 0 && <p className="text-yellow-600 dark:text-yellow-500 mt-2 text-center">You must have subjects assigned to your profile to add timetable entries.</p>}
            </div>

            <div>
                 <div className="flex justify-between items-center mb-4">
                    <h2 className="text-2xl font-bold text-cyan-500 dark:text-cyan-400">Current Timetable</h2>
                    <button
                        onClick={handleJumpToToday}
                        className="px-4 py-2 text-sm font-semibold text-white bg-cyan-600 rounded-md hover:bg-cyan-700 transition-colors"
                    >
                        Jump to Today
                    </button>
                 </div>

                 <div className="flex flex-wrap border-b border-gray-200 dark:border-gray-700 mb-4">
                    {DAYS_OF_WEEK.map(day => (
                        <button
                            key={day}
                            onClick={() => setViewedDay(day)}
                            className={`px-4 py-2 -mb-px font-semibold text-sm transition-colors duration-200 focus:outline-none ${
                                viewedDay === day
                                    ? 'border-b-2 border-cyan-500 dark:border-cyan-400 text-cyan-500 dark:text-cyan-400'
                                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-white'
                            }`}
                        >
                            {day}
                        </button>
                    ))}
                 </div>
                 
                 {timetable.length > 0 ? (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-gray-100 dark:bg-gray-700/50 text-gray-600 dark:text-gray-300">
                                <tr>
                                    <th className="p-3">Time</th>
                                    <th className="p-3">Subject</th>
                                    <th className="p-3">Faculty</th>
                                    <th className="p-3">Duration</th>
                                    <th className="p-3">Status</th>
                                    <th className="p-3 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {entriesForViewedDay.length > 0 ? (
                                    entriesForViewedDay.map(entry => {
                                        const isCurrent = entry.id === scheduleStatus.currentClassId;
                                        const isNext = entry.id === scheduleStatus.nextClassId;
                                        const canManage = entry.facultyId === currentFaculty?.uid;
                                        const rowClass = `border-b border-gray-200 dark:border-gray-700 transition-colors duration-200 ${
                                            isCurrent ? 'bg-green-50 dark:bg-green-900/50 border-l-4 border-green-500' :
                                            isNext ? 'bg-cyan-50 dark:bg-cyan-900/50 border-l-4 border-cyan-500' : 
                                            'hover:bg-gray-50 dark:hover:bg-gray-700/30'
                                        }`;

                                        return (
                                            <tr key={entry.id} className={rowClass}>
                                                <td className={`p-3 text-black dark:text-gray-300 ${isCurrent || isNext ? 'font-bold dark:text-white' : ''}`}>{entry.time}</td>
                                                <td className={`p-3 font-bold text-black ${isCurrent ? 'dark:text-green-300' : isNext ? 'dark:text-cyan-300' : 'dark:text-gray-300'}`}>{entry.subject}</td>
                                                <td className="p-3 text-gray-500 dark:text-gray-400">{entry.facultyName}</td>
                                                <td className="p-3 text-gray-500 dark:text-gray-400">{entry.duration || DEFAULT_CLASS_DURATION_MINS} mins</td>
                                                <td className="p-3">
                                                    {isCurrent && <span className="px-2 py-1 text-xs font-bold tracking-wider text-green-800 bg-green-200 dark:text-green-100 dark:bg-green-600 rounded-full animate-pulse">NOW</span>}
                                                    {isNext && <span className="px-2 py-1 text-xs font-bold tracking-wider text-cyan-800 bg-cyan-200 dark:text-cyan-100 dark:bg-cyan-600 rounded-full">NEXT</span>}
                                                </td>
                                                <td className="p-3 flex justify-end items-center gap-2">
                                                    {canManage ? (
                                                        <>
                                                            <button onClick={() => handleEdit(entry)} className="px-3 py-1 text-sm font-semibold text-white bg-cyan-600 rounded-md hover:bg-cyan-700 transition-colors">Edit</button>
                                                            <button onClick={() => handleDelete(entry.id)} className="px-3 py-1 text-sm font-semibold text-white bg-red-600 rounded-md hover:bg-red-700 transition-colors">Delete</button>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <button disabled className="px-3 py-1 text-sm font-semibold text-white bg-gray-400 dark:bg-gray-600 rounded-md cursor-not-allowed">Edit</button>
                                                            <button disabled className="px-3 py-1 text-sm font-semibold text-white bg-gray-400 dark:bg-gray-600 rounded-md cursor-not-allowed">Delete</button>
                                                        </>
                                                    )}
                                                </td>
                                            </tr>
                                        )
                                    })
                                ) : (
                                    <tr>
                                        <td colSpan={6} className="text-center p-8 text-gray-500">No classes scheduled for {viewedDay}.</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                 ) : (
                    <div className="text-center py-8 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
                        <p className="text-gray-500 dark:text-gray-400">The timetable is empty.</p>
                        <p className="text-gray-600 dark:text-gray-500">Add an entry using the form above to get started.</p>
                    </div>
                 )}
            </div>
        </div>
    );
};

const StudentList: React.FC<{ students: Student[], deleteStudent: (uid: string) => Promise<void>, onViewReport: (student: Student) => void }> = ({ students, deleteStudent, onViewReport }) => {
    const handleDelete = (student: Student) => {
        if(window.confirm(`Are you sure you want to remove ${student.name}? This will delete all their attendance records.`)) {
             deleteStudent(student.uid);
        }
    }
    return (
    <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-xl">
        <h2 className="text-2xl font-bold text-cyan-500 dark:text-cyan-400 mb-4">Registered Students</h2>
        {students.length > 0 ? (
            <ul className="space-y-3">
                {students.map(s => (
                    <li key={s.uid} onClick={() => onViewReport(s)} className="p-3 bg-gray-100 dark:bg-gray-700 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 cursor-pointer transition-colors">
                        <div className="flex justify-between items-start">
                             <div>
                                <p className="font-semibold">{s.name} ({s.rollNo})</p>
                                <p className="text-sm text-gray-500 dark:text-gray-400">{s.email}</p>
                            </div>
                            <button onClick={(e) => { e.stopPropagation(); handleDelete(s); }} className="p-2 text-red-500 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-500/20 rounded-full transition-colors flex-shrink-0">
                                <TrashIcon className="w-5 h-5" />
                            </button>
                        </div>
                        {s.subjects && s.subjects.length > 0 && (
                            <div className="mt-2 pt-2 border-t border-gray-200/50 dark:border-gray-600/50 text-xs text-gray-500 dark:text-gray-400">
                                <span className="font-semibold text-gray-700 dark:text-gray-300">Subjects: </span>
                                <span>{s.subjects.join(', ')}</span>
                            </div>
                        )}
                    </li>
                ))}
            </ul>
        ) : <p className="text-gray-500 dark:text-gray-400">No students have registered yet.</p>}
    </div>
)};

const ManualAttendance: React.FC<{ students: Student[], subjects: string[], markManualAttendance: (uid: string, subject: string) => void }> = ({ students, subjects, markManualAttendance }) => {
    const [selectedStudent, setSelectedStudent] = useState('');
    const [selectedSubject, setSelectedSubject] = useState('');

    const handleMarkPresent = () => {
        if (selectedStudent && selectedSubject) {
            markManualAttendance(selectedStudent, selectedSubject);
            const studentName = students.find(s => s.uid === selectedStudent)?.name;
            alert(`Marked ${studentName} present for ${selectedSubject}.`);
            setSelectedStudent('');
            setSelectedSubject('');
        } else {
            alert("Please select a student and a subject.");
        }
    };
    
    return (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-xl mt-8">
            <h2 className="text-2xl font-bold text-cyan-500 dark:text-cyan-400 mb-4">Manual Attendance Entry</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <select value={selectedStudent} onChange={e => setSelectedStudent(e.target.value)} className="w-full p-3 bg-gray-100 dark:bg-gray-700 rounded-md focus:ring-2 focus:ring-cyan-500 outline-none">
                    <option value="">Select Student</option>
                    {students.map(s => <option key={s.uid} value={s.uid}>{s.name} ({s.rollNo})</option>)}
                </select>
                <select value={selectedSubject} onChange={e => setSelectedSubject(e.target.value)} className="w-full p-3 bg-gray-100 dark:bg-gray-700 rounded-md focus:ring-2 focus:ring-cyan-500 outline-none">
                    <option value="">Select Subject</option>
                    {subjects.length > 0 ? subjects.map(sub => <option key={sub} value={sub}>{sub}</option>) : <option disabled>No subjects assigned</option>}
                </select>
                <button onClick={handleMarkPresent} className="w-full p-3 bg-green-600 hover:bg-green-700 text-white font-bold rounded-md transition-colors disabled:bg-gray-500" disabled={!selectedStudent || !selectedSubject}>
                    Mark Present
                </button>
            </div>
        </div>
    );
};


const AttendanceReport: React.FC<{ 
    students: Student[]; 
    attendance: AttendanceRecord[]; 
    subjects: string[];
    selectedStudentId?: string, 
    onClearSelection: () => void,
    deleteRecord: (id: string) => Promise<void>;
}> = ({ students, attendance, subjects, selectedStudentId, onClearSelection, deleteRecord }) => {
    const [selectedStudent, setSelectedStudent] = useState<string>(selectedStudentId || '');
    const [startDate, setStartDate] = useState<string>('');
    const [endDate, setEndDate] = useState<string>('');

    useEffect(() => {
        setSelectedStudent(selectedStudentId || '');
    }, [selectedStudentId]);

    const filteredAttendance = useMemo(() => {
        let result = attendance;
        if (selectedStudent) {
            result = result.filter(rec => rec.studentId === selectedStudent);
        }
        if (startDate) {
            result = result.filter(rec => rec.date >= startDate);
        }
        if (endDate) {
            result = result.filter(rec => rec.date <= endDate);
        }
        return result;
    }, [selectedStudent, startDate, endDate, attendance]);

    const clearFilters = () => {
        setSelectedStudent('');
        setStartDate('');
        setEndDate('');
        onClearSelection();
    };
    
    const handleDeleteRecord = useCallback(async (recordId: string) => {
        if (window.confirm("Are you sure you want to permanently delete this attendance record? This action cannot be undone.")) {
            try {
                await deleteRecord(recordId);
            } catch (error) {
                console.error("Failed to delete record:", error);
                alert("There was an error deleting the record. Please try again.");
            }
        }
    }, [deleteRecord]);
    
    const attendanceSummary = useMemo(() => {
        const data = filteredAttendance;
        if (data.length === 0) {
            return null;
        }

        const totalPresent = data.filter(r => r.status === 'present').length;
        const overallPercentage = (totalPresent / data.length) * 100;

        // Student Stats
        const studentStats: { [id: string]: { present: number, total: number, name: string } } = {};
        data.forEach(record => {
            if (!studentStats[record.studentId]) {
                studentStats[record.studentId] = { present: 0, total: 0, name: record.studentName };
            }
            studentStats[record.studentId].total++;
            if (record.status === 'present') studentStats[record.studentId].present++;
        });
        const byStudent = Object.entries(studentStats).map(([studentId, stats]) => {
            const studentInfo = students.find(s => s.uid === studentId);
            return {
                studentId,
                name: studentInfo?.name || stats.name,
                rollNo: studentInfo?.rollNo || 'N/A',
                percentage: (stats.present / stats.total) * 100,
                present: stats.present,
                total: stats.total,
            };
        }).sort((a, b) => b.percentage - a.percentage);

        // Subject Stats
        const subjectStats: { [subject: string]: { present: number, total: number } } = {};
        data.forEach(record => {
            if (!subjectStats[record.subject]) {
                subjectStats[record.subject] = { present: 0, total: 0 };
            }
            subjectStats[record.subject].total++;
            if (record.status === 'present') subjectStats[record.subject].present++;
        });
        const bySubject = Object.entries(subjectStats).map(([subject, stats]) => ({
            subject,
            percentage: (stats.present / stats.total) * 100,
            present: stats.present,
            total: stats.total,
        })).sort((a, b) => b.percentage - a.percentage);

        return {
            overall: { present: totalPresent, total: data.length, percentage: overallPercentage },
            byStudent,
            bySubject
        };
    }, [filteredAttendance, students]);

    const handleExportCSV = () => {
        if (filteredAttendance.length === 0) {
            alert("No data to export based on the current filters.");
            return;
        }

        const headers = ["Student Name", "Roll No", "Subject", "Date", "Status"];
        const csvRows = [headers.join(',')];

        for (const record of filteredAttendance) {
            const studentInfo = students.find(s => s.uid === record.studentId);
            const row = [
                `"${record.studentName}"`,
                `"${studentInfo?.rollNo || 'N/A'}"`,
                `"${record.subject}"`,
                record.date,
                record.status,
            ];
            csvRows.push(row.join(','));
        }

        const csvString = csvRows.join('\n');
        const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        
        link.setAttribute('href', url);
        const date = new Date().toISOString().split('T')[0];
        link.setAttribute('download', `attendance_report_${date}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    return (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-xl space-y-8">
            <div>
                <div className="flex flex-wrap justify-between items-center gap-4 mb-6">
                    <h2 className="text-2xl font-bold text-cyan-500 dark:text-cyan-400">
                        {selectedStudentId && students.find(s => s.uid === selectedStudentId)
                            ? `Report for ${students.find(s => s.uid === selectedStudentId)?.name}`
                            : 'Attendance Report'}
                    </h2>
                    <div className="flex items-center gap-2 flex-wrap">
                         <button onClick={handleExportCSV} className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-md transition-colors text-sm">
                            Export to CSV
                        </button>
                    </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                    <div>
                        <label className="text-sm text-gray-500 dark:text-gray-400">Student</label>
                        <select value={selectedStudent} onChange={e => setSelectedStudent(e.target.value)} className="w-full mt-1 p-2 bg-gray-100 dark:bg-gray-700 rounded-md focus:ring-2 focus:ring-cyan-500 outline-none">
                            <option value="">All Students</option>
                            {students.map(s => <option key={s.uid} value={s.uid}>{s.name} ({s.rollNo})</option>)}
                        </select>
                    </div>

                    <div>
                         <label className="text-sm text-gray-500 dark:text-gray-400">Start Date</label>
                        <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full mt-1 p-2 bg-gray-100 dark:bg-gray-700 rounded-md focus:ring-2 focus:ring-cyan-500 outline-none" />
                    </div>
                    <div>
                        <label className="text-sm text-gray-500 dark:text-gray-400">End Date</label>
                        <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-full mt-1 p-2 bg-gray-100 dark:bg-gray-700 rounded-md focus:ring-2 focus:ring-cyan-500 outline-none" />
                    </div>
                    <button onClick={clearFilters} className="w-full p-2 bg-gray-500 hover:bg-gray-600 dark:bg-gray-600 dark:hover:bg-gray-500 text-white font-bold rounded-md transition-colors">
                        Clear Filters
                    </button>
                </div>
            </div>

            {attendanceSummary && (
                <div>
                    <h3 className="text-xl font-bold text-cyan-500 dark:text-cyan-400 mb-4">Attendance Summary</h3>
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <div className="bg-gray-100/50 dark:bg-gray-700/50 p-6 rounded-lg flex flex-col items-center justify-center">
                            <span className="text-sm font-semibold text-gray-500 dark:text-gray-400">OVERALL ATTENDANCE</span>
                            <p className="text-5xl font-bold text-gray-900 dark:text-white mt-2">
                                {attendanceSummary.overall.percentage.toFixed(1)}<span className="text-3xl text-gray-500 dark:text-gray-400">%</span>
                            </p>
                            <p className="text-gray-600 dark:text-gray-300 mt-2">
                                {attendanceSummary.overall.present} of {attendanceSummary.overall.total} classes
                            </p>
                        </div>
                        
                        <div className="bg-gray-100/50 dark:bg-gray-700/50 p-4 rounded-lg">
                            <h4 className="font-semibold text-gray-800 dark:text-gray-200 mb-3 px-2">By Student</h4>
                            <div className="space-y-2 max-h-60 overflow-y-auto">
                                {attendanceSummary.byStudent.map(s => (
                                    <div key={s.studentId} className="flex items-center justify-between text-sm p-2 rounded-md hover:bg-gray-200/50 dark:hover:bg-gray-600/50">
                                        <div>
                                            <p className="font-medium text-gray-900 dark:text-white">{s.name}</p>
                                            <p className="text-gray-500 dark:text-gray-400">{s.present} / {s.total} attended</p>
                                        </div>
                                        <span className="font-bold text-lg text-cyan-600 dark:text-cyan-300">{s.percentage.toFixed(0)}%</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="bg-gray-100/50 dark:bg-gray-700/50 p-4 rounded-lg">
                            <h4 className="font-semibold text-gray-800 dark:text-gray-200 mb-3 px-2">By Subject</h4>
                            <div className="space-y-2 max-h-60 overflow-y-auto">
                                {attendanceSummary.bySubject.map(s => (
                                    <div key={s.subject} className="flex items-center justify-between text-sm p-2 rounded-md hover:bg-gray-200/50 dark:hover:bg-gray-600/50">
                                        <div>
                                            <p className="font-medium text-gray-900 dark:text-white">{s.subject}</p>
                                            <p className="text-gray-500 dark:text-gray-400">{s.present} / {s.total} classes</p>
                                        </div>
                                        <span className="font-bold text-lg text-cyan-600 dark:text-cyan-300">{s.percentage.toFixed(0)}%</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}
            
            <div>
                <h3 className="text-xl font-bold text-cyan-500 dark:text-cyan-400 mb-4">Detailed Log</h3>
                {filteredAttendance.length > 0 ? (
                    <div className="overflow-x-auto max-h-[50vh] overflow-y-auto">
                        <table className="w-full text-left">
                            <thead className="bg-gray-100 dark:bg-gray-700/50 text-gray-600 dark:text-gray-300 sticky top-0">
                                <tr>
                                    <th className="p-3">Student Name</th>
                                    <th className="p-3">Roll No</th>
                                    <th className="p-3">Subject</th>
                                    <th className="p-3">Date</th>
                                    <th className="p-3">Status</th>
                                    <th className="p-3 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200/50 dark:divide-gray-700/50">
                                {filteredAttendance.map(record => {
                                     const studentInfo = students.find(s => s.uid === record.studentId);
                                     return (
                                        <tr key={record.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                                            <td className="p-3 font-medium">{record.studentName}</td>
                                            <td className="p-3 text-gray-500 dark:text-gray-400">{studentInfo?.rollNo || 'N/A'}</td>
                                            <td className="p-3">{record.subject}</td>
                                            <td className="p-3 text-gray-500 dark:text-gray-400">{record.date}</td>
                                            <td className="p-3">
                                                 <span className={`px-2 py-1 rounded-full text-xs font-bold ${record.status === 'present' ? 'bg-green-100 text-green-800 dark:bg-green-500/20 dark:text-green-400' : 'bg-red-100 text-red-800 dark:bg-red-500/20 dark:text-red-400'}`}>
                                                    {record.status.charAt(0).toUpperCase() + record.status.slice(1)}
                                                </span>
                                            </td>
                                            <td className="p-3 text-right">
                                                <button 
                                                    onClick={() => record.id && handleDeleteRecord(record.id)} 
                                                    disabled={!record.id}
                                                    className="p-2 text-red-500 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-500/20 rounded-full transition-colors disabled:text-gray-600 disabled:cursor-not-allowed"
                                                    title="Delete Record"
                                                >
                                                    <TrashIcon className="w-5 h-5" />
                                                </button>
                                            </td>
                                        </tr>
                                     );
                                })}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div className="text-center py-8 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
                        <p className="text-gray-500 dark:text-gray-400">No attendance records found for the selected filters.</p>
                        <p className="text-gray-600 dark:text-gray-500">Adjust the filters or wait for students to mark their attendance.</p>
                    </div>
                )}
            </div>
        </div>
    );
};


const FacultyProfile: React.FC<{
    faculty: Faculty | null;
    updateProfile: (details: Partial<Omit<Faculty, 'uid' | 'email' | 'department' | 'subjects'>>) => Promise<void>
}> = ({ faculty, updateProfile }) => {
    const [name, setName] = useState(faculty?.name || '');
    const [isEditing, setIsEditing] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleProfilePicChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setIsLoading(true);
            setError('');
            setSuccess('');
            try {
                const base64 = await fileToBase64(file);
                await updateProfile({ profilePicture: base64 });
                setSuccess("Profile picture updated successfully!");
            } catch (err) {
                setError("Failed to upload image. Please try a smaller file.");
            } finally {
                setIsLoading(false);
            }
        }
    };

    const handleUpdateName = async () => {
        if (!name.trim()) {
            setError("Name cannot be empty.");
            return;
        }
        setIsLoading(true);
        setError('');
        setSuccess('');
        try {
            await updateProfile({ name });
            setSuccess("Name updated successfully!");
            setIsEditing(false);
        } catch (err: any) {
            setError(err.message || "Failed to update profile.");
        } finally {
            setIsLoading(false);
        }
    };
    
    useEffect(() => {
        if (faculty) {
            setName(faculty.name);
        }
    }, [faculty]);

    if (!faculty) {
        return <p>Loading profile...</p>;
    }

    return (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-xl max-w-lg mx-auto">
            <h2 className="text-2xl font-bold text-cyan-500 dark:text-cyan-400 mb-6">Your Profile</h2>
            
            {error && <p className="text-red-500 dark:text-red-400 mb-4 text-center">{error}</p>}
            {success && <p className="text-green-500 dark:text-green-400 mb-4 text-center">{success}</p>}

            <div className="flex flex-col items-center gap-6">
                <div className="relative group">
                    {faculty.profilePicture ? (
                        <img src={faculty.profilePicture} alt="Profile" className="w-32 h-32 rounded-full object-cover shadow-lg border-4 border-white dark:border-gray-700"/>
                    ) : (
                        <div className="w-32 h-32 rounded-full bg-cyan-200 dark:bg-cyan-700/50 flex items-center justify-center text-5xl font-bold text-cyan-700 dark:text-cyan-100 shadow-lg border-4 border-white dark:border-gray-700">
                            {faculty.name.charAt(0)}
                        </div>
                    )}
                    <button 
                        onClick={() => fileInputRef.current?.click()}
                        className="absolute inset-0 bg-black/60 rounded-full flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity"
                        aria-label="Change profile picture"
                    >
                        <CameraIcon className="w-8 h-8" />
                    </button>
                </div>
                <input type="file" accept="image/*" ref={fileInputRef} onChange={handleProfilePicChange} className="hidden" />
            </div>

            <div className="space-y-4 mt-8">
                <div>
                    <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Email Address</label>
                    <p className="text-lg p-3 bg-gray-100/50 dark:bg-gray-700/50 rounded-md mt-1">{faculty.email}</p>
                </div>
                <div>
                    <label htmlFor="name" className="text-sm font-medium text-gray-500 dark:text-gray-400">Full Name</label>
                    <input
                        id="name"
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        disabled={!isEditing || isLoading}
                        className="w-full mt-1 p-3 bg-gray-100 dark:bg-gray-700 rounded-md focus:ring-2 focus:ring-cyan-500 outline-none disabled:bg-gray-100/50 dark:disabled:bg-gray-700/50 disabled:cursor-not-allowed"
                    />
                </div>
                 <div>
                    <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Department</label>
                    <p className="text-lg p-3 bg-gray-100/50 dark:bg-gray-700/50 rounded-md mt-1">{faculty.department}</p>
                </div>
                <div>
                    <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Subjects</label>
                    <p className="text-lg p-3 bg-gray-100/50 dark:bg-gray-700/50 rounded-md mt-1">
                        {faculty.subjects && faculty.subjects.length > 0 ? faculty.subjects.join(', ') : 'No subjects assigned.'}
                    </p>
                </div>
                <div className="flex justify-end gap-4 pt-4">
                    {isEditing ? (
                        <>
                            <button onClick={() => { setIsEditing(false); setName(faculty.name); }} disabled={isLoading} className="px-6 py-2 bg-gray-500 hover:bg-gray-600 dark:bg-gray-600 dark:hover:bg-gray-500 text-white font-bold rounded-md transition-colors">
                                Cancel
                            </button>
                            <button onClick={handleUpdateName} disabled={isLoading} className="px-6 py-2 bg-cyan-600 hover:bg-cyan-700 text-white font-bold rounded-md transition-colors disabled:bg-gray-500">
                                {isLoading ? 'Saving...' : 'Save Changes'}
                            </button>
                        </>
                    ) : (
                        <button onClick={() => setIsEditing(true)} className="px-6 py-2 bg-cyan-600 hover:bg-cyan-700 text-white font-bold rounded-md transition-colors">
                            Edit Profile
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};


export default FacultyPortal;
