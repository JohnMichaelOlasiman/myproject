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
      className={`mx-2 flex items-center rounded-lg px-4 py-3 text-white transition hover:bg-blue-700 ${
        active ? "bg-blue-700" : ""
      }`}
    >
      <i className={`fas ${icon} w-5 text-center`} />
      <span className="sidebar-text ml-3 hidden whitespace-nowrap text-sm group-hover:inline">
        {label}
      </span>
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
    <div className="group/menu">
      <button
        type="button"
        className={`mx-2 flex w-[calc(100%-1rem)] items-center rounded-lg px-4 py-3 text-white transition hover:bg-blue-700 ${
          active ? "bg-blue-700" : ""
        }`}
      >
        <i className={`fas ${icon} w-5 text-center`} />
        <span className="sidebar-text ml-3 hidden whitespace-nowrap text-sm group-hover:inline">
          {label}
        </span>
        <i className="fas fa-chevron-down sidebar-text ml-auto hidden text-xs group-hover:inline" />
      </button>
      <div className="hidden pl-2 group-hover/menu:block">{children}</div>
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
    <div className="min-h-screen bg-gray-100">
      <aside className="peer group fixed inset-y-0 left-0 z-20 w-20 overflow-y-auto bg-[#002044] py-8 text-white transition-all duration-300 hover:w-64">
        <div className="flex flex-col items-center">
          <Image
            alt="CCS Sit-In Monitoring System Logo"
            className="mb-4"
            src="/inc/CCS_LOGO.png"
            width={70}
            height={70}
            priority
          />
          <h1 className="sidebar-text hidden px-2 text-center text-sm group-hover:block">
            CCS Sit-In Monitoring System
          </h1>
        </div>

        <nav className="mt-10 w-full space-y-1">
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
              className={`mx-2 flex items-center rounded-lg px-4 py-2 text-sm text-white hover:bg-blue-600 ${
                isActive(pathname, "/admin/current-sit") ? "bg-blue-600" : ""
              }`}
            >
              <i className="fas fa-eye mr-3 w-4 text-center" />
              <span className="sidebar-text hidden group-hover:inline">Current Sit-In</span>
            </Link>
            <Link
              href="/admin/day-sit"
              className={`mx-2 flex items-center rounded-lg px-4 py-2 text-sm text-white hover:bg-blue-600 ${
                isActive(pathname, "/admin/day-sit") ? "bg-blue-600" : ""
              }`}
            >
              <i className="fas fa-archive mr-3 w-4 text-center" />
              <span className="sidebar-text hidden group-hover:inline">Records</span>
            </Link>
            <Link
              href="/admin/rewards"
              className={`mx-2 flex items-center rounded-lg px-4 py-2 text-sm text-white hover:bg-blue-600 ${
                isActive(pathname, "/admin/rewards") ? "bg-blue-600" : ""
              }`}
            >
              <i className="fas fa-gift mr-3 w-4 text-center" />
              <span className="sidebar-text hidden group-hover:inline">Rewards</span>
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
              className={`mx-2 flex items-center rounded-lg px-4 py-2 text-sm text-white hover:bg-blue-600 ${
                isActive(pathname, "/admin/announcements") ? "bg-blue-600" : ""
              }`}
            >
              <i className="fas fa-bullhorn mr-3 w-4 text-center" />
              <span className="sidebar-text hidden group-hover:inline">Announcements</span>
            </Link>
            <Link
              href="/admin/feedback"
              className={`mx-2 flex items-center rounded-lg px-4 py-2 text-sm text-white hover:bg-blue-600 ${
                isActive(pathname, "/admin/feedback") ? "bg-blue-600" : ""
              }`}
            >
              <i className="fas fa-comment-dots mr-3 w-4 text-center" />
              <span className="sidebar-text hidden group-hover:inline">Feedback</span>
            </Link>
            <Link
              href="/admin/lab-schedule"
              className={`mx-2 flex items-center rounded-lg px-4 py-2 text-sm text-white hover:bg-blue-600 ${
                isActive(pathname, "/admin/lab-schedule") ? "bg-blue-600" : ""
              }`}
            >
              <i className="fas fa-desktop mr-3 w-4 text-center" />
              <span className="sidebar-text hidden group-hover:inline">Computer & Lab</span>
            </Link>
          </GroupItem>
        </nav>
      </aside>

      <div className="ml-20 flex min-h-screen flex-col transition-[margin] duration-300 peer-hover:ml-64">
        <header className="sticky top-0 z-10 flex items-center justify-between bg-white px-6 py-6">
          <h2 className="text-2xl font-semibold">{title}</h2>

          <div className="flex items-center space-x-4">
            <form onSubmit={onSearch} className="relative hidden w-80 sm:flex">
              <input
                type="text"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search by Name or ID"
                className="h-10 w-full rounded-full border border-gray-300 py-2 pl-5 pr-12 focus:outline-none focus:ring-2 focus:ring-violet-500"
              />
              <button type="submit" className="absolute right-4 top-1/2 -translate-y-1/2">
                <i className="fas fa-search text-gray-400" />
              </button>
            </form>

            <div className="relative" ref={notificationRef}>
              <button
                type="button"
                onClick={() => {
                  setNotificationOpen((current) => !current);
                  setProfileOpen(false);
                }}
                className="relative"
              >
                <i className="fas fa-bell text-xl" />
                {unread > 0 ? (
                  <span className="absolute -right-2 -top-2 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] text-white">
                    {unread > 99 ? "99+" : unread}
                  </span>
                ) : null}
              </button>

              {notificationOpen ? (
                <div className="absolute right-0 mt-2 w-80 overflow-hidden rounded-lg bg-white shadow-lg">
                  <div className="flex items-center justify-between border-b p-4">
                    <h3 className="font-semibold">Notifications</h3>
                    {unread > 0 ? (
                      <button
                        type="button"
                        onClick={markAllRead}
                        className="text-xs text-blue-500 hover:text-blue-700"
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
                          className={`border-b p-4 ${notification.read ? "" : "bg-blue-50"}`}
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
                                className="text-xs text-blue-500 hover:text-blue-700"
                              >
                                <i className="fas fa-check" />
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

            <div className="relative" ref={profileRef}>
              <button
                type="button"
                onClick={() => {
                  setProfileOpen((current) => !current);
                  setNotificationOpen(false);
                }}
                className="flex items-center"
              >
                <div className="mr-2 flex h-12 w-12 items-center justify-center rounded-full border-2 border-gray-300 text-lg font-semibold text-black">
                  {profile.initials}
                </div>
                <div className="text-left">
                  <p className="text-sm font-semibold">{profile.name}</p>
                  <p className="text-xs text-gray-500">{profile.role}</p>
                </div>
              </button>

              {profileOpen ? (
                <div className="absolute right-0 mt-2 w-48 rounded-lg bg-white shadow-lg">
                  <Link
                    href="/admin/profile"
                    className="flex items-center px-4 py-2 text-gray-700 hover:bg-gray-200"
                    onClick={() => setProfileOpen(false)}
                  >
                    <i className="fas fa-user mr-3" />
                    Profile
                  </Link>
                  <button
                    type="button"
                    className="flex w-full items-center px-4 py-2 text-left text-gray-700 hover:bg-gray-200"
                    onClick={() => {
                      setProfileOpen(false);
                      void onLogout();
                    }}
                  >
                    <i className="fas fa-sign-out-alt mr-3" />
                    Logout
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-auto p-6">{children}</main>
      </div>
    </div>
  );
}
