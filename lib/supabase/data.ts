"use client";

import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { labOptions } from "@/lib/supabase/constants";
import { calculateDurationMinutes } from "@/lib/sit-in-metrics";
import {
  AnnouncementCommentRecord,
  AnnouncementRecord,
  Course,
  FeedbackRecord,
  LabComputerRecord,
  LabNumber,
  LabScheduleRecord,
  Level,
  NotificationRecord,
  ProfileRecord,
  ReservationRecord,
  ResourceRecord,
  SitInRecord,
  UserRole,
} from "@/lib/supabase/types";

const SUPABASE_CONNECTION_ERROR_MESSAGE =
  "Unable to reach Supabase API. Verify NEXT_PUBLIC_SUPABASE_URL, ensure the project is active, and disable any blocker/VPN that may intercept requests.";

function ensureConfigured() {
  if (!isSupabaseConfigured) {
    throw new Error("Supabase is not configured.");
  }
}

function isFailedFetchError(error: unknown) {
  return error instanceof TypeError && error.message.toLowerCase().includes("failed to fetch");
}

function isAuthSessionMissingError(error: unknown) {
  return error instanceof Error && error.message.toLowerCase().includes("auth session missing");
}

function rethrowSupabaseError(error: unknown, fallback = SUPABASE_CONNECTION_ERROR_MESSAGE): never {
  if (isFailedFetchError(error)) {
    throw new Error(fallback);
  }
  if (error instanceof Error) {
    throw error;
  }
  throw new Error(fallback);
}

function wait(ms: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
}

type AuthUserLike = {
  id: string;
  email?: string | null;
  user_metadata?: Record<string, unknown> | null;
};

function stringValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function coerceCourse(value: unknown): Course {
  const candidate = stringValue(value).toUpperCase();
  return ["BSIT", "BSCS", "ACT"].includes(candidate) ? (candidate as Course) : "BSIT";
}

function coerceLevel(value: unknown): Level {
  const candidate = stringValue(value);
  return ["1", "2", "3", "4"].includes(candidate) ? (candidate as Level) : "1";
}

function buildFallbackProfile(user: AuthUserLike): ProfileRecord {
  const metadata = user.user_metadata ?? {};
  const firstname = stringValue(metadata.firstname) || "Student";
  const lastname = stringValue(metadata.lastname) || "User";
  const middlename = stringValue(metadata.middlename);
  const idno = stringValue(metadata.idno) || user.id;
  const email = stringValue(metadata.email) || user.email || "";
  const username = stringValue(metadata.username) || idno || email || user.id;
  const now = new Date().toISOString();

  return {
    id: user.id,
    idno,
    firstname,
    middlename,
    lastname,
    email,
    username,
    course: coerceCourse(metadata.course),
    level: coerceLevel(metadata.level),
    role: metadata.role === "admin" ? "admin" : "student",
    session_remaining:
      typeof metadata.session_remaining === "number" && Number.isFinite(metadata.session_remaining)
        ? metadata.session_remaining
        : 30,
    points: typeof metadata.points === "number" && Number.isFinite(metadata.points) ? metadata.points : 0,
    tasks_completed:
      typeof metadata.tasks_completed === "number" && Number.isFinite(metadata.tasks_completed)
        ? metadata.tasks_completed
        : 0,
    hours_spent:
      typeof metadata.hours_spent === "number" && Number.isFinite(metadata.hours_spent)
        ? metadata.hours_spent
        : 0,
    avatar_url: stringValue(metadata.avatar_url) || null,
    created_at: now,
    updated_at: now,
  };
}

async function waitForSessionUserId(timeoutMs: number) {
  const supabase = getSupabaseBrowserClient();
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    const { data, error } = await supabase.auth.getSession();
    handleError(error, "Unable to read auth session.");
    if (data.session?.user?.id) {
      return data.session.user.id;
    }
    await wait(200);
  }

  const { data, error } = await supabase.auth.getUser();
  if (isAuthSessionMissingError(error)) {
    return null;
  }
  handleError(error, "Unable to read auth user.");
  return data.user?.id ?? null;
}

function handleError(error: { message: string } | null, fallback: string) {
  if (error) {
    throw new Error(error.message || fallback);
  }
}

type RegistrationConflictRow = {
  conflict_field: "idno" | "email" | "username";
  conflict_message: string;
};

