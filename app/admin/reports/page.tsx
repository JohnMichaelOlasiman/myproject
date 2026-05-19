"use client";

import { useEffect, useMemo, useState } from "react";
import { AdminShell } from "@/components/admin-shell";
import { labOptions, purposeOptions } from "@/lib/supabase/constants";
import { listSitInRecords } from "@/lib/supabase/data";
import { SitInRecord } from "@/lib/supabase/types";
import { isSupabaseConfigured } from "@/lib/supabase/client";

type Entries = "all" | "5" | "10" | "25" | "50";

function csv(rows: SitInRecord[]) {
  const headers = ["ID NUMBER", "NAME", "PURPOSE", "LAB", "LOGIN", "LOGOUT", "DATE"];
  const data = rows.map((item) => [
    item.idno,
    item.full_name,
    item.purpose,
    item.lab_number,
    item.time_in,
    item.time_out ?? "—",
    item.date,
  ]);
  return [headers, ...data]
    .map((line) => line.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(","))
    .join("\n");
}

export default function AdminReportsPage() {
  const [records, setRecords] = useState<SitInRecord[]>([]);
  const [entries, setEntries] = useState<Entries>("all");
  const [search, setSearch] = useState("");
  const [purposeFilter, setPurposeFilter] = useState("");
  const [labFilter, setLabFilter] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
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
          setError(loadError instanceof Error ? loadError.message : "Unable to load reports.");
        }
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, []);

  const displayed = useMemo(() => {
    let rows = records.filter((record) => {
      const haystack = `${record.idno} ${record.full_name} ${record.purpose} ${record.lab_number}`.toLowerCase();
      const matchesSearch = haystack.includes(search.toLowerCase());
      const matchesPurpose = purposeFilter ? record.purpose === purposeFilter : true;
      const matchesLab = labFilter ? record.lab_number === labFilter : true;
      const matchesFrom = fromDate ? record.date >= fromDate : true;
      const matchesTo = toDate ? record.date <= toDate : true;
      return matchesSearch && matchesPurpose && matchesLab && matchesFrom && matchesTo;
    });

    if (entries !== "all") {
      rows = rows.slice(0, Number(entries));
    }
    return rows;
  }, [entries, fromDate, labFilter, purposeFilter, records, search, toDate]);

  const exportCsv = () => {
    const blob = new Blob([csv(displayed)], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "sitin_report.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  const exportExcel = () => {
    const table = `
      <table>
        <thead><tr><th>ID NUMBER</th><th>NAME</th><th>PURPOSE</th><th>LAB</th><th>LOGIN</th><th>LOGOUT</th><th>DATE</th></tr></thead>
        <tbody>
          ${displayed
            .map(
              (record) => `
              <tr>
                <td>${record.idno}</td>
                <td>${record.full_name}</td>
                <td>${record.purpose}</td>
                <td>${record.lab_number}</td>
                <td>${record.time_in}</td>
                <td>${record.time_out ?? "—"}</td>
                <td>${record.date}</td>
              </tr>`,
            )
            .join("")}
        </tbody>
      </table>`;
    const blob = new Blob([table], { type: "application/vnd.ms-excel" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "sitin_report.xls";
    link.click();
    URL.revokeObjectURL(url);
  };

  const exportPDF = () => {
    const popup = window.open("", "_blank", "width=1000,height=800");
    if (!popup) return;
    popup.document.write(`
      <html>
        <head>
          <title>Generate Report</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 24px; }
            table { width: 100%; border-collapse: collapse; }
            th, td { border: 1px solid #ccc; padding: 8px; text-align: left; }
          </style>
        </head>
        <body>
          <h2>Generate Report</h2>
          <table>
            <thead><tr><th>ID NUMBER</th><th>NAME</th><th>PURPOSE</th><th>LAB</th><th>LOGIN</th><th>LOGOUT</th><th>DATE</th></tr></thead>
            <tbody>
              ${displayed
                .map(
                  (record) => `
                  <tr>
                    <td>${record.idno}</td>
                    <td>${record.full_name}</td>
                    <td>${record.purpose}</td>
                    <td>${record.lab_number}</td>
                    <td>${record.time_in}</td>
                    <td>${record.time_out ?? "—"}</td>
                    <td>${record.date}</td>
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
    <AdminShell title="Generate Report">
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

        <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2 rounded-md bg-white p-2 shadow">
            <i className="fas fa-calendar-alt text-[#002044]" />
            <input
              type="date"
              value={fromDate}
              onChange={(event) => setFromDate(event.target.value)}
              className="rounded-md border border-gray-300 p-2"
            />
            <span className="text-gray-500">to</span>
            <input
              type="date"
              value={toDate}
              onChange={(event) => setToDate(event.target.value)}
              className="rounded-md border border-gray-300 p-2"
            />
            <button
              type="button"
              onClick={() => {
                setFromDate("");
                setToDate("");
              }}
              className="text-sm font-medium text-red-600 hover:text-red-800"
            >
              Clear Dates
            </button>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={exportCsv}
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
                <th className="px-4 py-4 text-center">NAME</th>
                <th className="px-4 py-4 text-center">PURPOSE</th>
                <th className="px-4 py-4 text-center">LAB</th>
                <th className="px-4 py-4 text-center">LOGIN</th>
                <th className="px-4 py-4 text-center">LOGOUT</th>
                <th className="px-4 py-4 text-center">DATE</th>
              </tr>
            </thead>
            <tbody>
              {displayed.length > 0 ? (
                displayed.map((record, index) => (
                  <tr key={record.id} className={index % 2 === 0 ? "bg-gray-100" : "bg-gray-200"}>
                    <td className="px-4 py-4 text-center font-semibold">{record.idno}</td>
                    <td className="px-4 py-4 text-center">{record.full_name}</td>
                    <td className="px-4 py-4 text-center">{record.purpose}</td>
                    <td className="px-4 py-4 text-center">{record.lab_number}</td>
                    <td className="px-4 py-4 text-center">{record.time_in}</td>
                    <td className="px-4 py-4 text-center">{record.time_out ?? "—"}</td>
                    <td className="px-4 py-4 text-center">{record.date}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="px-4 py-4 text-center">
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
