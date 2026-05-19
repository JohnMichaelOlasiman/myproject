export type UserRole = "student" | "admin";
export type Course = "BSIT" | "BSCS" | "HM" | "CRIM" | "CBA";
export type Level = "1" | "2" | "3" | "4";
export type LabNumber = "524" | "526" | "528" | "530" | "542" | "544";
export type ReservationStatus = "pending" | "approved" | "declined" | "sit-inned" | "completed";
export type SitInStatus = "Sit-in" | "Completed";
export type ResourceType = "folder" | "pdf" | "doc" | "video" | "file";

export type ProfileRecord = {
  id: string;
  idno: string;
  firstname: string;
  middlename: string;
  lastname: string;
  email: string;
  username: string;
  course: Course;
  level: Level;
  role: UserRole;
  session_remaining: number;
  points: number;
  tasks_completed: number;
  hours_spent: number;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
};

export type NotificationRecord = {
  id: number;
  user_id: string | null;
  role_scope: UserRole | null;
  message: string;
  read: boolean;
  created_at: string;
};

export type AnnouncementRecord = {
  id: number;
  title: string;
  description: string;
  author_id: string | null;
  author_name: string;
  attachment_name: string | null;
  attachment_type: "image" | "file" | null;
  attachment_url: string | null;
  created_at: string;
  updated_at: string;
};

export type AnnouncementCommentRecord = {
  id: number;
  announcement_id: number;
  user_id: string | null;
  comment: string;
  created_at: string;
};

export type SitInRecord = {
  id: number;
  idno: string;
  full_name: string;
  purpose: string;
  lab_number: LabNumber;
  time_in: string;
  time_out: string | null;
  date: string;
  session_remaining: number;
  status: SitInStatus;
  rewarded: boolean;
  created_at: string;
  updated_at: string;
};

export type ReservationRecord = {
  id: number;
  user_id: string | null;
  idno: string;
  full_name: string;
  course: Course;
  level: Level;
  lab_number: LabNumber;
  pc_number: number;
  reservation_date: string;
  time_in: string;
  purpose: string;
  status: ReservationStatus;
  created_at: string;
  updated_at: string;
};

export type FeedbackRecord = {
  id: number;
  idno: string;
  full_name: string;
  course: Course;
  level: Level;
  lab: LabNumber;
  date: string;
  time_in: string;
  time_out: string;
  message: string;
  rating: 1 | 2 | 3 | 4 | 5;
  flagged: boolean;
  created_at: string;
};

export type ResourceRecord = {
  id: string;
  parent_id: string | null;
  title: string;
  type: ResourceType;
  size: string;
  description: string;
  uploaded_at: string;
  owner_name: string;
  storage_url: string | null;
};

export type LabComputerRecord = {
  id: number;
  lab_number: LabNumber;
  pc_number: number;
  status: "available" | "unavailable" | "reserved" | "occupied";
  updated_at: string;
};

export type LabScheduleRecord = {
  id: number;
  lab_number: LabNumber;
  day: "Monday" | "Tuesday" | "Wednesday" | "Thursday" | "Friday" | "Saturday";
  start_time: string;
  end_time: string;
  status: "available" | "unavailable";
  notes: string;
  created_at: string;
  updated_at: string;
};