async function getRegistrationConflictMessage(input: {
  idno: string;
  email: string;
  username: string;
}) {
  ensureConfigured();
  try {
    const supabase = getSupabaseBrowserClient();
    const { data, error } = await supabase.rpc("check_registration_conflicts", {
      input_idno: input.idno.trim(),
      input_email: input.email.trim().toLowerCase(),
      input_username: input.username.trim().toLowerCase(),
    });

    if (error) {
      const message = error.message.toLowerCase();
      if (message.includes("function") && message.includes("does not exist")) {
        return null;
      }
      throw new Error(error.message || "Unable to validate registration details.");
    }

    const first = (data as RegistrationConflictRow[] | null)?.[0];
    return first?.conflict_message ?? null;
  } catch (error) {
    // If RPC pre-check is temporarily unreachable, continue and let auth.signUp enforce uniqueness.
    if (isFailedFetchError(error)) {
      return null;
    }
    rethrowSupabaseError(error);
  }
}

export async function getLoginEmail(identifier: string) {
  ensureConfigured();
  const value = identifier.trim();
  if (!value) {
    throw new Error("ID number is required.");
  }

  const supabase = getSupabaseBrowserClient();

  try {
    const { data, error } = await supabase.rpc("get_login_email", { input_value: value });
    handleError(error, "Unable to resolve login identifier.");
    if (data) {
      return String(data);
    }
  } catch (error) {
    if (isFailedFetchError(error)) {
      rethrowSupabaseError(
        error,
        "Unable to resolve your ID number right now. Verify Supabase URL/network settings and try again.",
      );
    }
  }

  const normalizedIdno = value.replaceAll(/[^a-z0-9]/gi, "");

  const { data: exactIdnoMatch, error: exactIdnoError } = await supabase
    .from("profiles")
    .select("email")
    .eq("idno", value)
    .maybeSingle();
  handleError(exactIdnoError, "Unable to resolve login identifier.");
  if (exactIdnoMatch?.email) {
    return exactIdnoMatch.email;
  }

  if (normalizedIdno && normalizedIdno !== value) {
    const { data: normalizedIdnoMatch, error: normalizedIdnoError } = await supabase
      .from("profiles")
      .select("email")
      .eq("idno", normalizedIdno)
      .maybeSingle();
    handleError(normalizedIdnoError, "Unable to resolve login identifier.");
    if (normalizedIdnoMatch?.email) {
      return normalizedIdnoMatch.email;
    }
  }

  const normalized = value.toLowerCase();
  const { data: emailMatch, error: emailError } = await supabase
    .from("profiles")
    .select("email")
    .ilike("email", normalized)
    .maybeSingle();
  handleError(emailError, "Unable to resolve login identifier.");
  if (emailMatch?.email) {
    return emailMatch.email;
  }

  const { data: usernameMatch, error: usernameError } = await supabase
    .from("profiles")
    .select("email")
    .ilike("username", normalized)
    .maybeSingle();
  handleError(usernameError, "Unable to resolve login identifier.");
  if (usernameMatch?.email) {
    return usernameMatch.email;
  }

  throw new Error("Account not found for this ID number.");
}

export async function signInWithPassword(identifier: string, password: string) {
  ensureConfigured();
  const email = await getLoginEmail(identifier);
  const supabase = getSupabaseBrowserClient();
  try {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      const msg = error.message || "";
      if (msg.toLowerCase().includes("email not confirmed")) {
        try {
          const res = await fetch('/api/auth/confirm-email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email }),
          });
          if (res.ok) {
            const retryResult = await supabase.auth.signInWithPassword({ email, password });
            handleError(retryResult.error, "Unable to sign in.");
            return retryResult.data;
          }
        } catch (apiError) {
          console.error("Auto-confirmation failed:", apiError);
        }
      }
      handleError(error, "Unable to sign in.");
    }
    return data;
  } catch (error) {
    rethrowSupabaseError(error);
  }
}

export async function signUpStudent(input: {
  idno: string;
  lastname: string;
  firstname: string;
  middlename: string;
  course: Course;
  level: Level;
  email: string;
  username: string;
  password: string;
}) {
  ensureConfigured();
  const conflictMessage = await getRegistrationConflictMessage({
    idno: input.idno.trim(),
    email: input.email.trim(),
    username: input.username.trim(),
  });

  if (conflictMessage) {
    throw new Error(conflictMessage);
  }

  try {
    const body = {
      idno: input.idno.trim(),
      firstname: input.firstname.trim(),
      middlename: input.middlename.trim(),
      lastname: input.lastname.trim(),
      course: input.course,
      level: input.level,
      email: input.email.trim().toLowerCase(),
      username: input.username.trim(),
      password: input.password,
    };

    const res = await fetch('/api/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const payload = await res.json().catch(() => ({}));
      throw new Error(payload.error || 'Unable to register account.');
    }

    const payload = await res.json();
    return payload;
  } catch (error) {
    rethrowSupabaseError(error);
  }
}

