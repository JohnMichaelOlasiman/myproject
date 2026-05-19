"use client";

import Image from "next/image";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { AdminShell } from "@/components/admin-shell";
import {
  createAnnouncement,
  createAnnouncementComment,
  deleteAnnouncement,
  getCurrentProfile,
  listAnnouncementComments,
  listAnnouncements,
  updateAnnouncement,
} from "@/lib/supabase/data";
import { AnnouncementRecord } from "@/lib/supabase/types";
import { isSupabaseConfigured } from "@/lib/supabase/client";

type SortMode = "A-Z" | "Z-A" | "Newest" | "Oldest";

type AnnouncementForm = {
  title: string;
  description: string;
  attachmentName: string;
  attachmentType: "image" | "file";
};

type AnnouncementView = AnnouncementRecord & { comments: string[] };

const emptyForm: AnnouncementForm = {
  title: "",
  description: "",
  attachmentName: "",
  attachmentType: "file",
};

export default function AdminAnnouncementsPage() {
  const [records, setRecords] = useState<AnnouncementView[]>([]);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortMode>("Newest");
  const [sortOpen, setSortOpen] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<AnnouncementView | null>(null);
  const [form, setForm] = useState<AnnouncementForm>(emptyForm);
  const [openComments, setOpenComments] = useState<number | null>(null);
  const [commentDraft, setCommentDraft] = useState("");
  const [profileId, setProfileId] = useState<string | null>(null);
  const [profileName, setProfileName] = useState("Admin");
  const [error, setError] = useState("");

  const refresh = async () => {
    const announcements = await listAnnouncements();
    const comments = await listAnnouncementComments(announcements.map((item) => item.id));
    const commentMap = new Map<number, string[]>();
    for (const comment of comments) {
      const list = commentMap.get(comment.announcement_id) ?? [];
      list.push(comment.comment);
      commentMap.set(comment.announcement_id, list);
    }
    setRecords(
      announcements.map((announcement) => ({
        ...announcement,
        comments: commentMap.get(announcement.id) ?? [],
      })),
    );
  };

  useEffect(() => {
    let active = true;
    const load = async () => {
      if (!isSupabaseConfigured) {
        setError("Supabase is not configured.");
        return;
      }
      try {
        const profile = await getCurrentProfile();
        if (active) {
          setProfileId(profile?.id ?? null);
          setProfileName(profile ? `${profile.firstname} ${profile.lastname}`.trim() : "Admin");
        }
        await refresh();
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

  const displayed = useMemo(() => {
    const items = records.filter((record) => {
      const haystack = `${record.title} ${record.description}`.toLowerCase();
      return haystack.includes(search.toLowerCase());
    });

    items.sort((a, b) => {
      if (sort === "A-Z") return a.title.localeCompare(b.title);
      if (sort === "Z-A") return b.title.localeCompare(a.title);
      if (sort === "Oldest") return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

    return items;
  }, [records, search, sort]);

  const openAdd = () => {
    setEditing(null);
    setForm(emptyForm);
    setFormOpen(true);
  };

  const openEdit = (record: AnnouncementView) => {
    setEditing(record);
    setForm({
      title: record.title,
      description: record.description,
      attachmentName: record.attachment_name ?? "",
      attachmentType: record.attachment_type ?? "file",
    });
    setFormOpen(true);
  };

  const saveAnnouncement = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      const attachmentName = form.attachmentName.trim() || null;
      const attachmentType = attachmentName ? form.attachmentType : null;
      const attachmentUrl = attachmentType === "image" ? "/inc/graphs.svg" : null;

      if (editing) {
        await updateAnnouncement(editing.id, {
          title: form.title,
          description: form.description,
          attachment_name: attachmentName,
          attachment_type: attachmentType,
          attachment_url: attachmentUrl,
        });
      } else {
        await createAnnouncement({
          title: form.title,
          description: form.description,
          author_id: profileId,
          author_name: profileName || "Admin",
          attachment_name: attachmentName,
          attachment_type: attachmentType,
          attachment_url: attachmentUrl,
        });
      }
      await refresh();
      setFormOpen(false);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save announcement.");
    }
  };

  const deleteAnnouncementRow = async (id: number) => {
    try {
      await deleteAnnouncement(id);
      await refresh();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Unable to delete announcement.");
    }
  };

  const addComment = async (id: number) => {
    if (!commentDraft.trim()) return;
    try {
      await createAnnouncementComment({
        announcement_id: id,
        comment: commentDraft.trim(),
        user_id: profileId,
      });
      setCommentDraft("");
      await refresh();
    } catch (commentError) {
      setError(commentError instanceof Error ? commentError.message : "Unable to post comment.");
    }
  };

  return (
    <AdminShell title="Announcements">
      {error ? (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-700">{error}</div>
      ) : null}

      <div className="mx-auto w-full max-w-5xl">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="relative">
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="w-64 rounded-full border border-gray-300 py-2 pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-violet-500"
                placeholder="Search"
              />
              <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            </div>

            <div className="relative">
              <button
                type="button"
                onClick={() => setSortOpen((open) => !open)}
                className="flex items-center gap-2 text-gray-600"
              >
                <i className="fas fa-sort" />
                <span>Sort</span>
              </button>
              {sortOpen ? (
                <div className="absolute z-10 mt-2 w-32 rounded-lg border border-gray-200 bg-white shadow-lg">
                  {(["A-Z", "Z-A", "Newest", "Oldest"] as SortMode[]).map((option) => (
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

          <button
            type="button"
            onClick={openAdd}
            className="rounded-lg bg-[#002044] px-4 py-2 text-white"
          >
            <i className="fas fa-plus mr-2" />
            Add Post
          </button>
        </div>

        <div className="space-y-4">
          {displayed.map((record) => (
            <article key={record.id} className="rounded-lg bg-white p-6 shadow">
              <div className="mb-4 flex items-center">
                <div className="mr-2 flex h-12 w-12 items-center justify-center rounded-full border-2 border-gray-300 text-lg font-semibold">
                  AD
                </div>
                <div className="ml-2">
                  <p className="font-semibold">{record.author_name || "Admin"} · Admin</p>
                  <p className="text-sm text-gray-500">
                    {new Date(record.created_at).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </p>
                </div>
              </div>

              <h3 className="mb-2 text-xl font-bold">{record.title}</h3>
              <p className="mb-4 text-gray-700">{record.description}</p>

              {record.attachment_name ? (
                <div className="mb-4">
                  {record.attachment_type === "image" ? (
                    <Image
                      src={record.attachment_url ?? "/inc/graphs.svg"}
                      alt={record.attachment_name}
                      width={1200}
                      height={360}
                      className="w-full rounded-lg object-cover"
                    />
                  ) : (
                    <span className="text-blue-600 underline">{record.attachment_name}</span>
                  )}
                </div>
              ) : null}

              <div className="flex items-center justify-between border-t pt-4">
                <button
                  type="button"
                  onClick={() => setOpenComments((current) => (current === record.id ? null : record.id))}
                  className="flex items-center gap-2 text-gray-600 hover:text-blue-600"
                >
                  <i className="fas fa-comment" />
                  <span>Comments</span>
                </button>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => openEdit(record)}
                    className="rounded-md px-3 py-2 text-blue-600 hover:bg-blue-50"
                  >
                    <i className="fas fa-pen" />
                  </button>
                  <button
                    type="button"
                    onClick={() => void deleteAnnouncementRow(record.id)}
                    className="rounded-md px-3 py-2 text-red-600 hover:bg-red-50"
                  >
                    <i className="fas fa-trash" />
                  </button>
                </div>
              </div>

              {openComments === record.id ? (
                <div className="mt-4 rounded-lg bg-gray-50 p-4">
                  <div className="space-y-2">
                    {record.comments.map((comment, index) => (
                      <div key={`${record.id}-${index}`} className="rounded-md bg-white p-2 text-sm text-gray-700 shadow-sm">
                        {comment}
                      </div>
                    ))}
                  </div>
                  <textarea
                    value={commentDraft}
                    onChange={(event) => setCommentDraft(event.target.value)}
                    rows={2}
                    className="mt-3 w-full rounded-md border border-gray-300 p-2"
                    placeholder="Write a comment..."
                  />
                  <button
                    type="button"
                    onClick={() => void addComment(record.id)}
                    className="mt-2 rounded-md bg-blue-600 px-4 py-2 text-white"
                  >
                    Post Comment
                  </button>
                </div>
              ) : null}
            </article>
          ))}
        </div>
      </div>

      {formOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-xl rounded-lg bg-white p-6">
            <h3 className="mb-4 text-xl font-semibold">{editing ? "Edit Post" : "Add Post"}</h3>
            <form onSubmit={(event) => void saveAnnouncement(event)}>
              <div className="space-y-4">
                <input
                  required
                  value={form.title}
                  onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
                  className="w-full rounded-md border border-gray-300 p-2"
                  placeholder="Title"
                />
                <textarea
                  required
                  value={form.description}
                  onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                  className="w-full rounded-md border border-gray-300 p-2"
                  rows={5}
                  placeholder="Description"
                />
                <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
                  <input
                    value={form.attachmentName}
                    onChange={(event) => setForm((current) => ({ ...current, attachmentName: event.target.value }))}
                    className="rounded-md border border-gray-300 p-2"
                    placeholder="Attachment file name (optional)"
                  />
                  <select
                    value={form.attachmentType}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        attachmentType: event.target.value as "image" | "file",
                      }))
                    }
                    className="rounded-md border border-gray-300 p-2"
                  >
                    <option value="file">File</option>
                    <option value="image">Image</option>
                  </select>
                </div>
              </div>
              <div className="mt-6 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setFormOpen(false)}
                  className="rounded-md border border-gray-300 px-4 py-2"
                >
                  Cancel
                </button>
                <button type="submit" className="rounded-md bg-[#002044] px-4 py-2 text-white">
                  {editing ? "Update" : "Post"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </AdminShell>
  );
}
