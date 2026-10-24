// The App Store build wraps this same web app with Capacitor. These helpers cover the few
// places where the native app behaves differently from the website.
import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';

/** The public website, for links other people open (rating links, shared reminders). */
export const PUBLIC_URL = 'https://justin-karlin.github.io/personality-trainer/';

export function isNative(): boolean {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

const REMINDER_ID = 1;

/**
 * Schedule a daily reminder notification at hh:mm on the phone itself (no server).
 * Returns false if the user didn't allow notifications.
 */
export async function scheduleDailyReminder(hour: number, minute: number, body: string): Promise<boolean> {
  const perm = await LocalNotifications.requestPermissions();
  if (perm.display !== 'granted') return false;
  await LocalNotifications.cancel({ notifications: [{ id: REMINDER_ID }] });
  await LocalNotifications.schedule({
    notifications: [
      {
        id: REMINDER_ID,
        title: 'Trait5',
        body,
        schedule: { on: { hour, minute }, allowWhileIdle: true },
      },
    ],
  });
  return true;
}

export async function cancelDailyReminder(): Promise<void> {
  await LocalNotifications.cancel({ notifications: [{ id: REMINDER_ID }] });
}
