
import React, { useState, useCallback } from 'react';
import { useAppContext } from '../context/AppContext.tsx';
import FaceCapture from './FaceCapture.tsx';
import { UserIcon, AcademicCapIcon, EyeIcon, EyeSlashIcon } from './Icons.tsx';
import { DEPARTMENTS } from '../constants.ts';

const Auth: React.FC = () => {
    const [role, setRole] = useState<'student' | 'faculty'>('student');
    const [isSigningUp, setIsSigningUp] = useState(false);
    
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [name, setName] = useState('');
    
    // Student specific
    const [rollNo, setRollNo] = useState('');
    const [face, setFace] = useState<string | null>(null);
    
    // Department
    const [department, setDepartment] = useState('');
    
    // Faculty specific
    const [facultySubjects, setFacultySubjects] = useState<string[]>([]);

    const [showFaceCapture, setShowFaceCapture] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [resetMessage, setResetMessage] = useState<string | null>(null);

    const { signUp, login, sendPasswordReset } = useAppContext();

    const handleFaceCapture = useCallback((capturedFace: string) => {
        setFace(capturedFace);
        setShowFaceCapture(false);
    }, []);

    const handleCloseFaceCapture = useCallback(() => {
        setShowFaceCapture(false);
    }, []);

    const handleSubjectChange = (subject: string) => {
        setFacultySubjects(prev =>
            prev.includes(subject)
                ? prev.filter(s => s !== subject)
                : [...prev, subject]
        );
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError(null);
        setResetMessage(null);

        try {
            if (isSigningUp) {
                if (role === 'student' && (!name || !rollNo || !face || !department)) {
                    throw new Error("Please fill all fields, select a department, and register your face.");
                }
                if (role === 'faculty' && (!name || !department || facultySubjects.length === 0)) {
                    throw new Error("Please fill all fields, select a department, and at least one subject.");
                }

                const details = role === 'student' 
                    ? { name, rollNo, face, department } 
                    : { name, department, subjects: facultySubjects };

                await signUp(email, password, role, details);
            } else {
                await login(email, password);
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : "An unknown error occurred.");
        } finally {
            setIsLoading(false);
        }
    };
    
    const handleForgotPassword = async () => {
        if (!email) {
            setError("Please enter your email address to reset your password.");
            setResetMessage(null);
            return;
        }
        setIsLoading(true);
        setError(null);
        setResetMessage(null);
        try {
            await sendPasswordReset(email);
            setResetMessage("Password reset email sent! Please check your inbox.");
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to send reset email.");
        } finally {
            setIsLoading(false);
        }
    };
    
    const isStudent = role === 'student';

    return (
        <div className="w-full max-w-md">
            <h1 className="text-4xl font-bold text-center text-gray-800 dark:text-gray-200 mb-2">Smart Attendance</h1>
            <p className="text-gray-600 dark:text-gray-400 text-center mb-8">Please sign in or create an account.</p>

            <div className="bg-white dark:bg-gray-800 p-8 rounded-xl shadow-2xl">
                {isSigningUp && (
                    <div className="flex mb-6 border-b border-gray-200 dark:border-gray-700">
                        <button onClick={() => setRole('student')} className={`flex-1 py-3 text-lg font-semibold flex items-center justify-center gap-2 ${isStudent ? 'text-teal-500 dark:text-teal-400 border-b-2 border-teal-500 dark:border-teal-400' : 'text-gray-500 dark:text-gray-400'}`}>
                            <AcademicCapIcon className="w-6 h-6"/> Student
                        </button>
                        <button onClick={() => setRole('faculty')} className={`flex-1 py-3 text-lg font-semibold flex items-center justify-center gap-2 ${!isStudent ? 'text-cyan-500 dark:text-cyan-400 border-b-2 border-cyan-500 dark:border-cyan-400' : 'text-gray-500 dark:text-gray-400'}`}>
                            <UserIcon className="w-6 h-6"/> Faculty
                        </button>
                    </div>
                )}
                
                <h2 className="text-2xl font-bold text-center text-gray-800 dark:text-gray-300 mb-6">{isSigningUp ? 'Create Account' : 'Welcome Back'}</h2>

                {error && <p className="bg-red-500/20 text-red-500 dark:text-red-400 p-3 rounded-md mb-4 text-center">{error}</p>}
                {resetMessage && <p className="bg-green-500/20 text-green-500 dark:text-green-400 p-3 rounded-md mb-4 text-center">{resetMessage}</p>}
                
                <form onSubmit={handleSubmit} className="space-y-4">
                    {isSigningUp && (
                        <>
                            <input type="text" placeholder="Full Name" value={name} onChange={e => setName(e.target.value)} required 
                                className={`w-full p-3 bg-gray-100 dark:bg-gray-700 rounded-md focus:ring-2 outline-none ${isStudent ? 'focus:ring-teal-500' : 'focus:ring-cyan-500'}`} />
                            <select 
                                value={department} 
                                onChange={e => {
                                    setDepartment(e.target.value);
                                    if (role === 'faculty') {
                                        setFacultySubjects([]); // Reset subjects on department change
                                    }
                                }} 
                                required 
                                className={`w-full p-3 bg-gray-100 dark:bg-gray-700 rounded-md focus:ring-2 outline-none ${department ? 'text-gray-900 dark:text-white' : 'text-gray-500'} ${isStudent ? 'focus:ring-teal-500' : 'focus:ring-cyan-500'}`}
                            >
                                <option value="" disabled>Select Department</option>
                                {Object.keys(DEPARTMENTS).map(dept => (
                                    <option key={dept} value={dept}>{dept}</option>
                                ))}
                            </select>
                            {isSigningUp && !isStudent && department && (
                                <div>
                                    <label className="block mb-2 text-sm font-medium text-gray-500 dark:text-gray-400">Select Your Subject(s)</label>
                                    <div className="p-3 bg-gray-100 dark:bg-gray-700 rounded-md space-y-2 max-h-40 overflow-y-auto">
                                        {DEPARTMENTS[department]?.map(subject => (
                                            <div key={subject} className="flex items-center">
                                                <input
                                                    type="checkbox"
                                                    id={`faculty-${subject}`}
                                                    value={subject}
                                                    checked={facultySubjects.includes(subject)}
                                                    onChange={() => handleSubjectChange(subject)}
                                                    className="w-4 h-4 text-cyan-600 bg-gray-200 dark:bg-gray-600 border-gray-300 dark:border-gray-500 rounded focus:ring-cyan-500"
                                                />
                                                <label htmlFor={`faculty-${subject}`} className="ml-2 text-sm text-gray-800 dark:text-gray-300">
                                                    {subject}
                                                </label>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                    {isSigningUp && isStudent && (
                        <input type="text" placeholder="Roll Number" value={rollNo} onChange={e => setRollNo(e.target.value)} required className="w-full p-3 bg-gray-100 dark:bg-gray-700 rounded-md focus:ring-2 focus:ring-teal-500 outline-none" />
                    )}
                    <input type="email" placeholder="Email Address" value={email} onChange={e => setEmail(e.target.value)} required 
                        className={`w-full p-3 bg-gray-100 dark:bg-gray-700 rounded-md focus:ring-2 outline-none ${isStudent ? 'focus:ring-teal-500' : 'focus:ring-cyan-500'}`} />
                    <div>
                        <div className="relative">
                            <input 
                                type={showPassword ? 'text' : 'password'} 
                                placeholder="Password" 
                                value={password} 
                                onChange={e => setPassword(e.target.value)} 
                                required 
                                className={`w-full p-3 bg-gray-100 dark:bg-gray-700 rounded-md focus:ring-2 outline-none pr-10 ${isStudent ? 'focus:ring-teal-500' : 'focus:ring-cyan-500'}`} 
                            />
                            <button 
                                type="button" 
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-white transition-colors"
                                aria-label={showPassword ? 'Hide password' : 'Show password'}
                            >
                                {showPassword ? (
                                    <EyeSlashIcon className="h-6 w-6" />
                                ) : (
                                    <EyeIcon className="h-6 w-6" />
                                )}
                            </button>
                        </div>
                         {!isSigningUp && (
                            <div className="text-right mt-2">
                                <button 
                                    type="button" 
                                    onClick={handleForgotPassword} 
                                    disabled={isLoading}
                                    className={`text-sm hover:underline font-semibold disabled:text-gray-500 disabled:no-underline ${isStudent ? 'text-teal-600 dark:text-teal-400' : 'text-cyan-600 dark:text-cyan-400'}`}
                                >
                                    Forgot Password?
                                </button>
                            </div>
                        )}
                    </div>
                    
                    {isSigningUp && isStudent && (
                        <div>
                            <button type="button" onClick={() => setShowFaceCapture(true)} className={`w-full p-3 bg-gray-200 hover:bg-gray-300 dark:bg-gray-600 dark:hover:bg-gray-500 rounded-md font-semibold transition-colors ${face ? 'text-green-500 dark:text-green-400' : 'text-gray-800 dark:text-white'}`}>
                                {face ? "Face Registered ✔" : "Register Your Face"}
                            </button>
                        </div>
                    )}

                    <button type="submit" disabled={isLoading} 
                        className={`w-full p-3 rounded-md font-bold text-lg text-white transition-colors disabled:bg-gray-400 dark:disabled:bg-gray-500 ${isStudent ? 'bg-teal-600 hover:bg-teal-700' : 'bg-cyan-600 hover:bg-cyan-700'}`}>
                        {isLoading ? 'Processing...' : (isSigningUp ? 'Sign Up' : 'Login')}
                    </button>
                </form>

                <p className="text-center mt-6 text-sm">
                    {isSigningUp ? "Already have an account?" : "Don't have an account?"}
                    <button onClick={() => setIsSigningUp(!isSigningUp)} 
                        className={`hover:underline ml-2 font-semibold ${isStudent ? 'text-teal-600 dark:text-teal-400' : 'text-cyan-600 dark:text-cyan-400'}`}>
                        {isSigningUp ? 'Login' : 'Sign Up'}
                    </button>
                </p>
            </div>
             {showFaceCapture && <FaceCapture onCapture={handleFaceCapture} onClose={handleCloseFaceCapture} purpose="registration"/>}
        </div>
    );
};

export default Auth;
