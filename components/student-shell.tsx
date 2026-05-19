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
      className={`flex items-center rounded-lg px-4 py-3 text-white transition hover:bg-blue-700 ${
        active ? "bg-blue-700" : ""
      }`}
    >
      <i className={`fas ${icon} w-6 text-center text-lg`} />
      <span className="sidebar-text ml-3 hidden whitespace-nowrap text-sm group-hover:inline">
        {label}
      </span>
    </Link>
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
  const [profile, setProfile] = useState<{
    id: string;
    name: string;
    role: string;
    initials: string;
  } | null>(null);
  const [notifications, setNotifications] = useState(fallbackNotifications);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const notificationRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);

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
        <div className="flex flex-col items-center px-2">
          <Image
            alt="CCS Sit-In Monitoring System Logo"
            src="/inc/CCS_LOGO.png"
            width={72}
            height={72}
            className="mb-4"
            priority
          />
          <h1 className="mb-2 hidden text-center text-sm font-medium group-hover:block">
            CCS Sit-In Monitoring System
          </h1>

          <nav className="mt-10 w-full px-2">
            <NavItem href="/dashboard" label="Home" icon="fa-home" active={activePath === "/dashboard"} />
            <NavItem
              href="/announcement"
              label="Announcements"
              icon="fa-bullhorn"
              active={activePath === "/announcement"}
            />

            <div className="group/rules relative">
              <button
                type="button"
                className={`flex w-full items-center rounded-lg px-4 py-3 text-white transition hover:bg-blue-700 ${
                  activePath === "/sitin" || activePath === "/laboratory" ? "bg-blue-700" : ""
                }`}
              >
                <i className="fas fa-clipboard-list w-6 text-center text-lg" />
                <span className="sidebar-text ml-3 hidden whitespace-nowrap text-sm group-hover:inline">
                  Rules & Regulations
                </span>
                <i className="fas fa-chevron-down ml-auto hidden text-xs group-hover:inline" />
              </button>
              <div className="hidden pl-6 group-hover/rules:block">
                <Link
                  href="/sitin"
                  className={`flex items-center rounded-lg px-4 py-2 text-sm text-white transition hover:bg-blue-600 ${
                    activePath === "/sitin" ? "bg-blue-600" : ""
                  }`}
                >
                  <i className="fas fa-chair mr-3 w-4 text-center" />
                  <span className="sidebar-text hidden group-hover:inline">Sit-In</span>
                </Link>
                <Link
                  href="/laboratory"
                  className={`flex items-center rounded-lg px-4 py-2 text-sm text-white transition hover:bg-blue-600 ${
                    activePath === "/laboratory" ? "bg-blue-600" : ""
                  }`}
                >
                  <i className="fas fa-flask mr-3 w-4 text-center" />
                  <span className="sidebar-text hidden group-hover:inline">Laboratory</span>
                </Link>
              </div>
            </div>

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
        </div>
      </aside>

      <div className="ml-20 flex min-h-screen flex-col transition-[margin] duration-300 peer-hover:ml-64">
        <header className="sticky top-0 z-10 flex items-center justify-between border-b bg-white px-6 py-4">
          <h2 className="text-2xl font-semibold">{title}</h2>

          <div className="flex items-center gap-6">
            <div className="relative" ref={notificationRef}>
              <button
                type="button"
                onClick={() => {
                  setNotificationsOpen((current) => !current);
                  setProfileOpen(false);
                }}
                className="relative"
              >
                <i className="fas fa-bell text-xl" />
                {unreadCount > 0 ? (
                  <span className="absolute -right-2 -top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] text-white">
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </span>
                ) : null}
              </button>

              {notificationsOpen ? (
                <div className="absolute right-0 mt-3 w-80 overflow-hidden rounded-lg bg-white shadow-lg">
                  <div className="flex items-center justify-between border-b p-4">
                    <h3 className="font-semibold">Notifications</h3>
                    {unreadCount > 0 ? (
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
                          className={`border-b p-4 ${
                            notification.read ? "" : "bg-blue-50"
                          }`}
                        >
                          <div className="flex justify-between gap-3">
                            <p className={`text-sm ${notification.read ? "text-gray-600" : "font-medium text-gray-900"}`}>
                              {notification.message}
                            </p>
                            {!notification.read ? (
                              <button
                                type="button"
                                onClick={() => markNotificationRead(notification.id)}
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
                  setNotificationsOpen(false);
                }}
                className="flex items-center gap-2"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-gray-300 text-lg font-semibold text-black">
                  {profile?.initials ?? "?"}
                </div>
                <div className="text-left">
                  <p className="text-sm font-semibold">{profile?.name ?? "Loading profile..."}</p>
                  <p className="text-xs text-gray-500">{profile?.role ?? "Student"}</p>
                </div>
              </button>

              {profileOpen ? (
                <div className="absolute right-0 mt-3 w-48 rounded-lg bg-white shadow-lg">
                  <Link
                    href="/profile"
                    className="flex items-center px-4 py-2 text-gray-700 hover:bg-gray-100"
                    onClick={() => setProfileOpen(false)}
                  >
                    <i className="fas fa-user mr-3" />
                    Profile
                  </Link>
                  <button
                    type="button"
                    className="flex w-full items-center px-4 py-2 text-left text-gray-700 hover:bg-gray-100"
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
