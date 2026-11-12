// Shapes returned by the Next.js server (app/api/*). Keep in sync with the web app.

export type EventCategory = "BUSINESS_TRIP" | "ATTENDANCE";

export type CalEvent = {
  id: string;
  category: EventCategory;
  title: string;
  description?: string | null;
  startDate: string; // ISO, Seoul midnight for all-day events
  endDate: string; // inclusive
  allDay: boolean;
  color: string;
  overtimeAvailable: boolean;
  isOvertimeOnly: boolean;
  equipmentOnly?: boolean;
  personnel?: string | null; // "김민수, 최유진"
  equipment?: string | null; // "T-01, N-01, Target x1"
  creatorId: string;
  groupId?: string | null;
  creator: { id: string; name?: string | null; email?: string | null; image?: string | null };
  creatorNickname?: string | null;
};

export type GroupMember = {
  id: string;
  userId: string;
  nickname?: string | null;
  role?: string | null;
  status?: string | null;
  canNotify?: boolean;
  user: { id: string; name?: string | null; email?: string | null; image?: string | null };
};

export type Group = {
  id: string;
  name: string;
  description?: string | null;
  leaderId: string;
  trackerOptions?: string | null;
  laptopOptions?: string | null;
  targetCount?: number;
  eventDisplayLimit?: number;
  inviteCode?: string;
  members: GroupMember[];
};

export type CustomHoliday = { id: string; date: string; name: string; type: "holiday" | "workday" };

export type PendingUser = { id: string; name?: string | null; email?: string | null; employeeId?: string | null; createdAt: string };

export type AdminUser = {
  id: string;
  name?: string | null;
  email?: string | null;
  employeeId?: string | null;
  isOperator: boolean;
  createdAt: string;
  groupMembers: { id: string; role?: string | null; group: { id: string; name: string; leaderId: string } }[];
};

export type NotificationSchedule = {
  id: string;
  groupId: string;
  message: string;
  dayOfWeek: string; // "1,3,5"
  timeHour: number;
  timeMin: number;
  active: boolean;
};

export type DayNoteEntry = { id: string; text: string; assignee: string; startDate: string; endDate: string };
export type PersonalNoteItem = { id: string; text: string };

export type Me = {
  id: string;
  name?: string | null;
  email?: string | null;
  image?: string | null;
  status: string;
  isOperator: boolean;
  employeeId?: string | null;
};

export type AppNotification = {
  id: string;
  groupId: string;
  type: string;
  title: string;
  body: string;
  targetDate?: string | null;
  eventId?: string | null;
  eventCategory?: EventCategory | null;
  createdAt: string;
  readAt: string | null;
};

export type DayNote = {
  id: string;
  date: string;
  content: string;
  items?: { text: string }[];
  updatedAt: string;
} | null;

export type EventInput = {
  category: EventCategory;
  title: string;
  description?: string;
  startDate: string;
  endDate: string;
  allDay: boolean;
  color: string;
  groupId?: string | null;
  personnel?: string | null;
  equipment?: string | null;
  equipmentOnly?: boolean;
  isOvertimeOnly?: boolean;
  overtimeAvailable?: boolean;
};
