"use client";

import { StudentShell } from "@/components/student-shell";
import { useEffect, useMemo, useState } from "react";
import {
  createFeedback,
  getCurrentProfileWithRetry,
  listFeedbackByIdno,
  listStudentHistory,
} from "@/lib/supabase/data";
import { LabNumber, ProfileRecord, SitInRecord } from "@/lib/supabase/types";
import { isSupabaseConfigured } from "@/lib/supabase/client";

type HistoryRow = {
  id: number;
  idno: string;
  name: string;
  course: string;
  level: string;
  purpose: string;
  lab: string;
  timeIn: string;
  timeOut: string;
  createdAt: string;
  feedbackSubmitted: boolean;
};

type SortOption = "Name A-Z" | "Name Z-A" | "Newest" | "Oldest";

function toHistoryRows(profile: ProfileRecord, records: SitInRecord[], feedbackKeys: Set<string>) {
  const fullName = `${profile.firstname} ${profile.middlename} ${profile.lastname}`.replace(/\s+/g, " ").trim();
  return records.map((record) => ({
    id: record.id,
    idno: record.idno,
    name: fullName,
    course: profile.course,
    level: profile.level,
    purpose: record.purpose,
    lab: record.lab_number,
    timeIn: record.time_in,
    timeOut: record.time_out ?? "—",
    createdAt: `${record.date}T00:00:00`,
    feedbackSubmitted: feedbackKeys.has(`${record.date}|${record.lab_number}|${record.time_in}`),
  }));
}

function detectFlaggedFeedback(text: string) {
  const lowered = text.toLowerCase();
  const blockedWords = ["pisti", "bogo", "yawa", "fuck", "shit"];
  return blockedWords.some((word) => lowered.includes(word));
}

