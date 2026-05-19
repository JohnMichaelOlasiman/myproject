"use client";

import { useEffect, useMemo, useState } from "react";
import { AdminShell } from "@/components/admin-shell";
import { labOptions, purposeOptions } from "@/lib/supabase/constants";
import { listSitInRecords } from "@/lib/supabase/data";
import { SitInRecord } from "@/lib/supabase/types";
import { isSupabaseConfigured } from "@/lib/supabase/client";

type Entries = "all" | "5" | "10" | "25" | "50";

export default function AdminDaySitPage() {
  const [entries, setEntries] = useState<Entries>("all");
  const [search, setSearch] = useState("");
  const [purposeFilter, setPurposeFilter] = useState("");
  const [labFilter, setLabFilter] = useState("");
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
        const rows = await listSitInRecords("Completed");
        if (active) {
          setRecords(rows);
        }
      } catch (loadError) {
        if (active) {
          setError(loadError instanceof Error ? loadError.message : "Unable to load sit-in records.");
        }
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, []);

  const filtered = useMemo(() => {
    let rows = records.filter((record) => {
      const haystack = `${record.id} ${record.idno} ${record.full_name} ${record.purpose} ${record.lab_number}`.toLowerCase();
      const matchesSearch = haystack.includes(search.toLowerCase());
      const matchesPurpose = purposeFilter ? record.purpose === purposeFilter : true;
      const matchesLab = labFilter ? record.lab_number === labFilter : true;
      return matchesSearch && matchesPurpose && matchesLab;
    });

    if (entries !== "all") {
      rows = rows.slice(0, Number(entries));
    }

    return rows;
  }, [records, search, purposeFilter, labFilter, entries]);

  return (
    <AdminShell title="Current Sit-In Records">
      {error ? (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-700">{error}</div>
      ) : null}

      <div className="mx-auto w-full max-w-6xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
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
              <option value="all">All</option>
              <option value="5">5</option>
              <option value="10">10</option>
              <option value="25">25</option>
              <option value="50">50</option>
            </select>
          </div>

          <div className="flex flex-wrap items-center gap-3">
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
            <select
              value={purposeFilter}
              onChange={(event) => setPurposeFilter(event.target.value)}
              className="rounded-md border border-gray-300 p-2"
            >
              <option value="">Filter by Purpose</option>
              {purposeOptions.map((purpose) => (
                <option key={purpose} value={purpose}>
                  {purpose}
                </option>
              ))}
            </select>
            <select
              value={labFilter}
              onChange={(event) => setLabFilter(event.target.value)}
              className="rounded-md border border-gray-300 p-2"
            >
              <option value="">Filter by Lab</option>
              {labOptions.map((lab) => (
                <option key={lab} value={lab}>
                  {lab}
                </option>
              ))}
            </select>
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
                <th className="px-4 py-4 text-center">LOGIN</th>
                <th className="px-4 py-4 text-center">LOGOUT</th>
                <th className="px-4 py-4 text-center">DATE</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length > 0 ? (
                filtered.map((record, index) => (
                  <tr key={record.id} className={index % 2 === 0 ? "bg-gray-100" : "bg-gray-200"}>
                    <td className="px-4 py-4 text-center">{record.id}</td>
                    <td className="px-4 py-4 text-center font-semibold">{record.idno}</td>
                    <td className="px-4 py-4 text-center">{record.full_name}</td>
                    <td className="px-4 py-4 text-center">{record.purpose}</td>
                    <td className="px-4 py-4 text-center">{record.lab_number}</td>
                    <td className="px-4 py-4 text-center">{record.time_in}</td>
                    <td className="px-4 py-4 text-center">{record.time_out ?? "—"}</td>
                    <td className="px-4 py-4 text-center">
                      {new Date(record.date).toLocaleDateString("en-US")}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} className="px-4 py-4 text-center">
                    No data found.
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
