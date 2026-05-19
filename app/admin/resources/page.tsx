"use client";

import { ChangeEvent, useEffect, useMemo, useState } from "react";
import { AdminShell } from "@/components/admin-shell";
import { ResourceRecord } from "@/lib/supabase/types";
import {
  createResource,
  deleteResource,
  listResources,
  updateResource,
} from "@/lib/supabase/data";
import { isSupabaseConfigured } from "@/lib/supabase/client";

function extensionType(fileName: string): ResourceRecord["type"] {
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "pdf") return "pdf";
  if (["doc", "docx"].includes(ext)) return "doc";
  if (["mp4", "mov", "avi", "mkv"].includes(ext)) return "video";
  return "file";
}

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

export default function AdminResourcesPage() {
  const [resources, setResources] = useState<ResourceRecord[]>([]);
  const [path, setPath] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [folderName, setFolderName] = useState("");
  const [renameTarget, setRenameTarget] = useState<ResourceRecord | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [preview, setPreview] = useState<ResourceRecord | null>(null);
  const [error, setError] = useState("");

  const refresh = async () => {
    const rows = await listResources();
    setResources(rows);
  };

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

  const currentParentId = path.length ? path[path.length - 1] : null;

  const breadcrumbs = useMemo(() => {
    const trail: ResourceRecord[] = [];
    for (const id of path) {
      const node = resources.find((item) => item.id === id);
      if (!node) break;
      trail.push(node);
    }
    return trail;
  }, [path, resources]);

  const visible = useMemo(
    () =>
      resources
        .filter((item) => item.parent_id === currentParentId)
        .filter((item) => item.title.toLowerCase().includes(search.toLowerCase())),
    [resources, currentParentId, search],
  );

  const addFolder = async () => {
    if (!folderName.trim()) return;
    try {
      await createResource({
        parent_id: currentParentId,
        title: folderName.trim(),
        type: "folder",
        size: "0 items",
        description: "Folder",
        owner_name: "Admin",
        storage_url: null,
      });
      setFolderName("");
      await refresh();
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Unable to create folder.");
    }
  };

  const uploadFiles = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    if (files.length === 0) return;

    try {
      await Promise.all(
        files.map((file) =>
          createResource({
            parent_id: currentParentId,
            title: file.name,
            type: extensionType(file.name),
            size: `${Math.max(1, Math.round(file.size / 1024))} KB`,
            description: "Uploaded file",
            owner_name: "Admin",
            storage_url: null,
          }),
        ),
      );
      await refresh();
      event.target.value = "";
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Unable to upload files.");
    }
  };

  const removeResourceItem = async (id: string) => {
    try {
      await deleteResource(id);
      await refresh();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Unable to delete resource.");
    }
  };

  const startRename = (resource: ResourceRecord) => {
    setRenameTarget(resource);
    setRenameValue(resource.title);
  };

  const confirmRename = async () => {
    if (!renameTarget || !renameValue.trim()) return;
    try {
      await updateResource(renameTarget.id, { title: renameValue.trim() });
      await refresh();
      setRenameTarget(null);
      setRenameValue("");
    } catch (renameError) {
      setError(renameError instanceof Error ? renameError.message : "Unable to rename resource.");
    }
  };

  return (
    <AdminShell title="Resources">
      {error ? (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-700">{error}</div>
      ) : null}

      <div className="mx-auto w-full max-w-6xl">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2 text-sm text-gray-600">
            <button
              type="button"
              onClick={() => setPath([])}
              className="inline-flex items-center gap-2 text-violet-600 hover:text-violet-800"
            >
              <i className="fas fa-home" />
              Home
            </button>
            {breadcrumbs.map((crumb, index) => (
              <span key={crumb.id} className="inline-flex items-center gap-2">
                <span>/</span>
                <button
                  type="button"
                  onClick={() => setPath(path.slice(0, index + 1))}
                  className="text-violet-600 hover:text-violet-800"
                >
                  {crumb.title}
                </button>
              </span>
            ))}
          </div>

          <div className="relative">
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search"
              className="rounded-full border border-gray-300 py-2 pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-violet-500"
            />
            <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          </div>
        </div>

        <div className="mb-4 rounded-lg bg-white p-4 shadow">
          <div className="grid gap-3 md:grid-cols-[1fr_auto_auto]">
            <input
              value={folderName}
              onChange={(event) => setFolderName(event.target.value)}
              placeholder="Create folder"
              className="rounded-md border border-gray-300 p-2"
            />
            <button type="button" onClick={() => void addFolder()} className="rounded-md bg-[#002044] px-4 py-2 text-white">
              <i className="fas fa-folder-plus mr-2" />
              Create
            </button>
            <label className="cursor-pointer rounded-md bg-[#002044] px-4 py-2 text-white">
              <i className="fas fa-upload mr-2" />
              Upload Files
              <input type="file" multiple className="hidden" onChange={(event) => void uploadFiles(event)} />
            </label>
          </div>
          {breadcrumbs.length ? <p className="mt-3 text-xs text-gray-500">Current folder: {breadcrumbs[breadcrumbs.length - 1]?.title}</p> : null}
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {visible.map((resource) => (
            <div key={resource.id} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <button
                type="button"
                onClick={() => {
                  if (resource.type === "folder") {
                    setPath((current) => [...current, resource.id]);
                  } else {
                    setPreview(resource);
                  }
                }}
                className="w-full text-left"
              >
                <div className="flex items-start gap-3">
                  <i className={`fas ${typeIcon(resource.type)} text-3xl`} />
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate font-semibold">{resource.title}</h3>
                    <p className="mt-1 text-xs text-gray-500">
                      {resource.size} • {new Date(resource.uploaded_at).toLocaleDateString("en-US")}
                    </p>
                    <p className="mt-1 text-xs text-gray-500">Owner: {resource.owner_name}</p>
                  </div>
                </div>
              </button>

              <div className="mt-3 flex justify-end gap-2 border-t pt-3">
                <button
                  type="button"
                  onClick={() => startRename(resource)}
                  className="rounded-md px-2 py-1 text-blue-600 hover:bg-blue-50"
                >
                  <i className="fas fa-pen" />
                </button>
                <button
                  type="button"
                  onClick={() => void removeResourceItem(resource.id)}
                  className="rounded-md px-2 py-1 text-red-600 hover:bg-red-50"
                >
                  <i className="fas fa-trash" />
                </button>
              </div>
            </div>
          ))}
        </div>

        {visible.length === 0 ? (
          <p className="mt-8 text-center text-gray-600">No resources found in this folder.</p>
        ) : null}
      </div>

      {renameTarget ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-lg bg-white p-6">
            <h3 className="mb-3 text-lg font-semibold">Rename Resource</h3>
            <input
              value={renameValue}
              onChange={(event) => setRenameValue(event.target.value)}
              className="w-full rounded-md border border-gray-300 p-2"
            />
            <div className="mt-4 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setRenameTarget(null)}
                className="rounded-md border border-gray-300 px-4 py-2"
              >
                Cancel
              </button>
              <button type="button" onClick={() => void confirmRename()} className="rounded-md bg-[#7952b3] px-4 py-2 text-white">
                Save
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {preview ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-lg bg-white p-6">
            <h3 className="mb-2 text-xl font-semibold">{preview.title}</h3>
            <p className="text-sm text-gray-500">
              {preview.size} • {new Date(preview.uploaded_at).toLocaleDateString("en-US")}
            </p>
            <p className="mt-4 text-gray-700">{preview.description || "Preview is unavailable for this file type."}</p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setPreview(null)}
                className="rounded-md border border-gray-300 px-4 py-2"
              >
                Close
              </button>
              <a
                href={preview.storage_url ?? "#"}
                className="rounded-md bg-[#7952b3] px-4 py-2 text-white"
              >
                Download
              </a>
            </div>
          </div>
        </div>
      ) : null}
    </AdminShell>
  );
}
