
import React, { createContext, useContext, ReactNode, useState, useEffect, useCallback } from 'react';
import { Student, TimetableEntry, AttendanceRecord, SessionData, Faculty } from '../types.ts';
import { auth, db } from '../firebase/config.ts';
// FIX: Import modular functions from Firebase v9 SDK.
import {
  collection,
  doc,
  getDoc,
  setDoc,
  onSnapshot,
  query,
  where,
  addDoc,
  updateDoc,
  deleteDoc,
  orderBy,
  writeBatch,
  getDocs,
  QuerySnapshot,
  DocumentData,
} from 'firebase/firestore';
import {
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
} from 'firebase/auth';

// Define the shape of the context
interface AppContextType {
  currentUser: any | null;
  userRole: 'student' | 'faculty' | null;
  currentStudent: Student | null;
  currentFaculty: Faculty | null;
  loadingAuth: boolean;
  students: Student[];
  timetable: TimetableEntry[];
  addTimetableEntry: (entry: Omit<TimetableEntry, 'id' | 'facultyId' | 'facultyName' | 'department'>) => Promise<void>;
  updateTimetableEntry: (entry: TimetableEntry) => Promise<void>;
  deleteTimetableEntry: (id: string) => Promise<void>;
  attendance: AttendanceRecord[];
  activeSession: SessionData | null;
  setActiveSession: React.Dispatch<React.SetStateAction<SessionData | null>>;
  signUp: (email: string, password: string, role: 'student' | 'faculty', details: any) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  addAttendanceRecord: (record: Omit<AttendanceRecord, 'id'>) => Promise<void>;
  deleteStudent: (uid: string) => Promise<void>;
  markManualAttendance: (studentUid: string, subject: string) => Promise<void>;
  updateFacultyProfile: (details: Partial<Omit<Faculty, 'uid' | 'email' | 'department' | 'subjects'>>) => Promise<void>;
  updateStudentProfile: (details: Partial<Omit<Student, 'uid' | 'email' | 'department' | 'subjects'>>) => Promise<void>;
  sendPasswordReset: (email: string) => Promise<void>;
  deleteAttendanceRecord: (id: string) => Promise<void>;
  deleteMultipleAttendanceRecords: (ids: string[]) => Promise<void>;
  deleteAllAttendanceRecords: () => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<any | null>(null);
  const [userRole, setUserRole] = useState<'student' | 'faculty' | null>(null);
  const [currentStudent, setCurrentStudent] = useState<Student | null>(null);
  const [currentFaculty, setCurrentFaculty] = useState<Faculty | null>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);

  const [students, setStudents] = useState<Student[]>([]);
  const [timetable, setTimetable] = useState<TimetableEntry[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [activeSession, setActiveSession] = useState<SessionData | null>(null);

  // Auth state listener
  useEffect(() => {
    // FIX: Add null check as auth and db can be null if Firebase is not configured.
    if (!auth || !db) {
        setLoadingAuth(false);
        return;
    }
    // FIX: Use Firestore v9 modular syntax for onAuthStateChanged.
    const unsubscribe = onAuthStateChanged(auth, async user => {
      setCurrentUser(user);
      if (user) {
        // Fetch user role from Firestore
        // FIX: Use Firestore v9 modular syntax for doc and getDoc.
        const userDoc = await getDoc(doc(db!, 'users', user.uid));
        if (userDoc.exists()) {
          const role = (userDoc.data() as any)?.role;
          setUserRole(role);
          if (role === 'student') {
            // FIX: Use Firestore v9 modular syntax for doc and getDoc.
             const studentDoc = await getDoc(doc(db!, 'students', user.uid));
             if(studentDoc.exists()) {
                setCurrentStudent({ uid: user.uid, ...(studentDoc.data() as any) } as Student);
             }
             setCurrentFaculty(null);
          } else if (role === 'faculty') {
            // FIX: Use Firestore v9 modular syntax for doc and getDoc.
            const facultyDoc = await getDoc(doc(db!, 'faculty', user.uid));
            if (facultyDoc.exists()) {
                setCurrentFaculty({ uid: user.uid, ...(facultyDoc.data() as any) } as Faculty);
            }
            setCurrentStudent(null);
          } else {
            setCurrentStudent(null);
            setCurrentFaculty(null);
          }
        } else {
            // Handle case where user exists in Auth but not in users collection
            setUserRole(null); 
        }
      } else {
        setUserRole(null);
        setCurrentStudent(null);
        setCurrentFaculty(null);
      }
      setLoadingAuth(false);
    });
    return () => unsubscribe();
  }, []);

  // Firestore listeners
  useEffect(() => {
    // FIX: Add null check for db from Firebase config.
    if (!currentUser || !db) {
        setStudents([]);
        setAttendance([]);
        setTimetable([]);
        return;
    }

    const sortTimetable = (timetableData: TimetableEntry[]) => {
        const daysOfWeekOrder: TimetableEntry['day'][] = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
        timetableData.sort((a, b) => {
            const dayComparison = daysOfWeekOrder.indexOf(a.day) - daysOfWeekOrder.indexOf(b.day);
            if (dayComparison !== 0) return dayComparison;
            if (a.time && b.time) return a.time.localeCompare(b.time);
            return 0;
        });
        return timetableData;
    };

    let unsubTimetable: (() => void) | undefined;
    let unsubAttendance: (() => void) | undefined;
    let unsubStudents: (() => void) | undefined;
    let unsubFaculty: (() => void) | undefined;
    
    const userDepartment = userRole === 'faculty' ? currentFaculty?.department : currentStudent?.department;

    if (userDepartment) {
        // FIX: Use Firestore v9 modular syntax for query and onSnapshot.
         const timetableQuery = query(collection(db!, 'timetable'), where('department', '==', userDepartment));
         unsubTimetable = onSnapshot(timetableQuery, (snapshot: QuerySnapshot<DocumentData>) => {
                const timetableData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as TimetableEntry));
                setTimetable(sortTimetable(timetableData));
            }, err => {
                console.error("Error fetching department timetable:", err);
                setTimetable([]);
            });
    } else {
        setTimetable([]);
    }

    if (userRole === 'faculty') {
        if (currentFaculty?.department) {
            // FIX: Use Firestore v9 modular syntax for query and onSnapshot.
            const studentsQuery = query(collection(db!, 'students'), where('department', '==', currentFaculty.department));
            unsubStudents = onSnapshot(studentsQuery, (snapshot: QuerySnapshot<DocumentData>) => {
                    const studentData = snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as Student));
                    setStudents(studentData);
                });
        }

        // FIX: Use Firestore v9 modular syntax for query and onSnapshot.
        const attendanceQuery = query(collection(db!, 'attendance'), orderBy('date', 'desc'));
        unsubAttendance = onSnapshot(attendanceQuery, (snapshot: QuerySnapshot<DocumentData>) => {
            const attendanceData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AttendanceRecord));
            setAttendance(attendanceData);
        });
        
        // FIX: Use Firestore v9 modular syntax for onSnapshot and doc.
        unsubFaculty = onSnapshot(doc(db!, 'faculty', currentUser.uid), docSnap => {
            if (docSnap.exists()) {
                setCurrentFaculty({ uid: docSnap.id, ...(docSnap.data() as any) } as Faculty);
            }
        });
    } else if (userRole === 'student') {
        // FIX: Use Firestore v9 modular syntax for query and onSnapshot.
        const attendanceQuery = query(collection(db!, 'attendance'), where('studentId', '==', currentUser.uid));
        unsubAttendance = onSnapshot(attendanceQuery, (snapshot: QuerySnapshot<DocumentData>) => {
                const attendanceData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AttendanceRecord));
                attendanceData.sort((a, b) => b.date.localeCompare(a.date));
                setAttendance(attendanceData);
            }, err => {
                console.error("Error fetching student attendance:", err);
            });
    }

    return () => {
        if (unsubTimetable) unsubTimetable();
        if (unsubAttendance) unsubAttendance();
        if (unsubStudents) unsubStudents();
        if (unsubFaculty) unsubFaculty();
    };
}, [currentUser, userRole, currentStudent, currentFaculty]);


  const signUp = async (email: string, password: string, role: 'student' | 'faculty', details: any) => {
    // FIX: Add null check as auth and db can be null if Firebase is not configured.
    if (!auth || !db) throw new Error("Firebase not initialized.");
    // FIX: Use Auth v9 modular syntax for createUserWithEmailAndPassword.
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    if (!user) throw new Error("Could not create user.");

    // Create a document in 'users' collection to store the role
    // FIX: Use Firestore v9 modular syntax for setDoc and doc.
    await setDoc(doc(db, 'users', user.uid), { role, email });

    // If student, create a document in 'students' collection
    if (role === 'student') {
        const studentData: Omit<Student, 'uid'> = {
            rollNo: details.rollNo,
            name: details.name,
            email: email,
            department: details.department,
            subjects: [],
            registeredFace: details.face,
        };
      // FIX: Use Firestore v9 modular syntax for setDoc and doc.
      await setDoc(doc(db, 'students', user.uid), studentData);
    } else if (role === 'faculty') {
        const facultyData = {
            name: details.name,
            email: email,
            department: details.department,
            subjects: details.subjects || [],
        };
        // FIX: Use Firestore v9 modular syntax for setDoc and doc.
        await setDoc(doc(db, 'faculty', user.uid), facultyData);
    }
  };

  const login = async (email: string, password: string) => {
    // FIX: Add null check as auth can be null if Firebase is not configured.
    if (!auth) throw new Error("Firebase not initialized.");
    // FIX: Use Auth v9 modular syntax for signInWithEmailAndPassword.
    await signInWithEmailAndPassword(auth, email, password);
  };

  const logout = async () => {
    // FIX: Add null check as auth can be null if Firebase is not configured.
    if (!auth) throw new Error("Firebase not initialized.");
    // FIX: Use Auth v9 modular syntax for signOut.
    await signOut(auth);
  };

  const addAttendanceRecord = async (record: Omit<AttendanceRecord, 'id'>) => {
    // FIX: Add null check as db can be null if Firebase is not configured.
    if (!db) throw new Error("Firebase not initialized.");
    // FIX: Use Firestore v9 modular syntax for addDoc and collection.
    await addDoc(collection(db, 'attendance'), record);
  };
  
  const deleteStudent = async (uid: string) => {
      // FIX: Add null check as db can be null if Firebase is not configured.
      if (!db) throw new Error("Firebase not initialized.");
      try {
          // FIX: Use Firestore v9 modular syntax for writeBatch.
          const batch = writeBatch(db);

          // 1. Delete the student document
          // FIX: Use Firestore v9 modular syntax for doc.
          const studentRef = doc(db, 'students', uid);
          batch.delete(studentRef);

          // 2. Delete the user role document
          // FIX: Use Firestore v9 modular syntax for doc.
          const userRef = doc(db, 'users', uid);
          batch.delete(userRef);

          // 3. Find and delete all attendance records for the student
          // FIX: Use Firestore v9 modular syntax for query, collection, and where.
          const attendanceQuery = query(collection(db, 'attendance'), where('studentId', '==', uid));
          // FIX: Use Firestore v9 modular syntax for getDocs.
          const attendanceSnapshot = await getDocs(attendanceQuery);
          if (!attendanceSnapshot.empty) {
              attendanceSnapshot.forEach(doc => {
                  batch.delete(doc.ref);
              });
          }

          // Commit the batch
          await batch.commit();
          
          alert("Student and all their attendance records have been deleted. Note: The auth user is not deleted from client-side for security reasons.");
      } catch (error) {
          console.error("Error deleting student and their data:", error);
          alert("Failed to delete student. See console for details.");
      }
  };
  
  const markManualAttendance = async (studentUid: string, subject: string) => {
      const student = students.find(s => s.uid === studentUid);
      if (!student) return;
      
      const newRecord: Omit<AttendanceRecord, 'id'> = {
        studentId: student.uid,
        studentName: student.name,
        subject: subject,
        date: new Date().toISOString().split('T')[0],
        status: 'present',
      };
      await addAttendanceRecord(newRecord);
  };
  
  const addTimetableEntry = async (entry: Omit<TimetableEntry, 'id' | 'facultyId' | 'facultyName' | 'department'>) => {
    // FIX: Add null check as db can be null if Firebase is not configured.
    if (!currentUser || !currentFaculty?.department || !db) throw new Error("Faculty user, department, or DB not properly loaded.");
    const newEntry = {
        ...entry,
        department: currentFaculty.department,
        facultyId: currentUser.uid,
        facultyName: currentFaculty.name,
    };
    // FIX: Use Firestore v9 modular syntax for addDoc and collection.
    await addDoc(collection(db, 'timetable'), newEntry);
  };

  const updateTimetableEntry = async (entry: TimetableEntry) => {
    // FIX: Add null check as db can be null if Firebase is not configured.
    if (!db) throw new Error("Firebase not initialized.");
    const { id, ...data } = entry;
    if ((!data.facultyId || !data.facultyName) && currentUser && currentFaculty) {
        data.facultyId = currentUser.uid;
        data.facultyName = currentFaculty.name;
    }
    // FIX: Use Firestore v9 modular syntax for updateDoc and doc.
    await updateDoc(doc(db, 'timetable', id), data);
  };

  const deleteTimetableEntry = async (id: string) => {
    // FIX: Add null check as db can be null if Firebase is not configured.
    if (!db) throw new Error("Firebase not initialized.");
    // FIX: Use Firestore v9 modular syntax for deleteDoc and doc.
    await deleteDoc(doc(db, 'timetable', id));
  };
  
  const updateStudentProfile = async (details: Partial<Omit<Student, 'uid' | 'email' | 'department' | 'subjects'>>) => {
      if (!currentUser) throw new Error("Authentication error: No user is logged in.");
      // Student profile editing from the portal has been disabled. This function is a no-op.
  };

  const updateFacultyProfile = async (details: Partial<Omit<Faculty, 'uid' | 'email' | 'department' | 'subjects'>>) => {
    // FIX: Add null check as db can be null if Firebase is not configured.
    if (!currentUser || !db) throw new Error("Authentication error: No user is logged in.");
    
    const updateData: Partial<Faculty> = {};
    if (details.name && details.name.trim()) {
        updateData.name = details.name.trim();
    }
    if (details.profilePicture) {
        updateData.profilePicture = details.profilePicture;
    }

    if (Object.keys(updateData).length === 0) {
        console.warn("Update profile called with no data to update.");
        return;
    }

    // FIX: Use Firestore v9 modular syntax for updateDoc and doc.
    await updateDoc(doc(db, 'faculty', currentUser.uid), updateData);
  };

  const sendPasswordReset = async (email: string) => {
    // FIX: Add null check as auth can be null if Firebase is not configured.
    if (!auth) throw new Error("Firebase not initialized.");
    if (!email.trim()) throw new Error("Email address is required.");
    // FIX: Use Auth v9 modular syntax for sendPasswordResetEmail.
    await sendPasswordResetEmail(auth, email);
  };

  const deleteAttendanceRecord = useCallback(async (id: string) => {
    // FIX: Add null check as db can be null if Firebase is not configured.
    if (!db) throw new Error("Firebase not initialized.");
    if (!id) throw new Error("Record ID is required for deletion.");
    // FIX: Use Firestore v9 modular syntax for deleteDoc and doc.
    await deleteDoc(doc(db, 'attendance', id));
  }, []);
  
  const deleteMultipleAttendanceRecords = useCallback(async (ids: string[]) => {
    // FIX: Add null check as db can be null if Firebase is not configured.
    if (!db) throw new Error("Firebase not initialized.");
    if (!ids || ids.length === 0) {
      console.warn("No record IDs provided for deletion.");
      return;
    }

    // FIX: Use Firestore v9 modular syntax for writeBatch.
    const batch = writeBatch(db);
    ids.forEach(id => {
        // FIX: Use Firestore v9 modular syntax for doc.
        const docRef = doc(db, 'attendance', id);
        batch.delete(docRef);
    });

    await batch.commit();
  }, []);

  const deleteAllAttendanceRecords = useCallback(async () => {
    // FIX: Add null check as db can be null if Firebase is not configured.
    if (!db) throw new Error("Firebase not initialized.");
    if (userRole !== 'faculty' || !currentFaculty || !currentFaculty.subjects || currentFaculty.subjects.length === 0) {
        const errorMsg = "Operation cancelled: Not a faculty or no subjects assigned.";
        console.warn(errorMsg);
        throw new Error(errorMsg);
    }

    const facultySubjects = currentFaculty.subjects;
    
    // Fetch all attendance records and filter client-side to avoid 'in' query limitations.
    // FIX: Use Firestore v9 modular syntax for collection and getDocs.
    const attendanceRef = collection(db, 'attendance');
    const snapshot = await getDocs(attendanceRef);

    const recordsToDelete = snapshot.docs.filter(doc => {
        const data = doc.data() as AttendanceRecord;
        return facultySubjects.includes(data.subject);
    });

    if (recordsToDelete.length === 0) {
      console.warn("No attendance records to delete for this faculty's subjects.");
      return;
    }

    const BATCH_SIZE = 500;
    const promises = [];

    for (let i = 0; i < recordsToDelete.length; i += BATCH_SIZE) {
      // FIX: Use Firestore v9 modular syntax for writeBatch.
      const batch = writeBatch(db);
      const chunk = recordsToDelete.slice(i, i + BATCH_SIZE);
      chunk.forEach(doc => {
        batch.delete(doc.ref);
      });
      promises.push(batch.commit());
    }

    await Promise.all(promises);
  }, [userRole, currentFaculty]);


  const value = {
    currentUser,
    userRole,
    currentStudent,
    currentFaculty,
    loadingAuth,
    students,
    timetable,
    addTimetableEntry,
    updateTimetableEntry,
    deleteTimetableEntry,
    attendance,
    activeSession,
    setActiveSession,
    signUp,
    login,
    logout,
    addAttendanceRecord,
    deleteStudent,
    markManualAttendance,
    updateStudentProfile,
    updateFacultyProfile,
    sendPasswordReset,
    deleteAttendanceRecord,
    deleteMultipleAttendanceRecords,
    deleteAllAttendanceRecords,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

export const useAppContext = () => {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useAppContext must be used within an AppProvider');
  }
  return context;
};
