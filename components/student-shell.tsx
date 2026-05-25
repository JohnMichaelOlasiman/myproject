"use client";

import Image from "next/image";
import Link from "next/link";
import { ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  getCurrentProfileWithRetry,
  listNotifications,
  markAllNotificationsRead as dbMarkAllNotificationsRead,
  markNotificationRead as dbMarkNotificationRead,
  signOut,
} from "@/lib/supabase/data";
import { isSupabaseConfigured } from "@/lib/supabase/client";

type Notification = {
  id: number;
  message: string;
  createdAt: string;
  read: boolean;
};

const fallbackNotifications: Notification[] = [];

function NavItem({
  href,
  label,
  icon,
  active,
}: {
  href: string;
  label: string;
  icon: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className="ccs-student-nav-item"
      data-active={active ? "true" : undefined}
    >
      <i className={`fas ${icon}`} aria-hidden />
      <span>{label}</span>
    </Link>
  );
}

function GroupItem({
  id,
  label,
  icon,
  active,
  open,
  onToggle,
  children,
}: {
  id: string;
  label: string;
  icon: string;
  active: boolean;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <div className="ccs-student-nav-group" data-open={open ? "true" : "false"}>
      <button
        type="button"
        className="ccs-student-nav-item ccs-student-nav-button"
        data-active={active ? "true" : undefined}
        aria-expanded={open}
        aria-controls={`${id}-children`}
        onClick={onToggle}
      >
        <i className={`fas ${icon}`} aria-hidden />
        <span>{label}</span>
        <i className="fas fa-chevron-down ccs-student-nav-chevron" aria-hidden />
      </button>
      {open ? (
        <div id={`${id}-children`} className="ccs-student-nav-children">
          {children}
        </div>
      ) : null}
    </div>
  );
}

