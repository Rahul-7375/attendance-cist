
export const DEPARTMENTS: { [key: string]: string[] } = {
    'Computer Science and Engineering': [
        'Introduction to Programming',
        'Data Structures',
        'Algorithms',
        'Database Management Systems',
        'Operating Systems',
        'Computer Networks',
    ],
    'CSE- Data Science': [
        'ATCD',
        'PA',
        'WSMA',
        'NLP',
        'WSMA LAB',
        'PALAB PS-1',
        'I&EE',
        'EIA'
    ],
    'CSE- AIML': [
        'Fundamentals of AI',
        'Natural Language Processing',
        'Computer Vision',
        'Robotics',
        'Expert Systems',
        'Reinforcement Learning'
    ],
    'Electronics and Communication Engineering': [
        'Basic Electrical Engineering',
        'Circuit Theory',
        'Digital Logic Design',
        'Signals and Systems',
        'Analog Communication',
        'Digital Communication',
        'Microprocessors'
    ],
    'Mechanical Engineering': [
        'Engineering Mechanics',
        'Thermodynamics',
        'Fluid Mechanics',
        'Machine Design',
        'Manufacturing Processes',
        'Heat Transfer'
    ],
    'Civil Engineering': [
        'Surveying',
        'Structural Analysis',
        'Geotechnical Engineering',
        'Transportation Engineering',
        'Environmental Engineering',
        'Fluid Mechanics for Civil Engineers'
    ]
};


export const MAX_DISTANCE_METERS = 50;
export const QR_REFRESH_INTERVAL_MS = 10000;
export const MAX_FACULTY_MOVEMENT_METERS = 100;
export const RETRY_CONFIDENCE_THRESHOLD = 0.75; // 75% confidence
export const DEFAULT_CLASS_DURATION_MINS = 45;