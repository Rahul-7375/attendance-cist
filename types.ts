// FIX: Import Dispatch and SetStateAction from React to resolve type errors.
import type { Dispatch, SetStateAction } from 'react';
import type { User as FirebaseUser } from 'firebase/auth';

export type Role = 'student' | 'faculty' | null;

export interface Student {
    uid: string;
    rollNo: string;
    name: string;
    email: string;
    department: string;
    subjects: string[];
    registeredFace: string; // base64 data URL
}

export interface Faculty {
    uid: string;
    name: string;
    email: string;
    department: string;
    subjects: string[];
    profilePicture?: string; // base64 data URL
}

export interface TimetableEntry {
    id: string;
    day: string;
    time: string;
    subject: string;
    department: string;
    facultyId: string;
    facultyName: string;
    duration: number;
}

export interface AttendanceRecord {
    id: string;
    studentId: string;
    studentName: string;
    subject: string;
    date: string; // ISO string format YYYY-MM-DD
    status: 'present' | 'absent';
}

export interface LocationCoordinate {
    latitude: number;
    longitude: number;
}

export interface SessionData {
    location: LocationCoordinate;
    timestamp: number;
}

export type StudentSignUpDetails = {
    name: string;
    rollNo: string;
    face: string;
    department: string;
};

export type FacultySignUpDetails = {
    name: string;
    department: string;
    subjects: string[];
};

export interface AppContextType {
    currentUser: FirebaseUser | null;
    userRole: Role;
    currentStudent: Student | null;
    currentFaculty: Faculty | null;
    loadingAuth: boolean;
    students: Student[];
    timetable: TimetableEntry[];
    addTimetableEntry: (entry: Omit<TimetableEntry, 'id' | 'department' | 'facultyId' | 'facultyName'>) => Promise<void>;
    updateTimetableEntry: (entry: TimetableEntry) => Promise<void>;
    deleteTimetableEntry: (id: string) => Promise<void>;
    attendance: AttendanceRecord[];
    activeSession: SessionData | null;
    // FIX: Replaced React.Dispatch and React.SetStateAction with imported types.
    setActiveSession: Dispatch<SetStateAction<SessionData | null>>;
    signUp: (email: string, password: string, role: 'student' | 'faculty', details: StudentSignUpDetails | FacultySignUpDetails) => Promise<void>;
    login: (email: string, password: string) => Promise<void>;
    logout: () => Promise<void>;
    addAttendanceRecord: (record: Omit<AttendanceRecord, 'id'>) => Promise<void>;
    deleteStudent: (uid: string) => Promise<void>;
    markManualAttendance: (studentUid: string, subject: string) => Promise<void>;
    updateStudentProfile: (details: Partial<Student>) => Promise<void>;
    updateFacultyProfile: (details: Partial<Pick<Faculty, 'name' | 'profilePicture'>>) => Promise<void>;
    sendPasswordReset: (email: string) => Promise<void>;
    deleteAttendanceRecord: (id: string) => Promise<void>;
    deleteMultipleAttendanceRecords: (ids: string[]) => Promise<void>;
    deleteAllAttendanceRecords: () => Promise<void>;
}

export interface ThemeContextType {
  theme: 'light' | 'dark';
  // FIX: Replaced React.Dispatch and React.SetStateAction with imported types.
  setTheme: Dispatch<SetStateAction<'light' | 'dark'>>;
}