export default function HistoryPage() {
  const [profile, setProfile] = useState<ProfileRecord | null>(null);
  const [rows, setRows] = useState<HistoryRow[]>([]);
  const [entries, setEntries] = useState<"10" | "25" | "all">("10");
  const [search, setSearch] = useState("");
  const [courseFilter, setCourseFilter] = useState("");
  const [levelFilter, setLevelFilter] = useState("");
  const [sort, setSort] = useState<SortOption>("Newest");
  const [sortOpen, setSortOpen] = useState(false);
  const [feedbackRecord, setFeedbackRecord] = useState<HistoryRow | null>(null);
  const [rating, setRating] = useState(5);
  const [feedbackMessage, setFeedbackMessage] = useState("");
  const [feedbackNotice, setFeedbackNotice] = useState("");
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
        setProfile(currentProfile);

        const [records, feedback] = await Promise.all([
          listStudentHistory(currentProfile.idno),
          listFeedbackByIdno(currentProfile.idno),
        ]);
        if (!active) return;

        const feedbackKeys = new Set(
          feedback.map((item) => `${item.date}|${item.lab}|${item.time_in}`),
        );
        setRows(toHistoryRows(currentProfile, records, feedbackKeys));
      } catch (loadError) {
        if (active) {
          setError(loadError instanceof Error ? loadError.message : "Unable to load history.");
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

  const filteredRows = useMemo(() => {
    const lowerSearch = search.toLowerCase();
    const data = rows.filter((row) => {
      const searchMatch =
        row.idno.toLowerCase().includes(lowerSearch) ||
        row.name.toLowerCase().includes(lowerSearch) ||
        row.course.toLowerCase().includes(lowerSearch) ||
        row.purpose.toLowerCase().includes(lowerSearch) ||
        row.lab.toLowerCase().includes(lowerSearch);
      const courseMatch = courseFilter ? row.course === courseFilter : true;
      const levelMatch = levelFilter ? row.level === levelFilter : true;
      return searchMatch && courseMatch && levelMatch;
    });

    data.sort((a, b) => {
      switch (sort) {
        case "Name A-Z":
          return a.name.localeCompare(b.name);
        case "Name Z-A":
          return b.name.localeCompare(a.name);
        case "Oldest":
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        case "Newest":
        default:
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
    });

    return entries === "all" ? data : data.slice(0, Number(entries));
  }, [courseFilter, entries, levelFilter, rows, search, sort]);

  const exportTable = (format: "csv" | "xls" | "pdf") => {
    const headers = ["ID No", "Name", "Course", "Level", "Purpose", "Lab", "Time In", "Time Out", "Created At"];

    if (format === "csv") {
      const csv = [headers.join(","), ...filteredRows.map((row) =>
        [
          row.idno,
          row.name,
          row.course,
          row.level,
          row.purpose,
          row.lab,
          row.timeIn,
          row.timeOut,
          new Date(row.createdAt).toLocaleString(),
        ]
          .map((value) => `"${String(value).replaceAll('"', '""')}"`)
          .join(","),
      )].join("\n");
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "student_records.csv";
      link.click();
      URL.revokeObjectURL(url);
      return;
    }

    if (format === "xls") {
      const table = `
        <table>
          <thead><tr>${headers.map((header) => `<th>${header}</th>`).join("")}</tr></thead>
          <tbody>
            ${filteredRows
              .map(
                (row) => `
                  <tr>
                    <td>${row.idno}</td>
                    <td>${row.name}</td>
                    <td>${row.course}</td>
                    <td>${row.level}</td>
                    <td>${row.purpose}</td>
                    <td>${row.lab}</td>
                    <td>${row.timeIn}</td>
                    <td>${row.timeOut}</td>
                    <td>${new Date(row.createdAt).toLocaleString()}</td>
                  </tr>`,
              )
              .join("")}
          </tbody>
        </table>
      `;
      const blob = new Blob([table], { type: "application/vnd.ms-excel" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "student_records.xls";
      link.click();
      URL.revokeObjectURL(url);
      return;
    }

    const popup = window.open("", "_blank", "width=1000,height=800");
    if (popup) {
      popup.document.write(`
        <html>
          <head>
            <title>Student Records</title>
            <style>
              body { font-family: Arial, sans-serif; padding: 24px; }
              table { width: 100%; border-collapse: collapse; }
              th, td { border: 1px solid #ccc; padding: 8px; text-align: left; }
            </style>
          </head>
          <body>
            <h1>Student Records</h1>
            <table>
              <thead><tr>${headers.map((header) => `<th>${header}</th>`).join("")}</tr></thead>
              <tbody>
                ${filteredRows
                  .map(
                    (row) => `
                      <tr>
                        <td>${row.idno}</td>
                        <td>${row.name}</td>
                        <td>${row.course}</td>
                        <td>${row.level}</td>
                        <td>${row.purpose}</td>
                        <td>${row.lab}</td>
                        <td>${row.timeIn}</td>
                        <td>${row.timeOut}</td>
                        <td>${new Date(row.createdAt).toLocaleString()}</td>
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
    }
  };

  const submitFeedback = async () => {
    if (!feedbackRecord || !profile) {
      return;
    }

    try {
      await createFeedback({
        idno: profile.idno,
        full_name: feedbackRecord.name,
        course: profile.course,
        level: profile.level,
        lab: feedbackRecord.lab as LabNumber,
        date: feedbackRecord.createdAt.slice(0, 10),
        time_in: feedbackRecord.timeIn,
        time_out: feedbackRecord.timeOut === "—" ? feedbackRecord.timeIn : feedbackRecord.timeOut,
        message: feedbackMessage.trim() || "No comment provided.",
        rating: rating as 1 | 2 | 3 | 4 | 5,
        flagged: detectFlaggedFeedback(feedbackMessage),
      });

      setRows((current) =>
        current.map((row) =>
          row.id === feedbackRecord.id ? { ...row, feedbackSubmitted: true } : row,
        ),
      );
      setFeedbackNotice(`Feedback saved for ${feedbackRecord.name}.`);
      setFeedbackRecord(null);
      setRating(5);
      setFeedbackMessage("");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to submit feedback.");
    }
  };

  return (
    <StudentShell title="History">
      {!loading && error ? (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-700">{error}</div>
      ) : null}

      {loading ? (
        <div className="mx-auto max-w-6xl rounded-lg bg-white p-6 shadow">
          <p className="text-center text-gray-600">Loading history...</p>
        </div>
      ) : null}

      {!loading ? (
      <div className="mx-auto max-w-6xl">
        {feedbackNotice ? (
          <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-emerald-700">
            {feedbackNotice}
          </div>
        ) : null}

        <div className="mb-6 flex flex-col gap-3 xl:flex-row xl:flex-wrap xl:items-center">
          <select
            value={entries}
            onChange={(event) => setEntries(event.target.value as "10" | "25" | "all")}
            className="rounded-lg border border-gray-300 px-3 py-2"
          >
            <option value="10">10 entries</option>
            <option value="25">25 entries</option>
            <option value="all">All</option>
          </select>

          <div className="relative flex-1 min-w-[240px]">
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search"
              className="w-full rounded-full border border-gray-300 py-2 pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-violet-500"
            />
            <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          </div>

          <select
            value={courseFilter}
            onChange={(event) => setCourseFilter(event.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-2"
          >
            <option value="">All Courses</option>
            <option value="BSIT">BSIT</option>
            <option value="BSCS">BSCS</option>
            <option value="HM">HM</option>
            <option value="CRIM">CRIM</option>
            <option value="CBA">CBA</option>
          </select>

          <select
            value={levelFilter}
            onChange={(event) => setLevelFilter(event.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-2"
          >
            <option value="">All Levels</option>
            <option value="1">1</option>
            <option value="2">2</option>
            <option value="3">3</option>
            <option value="4">4</option>
          </select>

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
              <div className="absolute right-0 z-10 mt-2 w-36 rounded-lg border border-gray-200 bg-white shadow-lg">
                {(["Name A-Z", "Name Z-A", "Newest", "Oldest"] as SortOption[]).map((option) => (
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

          <div className="flex flex-wrap gap-2 xl:ml-auto">
            <button
              type="button"
              onClick={() => exportTable("csv")}
              className="rounded-lg bg-gray-200 px-4 py-2 hover:bg-gray-300"
            >
              CSV
            </button>
            <button
              type="button"
              onClick={() => exportTable("xls")}
              className="rounded-lg bg-gray-200 px-4 py-2 hover:bg-gray-300"
            >
              Excel
            </button>
            <button
              type="button"
              onClick={() => exportTable("pdf")}
              className="rounded-lg bg-gray-200 px-4 py-2 hover:bg-gray-300"
            >
              PDF
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="rounded-lg bg-gray-200 px-4 py-2 hover:bg-gray-300"
            >
              Print
            </button>
          </div>
        </div>

        <div className="overflow-hidden rounded-lg bg-white shadow">
          <div className="overflow-x-auto">
            <table className="min-w-[1200px] w-full border-collapse">
              <thead className="bg-gray-50">
                <tr>
                  <th className="border-b px-4 py-3 text-left">ID No</th>
                  <th className="border-b px-4 py-3 text-left">Name</th>
                  <th className="border-b px-4 py-3 text-left">Course</th>
                  <th className="border-b px-4 py-3 text-left">Level</th>
                  <th className="border-b px-4 py-3 text-left">Purpose</th>
                  <th className="border-b px-4 py-3 text-left">Lab</th>
                  <th className="border-b px-4 py-3 text-left">Time In</th>
                  <th className="border-b px-4 py-3 text-left">Time Out</th>
                  <th className="border-b px-4 py-3 text-left">Created At</th>
                  <th className="border-b px-4 py-3 text-left">Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row) => (
                  <tr key={row.id} className="hover:bg-gray-50">
                    <td className="border-b px-4 py-3 text-sm">{row.idno}</td>
                    <td className="border-b px-4 py-3 text-sm">{row.name}</td>
                    <td className="border-b px-4 py-3 text-sm">{row.course}</td>
                    <td className="border-b px-4 py-3 text-sm">{row.level}</td>
                    <td className="border-b px-4 py-3 text-sm">{row.purpose}</td>
                    <td className="border-b px-4 py-3 text-sm">{row.lab}</td>
                    <td className="border-b px-4 py-3 text-sm">{row.timeIn}</td>
                    <td className="border-b px-4 py-3 text-sm">{row.timeOut}</td>
                    <td className="border-b px-4 py-3 text-sm">
                      {new Date(row.createdAt).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </td>
                    <td className="border-b px-4 py-3 text-sm">
                      <button
                        type="button"
                        onClick={() => setFeedbackRecord(row)}
                        className={`rounded-md px-3 py-2 text-white ${
                          row.feedbackSubmitted ? "bg-slate-500" : "bg-[#7952b3]"
                        }`}
                      >
                        {row.feedbackSubmitted ? "View Feedback" : "Feedback"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      ) : null}

      {!loading && feedbackRecord ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-xl rounded-lg bg-white p-6 shadow-xl">
            <h3 className="mb-1 text-xl font-semibold">Feedback for {feedbackRecord.name}</h3>
            <p className="mb-4 text-sm text-gray-500">
              {feedbackRecord.purpose} · Lab {feedbackRecord.lab}
            </p>

            <div className="mb-4 flex gap-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating(star)}
                  className={`text-2xl ${rating >= star ? "text-yellow-500" : "text-gray-300"}`}
                >
                  ★
                </button>
              ))}
            </div>

            <textarea
              value={feedbackMessage}
              onChange={(event) => setFeedbackMessage(event.target.value)}
              rows={4}
              placeholder="Write your feedback..."
              className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-500"
            />

            <div className="mt-4 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setFeedbackRecord(null)}
                className="rounded-lg border border-gray-300 px-4 py-2"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void submitFeedback()}
                className="rounded-lg bg-[#7952b3] px-4 py-2 text-white"
              >
                Submit Feedback
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </StudentShell>
  );
}