export async function signOut() {
  ensureConfigured();
  const supabase = getSupabaseBrowserClient();
  const { error } = await supabase.auth.signOut();
  handleError(error, "Unable to sign out.");
}

export async function getCurrentUserId(options?: { waitForSessionMs?: number }) {
  ensureConfigured();
  const waitForSessionMs = options?.waitForSessionMs ?? 5000;
  const supabase = getSupabaseBrowserClient();
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  handleError(sessionError, "Unable to read auth session.");
  if (sessionData.session?.user?.id) {
    return sessionData.session.user.id;
  }

  if (waitForSessionMs > 0) {
    const hydratedUserId = await waitForSessionUserId(waitForSessionMs);
    if (hydratedUserId) {
      return hydratedUserId;
    }
  }

  const { data, error } = await supabase.auth.getUser();
  if (isAuthSessionMissingError(error)) {
    return null;
  }
  handleError(error, "Unable to read auth user.");
  return data.user?.id ?? null;
}

export async function getCurrentProfile() {
  const userId = await getCurrentUserId({ waitForSessionMs: 5000 });
  if (!userId) {
    return null;
  }
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
  handleError(error, "Unable to fetch profile.");
  if (data) {
    return data as ProfileRecord;
  }

  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (isAuthSessionMissingError(authError)) {
    return null;
  }
  handleError(authError, "Unable to read auth user.");
  if (!authData.user) {
    return null;
  }

  return buildFallbackProfile(authData.user as AuthUserLike);
}

export async function getCurrentProfileWithRetry(options?: { attempts?: number; delayMs?: number }) {
  const attempts = options?.attempts ?? 20;
  const delayMs = options?.delayMs ?? 250;
  let userId: string | null = null;
  let lastError: unknown = null;

  for (let index = 0; index < attempts; index += 1) {
    try {
      if (!userId) {
        userId = await getCurrentUserId({ waitForSessionMs: index === 0 ? 6000 : 0 });
        if (!userId) {
          if (index < attempts - 1) {
            await wait(delayMs);
            continue;
          }
          return null;
        }
      }

      const supabase = getSupabaseBrowserClient();
      const { data, error } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
      handleError(error, "Unable to fetch profile.");
      if (data) {
        return data as ProfileRecord;
      }

      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (isAuthSessionMissingError(authError)) {
        return null;
      }
      handleError(authError, "Unable to read auth user.");
      if (authData.user) {
        return buildFallbackProfile(authData.user as AuthUserLike);
      }
    } catch (error) {
      if (!isFailedFetchError(error) && !isAuthSessionMissingError(error)) {
        throw error;
      }
      lastError = error;
    }

    if (index < attempts - 1) {
      await wait(delayMs);
    }
  }

  if (lastError) {
    rethrowSupabaseError(lastError);
  }
  return null;
}

export async function getAdminProfileFallback() {
  ensureConfigured();
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("role", "admin")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  handleError(error, "Unable to fetch admin profile.");
  return (data as ProfileRecord | null) ?? null;
}

export async function updateProfile(
  id: string,
  patch: Partial<
    Pick<
      ProfileRecord,
      | "idno"
      | "lastname"
      | "firstname"
      | "middlename"
      | "course"
      | "level"
      | "email"
      | "username"
      | "avatar_url"
      | "session_remaining"
      | "points"
      | "tasks_completed"
      | "hours_spent"
      | "role"
    >
  >,
) {
  ensureConfigured();
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("profiles")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("*")
    .single();
  handleError(error, "Unable to update profile.");
  return data as ProfileRecord;
}

export async function updatePassword(password: string) {
  ensureConfigured();
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase.auth.updateUser({ password });
  handleError(error, "Unable to update password.");
  return data;
}

export async function listNotifications(profileId: string | null, role: UserRole) {
  ensureConfigured();
  const supabase = getSupabaseBrowserClient();
  let query = supabase.from("notifications").select("*").order("created_at", { ascending: false }).limit(30);
  if (profileId) {
    query = query.or(`user_id.eq.${profileId},and(user_id.is.null,role_scope.eq.${role})`);
  } else {
    query = query.eq("role_scope", role).is("user_id", null);
  }
  const { data, error } = await query;
  handleError(error, "Unable to fetch notifications.");
  return (data ?? []) as NotificationRecord[];
}

