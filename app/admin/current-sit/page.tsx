"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AdminShell } from "@/components/admin-shell";
import { listSitInRecords, timeoutSitInRecord } from "@/lib/supabase/data";
import { SitInRecord } from "@/lib/supabase/types";
import { isSupabaseConfigured } from "@/lib/supabase/client";

type Entries = "5" | "10" | "25" | "50";

export default function AdminCurrentSitPage() {
  const router = useRouter();
  const [entries, setEntries] = useState<Entries>("5");
  const [search, setSearch] = useState("");
  const [records, setRecords] = useState<SitInRecord[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    const load = async () => {
      if (!isSupabaseConfigured) {
        setError("Supabase is not configured.");
        return;
      }
      try {
        const rows = await listSitInRecords("Sit-in");
        if (active) {
          setRecords(rows);
        }
      } catch (loadError) {
        if (active) {
          setError(loadError instanceof Error ? loadError.message : "Unable to load current sit-ins.");
        }
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, []);

  const visible = useMemo(() => {
    const filtered = records.filter((record) => {
      const haystack = `${record.id} ${record.idno} ${record.full_name} ${record.purpose} ${record.lab_number}`.toLowerCase();
      return haystack.includes(search.toLowerCase());
    });
    return filtered.slice(0, Number(entries));
  }, [records, search, entries]);

  const timeout = async (recordId: number) => {
    try {
      await timeoutSitInRecord(recordId);
      setRecords((current) => current.filter((record) => record.id !== recordId));
      router.push("/admin/rewards");
    } catch (timeoutError) {
      setError(timeoutError instanceof Error ? timeoutError.message : "Unable to time out sit-in.");
    }
  };

  return (
    <AdminShell title="Current Sit-In">
      {error ? (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-700">{error}</div>
      ) : null}

      <div className="mx-auto w-full max-w-6xl">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center space-x-2">
            <label className="text-gray-600" htmlFor="entries">
              Entries per page
            </label>
            <select
              id="entries"
              value={entries}
              onChange={(event) => setEntries(event.target.value as Entries)}
              className="rounded-md border border-gray-300 p-2"
            >
              <option value="5">5</option>
              <option value="10">10</option>
              <option value="25">25</option>
              <option value="50">50</option>
            </select>
          </div>

          <div className="relative">
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="rounded-full border border-gray-300 py-2 pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-violet-500"
              placeholder="Search"
              type="text"
            />
            <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          </div>
        </div>

        <div className="overflow-x-auto rounded-lg shadow-md">
          <table className="min-w-full bg-white">
            <thead>
              <tr className="bg-[#002044] text-white">
                <th className="px-4 py-4 text-center">SIT ID NUMBER</th>
                <th className="px-4 py-4 text-center">ID NUMBER</th>
                <th className="px-4 py-4 text-center">NAME</th>
                <th className="px-4 py-4 text-center">PURPOSE</th>
                <th className="px-4 py-4 text-center">LAB</th>
                <th className="px-4 py-4 text-center">SESSION</th>
                <th className="px-4 py-4 text-center">DATE</th>
                <th className="px-4 py-4 text-center">STATUS</th>
                <th className="px-4 py-4 text-center">ACTION</th>
              </tr>
            </thead>
            <tbody>
              {visible.length > 0 ? (
                visible.map((record, index) => (
                  <tr key={record.id} className={index % 2 === 0 ? "bg-gray-100" : "bg-gray-200"}>
                    <td className="px-4 py-4 text-center">{record.id}</td>
                    <td className="px-4 py-4 text-center font-semibold">{record.idno}</td>
                    <td className="px-4 py-4 text-center">{record.full_name}</td>
                    <td className="px-4 py-4 text-center">{record.purpose}</td>
                    <td className="px-4 py-4 text-center">{record.lab_number}</td>
                    <td className="px-4 py-4 text-center">{record.session_remaining}</td>
                    <td className="px-4 py-4 text-center">
                      {new Date(record.date).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </td>
                    <td className="px-4 py-4 text-center">{record.status}</td>
                    <td className="px-4 py-4 text-center">
                      <button
                        type="button"
                        onClick={() => void timeout(record.id)}
                        className="rounded bg-red-500 px-4 py-2 text-white"
                      >
                        Time Out
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={9} className="px-4 py-4 text-center">
                    No students currently sitting in.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </AdminShell>
  );
}
