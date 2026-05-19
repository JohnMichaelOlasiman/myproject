"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { StudentShell } from "@/components/student-shell";
import { AnnouncementRecord, ProfileRecord } from "@/lib/supabase/types";
import { getCurrentProfileWithRetry, getStudentDashboardData } from "@/lib/supabase/data";
import { isSupabaseConfigured } from "@/lib/supabase/client";

function timeAgo(isoDate: string) {
  const diff = Date.now() - new Date(isoDate).getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));
  if (hours < 1) return "Just now";
  if (hours < 24) return `${hours} hour${hours > 1 ? "s" : ""} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days > 1 ? "s" : ""} ago`;
}

export default function DashboardPage() {
  const [profile, setProfile] = useState<ProfileRecord | null>(null);
  const [announcements, setAnnouncements] = useState<AnnouncementRecord[]>([]);
  const [usage, setUsage] = useState<Array<{ day: string; value: number }>>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const load = async () => {
      if (!isSupabaseConfigured) {
        setError("Supabase is not configured.");
        setLoading(false);
        return;
      }
      try {
        const currentProfile = await getCurrentProfileWithRetry();
        if (!active || !currentProfile) {
          return;
        }
        const data = await getStudentDashboardData(currentProfile);
        if (!active) return;
        setProfile(data.profile);
        setAnnouncements(data.announcements);
        setUsage(data.usage);
      } catch (loadError) {
        if (active) {
          setError(loadError instanceof Error ? loadError.message : "Unable to load dashboard.");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    void load();
    return () => {
      active = false;
    };
  }, []);

  const max = useMemo(() => Math.max(...usage.map((item) => item.value), 1), [usage]);

  return (
    <StudentShell title="Dashboard">
      {!loading && error ? (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-700">{error}</div>
      ) : null}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div className="flex h-24 items-center justify-between rounded-lg bg-[#002044] p-4 text-white">
              <div>
                <p className="text-3xl font-semibold">{profile?.session_remaining ?? 0}</p>
                <p>Sessions Left</p>
              </div>
              <i className="fas fa-calendar-alt text-3xl" />
            </div>
            <div className="flex h-24 items-center justify-between rounded-lg bg-white p-4 shadow">
              <div>
                <p className="text-3xl font-semibold">{profile?.points ?? 0}</p>
                <p>Points Accumulated</p>
              </div>
              <i className="fas fa-award text-3xl text-yellow-500" />
            </div>
          </div>

          <div className="rounded-lg bg-white p-6 shadow">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold">Lab Usage</h3>
              <span className="rounded-lg bg-gray-200 px-4 py-2 text-gray-700">Last 7 Days</span>
            </div>

            <div className="flex h-72 items-end gap-4 rounded-lg bg-gray-50 p-4">
              {usage.map((item) => (
                <div key={item.day} className="flex flex-1 flex-col items-center gap-2">
                  <div className="flex h-56 w-full items-end">
                    <div
                      className="w-full rounded-t-lg bg-[#002044] transition hover:bg-[#01356b]"
                      style={{ height: `${(item.value / max) * 100}%` }}
                    />
                  </div>
                  <span className="text-sm text-gray-600">{item.day}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="rounded-lg bg-white p-6 shadow">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-semibold">Announcements</h3>
            <Link href="/announcement" className="text-sm text-blue-600 hover:text-blue-800">
              View All
            </Link>
          </div>

          <div className="space-y-4">
            {announcements.map((announcement, index) =>
              index === 0 ? (
                <Link href="/announcement" key={announcement.id} className="block">
                  <div className="rounded-lg bg-[#002044] p-4 text-white">
                    <div className="mb-2 flex items-center justify-between gap-4">
                      <p className="font-semibold">{announcement.title}</p>
                      <span className="text-sm">{timeAgo(announcement.created_at)}</span>
                    </div>
                    <Image
                      src={announcement.attachment_url ?? "/inc/graphs.svg"}
                      alt={announcement.attachment_name ?? "Announcement attachment"}
                      width={800}
                      height={200}
                      className="mt-2 h-32 w-full rounded-lg object-cover"
                    />
                    <p className="mt-3 text-sm text-blue-100">{announcement.description}</p>
                  </div>
                </Link>
              ) : (
                <Link href="/announcement" key={announcement.id} className="block">
                  <div className="rounded-lg bg-white p-4 shadow transition hover:bg-gray-50">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex-1">
                        <p className="font-semibold">{announcement.title}</p>
                        <p className="mt-1 text-sm text-gray-600">{announcement.description}</p>
                      </div>
                      <span className="text-sm text-gray-500">{timeAgo(announcement.created_at)}</span>
                    </div>
                  </div>
                </Link>
              ),
            )}
          </div>
        </div>
      </div>
    </StudentShell>
  );
}
