"use client";

import Image from "next/image";
import Link from "next/link";
import { FormEvent, ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  getAdminProfileFallback,
  getCurrentProfile,
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

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

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
      className="ccs-admin-nav-item"
      data-active={active ? "true" : undefined}
    >
      <i className={`fas ${icon}`} aria-hidden />
      <span>{label}</span>
    </Link>
  );
}

function GroupItem({
  label,
  icon,
  active,
  children,
}: {
  label: string;
  icon: string;
  active: boolean;
  children: ReactNode;
}) {
  return (
    <div className="ccs-admin-nav-group">
      <button
        type="button"
        className="ccs-admin-nav-item ccs-admin-nav-button"
        data-active={active ? "true" : undefined}
      >
        <i className={`fas ${icon}`} aria-hidden />
        <span>{label}</span>
        <i className="fas fa-chevron-down ccs-admin-nav-chevron" aria-hidden />
      </button>
      <div className="ccs-admin-nav-children">{children}</div>
    </div>
  );
}

export function AdminShell({
  title,
  children,
  initialSearch = "",
}: {
  title: string;
  children: ReactNode;
  initialSearch?: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [query, setQuery] = useState(initialSearch);
  const [profile, setProfile] = useState({
    id: "",
    name: "System Admin",
    role: "Admin",
    initials: "AD",
  });
  const [notifications, setNotifications] = useState<Notification[]>(
    [],
  );
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);
  const notificationRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      if (!isSupabaseConfigured) {
        setNotifications([]);
        return;
      }

      try {
        const current = await getCurrentProfile();
        const adminProfile = current?.role === "admin" ? current : await getAdminProfileFallback();
        if (!active || !adminProfile) {
          return;
        }

        const initials = `${adminProfile.firstname.slice(0, 1)}${adminProfile.lastname.slice(0, 1)}`.toUpperCase();
        setProfile({
          id: adminProfile.id,
          name: `${adminProfile.firstname} ${adminProfile.lastname}`.trim() || "System Admin",
          role: "Admin",
          initials: initials || "AD",
        });

        const rows = await listNotifications(adminProfile.id, "admin");
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
      } catch (error) {
        if (active) {
          console.error(error);
        }
      }
    };

    void load();
    const intervalId = window.setInterval(() => {
      void load();
    }, 15000);

    const onOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (profileRef.current && !profileRef.current.contains(target)) {
        setProfileOpen(false);
      }
      if (notificationRef.current && !notificationRef.current.contains(target)) {
        setNotificationOpen(false);
      }
    };
    document.addEventListener("mousedown", onOutside);
    return () => {
      active = false;
      window.clearInterval(intervalId);
      document.removeEventListener("mousedown", onOutside);
    };
  }, []);

  const unread = useMemo(
    () => notifications.filter((notification) => !notification.read).length,
    [notifications],
  );

  const markRead = (id: number) => {
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
      void dbMarkAllNotificationsRead(profile.id || null, "admin");
    }
  };

  const onSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    router.push(`/admin/search-results?query=${encodeURIComponent(query.trim())}`);
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
    <div className="ccs-admin-root">
      <aside className="ccs-admin-sidebar">
        <div className="ccs-admin-brand">
          <Image
            alt="CCS Sit-In Monitoring System Logo"
            src="/inc/CCS_LOGO.png"
            width={70}
            height={70}
            priority
          />
          <div>
            <p>CCS Sit-In</p>
            <h1>Monitoring System</h1>
          </div>
        </div>

        <nav className="ccs-admin-nav" aria-label="Admin navigation">
          <NavItem
            href="/admin/dashboard"
            label="Dashboard"
            icon="fa-tachometer-alt"
            active={isActive(pathname, "/admin/dashboard") || pathname === "/admin"}
          />
          <NavItem
            href="/admin/students"
            label="Students"
            icon="fa-user-graduate"
            active={isActive(pathname, "/admin/students")}
          />
          <NavItem
            href="/admin/reservations"
            label="Reservations"
            icon="fa-calendar-check"
            active={isActive(pathname, "/admin/reservations")}
          />

          <GroupItem
            label="Sit-In"
            icon="fa-chair"
            active={
              isActive(pathname, "/admin/current-sit") ||
              isActive(pathname, "/admin/day-sit") ||
              isActive(pathname, "/admin/rewards")
            }
          >
            <Link
              href="/admin/current-sit"
              className="ccs-admin-subnav-item"
              data-active={isActive(pathname, "/admin/current-sit") ? "true" : undefined}
            >
              <i className="fas fa-eye" aria-hidden />
              <span>Current Sit-In</span>
            </Link>
            <Link
              href="/admin/day-sit"
              className="ccs-admin-subnav-item"
              data-active={isActive(pathname, "/admin/day-sit") ? "true" : undefined}
            >
              <i className="fas fa-archive" aria-hidden />
              <span>Records</span>
            </Link>
            <Link
              href="/admin/rewards"
              className="ccs-admin-subnav-item"
              data-active={isActive(pathname, "/admin/rewards") ? "true" : undefined}
            >
              <i className="fas fa-gift" aria-hidden />
              <span>Rewards</span>
            </Link>
          </GroupItem>

          <NavItem
            href="/admin/analytics"
            label="Analytics"
            icon="fa-chart-pie"
            active={isActive(pathname, "/admin/analytics")}
          />
          <NavItem
            href="/admin/reports"
            label="Generate Reports"
            icon="fa-file-export"
            active={isActive(pathname, "/admin/reports") || isActive(pathname, "/admin/generate")}
          />
          <NavItem
            href="/admin/leaderboard"
            label="Leaderboard"
            icon="fa-trophy"
            active={isActive(pathname, "/admin/leaderboard")}
          />

          <GroupItem
            label="Communication"
            icon="fa-comments"
            active={
              isActive(pathname, "/admin/announcements") ||
              isActive(pathname, "/admin/feedback") ||
              isActive(pathname, "/admin/lab-schedule")
            }
          >
            <Link
              href="/admin/announcements"
              className="ccs-admin-subnav-item"
              data-active={isActive(pathname, "/admin/announcements") ? "true" : undefined}
            >
              <i className="fas fa-bullhorn" aria-hidden />
              <span>Announcements</span>
            </Link>
            <Link
              href="/admin/feedback"
              className="ccs-admin-subnav-item"
              data-active={isActive(pathname, "/admin/feedback") ? "true" : undefined}
            >
              <i className="fas fa-comment-dots" aria-hidden />
              <span>Feedback</span>
            </Link>
            <Link
              href="/admin/lab-schedule"
              className="ccs-admin-subnav-item"
              data-active={isActive(pathname, "/admin/lab-schedule") ? "true" : undefined}
            >
              <i className="fas fa-desktop" aria-hidden />
              <span>Computer & Lab</span>
            </Link>
          </GroupItem>
        </nav>
      </aside>

      <div className="ccs-admin-content">
        <header className="ccs-admin-header">
          <div>
            <p className="ccs-admin-eyebrow">Admin Console</p>
            <h2>{title}</h2>
          </div>

          <div className="ccs-admin-actions">
            <form onSubmit={onSearch} className="ccs-admin-search">
              <input
                type="text"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search by Name or ID"
              />
              <button type="submit" aria-label="Search admin records">
                <i className="fas fa-search" aria-hidden />
              </button>
            </form>

            <div className="ccs-admin-popover-wrap" ref={notificationRef}>
              <button
                type="button"
                onClick={() => {
                  setNotificationOpen((current) => !current);
                  setProfileOpen(false);
                }}
                className="ccs-admin-icon-button"
                aria-label="Open notifications"
              >
                <i className="fas fa-bell" aria-hidden />
                {unread > 0 ? (
                  <span className="ccs-admin-badge">
                    {unread > 99 ? "99+" : unread}
                  </span>
                ) : null}
              </button>

              {notificationOpen ? (
                <div className="ccs-admin-dropdown ccs-admin-notifications">
                  <div className="ccs-admin-dropdown-header">
                    <h3 className="font-semibold">Notifications</h3>
                    {unread > 0 ? (
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
                          className="ccs-admin-notification"
                          data-unread={!notification.read ? "true" : undefined}
                        >
                          <div className="flex justify-between gap-2">
                            <p
                              className={`text-sm ${
                                notification.read ? "text-gray-600" : "font-medium text-gray-900"
                              }`}
                            >
                              {notification.message}
                            </p>
                            {!notification.read ? (
                              <button
                                type="button"
                                onClick={() => markRead(notification.id)}
                                className="ccs-admin-check-button"
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

            <div className="ccs-admin-popover-wrap" ref={profileRef}>
              <button
                type="button"
                onClick={() => {
                  setProfileOpen((current) => !current);
                  setNotificationOpen(false);
                }}
                className="ccs-admin-profile-button"
              >
                <div className="ccs-admin-avatar">
                  {profile.initials}
                </div>
                <div>
                  <p className="text-sm font-semibold">{profile.name}</p>
                  <p className="text-xs text-gray-500">{profile.role}</p>
                </div>
              </button>

              {profileOpen ? (
                <div className="ccs-admin-dropdown ccs-admin-profile-menu">
                  <Link
                    href="/admin/profile"
                    className="ccs-admin-menu-item"
                    onClick={() => setProfileOpen(false)}
                  >
                    <i className="fas fa-user" aria-hidden />
                    Profile
                  </Link>
                  <button
                    type="button"
                    className="ccs-admin-menu-item"
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

        <main className="ccs-admin-main">{children}</main>
      </div>
    </div>
  );
}