export function StudentShell({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const activePath = pathname === "/" ? "/dashboard" : pathname;
  const rulesActive = activePath === "/sitin" || activePath === "/laboratory";
  const [profile, setProfile] = useState<{
    id: string;
    name: string;
    role: string;
    initials: string;
  } | null>(null);
  const [notifications, setNotifications] = useState(fallbackNotifications);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [rulesExpanded, setRulesExpanded] = useState(false);
  const [rulesCollapsedWhileActive, setRulesCollapsedWhileActive] = useState(false);
  const notificationRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);
  const rulesOpen = rulesActive ? !rulesCollapsedWhileActive : rulesExpanded;

  const unreadCount = useMemo(
    () => notifications.filter((notification) => !notification.read).length,
    [notifications],
  );

  useEffect(() => {
    let active = true;
    const load = async () => {
      if (!isSupabaseConfigured) {
        return;
      }
      try {
        const currentProfile = await getCurrentProfileWithRetry();
        if (!active) return;

        if (currentProfile) {
          const name = `${currentProfile.firstname} ${currentProfile.lastname}`.trim();
          const initials = `${currentProfile.firstname.slice(0, 1)}${currentProfile.lastname.slice(0, 1)}`.toUpperCase();
          setProfile({
            id: currentProfile.id,
            name: name || "Student User",
            role: currentProfile.role === "admin" ? "Admin" : "Student",
            initials: initials || "SU",
          });
          const rows = await listNotifications(currentProfile.id, "student");
          if (active) {
            setNotifications(
              rows.map((row) => ({
                id: row.id,
                message: row.message,
                createdAt: new Date(row.created_at).toLocaleString("en-US"),
                read: row.read,
              })),
            );
          }
        } else {
          setProfile(null);
          setNotifications(fallbackNotifications);
        }
      } catch {
        if (active) {
          setProfile(null);
          setNotifications(fallbackNotifications);
        }
      }
    };

    void load();
    const intervalId = window.setInterval(() => {
      void load();
    }, 15000);

    const handleOutsideClick = (event: MouseEvent) => {
      const target = event.target as Node;

      if (notificationRef.current && !notificationRef.current.contains(target)) {
        setNotificationsOpen(false);
      }

      if (profileRef.current && !profileRef.current.contains(target)) {
        setProfileOpen(false);
      }
    };

    document.addEventListener("mousedown", handleOutsideClick);
    return () => {
      active = false;
      window.clearInterval(intervalId);
      document.removeEventListener("mousedown", handleOutsideClick);
    };
  }, []);

  const markNotificationRead = (id: number) => {
    setNotifications((current) =>
      current.map((notification) =>
        notification.id === id ? { ...notification, read: true } : notification,
      ),
    );
    if (isSupabaseConfigured) {
      void dbMarkNotificationRead(id);
    }
  };

  const markAllRead = () => {
    setNotifications((current) => current.map((notification) => ({ ...notification, read: true })));
    if (isSupabaseConfigured) {
      void dbMarkAllNotificationsRead(profile?.id ?? null, "student");
    }
  };

  const toggleRulesGroup = () => {
    if (rulesActive) {
      setRulesCollapsedWhileActive((current) => !current);
      return;
    }

    setRulesExpanded((current) => !current);
  };

  const onLogout = async () => {
    if (isSupabaseConfigured) {
      try {
        await signOut();
      } catch (error) {
        console.error(error);
      }
    }
    router.push("/login");
  };

  return (
    <div className="ccs-student-root">
      <aside className="ccs-student-sidebar">
        <div className="ccs-student-brand">
          <Image
            alt="CCS Sit-In Monitoring System Logo"
            src="/inc/CCS_LOGO.png"
            width={72}
            height={72}
            priority
          />
          <div>
            <p>Student Portal</p>
            <h1>CCS Sit-In Monitoring System</h1>
          </div>
        </div>

        <nav className="ccs-student-nav" aria-label="Student navigation">
          <NavItem href="/dashboard" label="Home" icon="fa-home" active={activePath === "/dashboard"} />
          <NavItem
            href="/announcement"
            label="Announcements"
            icon="fa-bullhorn"
            active={activePath === "/announcement"}
          />

          <GroupItem
            id="student-rules"
            label="Rules & Regulations"
            icon="fa-clipboard-list"
            active={rulesActive}
            open={rulesOpen}
            onToggle={toggleRulesGroup}
          >
            <Link
              href="/sitin"
              className="ccs-student-subnav-item"
              data-active={activePath === "/sitin" ? "true" : undefined}
            >
              <i className="fas fa-chair" aria-hidden />
              <span>Sit-In</span>
            </Link>
            <Link
              href="/laboratory"
              className="ccs-student-subnav-item"
              data-active={activePath === "/laboratory" ? "true" : undefined}
            >
              <i className="fas fa-flask" aria-hidden />
              <span>Laboratory</span>
            </Link>
          </GroupItem>

          <NavItem href="/history" label="History" icon="fa-history" active={activePath === "/history"} />
          <NavItem
            href="/lab"
            label="Lab Schedule"
            icon="fa-calendar-check"
            active={activePath === "/lab"}
          />
          <NavItem
            href="/reservation"
            label="Reservations"
            icon="fa-calendar-alt"
            active={activePath === "/reservation"}
          />
          <NavItem
            href="/leader"
            label="Leaderboard"
            icon="fa-trophy"
            active={activePath === "/leader"}
          />
          <NavItem
            href="/resources"
            label="Resources"
            icon="fa-boxes"
            active={activePath === "/resources"}
          />
        </nav>
      </aside>

      <div className="ccs-student-content">
        <header className="ccs-student-header">
          <div>
            <p className="ccs-student-eyebrow">Student Workspace</p>
            <h2>{title}</h2>
          </div>

          <div className="ccs-student-actions">
            <div className="ccs-student-popover-wrap" ref={notificationRef}>
              <button
                type="button"
                onClick={() => {
                  setNotificationsOpen((current) => !current);
                  setProfileOpen(false);
                }}
                className="ccs-student-icon-button"
                aria-label="Open notifications"
              >
                <i className="fas fa-bell" aria-hidden />
                {unreadCount > 0 ? (
                  <span className="ccs-student-badge">
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </span>
                ) : null}
              </button>

              {notificationsOpen ? (
                <div className="ccs-student-dropdown ccs-student-notifications">
                  <div className="ccs-student-dropdown-header">
                    <h3 className="font-semibold">Notifications</h3>
                    {unreadCount > 0 ? (
                      <button
                        type="button"
                        onClick={markAllRead}
                      >
                        Mark All as Read
                      </button>
                    ) : null}
                  </div>
                  <div className="max-h-80 overflow-y-auto">
                    {notifications.length > 0 ? (
                      notifications.map((notification) => (
                        <div
                          key={notification.id}
                          className="ccs-student-notification"
                          data-unread={!notification.read ? "true" : undefined}
                        >
                          <div className="flex justify-between gap-3">
                            <p className={`text-sm ${notification.read ? "text-gray-600" : "font-medium text-gray-900"}`}>
                              {notification.message}
                            </p>
                            {!notification.read ? (
                              <button
                                type="button"
                                onClick={() => markNotificationRead(notification.id)}
                                className="ccs-student-check-button"
                                aria-label="Mark notification as read"
                              >
                                <i className="fas fa-check" aria-hidden />
                              </button>
                            ) : null}
                          </div>
                          <p className="mt-1 text-xs text-gray-500">{notification.createdAt}</p>
                        </div>
                      ))
                    ) : (
                      <div className="p-4 text-center text-gray-500">No notifications</div>
                    )}
                  </div>
                </div>
              ) : null}
            </div>

            <div className="ccs-student-popover-wrap" ref={profileRef}>
              <button
                type="button"
                onClick={() => {
                  setProfileOpen((current) => !current);
                  setNotificationsOpen(false);
                }}
                className="ccs-student-profile-button"
              >
                <div className="ccs-student-avatar">
                  {profile?.initials ?? "?"}
                </div>
                <div>
                  <p className="text-sm font-semibold">{profile?.name ?? "Loading profile..."}</p>
                  <p className="text-xs text-gray-500">{profile?.role ?? "Student"}</p>
                </div>
              </button>

              {profileOpen ? (
                <div className="ccs-student-dropdown ccs-student-profile-menu">
                  <Link
                    href="/profile"
                    className="ccs-student-menu-item"
                    onClick={() => setProfileOpen(false)}
                  >
                    <i className="fas fa-user" aria-hidden />
                    Profile
                  </Link>
                  <button
                    type="button"
                    className="ccs-student-menu-item"
                    onClick={() => {
                      setProfileOpen(false);
                      void onLogout();
                    }}
                  >
                    <i className="fas fa-sign-out-alt" aria-hidden />
                    Logout
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </header>

        <main className="ccs-student-main">{children}</main>
      </div>
    </div>
  );
}
