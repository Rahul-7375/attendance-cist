
import { TimetableEntry } from '../types.ts';
import { DEFAULT_CLASS_DURATION_MINS } from '../constants.ts';

const DAYS_OF_WEEK: TimetableEntry['day'][] = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/**
 * Analyzes the timetable against the current time to find the currently active class and the next upcoming class.
 * @param timetable The array of all timetable entries.
 * @returns An object with the IDs of the current and next class, or null if not applicable.
 */
export const getScheduleStatus = (timetable: TimetableEntry[]): { currentClassId: string | null; nextClassId: string | null } => {
    const now = new Date();
    const currentDay = DAYS_OF_WEEK[now.getDay()];
    const nowTimeValue = now.getHours() * 60 + now.getMinutes(); // Current time in minutes from midnight

    let currentClassId: string | null = null;
    let nextClassId: string | null = null;

    const todayEntries = timetable
        .filter(entry => entry.day === currentDay)
        .map(entry => {
            const [hours, minutes] = entry.time.split(':').map(Number);
            return { ...entry, startTimeValue: hours * 60 + minutes };
        })
        .sort((a, b) => a.startTimeValue - b.startTimeValue);

    // Find current and next class for today
    const upcomingToday = [];
    for (const entry of todayEntries) {
        const startTime = entry.startTimeValue;
        const duration = entry.duration || DEFAULT_CLASS_DURATION_MINS; // Use entry's duration, with a fallback
        const endTime = startTime + duration;

        if (nowTimeValue >= startTime && nowTimeValue < endTime) {
            currentClassId = entry.id;
        }

        if (startTime > nowTimeValue) {
            upcomingToday.push(entry);
        }
    }

    if (upcomingToday.length > 0) {
        nextClassId = upcomingToday[0].id;
    }

    // If no next class today, find the first class of the next available day
    if (!nextClassId) {
        for (let i = 1; i <= 7; i++) {
            const nextDayIndex = (now.getDay() + i) % 7;
            const nextDay = DAYS_OF_WEEK[nextDayIndex];
            const nextDayEntries = timetable
                .filter(entry => entry.day === nextDay)
                .sort((a, b) => a.time.localeCompare(b.time));

            if (nextDayEntries.length > 0) {
                nextClassId = nextDayEntries[0].id;
                break; // Found the next class, exit loop
            }
        }
    }

    return { currentClassId, nextClassId };
};