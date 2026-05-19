"use client";

import Image from "next/image";
import { StudentShell } from "@/components/student-shell";
import { useEffect, useMemo, useState } from "react";
import {
  createAnnouncementComment,
  getCurrentProfile,
  listAnnouncementComments,
  listAnnouncements,
} from "@/lib/supabase/data";
import { AnnouncementRecord } from "@/lib/supabase/types";
import { isSupabaseConfigured } from "@/lib/supabase/client";

type SortOption = "A-Z" | "Z-A" | "Newest" | "Oldest";

type AnnouncementView = AnnouncementRecord & {
  comments: string[];
};

function initials(name: string) {
  return name
    .split(" ")
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function timeAgo(isoDate: string) {
  const diff = Date.now() - new Date(isoDate).getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));
  if (hours < 1) return "Just now";
  if (hours < 24) return `${hours} hour${hours > 1 ? "s" : ""} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days > 1 ? "s" : ""} ago`;
}

export default function AnnouncementPage() {
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortOption>("Newest");
  const [sortOpen, setSortOpen] = useState(false);
  const [openAnnouncementId, setOpenAnnouncementId] = useState<number>(0);
  const [commentDraft, setCommentDraft] = useState("");
  const [postedAnnouncementId, setPostedAnnouncementId] = useState<number | null>(null);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [records, setRecords] = useState<AnnouncementView[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    const load = async () => {
      if (!isSupabaseConfigured) {
        setError("Supabase is not configured.");
        return;
      }

      try {
        const [profile, announcements] = await Promise.all([getCurrentProfile(), listAnnouncements()]);
        const comments = await listAnnouncementComments(announcements.map((item) => item.id));
        if (!active) return;

        setProfileId(profile?.id ?? null);

        const commentsByAnnouncement = new Map<number, string[]>();
        for (const item of comments) {
          const list = commentsByAnnouncement.get(item.announcement_id) ?? [];
          list.push(item.comment);
          commentsByAnnouncement.set(item.announcement_id, list);
        }

        const merged = announcements.map((announcement) => ({
          ...announcement,
          comments: commentsByAnnouncement.get(announcement.id) ?? [],
        }));
        setRecords(merged);
        setOpenAnnouncementId(merged[0]?.id ?? 0);
      } catch (loadError) {
        if (active) {
          setError(loadError instanceof Error ? loadError.message : "Unable to load announcements.");
        }
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, []);

  const filtered = useMemo(() => {
    const lowerSearch = search.toLowerCase();
    const items = records.filter(
      (announcement) =>
        announcement.title.toLowerCase().includes(lowerSearch) ||
        announcement.description.toLowerCase().includes(lowerSearch),
    );

    items.sort((a, b) => {
      switch (sort) {
        case "A-Z":
          return a.title.localeCompare(b.title);
        case "Z-A":
          return b.title.localeCompare(a.title);
        case "Oldest":
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        case "Newest":
        default:
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
    });

    return items;
  }, [records, search, sort]);

  const sortOptions: SortOption[] = ["A-Z", "Z-A", "Newest", "Oldest"];

  const onPostComment = async (announcementId: number) => {
    const comment = commentDraft.trim();
    if (!comment) {
      return;
    }
    try {
      await createAnnouncementComment({
        announcement_id: announcementId,
        comment,
        user_id: profileId,
      });
      setRecords((current) =>
        current.map((announcement) =>
          announcement.id === announcementId
            ? { ...announcement, comments: [...announcement.comments, comment] }
            : announcement,
        ),
      );
      setPostedAnnouncementId(announcementId);
      setCommentDraft("");
    } catch (commentError) {
      setError(commentError instanceof Error ? commentError.message : "Unable to post comment.");
    }
  };

  return (
    <StudentShell title="Announcements">
      {error ? (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-700">{error}</div>
      ) : null}

      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search"
              className="w-full rounded-full border border-gray-300 py-2 pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-violet-500"
            />
            <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          </div>

          <div className="relative">
            <button
              type="button"
              onClick={() => setSortOpen((current) => !current)}
              className="flex items-center gap-2 rounded-lg px-4 py-2 text-gray-600 shadow-sm hover:bg-gray-100"
            >
              <i className="fas fa-sort" />
              <span>Sort</span>
            </button>

            {sortOpen ? (
              <div className="absolute right-0 z-10 mt-2 w-32 rounded-lg border border-gray-200 bg-white shadow-lg">
                {sortOptions.map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => {
                      setSort(option);
                      setSortOpen(false);
                    }}
                    className="block w-full px-4 py-2 text-left hover:bg-gray-100"
                  >
                    {option}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </div>

        <div className="space-y-4">
          {filtered.length > 0 ? (
            filtered.map((announcement) => (
              <article key={announcement.id} className="rounded-lg bg-white p-6 shadow">
                <div className="mb-4 flex items-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-gray-300 text-lg font-semibold">
                    {initials(announcement.author_name || "Admin")}
                  </div>
                  <div className="ml-4">
                    <p className="font-semibold">{announcement.author_name || "Admin"} · Admin</p>
                    <p className="text-sm text-gray-500">
                      {new Date(announcement.created_at).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-4">
                  <div className="flex-1">
                    <h2 className="mb-2 text-xl font-bold">{announcement.title}</h2>
                    <p className="text-gray-700">{announcement.description}</p>
                  </div>
                  <span className="text-sm text-gray-500">{timeAgo(announcement.created_at)}</span>
                </div>

                {announcement.attachment_name ? (
                  <div className="mt-4">
                    {announcement.attachment_type === "image" ? (
                      <Image
                        src={announcement.attachment_url ?? "/inc/graphs.svg"}
                        alt={announcement.attachment_name}
                        width={1200}
                        height={400}
                        className="h-64 w-full rounded-lg object-cover"
                      />
                    ) : (
                      <a
                        href={announcement.attachment_url ?? "#"}
                        className="inline-flex items-center gap-2 rounded-lg bg-gray-100 px-4 py-2 text-blue-600 hover:bg-gray-200"
                      >
                        <i className="fas fa-file-alt" />
                        {announcement.attachment_name}
                      </a>
                    )}
                  </div>
                ) : null}

                <div className="mt-4 flex items-center justify-between border-t border-gray-200 pt-4">
                  <button
                    type="button"
                    onClick={() =>
                      setOpenAnnouncementId((current) =>
                        current === announcement.id ? 0 : announcement.id,
                      )
                    }
                    className="inline-flex items-center gap-2 text-gray-600 transition hover:text-blue-600"
                  >
                    <i className="fas fa-comment" />
                    <span>Comments</span>
                  </button>
                </div>

                {openAnnouncementId === announcement.id ? (
                  <div className="mt-4 rounded-lg bg-gray-50 p-4">
                    <div className="space-y-3">
                      {announcement.comments.map((comment, index) => (
                        <div key={`${announcement.id}-${index}`} className="rounded-md bg-white p-3 shadow-sm">
                          <p className="text-sm text-gray-700">{comment}</p>
                        </div>
                      ))}
                    </div>

                    <textarea
                      value={commentDraft}
                      onChange={(event) => setCommentDraft(event.target.value)}
                      rows={3}
                      placeholder="Write a comment..."
                      className="mt-4 w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                      type="button"
                      onClick={() => void onPostComment(announcement.id)}
                      className="mt-3 rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
                    >
                      Post Comment
                    </button>
                    {postedAnnouncementId === announcement.id ? (
                      <p className="mt-2 text-sm text-emerald-600">Comment posted.</p>
                    ) : null}
                  </div>
                ) : null}
              </article>
            ))
          ) : (
            <p className="text-center text-gray-600">No announcements found.</p>
          )}
        </div>
      </div>
    </StudentShell>
  );
}