export async function createNotification(input: {
  message: string;
  user_id?: string | null;
  role_scope?: UserRole | null;
}) {
  ensureConfigured();
  const message = input.message.trim();
  if (!message) {
    throw new Error("Notification message is required.");
  }
  const supabase = getSupabaseBrowserClient();
  const { error } = await supabase.from("notifications").insert({
    message,
    user_id: input.user_id ?? null,
    role_scope: input.role_scope ?? null,
  });
  handleError(error, "Unable to create notification.");
}

export async function markNotificationRead(notificationId: number) {
  ensureConfigured();
  const supabase = getSupabaseBrowserClient();
  const { error } = await supabase
    .from("notifications")
    .update({ read: true })
    .eq("id", notificationId);
  handleError(error, "Unable to mark notification as read.");
}

export async function markAllNotificationsRead(profileId: string | null, role: UserRole) {
  ensureConfigured();
  const supabase = getSupabaseBrowserClient();
  let query = supabase.from("notifications").update({ read: true }).eq("read", false);
  if (profileId) {
    query = query.or(`user_id.eq.${profileId},and(user_id.is.null,role_scope.eq.${role})`);
  } else {
    query = query.eq("role_scope", role).is("user_id", null);
  }
  const { error } = await query;
  handleError(error, "Unable to mark all notifications as read.");
}

export async function listAnnouncements() {
  ensureConfigured();
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("announcements")
    .select("*")
    .order("created_at", { ascending: false });
  handleError(error, "Unable to fetch announcements.");
  return (data ?? []) as AnnouncementRecord[];
}

export async function listAnnouncementComments(announcementIds: number[]) {
  if (announcementIds.length === 0) {
    return [] as AnnouncementCommentRecord[];
  }
  ensureConfigured();
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("announcement_comments")
    .select("*")
    .in("announcement_id", announcementIds)
    .order("created_at", { ascending: true });
  handleError(error, "Unable to fetch announcement comments.");
  return (data ?? []) as AnnouncementCommentRecord[];
}

export async function createAnnouncementComment(input: {
  announcement_id: number;
  comment: string;
  user_id: string | null;
}) {
  ensureConfigured();
  const supabase = getSupabaseBrowserClient();
  const payload = {
    announcement_id: input.announcement_id,
    comment: input.comment.trim(),
    user_id: input.user_id,
  };
  const { error } = await supabase.from("announcement_comments").insert(payload);
  handleError(error, "Unable to post comment.");
}

export async function createAnnouncement(input: {
  title: string;
  description: string;
  author_name: string;
  author_id: string | null;
  attachment_name: string | null;
  attachment_type: "image" | "file" | null;
  attachment_url: string | null;
}) {
  ensureConfigured();
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("announcements")
    .insert({
      ...input,
      updated_at: new Date().toISOString(),
    })
    .select("*")
    .single();
  handleError(error, "Unable to create announcement.");
  await createNotification({
    role_scope: "student",
    message: `New announcement posted: ${input.title}`,
  });
  return data as AnnouncementRecord;
}

