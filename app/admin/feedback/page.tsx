"use client";

import { useEffect, useMemo, useState } from "react";
import { AdminShell } from "@/components/admin-shell";
import { listFeedback } from "@/lib/supabase/data";
import { FeedbackRecord } from "@/lib/supabase/types";
import { isSupabaseConfigured } from "@/lib/supabase/client";

type Entries = "all" | "5" | "10" | "25" | "50";
type SortMode = "az" | "za" | "newest" | "oldest";

function stars(rating: number) {
  return Array.from({ length: 5 }, (_, index) => (index < rating ? "★" : "☆")).join("");
}

function csv(feedback: FeedbackRecord[]) {
  const headers = ["ID NUMBER", "FULL NAME", "COURSE", "LAB", "DATE", "TIME IN", "TIME OUT", "MESSAGE", "RATING"];
  const rows = feedback.map((item) => [
    item.idno,
    item.full_name,
    `${item.course} ${item.level}`,
    item.lab,
    item.date,
    item.time_in,
    item.time_out,
    item.message,
    String(item.rating),
  ]);
  return [headers, ...rows]
    .map((line) => line.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(","))
    .join("\n");
}

export default function AdminFeedbackPage() {
  const [records, setRecords] = useState<FeedbackRecord[]>([]);
  const [entries, setEntries] = useState<Entries>("all");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortMode>("newest");
  const [sortOpen, setSortOpen] = useState(false);
  const [overlay, setOverlay] = useState<FeedbackRecord | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    const load = async () => {
      if (!isSupabaseConfigured) {
        setError("Supabase is not configured.");
        return;
      }
      try {
        const rows = await listFeedback();
        if (active) setRecords(rows);
      } catch (loadError) {
        if (active) {
          setError(loadError instanceof Error ? loadError.message : "Unable to load feedback.");
        }
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, []);

  const displayed = useMemo(() => {
    let items = records.filter((item) => {
      const haystack = `${item.idno} ${item.full_name} ${item.message} ${item.lab}`.toLowerCase();
      return haystack.includes(search.toLowerCase());
    });

    items = items.sort((a, b) => {
      if (sort === "az") return a.full_name.localeCompare(b.full_name);
      if (sort === "za") return b.full_name.localeCompare(a.full_name);
      if (sort === "oldest") return new Date(a.date).getTime() - new Date(b.date).getTime();
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    });

    if (entries !== "all") {
      items = items.slice(0, Number(entries));
    }

    return items;
  }, [records, search, sort, entries]);

  const exportCSV = () => {
    const blob = new Blob([csv(displayed)], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "feedback_report.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  const exportExcel = () => {
    const table = `
      <table>
        <thead><tr><th>ID NUMBER</th><th>FULL NAME</th><th>COURSE</th><th>LAB</th><th>DATE</th><th>TIME IN</th><th>TIME OUT</th><th>MESSAGE</th><th>RATING</th></tr></thead>
        <tbody>
          ${displayed
            .map(
              (item) => `
              <tr>
                <td>${item.idno}</td>
                <td>${item.full_name}</td>
                <td>${item.course} ${item.level}</td>
                <td>${item.lab}</td>
                <td>${item.date}</td>
                <td>${item.time_in}</td>
                <td>${item.time_out}</td>
                <td>${item.message}</td>
                <td>${item.rating}</td>
              </tr>`,
            )
            .join("")}
        </tbody>
      </table>`;
    const blob = new Blob([table], { type: "application/vnd.ms-excel" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "feedback_report.xls";
    link.click();
    URL.revokeObjectURL(url);
  };

  const exportPDF = () => {
    const popup = window.open("", "_blank", "width=1000,height=800");
    if (!popup) return;
    popup.document.write(`
      <html>
        <head>
          <title>Feedback Report</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 24px; }
            table { width: 100%; border-collapse: collapse; }
            th, td { border: 1px solid #ccc; padding: 8px; text-align: left; }
          </style>
        </head>
        <body>
          <h2>Feedback Report</h2>
          <table>
            <thead><tr><th>ID NUMBER</th><th>FULL NAME</th><th>COURSE</th><th>LAB</th><th>DATE</th><th>TIME IN</th><th>TIME OUT</th><th>MESSAGE</th><th>RATING</th></tr></thead>
            <tbody>
              ${displayed
                .map(
                  (item) => `
                  <tr>
                    <td>${item.idno}</td>
                    <td>${item.full_name}</td>
                    <td>${item.course} ${item.level}</td>
                    <td>${item.lab}</td>
                    <td>${item.date}</td>
                    <td>${item.time_in}</td>
                    <td>${item.time_out}</td>
                    <td>${item.message}</td>
                    <td>${item.rating}</td>
                  </tr>`,
                )
                .join("")}
            </tbody>
          </table>
        </body>
      </html>
    `);
    popup.document.close();
    popup.focus();
    popup.print();
  };

  return (
    <AdminShell title="Feedback Report">
      {error ? (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-700">{error}</div>
      ) : null}

      <div className="mx-auto w-full max-w-6xl">
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
              <option value="all">All</option>
              <option value="5">5</option>
              <option value="10">10</option>
              <option value="25">25</option>
              <option value="50">50</option>
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
                onClick={() => setSortOpen((open) => !open)}
                className="flex items-center gap-2 text-gray-600"
              >
                <i className="fas fa-sort" />
                <span>Sort</span>
              </button>
              {sortOpen ? (
                <div className="absolute right-0 z-10 mt-2 w-32 rounded-lg border border-gray-200 bg-white shadow-lg">
                  <button
                    type="button"
                    onClick={() => {
                      setSort("az");
                      setSortOpen(false);
                    }}
                    className="block w-full px-4 py-2 text-left hover:bg-gray-100"
                  >
                    A-Z
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSort("za");
                      setSortOpen(false);
                    }}
                    className="block w-full px-4 py-2 text-left hover:bg-gray-100"
                  >
                    Z-A
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSort("newest");
                      setSortOpen(false);
                    }}
                    className="block w-full px-4 py-2 text-left hover:bg-gray-100"
                  >
                    Newest
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSort("oldest");
                      setSortOpen(false);
                    }}
                    className="block w-full px-4 py-2 text-left hover:bg-gray-100"
                  >
                    Oldest
                  </button>
                </div>
              ) : null}
            </div>

            <button
              type="button"
              onClick={exportCSV}
              className="flex items-center gap-2 rounded-md bg-[#002044] px-4 py-2 text-white"
            >
              <i className="fas fa-file-csv" />
              <span>CSV</span>
            </button>
            <button
              type="button"
              onClick={exportExcel}
              className="flex items-center gap-2 rounded-md bg-[#002044] px-4 py-2 text-white"
            >
              <i className="fas fa-file-excel" />
              <span>Excel</span>
            </button>
            <button
              type="button"
              onClick={exportPDF}
              className="flex items-center gap-2 rounded-md bg-[#002044] px-4 py-2 text-white"
            >
              <i className="fas fa-file-pdf" />
              <span>PDF</span>
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="flex items-center gap-2 rounded-md bg-[#002044] px-4 py-2 text-white"
            >
              <i className="fas fa-print" />
              <span>Print</span>
            </button>
          </div>
        </div>

        <div className="overflow-x-auto rounded-lg shadow-md">
          <table className="min-w-full bg-white">
            <thead>
              <tr className="bg-[#002044] text-white">
                <th className="px-4 py-4 text-center">ID NUMBER</th>
                <th className="px-4 py-4 text-center">FULL NAME</th>
                <th className="px-4 py-4 text-center">LABORATORY</th>
                <th className="px-4 py-4 text-center">DATE</th>
                <th className="px-4 py-4 text-center">MESSAGE</th>
                <th className="px-4 py-4 text-center">RATING</th>
              </tr>
            </thead>
            <tbody>
              {displayed.length > 0 ? (
                displayed.map((item, index) => (
                  <tr
                    key={item.id}
                    className={`${item.flagged ? "text-red-500" : ""} ${index % 2 === 0 ? "bg-gray-100" : "bg-gray-200"} cursor-pointer`}
                    onClick={() => setOverlay(item)}
                  >
                    <td className="px-4 py-4 text-center font-semibold">{item.idno}</td>
                    <td className="px-4 py-4 text-center">{item.full_name}</td>
                    <td className="px-4 py-4 text-center">{item.lab}</td>
                    <td className="px-4 py-4 text-center">{item.date}</td>
                    <td className="max-w-[300px] truncate px-4 py-4 text-center">{item.message}</td>
                    <td className="px-4 py-4 text-center text-yellow-500">{stars(item.rating)}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="px-4 py-4 text-center">
                    No feedback found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {overlay ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="relative w-full max-w-2xl rounded-lg bg-white p-6">
            <button
              type="button"
              onClick={() => setOverlay(null)}
              className="absolute right-4 top-4 text-xl text-gray-600"
            >
              &times;
            </button>
            <h3 className="mb-4 text-xl font-bold">Feedback Details</h3>
            <div className="grid gap-2 text-sm sm:grid-cols-2">
              <p>
                <strong>ID Number:</strong> {overlay.idno}
              </p>
              <p>
                <strong>Full Name:</strong> {overlay.full_name}
              </p>
              <p>
                <strong>Course:</strong> {overlay.course} {overlay.level}
              </p>
              <p>
                <strong>Laboratory:</strong> {overlay.lab}
              </p>
              <p>
                <strong>Date:</strong> {overlay.date}
              </p>
              <p>
                <strong>Time In / Out:</strong> {overlay.time_in} - {overlay.time_out}
              </p>
            </div>
            <div className="mt-4">
              <p className="mb-1 font-semibold">Message:</p>
              <p className="rounded-md bg-gray-50 p-3 text-gray-700">{overlay.message}</p>
            </div>
            <div className="mt-4">
              <p className="font-semibold">Rating: <span className="text-yellow-500">{stars(overlay.rating)}</span></p>
            </div>
          </div>
        </div>
      ) : null}
    </AdminShell>
  );
}
