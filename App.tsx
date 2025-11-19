
import React from 'react';
import { AppProvider, useAppContext } from './context/AppContext.tsx';
import FacultyPortal from './components/FacultyPortal.tsx';
import StudentPortal from './components/StudentPortal.tsx';
import Auth from './components/Auth.tsx';
import { ThemeProvider } from './context/ThemeContext.tsx';
import { firebaseInitialized } from './firebase/config.ts';

const App: React.FC = () => {
  return (
    <ThemeProvider>
      <AppProvider>
        <Main />
      </AppProvider>
    </ThemeProvider>
  );
};

const FirebaseConfigError: React.FC = () => (
    <div className="flex flex-col items-center justify-center h-screen text-center p-6 bg-red-50 dark:bg-gray-800">
        <div className="bg-white dark:bg-gray-900 p-8 rounded-lg shadow-2xl border border-red-200 dark:border-red-700 max-w-lg">
            <svg className="w-16 h-16 mx-auto text-red-500 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
            <h1 className="text-2xl font-bold text-red-600 dark:text-red-400 mb-3">Configuration Error</h1>
            <p className="text-gray-700 dark:text-gray-300">
                The application cannot connect to the backend services because Firebase is not configured correctly.
            </p>
            <p className="text-gray-600 dark:text-gray-400 mt-2 text-sm">
                Please update the <code className="bg-gray-200 dark:bg-gray-700 px-1 py-0.5 rounded">firebase/config.ts</code> file with your project's credentials from the Firebase console.
            </p>
        </div>
    </div>
);

const Main: React.FC = () => {
    const { currentUser, userRole, loadingAuth } = useAppContext();

    const renderContent = () => {
        // This is the most important check. If Firebase isn't set up, show an error and stop.
        if (!firebaseInitialized) {
            return <FirebaseConfigError />;
        }
        
        if (loadingAuth) {
            return (
                <div className="flex items-center justify-center h-screen">
                    <svg className="animate-spin h-10 w-10 text-cyan-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                </div>
            );
        }

        if (!currentUser) {
            return <Auth />;
        }

        if (userRole === 'faculty') {
            return <FacultyPortal />;
        }
        if (userRole === 'student') {
            return <StudentPortal />;
        }
        
        // This can happen briefly while the userRole is being fetched after login
        return <p>Verifying user role...</p>;
    };
    
    // The portals handle their own layout. The centering classes are for the Auth component.
    const wrapperClasses = currentUser && userRole && firebaseInitialized
      ? "" 
      : "flex flex-col items-center justify-center p-4";

    return (
        <div className={`min-h-screen bg-cyan-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 transition-colors duration-300 ${wrapperClasses}`}>
           {renderContent()}
        </div>
    );
}

export default App;