export async function updateAnnouncement(
  id: number,
  input: Partial<
    Pick<
      AnnouncementRecord,
      "title" | "description" | "attachment_name" | "attachment_type" | "attachment_url"
    >
  >,
) {
  ensureConfigured();
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("announcements")
    .update({
      ...input,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select("*")
    .single();
  handleError(error, "Unable to update announcement.");
  return data as AnnouncementRecord;
}

export async function deleteAnnouncement(id: number) {
  ensureConfigured();
  const supabase = getSupabaseBrowserClient();
  const { error } = await supabase.from("announcements").delete().eq("id", id);
  handleError(error, "Unable to delete announcement.");
}

export async function listStudentHistory(idno: string) {
  ensureConfigured();
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("sit_in_records")
    .select("*")
    .eq("idno", idno)
    .order("date", { ascending: false })
    .order("created_at", { ascending: false });
  handleError(error, "Unable to fetch student history.");
  return (data ?? []) as SitInRecord[];
}

export async function listFeedbackByIdno(idno: string) {
  ensureConfigured();
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("feedback")
    .select("*")
    .eq("idno", idno);
  handleError(error, "Unable to fetch feedback.");
  return (data ?? []) as FeedbackRecord[];
}

export async function createFeedback(input: {
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
}) {
  ensureConfigured();
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("feedback")
    .insert(input)
    .select("*")
    .single();
  handleError(error, "Unable to submit feedback.");
  return data as FeedbackRecord;
}

export async function listReservationsByIdno(idno: string) {
  ensureConfigured();
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("reservations")
    .select("*")
    .eq("idno", idno)
    .order("created_at", { ascending: false });
  handleError(error, "Unable to fetch reservations.");
  return (data ?? []) as ReservationRecord[];
}

export async function createReservation(input: {
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
}) {
  ensureConfigured();
  if (!input.reservation_date.trim() || !input.time_in.trim()) {
    throw new Error("Reservation date and time in are required.");
  }
  const supabase = getSupabaseBrowserClient();
  const { data: pcRow, error: pcError } = await supabase
    .from("lab_computers")
    .select("status")
    .eq("lab_number", input.lab_number)
    .eq("pc_number", input.pc_number)
    .maybeSingle();
  handleError(pcError, "Unable to validate computer status.");
  if (pcRow && pcRow.status !== "available") {
    throw new Error("The selected PC is unavailable. Please choose an available PC.");
  }

  const { data, error } = await supabase
    .from("reservations")
    .insert({ ...input, status: "pending" })
    .select("*")
    .single();
  handleError(error, "Unable to create reservation.");
  return data as ReservationRecord;
}

export async function listLabComputers(labNumber?: LabNumber) {
  ensureConfigured();
  const supabase = getSupabaseBrowserClient();
  let query = supabase
    .from("lab_computers")
    .select("*")
    .order("pc_number", { ascending: true });
  if (labNumber) {
    query = query.eq("lab_number", labNumber);
  }
  const { data, error } = await query;
  handleError(error, "Unable to fetch lab computers.");
  return (data ?? []) as LabComputerRecord[];
}

export async function upsertLabComputerStatuses(rows: Array<{
  lab_number: LabNumber;
  pc_number: number;
  status: "available" | "unavailable" | "reserved" | "occupied";
}>) {
  if (rows.length === 0) {
    return;
  }
  ensureConfigured();
  const supabase = getSupabaseBrowserClient();
  const payload = rows.map((row) => ({ ...row, updated_at: new Date().toISOString() }));
  const { error } = await supabase
    .from("lab_computers")
    .upsert(payload, { onConflict: "lab_number,pc_number" });
  handleError(error, "Unable to update lab computers.");
}

export async function listLabSchedules(labNumber?: LabNumber) {
  ensureConfigured();
  const supabase = getSupabaseBrowserClient();
  let query = supabase
    .from("lab_schedules")
    .select("*")
    .order("day", { ascending: true })
    .order("start_time", { ascending: true });
  if (labNumber) {
    query = query.eq("lab_number", labNumber);
  }
  const { data, error } = await query;
  handleError(error, "Unable to fetch lab schedules.");
  return (data ?? []) as LabScheduleRecord[];
}

export async function upsertLabSchedule(input: {
  id?: number;
  lab_number: LabNumber;
  day: LabScheduleRecord["day"];
  start_time: string;
  end_time: string;
  status: "available" | "unavailable";
  notes: string;
}) {
  ensureConfigured();
  const supabase = getSupabaseBrowserClient();
  if (input.id) {
    const { data, error } = await supabase
      .from("lab_schedules")
      .update({ ...input, updated_at: new Date().toISOString() })
      .eq("id", input.id)
      .select("*")
      .single();
    handleError(error, "Unable to update schedule.");
    return data as LabScheduleRecord;
  }
  const { data, error } = await supabase
    .from("lab_schedules")
    .insert({ ...input, updated_at: new Date().toISOString() })
    .select("*")
    .single();
  handleError(error, "Unable to create schedule.");
  return data as LabScheduleRecord;
}

export async function listResources() {
  ensureConfigured();
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase.from("resources").select("*").order("uploaded_at", { ascending: false });
  handleError(error, "Unable to fetch resources.");
  return (data ?? []) as ResourceRecord[];
}

export async function createResource(input: {
  parent_id: string | null;
  title: string;
  type: ResourceRecord["type"];
  size: string;
  description: string;
  owner_name: string;
  storage_url: string | null;
}) {
  ensureConfigured();
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase.from("resources").insert(input).select("*").single();
  handleError(error, "Unable to create resource.");
  return data as ResourceRecord;
}

export async function updateResource(
  id: string,
  input: Partial<Pick<ResourceRecord, "title" | "size" | "description" | "storage_url">>,
) {
  ensureConfigured();
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase.from("resources").update(input).eq("id", id).select("*").single();
  handleError(error, "Unable to update resource.");
  return data as ResourceRecord;
}

export async function deleteResource(id: string) {
  ensureConfigured();
  const supabase = getSupabaseBrowserClient();
  const { error } = await supabase.from("resources").delete().eq("id", id);
  handleError(error, "Unable to delete resource.");
}

export async function listPublicLeaderboard(limit = 10) {
  ensureConfigured();
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase.rpc("get_public_leaderboard", { input_limit: limit });
  if (error) {
    const message = error.message.toLowerCase();
    if (
      message.includes("could not find the function") ||
      message.includes("schema cache") ||
      (message.includes("function") && message.includes("does not exist"))
    ) {
      return [] as Array<{
        id: string;
        firstname: string;
        lastname: string;
        course: Course;
        level: Level;
        points: number;
        hours_spent: number;
        tasks_completed: number;
      }>;
    }
    handleError(error, "Unable to fetch public leaderboard.");
  }
  return (data ?? []) as Array<{
    id: string;
    firstname: string;
    lastname: string;
    course: Course;
    level: Level;
    points: number;
    hours_spent: number;
    tasks_completed: number;
  }>;
}

export async function listStudents() {
  ensureConfigured();
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("role", "student")
    .neq("email", "admin@example.com")
    .neq("username", "admin")
    .neq("idno", "ADMIN")
    .order("created_at", { ascending: false })
    .order("lastname", { ascending: true });
  handleError(error, "Unable to fetch students.");
  return (data ?? []) as ProfileRecord[];
}

export async function createStudent(input: {
  idno: string;
  firstname: string;
  middlename: string;
  lastname: string;
  course: Course;
  level: Level;
  email: string;
  username: string;
  session_remaining: number;
  points: number;
  tasks_completed: number;
  hours_spent: number;
  password?: string;
}) {
  // Create an auth user + profile via server-side admin endpoint
  ensureConfigured();
  const body = {
    idno: input.idno,
    firstname: input.firstname,
    middlename: input.middlename,
    lastname: input.lastname,
    course: input.course,
    level: input.level,
    email: input.email,
    username: input.username,
    // default password: use idno if available otherwise random
    password: input.password || input.idno || `pass-${Math.random().toString(36).slice(2, 10)}`,
  };

  const res = await fetch('/api/admin/users', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const payload = await res.json().catch(() => ({}));
    throw new Error(payload.error || 'Unable to create student account.');
  }
  const payload = await res.json();
  return payload.profile as ProfileRecord;
}

export async function updateStudent(id: string, patch: Partial<ProfileRecord> & { password?: string }) {
  ensureConfigured();
  
  // Validate ID
  if (!id || id.trim() === '') {
    console.error('updateStudent called with empty ID');
    throw new Error('Student ID is required for updates');
  }
  
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { password, id: _id, created_at: _created, updated_at: _updated, ...profilePatch } = patch as Record<string, unknown>;
  
  const res = await fetch(`/api/admin/users/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ 
      profile: profilePatch, 
      password: password || undefined,
      email: profilePatch.email || undefined,
    }),
  });
  if (!res.ok) {
    const payload = await res.json().catch(() => ({}));
    throw new Error(payload.error || `Unable to update student account (${res.status})`);
  }
  const payload = await res.json();
  return payload.profile as ProfileRecord;
}

export async function deleteStudent(id: string) {
  ensureConfigured();
  if (!id || id.trim() === '') {
    console.error('deleteStudent called with empty ID');
    throw new Error('Student ID is required for deletion');
  }
  
  const res = await fetch(`/api/admin/users/${id}`, { method: 'DELETE' });
  if (!res.ok) {
    const payload = await res.json().catch(() => ({}));
    throw new Error(payload.error || `Unable to delete student account (${res.status})`);
  }
}

export async function resetAllStudentSessions(sessionRemaining = 30) {
  ensureConfigured();
  const supabase = getSupabaseBrowserClient();
  const { error } = await supabase
    .from("profiles")
    .update({
      session_remaining: sessionRemaining,
      updated_at: new Date().toISOString(),
    })
    .eq("role", "student");
  handleError(error, "Unable to reset sessions.");
}

export async function searchStudents(query: string) {
  ensureConfigured();
  const q = query.trim().toLowerCase();
  if (!q) return [] as ProfileRecord[];
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("role", "student")
    .neq("email", "admin@example.com")
    .neq("username", "admin")
    .neq("idno", "ADMIN")
    .or(
      `idno.ilike.%${q}%,firstname.ilike.%${q}%,lastname.ilike.%${q}%,middlename.ilike.%${q}%,email.ilike.%${q}%`,
    )
    .order("lastname", { ascending: true });
  handleError(error, "Unable to search students.");
  return (data ?? []) as ProfileRecord[];
}

export async function listReservations() {
  ensureConfigured();
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("reservations")
    .select("*")
    .order("created_at", { ascending: false });
  handleError(error, "Unable to fetch reservations.");
  return (data ?? []) as ReservationRecord[];
}

export async function updateReservationStatus(id: number, status: ReservationRecord["status"]) {
  ensureConfigured();
  const supabase = getSupabaseBrowserClient();
  const { data: existingReservation, error: existingReservationError } = await supabase
    .from("reservations")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  handleError(existingReservationError, "Unable to read reservation.");
  if (!existingReservation) {
    throw new Error("Reservation not found.");
  }

  const { data, error } = await supabase
    .from("reservations")
    .update({
      status,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select("*")
    .single();
  handleError(error, "Unable to update reservation status.");
  const reservation = data as ReservationRecord;

  const nextPcStatus =
    status === "approved"
      ? "reserved"
      : status === "sit-inned"
        ? "occupied"
        : (status === "declined" || status === "completed") &&
            (existingReservation.status === "approved" || existingReservation.status === "sit-inned")
          ? "available"
          : null;

  if (nextPcStatus) {
    const { error: computerUpdateError } = await supabase
      .from("lab_computers")
      .upsert(
        {
          lab_number: reservation.lab_number,
          pc_number: reservation.pc_number,
          status: nextPcStatus,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "lab_number,pc_number" },
      );
    handleError(computerUpdateError, "Unable to sync lab computer status.");
  }

  const reservationOwnerId = reservation.user_id ?? (await findProfileByIdno(reservation.idno))?.id ?? null;
  if (reservationOwnerId) {
    await createNotification({
      user_id: reservationOwnerId,
      message: `Your reservation for Lab ${reservation.lab_number} is now ${status}.`,
    });
  }
  return reservation;
}

export async function listSitInRecords(status?: SitInRecord["status"]) {
  ensureConfigured();
  const supabase = getSupabaseBrowserClient();
  let query = supabase.from("sit_in_records").select("*").order("created_at", { ascending: false });
  if (status) {
    query = query.eq("status", status);
  }
  const { data, error } = await query;
  handleError(error, "Unable to fetch sit-in records.");
  return (data ?? []) as SitInRecord[];
}

export async function createSitInRecord(input: {
  idno: string;
  full_name: string;
  purpose: string;
  lab_number: LabNumber;
  time_in: string;
  date: string;
  session_remaining: number;
}) {
  ensureConfigured();
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("sit_in_records")
    .insert({
      ...input,
      status: "Sit-in",
      rewarded: false,
    })
    .select("*")
    .single();
  handleError(error, "Unable to create sit-in record.");

  const profile = await findProfileByIdno(input.idno);
  if (profile) {
    const updatedSessionRemaining = Math.max(0, input.session_remaining - 1);
    await updateProfile(profile.id, {
      session_remaining: updatedSessionRemaining,
    } as Partial<ProfileRecord>);
    await createNotification({
      user_id: profile.id,
      message: `Sit-in started in Lab ${input.lab_number}. Sessions left: ${updatedSessionRemaining}.`,
    });
  }

  return data as SitInRecord;
}

export async function timeoutSitInRecord(id: number) {
  ensureConfigured();
  const supabase = getSupabaseBrowserClient();
  const now = new Date();
  const timeOut = now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
  const { data, error } = await supabase
    .from("sit_in_records")
    .update({
      status: "Completed",
      time_out: timeOut,
      updated_at: now.toISOString(),
    })
    .eq("id", id)
    .select("*")
    .single();
  handleError(error, "Unable to time out sit-in record.");
  const record = data as SitInRecord;
  const profile = await findProfileByIdno(record.idno);
  if (profile) {
    await createNotification({
      user_id: profile.id,
      message: `You have been timed out from your sit-in session in Lab ${record.lab_number}.`,
    });
  }
  return record;
}

export async function rewardSitInRecord(input: { sitInId: number; points: number; taskCompleted: boolean }) {
  ensureConfigured();
  const supabase = getSupabaseBrowserClient();
  const { data: record, error: recordError } = await supabase
    .from("sit_in_records")
    .select("*")
    .eq("id", input.sitInId)
    .maybeSingle();
  handleError(recordError, "Unable to read sit-in record.");

  if (!record) {
    throw new Error("Sit-in record not found.");
  }
  if (record.rewarded) {
    throw new Error("This record has already been finalized.");
  }

  const { data: updatedRecord, error } = await supabase
    .from("sit_in_records")
    .update({ rewarded: true, updated_at: new Date().toISOString() })
    .eq("id", input.sitInId)
    .eq("rewarded", false)
    .select("id")
    .maybeSingle();
  handleError(error, "Unable to reward sit-in record.");
  if (!updatedRecord) {
    throw new Error("This record has already been finalized.");
  }

  const profile = await findProfileByIdno(record.idno);
  if (profile) {
    const earnedMinutes = calculateDurationMinutes(record.time_in, record.time_out);
    const updatedPoints = profile.points + input.points;
    const sessionBonus = Math.max(0, Math.floor(updatedPoints / 3) - Math.floor(profile.points / 3));
    const updatedSessions = profile.session_remaining + sessionBonus;
    await updateProfile(profile.id, {
      points: updatedPoints,
      session_remaining: updatedSessions,
      hours_spent: profile.hours_spent + earnedMinutes,
      tasks_completed: profile.tasks_completed + (input.taskCompleted ? 1 : 0),
    } as Partial<ProfileRecord>);
    await createNotification({
      user_id: profile.id,
      message:
        sessionBonus > 0
          ? `You earned ${input.points} point${input.points === 1 ? "" : "s"} and unlocked +${sessionBonus} session (${updatedSessions} sessions left).`
          : `You earned ${input.points} point${input.points === 1 ? "" : "s"} from rewards.`,
    });
  }
}

export async function listFeedback() {
  ensureConfigured();
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("feedback")
    .select("*")
    .order("created_at", { ascending: false });
  handleError(error, "Unable to fetch feedback records.");
  return (data ?? []) as FeedbackRecord[];
}

export async function getStudentDashboardData(profile: ProfileRecord) {
  const [announcements, sitIns] = await Promise.all([
    listAnnouncements(),
    listSitInRecords(),
  ]);

  const userSitIns = sitIns.filter((record) => record.idno === profile.idno);
  const usage = Array.from({ length: 7 }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - index));
    const iso = date.toISOString().slice(0, 10);
    return {
      day: date.toLocaleDateString("en-US", { weekday: "short" }),
      value: userSitIns.filter((record) => record.date === iso).length,
    };
  });

  return {
    announcements: announcements.slice(0, 4),
    usage,
    profile,
  };
}

export async function getAdminDashboardData() {
  const [students, sitIns, reservations] = await Promise.all([
    listStudents(),
    listSitInRecords(),
    listReservations(),
  ]);

  const totalStudents = students.length;
  const currentSitIn = sitIns.filter((record) => record.status === "Sit-in").length;
  const approvedReservations = reservations.filter((record) => record.status === "approved").length;
  const totalSitIn = sitIns.filter((record) => record.status === "Completed").length;

  const purposeTotals = new Map<string, number>();
  const labTotals = new Map<LabNumber, number>();
  for (const lab of labOptions) {
    labTotals.set(lab, 0);
  }
  for (const record of sitIns) {
    purposeTotals.set(record.purpose, (purposeTotals.get(record.purpose) ?? 0) + 1);
    labTotals.set(record.lab_number, (labTotals.get(record.lab_number) ?? 0) + 1);
  }

  const daily = Array.from({ length: 7 }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - index));
    const iso = date.toISOString().slice(0, 10);
    return {
      label: date.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      value: sitIns.filter((record) => record.date === iso).length,
    };
  });

  return {
    totalStudents,
    currentSitIn,
    approvedReservations,
    totalSitIn,
    purposeTotals,
    labTotals,
    daily,
  };
}

export async function findProfileByIdno(idno: string) {
  ensureConfigured();
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("idno", idno)
    .maybeSingle();
  handleError(error, "Unable to fetch profile by ID number.");
  return (data as ProfileRecord | null) ?? null;
}
