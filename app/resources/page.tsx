"use client";

import { StudentShell } from "@/components/student-shell";
import { useEffect, useMemo, useState } from "react";
import { listResources } from "@/lib/supabase/data";
import { ResourceRecord } from "@/lib/supabase/types";
import { isSupabaseConfigured } from "@/lib/supabase/client";

function typeIcon(type: ResourceRecord["type"]) {
  switch (type) {
    case "folder":
      return "fa-folder text-amber-500";
    case "pdf":
      return "fa-file-pdf text-rose-500";
    case "doc":
      return "fa-file-word text-blue-500";
    case "video":
      return "fa-file-video text-purple-500";
    default:
      return "fa-file text-gray-500";
  }
}

export default function ResourcesPage() {
  const [resources, setResources] = useState<ResourceRecord[]>([]);
  const [folderStack, setFolderStack] = useState<ResourceRecord[]>([]);
  const [search, setSearch] = useState("");
  const [preview, setPreview] = useState<ResourceRecord | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    const load = async () => {
      if (!isSupabaseConfigured) {
        setError("Supabase is not configured.");
        return;
      }
      try {
        const rows = await listResources();
        if (active) {
          setResources(rows);
        }
      } catch (loadError) {
        if (active) {
          setError(loadError instanceof Error ? loadError.message : "Unable to load resources.");
        }
      }
    };

    void load();
    return () => {
      active = false;
    };
  }, []);

  const currentParentId = folderStack.length ? folderStack[folderStack.length - 1].id : null;
  const currentItems = useMemo(
    () => resources.filter((item) => item.parent_id === currentParentId),
    [resources, currentParentId],
  );

  const visibleItems = useMemo(() => {
    const lowerSearch = search.toLowerCase();
    return currentItems.filter((item) => item.title.toLowerCase().includes(lowerSearch));
  }, [currentItems, search]);

  return (
    <StudentShell title="Resources">
      {error ? (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-700">{error}</div>
      ) : null}

      <div className="mx-auto max-w-5xl">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search resources"
              className="w-full rounded-full border border-gray-300 py-2 pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-violet-500"
            />
            <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          </div>
          <button
            type="button"
            onClick={() => setFolderStack([])}
            className="rounded-lg border border-gray-300 px-4 py-2 hover:bg-gray-100"
          >
            Home
          </button>
        </div>

        <div className="mb-6 flex flex-wrap items-center gap-2 text-sm text-gray-600">
          <button
            type="button"
            onClick={() => setFolderStack([])}
            className="inline-flex items-center gap-2 text-violet-600 hover:text-violet-800"
          >
            <i className="fas fa-home" />
            Home
          </button>
          {folderStack.map((folder, index) => (
            <span key={folder.id} className="inline-flex items-center gap-2">
              <span>/</span>
              <button
                type="button"
                onClick={() => setFolderStack(folderStack.slice(0, index + 1))}
                className="text-violet-600 hover:text-violet-800"
              >
                {folder.title}
              </button>
            </span>
          ))}
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {visibleItems.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                if (item.type === "folder") {
                  setFolderStack((current) => [...current, item]);
                } else {
                  setPreview(item);
                }
              }}
              className="rounded-xl border border-gray-200 bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow"
            >
              <div className="flex items-start gap-4">
                <i className={`fas ${typeIcon(item.type)} text-4xl`} />
                <div className="min-w-0 flex-1">
                  <h3 className="truncate font-semibold">{item.title}</h3>
                  <p className="mt-1 text-sm text-gray-600">{item.description || "No description available."}</p>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs text-gray-500">
                    <span>{item.size}</span>
                    <span>•</span>
                    <span>{new Date(item.uploaded_at).toLocaleDateString("en-US")}</span>
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>

        {visibleItems.length === 0 ? (
          <p className="mt-8 text-center text-gray-600">No resources found.</p>
        ) : null}
      </div>

      {preview ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center gap-3">
              <i className={`fas ${typeIcon(preview.type)} text-3xl`} />
              <div>
                <h3 className="text-xl font-semibold">{preview.title}</h3>
                <p className="text-sm text-gray-500">{new Date(preview.uploaded_at).toLocaleDateString("en-US")}</p>
              </div>
            </div>
            <p className="text-gray-700">{preview.description || "No description available."}</p>
            <div className="mt-4 flex items-center justify-between text-sm text-gray-500">
              <span>{preview.size}</span>
              <span>{preview.type.toUpperCase()}</span>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setPreview(null)}
                className="rounded-lg border border-gray-300 px-4 py-2"
              >
                Close
              </button>
              <a
                href={preview.storage_url ?? "#"}
                className="rounded-lg bg-[#7952b3] px-4 py-2 text-white"
              >
                Download
              </a>
            </div>
          </div>
        </div>
      ) : null}
    </StudentShell>
  );
}
