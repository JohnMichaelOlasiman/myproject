"use client";

import { useEffect, useMemo, useState } from "react";
import { AdminShell } from "@/components/admin-shell";
import { labOptions } from "@/lib/supabase/constants";
import { listReservations, updateReservationStatus } from "@/lib/supabase/data";
import { ReservationRecord } from "@/lib/supabase/types";
import { isSupabaseConfigured } from "@/lib/supabase/client";

type TabMode = "pending" | "logs";
type Entries = "5" | "10" | "25" | "50" | "all";

export default function AdminReservationsPage() {
  const [tab, setTab] = useState<TabMode>("pending");
  const [entries, setEntries] = useState<Entries>("all");
  const [search, setSearch] = useState("");
  const [labFilter, setLabFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [sort, setSort] = useState<"name-asc" | "name-desc" | "date-asc" | "date-desc">("date-desc");
  const [reservations, setReservations] = useState<ReservationRecord[]>([]);
  const [filterOpen, setFilterOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    const load = async () => {
      if (!isSupabaseConfigured) {
        setError("Supabase is not configured.");
        return;
      }
      try {
        const rows = await listReservations();
        if (active) {
          setReservations(rows);
        }
      } catch (loadError) {
        if (active) {
          setError(loadError instanceof Error ? loadError.message : "Unable to load reservations.");
        }
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, []);

  const pendingRows = useMemo(
    () => reservations.filter((record) => record.status === "pending"),
    [reservations],
  );
  const logRows = useMemo(
    () => reservations.filter((record) => record.status !== "pending"),
    [reservations],
  );

  const activeRows = tab === "pending" ? pendingRows : logRows;

  const displayedRows = useMemo(() => {
    let rows = activeRows.filter((record) => {
      const haystack = `${record.idno} ${record.full_name} ${record.purpose} ${record.lab_number} ${record.pc_number}`.toLowerCase();
      const matchesSearch = haystack.includes(search.toLowerCase());
      const matchesLab = labFilter ? record.lab_number === labFilter : true;
      const matchesStatus = tab === "logs" && statusFilter ? record.status === statusFilter : true;
      return matchesSearch && matchesLab && matchesStatus;
    });

    rows = rows.sort((a, b) => {
      if (sort === "name-asc") {
        return a.full_name.localeCompare(b.full_name);
      }
      if (sort === "name-desc") {
        return b.full_name.localeCompare(a.full_name);
      }
      if (sort === "date-asc") {
        return new Date(`${a.reservation_date} ${a.time_in}`).getTime() - new Date(`${b.reservation_date} ${b.time_in}`).getTime();
      }
      return new Date(`${b.reservation_date} ${b.time_in}`).getTime() - new Date(`${a.reservation_date} ${a.time_in}`).getTime();
    });

    if (entries !== "all") {
      return rows.slice(0, Number(entries));
    }
    return rows;
  }, [activeRows, entries, labFilter, search, sort, statusFilter, tab]);

  const setReservationStatus = async (reservationId: number, status: ReservationRecord["status"]) => {
    try {
      const updated = await updateReservationStatus(reservationId, status);
      setReservations((current) =>
        current.map((record) =>
          record.id === reservationId ? updated : record,
        ),
      );
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "Unable to update reservation.");
    }
  };

  return (
    <AdminShell title="Reservations">
      {error ? (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-700">{error}</div>
      ) : null}

      <div className="mx-auto w-full max-w-6xl">
        <div className="mb-4 flex border-b">
          <button
            type="button"
            onClick={() => setTab("pending")}
            className={`px-4 py-2 ${
              tab === "pending" ? "border-b-[3px] border-[#002044] font-bold text-[#002044]" : ""
            }`}
          >
            <i className="fas fa-hourglass-half mr-2" />
            Pending
          </button>
          <button
            type="button"
            onClick={() => setTab("logs")}
            className={`px-4 py-2 ${
              tab === "logs" ? "border-b-[3px] border-[#002044] font-bold text-[#002044]" : ""
            }`}
          >
            <i className="fas fa-history mr-2" />
            Logs
          </button>
        </div>

        <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
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
              <option value="all">All</option>
            </select>
          </div>

          <div className="flex flex-wrap items-center gap-4">
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

            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setFilterOpen((open) => !open);
                  setSortOpen(false);
                }}
                className="flex items-center space-x-2 text-gray-600"
              >
                <i className="fas fa-filter" />
                <span>Filter</span>
              </button>
              {filterOpen ? (
                <div className="absolute right-0 z-10 mt-2 w-48 rounded-lg border border-gray-200 bg-white shadow-lg">
                  <div className="p-2">
                    <label className="block text-sm font-medium text-gray-700">Laboratory</label>
                    <select
                      value={labFilter}
                      onChange={(event) => setLabFilter(event.target.value)}
                      className="mt-1 w-full rounded-md border border-gray-300 p-2"
                    >
                      <option value="">All Labs</option>
                      {labOptions.map((lab) => (
                        <option key={lab} value={lab}>
                          {lab}
                        </option>
                      ))}
                    </select>
                  </div>
                  {tab === "logs" ? (
                    <div className="p-2">
                      <label className="block text-sm font-medium text-gray-700">Status</label>
                      <select
                        value={statusFilter}
                        onChange={(event) => setStatusFilter(event.target.value)}
                        className="mt-1 w-full rounded-md border border-gray-300 p-2"
                      >
                        <option value="">All Status</option>
                        <option value="approved">Approved</option>
                        <option value="declined">Declined</option>
                        <option value="sit-inned">Sit-Inned</option>
                        <option value="completed">Completed</option>
                      </select>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>

            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setSortOpen((open) => !open);
                  setFilterOpen(false);
                }}
                className="flex items-center space-x-2 text-gray-600"
              >
                <i className="fas fa-sort" />
                <span>Sort</span>
              </button>
              {sortOpen ? (
                <div className="absolute right-0 z-10 mt-2 w-44 rounded-lg border border-gray-200 bg-white shadow-lg">
                  <button
                    type="button"
                    onClick={() => {
                      setSort("name-asc");
                      setSortOpen(false);
                    }}
                    className="block w-full px-4 py-2 text-left hover:bg-gray-100"
                  >
                    Name (A-Z)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSort("name-desc");
                      setSortOpen(false);
                    }}
                    className="block w-full px-4 py-2 text-left hover:bg-gray-100"
                  >
                    Name (Z-A)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSort("date-asc");
                      setSortOpen(false);
                    }}
                    className="block w-full px-4 py-2 text-left hover:bg-gray-100"
                  >
                    Date (Oldest)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSort("date-desc");
                      setSortOpen(false);
                    }}
                    className="block w-full px-4 py-2 text-left hover:bg-gray-100"
                  >
                    Date (Newest)
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </div>

        <div className="overflow-x-auto rounded-lg shadow-md">
          <table className="min-w-full bg-white">
            <thead>
              <tr className="bg-[#002044] text-white">
                <th className="px-4 py-4 text-center">ID Number</th>
                <th className="px-4 py-4 text-center">Student Name</th>
                <th className="px-4 py-4 text-center">Lab</th>
                <th className="px-4 py-4 text-center">PC</th>
                <th className="px-4 py-4 text-center">Date</th>
                <th className="px-4 py-4 text-center">Time In</th>
                <th className="px-4 py-4 text-center">Purpose</th>
                <th className="px-4 py-4 text-center">{tab === "pending" ? "Actions" : "Status"}</th>
              </tr>
            </thead>
            <tbody>
              {displayedRows.length > 0 ? (
                displayedRows.map((reservation, index) => (
                  <tr key={reservation.id} className={index % 2 === 0 ? "bg-gray-100" : "bg-gray-200"}>
                    <td className="px-4 py-4 text-center">{reservation.idno}</td>
                    <td className="px-4 py-4 text-center">{reservation.full_name}</td>
                    <td className="px-4 py-4 text-center">{reservation.lab_number}</td>
                    <td className="px-4 py-4 text-center">{reservation.pc_number}</td>
                    <td className="px-4 py-4 text-center">
                      {new Date(reservation.reservation_date).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </td>
                    <td className="px-4 py-4 text-center">{reservation.time_in}</td>
                    <td className="px-4 py-4 text-center">{reservation.purpose}</td>
                    <td className="px-4 py-4 text-center">
                      {tab === "pending" ? (
                        <div className="flex justify-center space-x-2">
                          <button
                            type="button"
                            onClick={() => void setReservationStatus(reservation.id, "approved")}
                            className="rounded bg-blue-500 px-4 py-2 text-white"
                          >
                            Approve
                          </button>
                          <button
                            type="button"
                            onClick={() => void setReservationStatus(reservation.id, "declined")}
                            className="rounded bg-red-500 px-4 py-2 text-white"
                          >
                            Decline
                          </button>
                        </div>
                      ) : (
                        <span
                          className={`rounded-full px-3 py-1 text-sm font-semibold ${
                            reservation.status === "approved"
                              ? "bg-emerald-100 text-emerald-700"
                              : reservation.status === "declined"
                                ? "bg-rose-100 text-rose-700"
                                : reservation.status === "sit-inned"
                                  ? "bg-blue-100 text-blue-700"
                                  : "bg-gray-100 text-gray-700"
                          }`}
                        >
                          {reservation.status}
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} className="px-4 py-4 text-center">
                    {tab === "pending" ? "No pending reservations." : "No reservation logs found."}
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
