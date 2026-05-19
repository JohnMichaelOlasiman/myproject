"use client";

import { useEffect, useMemo, useState } from "react";
import { AdminShell } from "@/components/admin-shell";
import { labOptions, purposeOptions } from "@/lib/supabase/constants";
import { listSitInRecords, rewardSitInRecord } from "@/lib/supabase/data";
import { SitInRecord } from "@/lib/supabase/types";
import { isSupabaseConfigured } from "@/lib/supabase/client";

type Entries = "all" | "5" | "10" | "25" | "50";

export default function AdminRewardsPage() {
  const [entries, setEntries] = useState<Entries>("all");
  const [search, setSearch] = useState("");
  const [purposeFilter, setPurposeFilter] = useState("");
  const [labFilter, setLabFilter] = useState("");
  const [records, setRecords] = useState<SitInRecord[]>([]);
  const [rewardSelections, setRewardSelections] = useState<Record<number, boolean>>({});
  const [decisionSelections, setDecisionSelections] = useState<Record<number, "complete" | "incomplete">>({});
  const [finalizedDecisions, setFinalizedDecisions] = useState<Record<number, "complete" | "incomplete">>({});
  const [openMenuId, setOpenMenuId] = useState<number | null>(null);
  const [processingId, setProcessingId] = useState<number | null>(null);
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
          setError(loadError instanceof Error ? loadError.message : "Unable to load rewards records.");
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

  const applyRewardDecision = async (record: SitInRecord, taskCompleted: boolean) => {
    const hasReward = rewardSelections[record.id];
    if (!hasReward) {
      setError("Click Reward first before choosing Complete or Incomplete.");
      return;
    }

    try {
      setError("");
      const selectedDecision = taskCompleted ? "complete" : "incomplete";
      setDecisionSelections((current) => ({ ...current, [record.id]: selectedDecision }));
      setProcessingId(record.id);
      await rewardSitInRecord({
        sitInId: record.id,
        points: 1,
        taskCompleted,
      });
      setRecords((current) =>
        current.map((item) => (item.id === record.id ? { ...item, rewarded: true } : item)),
      );
      setRewardSelections((current) => {
        const next = { ...current };
        delete next[record.id];
        return next;
      });
      setDecisionSelections((current) => {
        const next = { ...current };
        delete next[record.id];
        return next;
      });
      setFinalizedDecisions((current) => ({
        ...current,
        [record.id]: selectedDecision,
      }));
      setOpenMenuId(null);
    } catch (rewardError) {
      setError(rewardError instanceof Error ? rewardError.message : "Unable to assign reward.");
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <AdminShell title="Rewards">
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
                <th className="px-4 py-4 text-center">ACTION</th>
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
                    <td className="px-4 py-4 text-center">{new Date(record.date).toLocaleDateString("en-US")}</td>
                    <td className="px-4 py-4 text-center">
                      {record.rewarded ? (
                        <button type="button" disabled className="rounded bg-gray-400 px-3 py-1 text-white">
                          Locked{finalizedDecisions[record.id] ? ` • ${finalizedDecisions[record.id] === "complete" ? "Complete" : "Incomplete"}` : ""}
                        </button>
                      ) : (
                        <div className="relative inline-flex flex-col items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setOpenMenuId((current) => (current === record.id ? null : record.id))}
                            className="rounded border border-gray-300 bg-white px-3 py-1 text-sm text-gray-700 hover:bg-gray-100"
                            aria-label="Open reward actions"
                          >
                            <i className="fas fa-ellipsis-v" />
                          </button>
                          {rewardSelections[record.id] ? (
                            <span className="rounded bg-green-100 px-2 py-1 text-xs font-medium text-green-700">Reward selected</span>
                          ) : null}
                          {processingId === record.id ? (
                            <span className="rounded bg-blue-100 px-2 py-1 text-xs font-medium text-blue-700">
                              Saving {decisionSelections[record.id] === "incomplete" ? "Incomplete" : "Complete"}...
                            </span>
                          ) : null}
                          {openMenuId === record.id ? (
                            <div className="absolute right-0 top-10 z-20 w-44 rounded-md border border-gray-200 bg-white py-1 text-left shadow-lg">
                              <button
                                type="button"
                                onClick={() => {
                                  setError("");
                                  setRewardSelections((current) => ({
                                    ...current,
                                    [record.id]: true,
                                  }));
                                  setDecisionSelections((current) => {
                                    const next = { ...current };
                                    delete next[record.id];
                                    return next;
                                  });
                                }}
                                disabled={processingId === record.id}
                                className={`block w-full px-3 py-2 text-left text-sm disabled:cursor-not-allowed disabled:text-gray-400 ${
                                  rewardSelections[record.id] ? "bg-green-50 font-semibold text-green-700" : "hover:bg-gray-100"
                                }`}
                              >
                                Reward{rewardSelections[record.id] ? " ✓" : ""}
                              </button>
                              <button
                                type="button"
                                onClick={() => void applyRewardDecision(record, true)}
                                disabled={processingId === record.id}
                                className={`block w-full px-3 py-2 text-left text-sm disabled:cursor-not-allowed disabled:text-gray-400 ${
                                  decisionSelections[record.id] === "complete"
                                    ? "bg-blue-50 font-semibold text-blue-700"
                                    : "hover:bg-gray-100"
                                }`}
                              >
                                Complete{decisionSelections[record.id] === "complete" ? " ✓" : ""}
                              </button>
                              <button
                                type="button"
                                onClick={() => void applyRewardDecision(record, false)}
                                disabled={processingId === record.id}
                                className={`block w-full px-3 py-2 text-left text-sm disabled:cursor-not-allowed disabled:text-gray-400 ${
                                  decisionSelections[record.id] === "incomplete"
                                    ? "bg-blue-50 font-semibold text-blue-700"
                                    : "hover:bg-gray-100"
                                }`}
                              >
                                Incomplete{decisionSelections[record.id] === "incomplete" ? " ✓" : ""}
                              </button>
                            </div>
                          ) : null}
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={9} className="px-4 py-4 text-center">
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
