"use client";

import { FormEvent, Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AdminShell } from "@/components/admin-shell";
import { createSitInRecord, listSitInRecords, searchStudents } from "@/lib/supabase/data";
import { LabNumber, ProfileRecord } from "@/lib/supabase/types";
import { labOptions, purposeOptions } from "@/lib/supabase/constants";
import { isSupabaseConfigured } from "@/lib/supabase/client";

type SitInForm = {
  idno: string;
  fullName: string;
  labNumber: LabNumber | "";
  purpose: string;
  otherReason: string;
  session: number;
};

const emptySitIn: SitInForm = {
  idno: "",
  fullName: "",
  labNumber: "",
  purpose: "",
  otherReason: "",
  session: 0,
};

function AdminSearchResultsContent() {
  const params = useSearchParams();
  const query = (params.get("query") ?? "").trim();
  const [results, setResults] = useState<ProfileRecord[]>([]);
  const [activeSitIns, setActiveSitIns] = useState<string[]>([]);
  const [overlay, setOverlay] = useState(false);
  const [form, setForm] = useState<SitInForm>(emptySitIn);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    const load = async () => {
      if (!query) {
        setResults([]);
        return;
      }
      if (!isSupabaseConfigured) {
        setError("Supabase is not configured.");
        return;
      }
      try {
        const [students, sitIns] = await Promise.all([searchStudents(query), listSitInRecords("Sit-in")]);
        if (!active) return;
        setResults(students);
        setActiveSitIns(sitIns.map((item) => item.idno));
      } catch (loadError) {
        if (active) {
          setError(loadError instanceof Error ? loadError.message : "Unable to load search results.");
        }
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, [query]);

  const openSitIn = (student: ProfileRecord) => {
    setForm({
      idno: student.idno,
      fullName: `${student.firstname} ${student.middlename} ${student.lastname}`.replace(/\s+/g, " ").trim(),
      labNumber: "",
      purpose: "",
      otherReason: "",
      session: student.session_remaining,
    });
    setOverlay(true);
  };

  const saveSitIn = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!form.labNumber || !form.purpose) {
      return;
    }
    const selectedPurpose = form.purpose === "Others" ? form.otherReason.trim() || "Others" : form.purpose;
    try {
      await createSitInRecord({
        idno: form.idno,
        full_name: form.fullName,
        lab_number: form.labNumber,
        purpose: selectedPurpose,
        time_in: new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
        date: new Date().toISOString().slice(0, 10),
        session_remaining: form.session,
      });
      setActiveSitIns((current) => [...current, form.idno]);
      setOverlay(false);
      setForm(emptySitIn);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to create sit-in record.");
    }
  };

  const rendered = useMemo(() => results, [results]);

  return (
    <AdminShell title="Search Results" initialSearch={query}>
      {error ? (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-700">{error}</div>
      ) : null}

      <div className="mx-auto w-full max-w-6xl">
        {rendered.length > 0 ? (
          <div className="overflow-x-auto rounded-lg shadow-md">
            <table className="min-w-full bg-white">
              <thead>
                <tr className="bg-[#002044] text-white">
                  <th className="px-4 py-4 text-center">ID NUMBER</th>
                  <th className="px-4 py-4 text-center">FULL NAME</th>
                  <th className="px-4 py-4 text-center">COURSE</th>
                  <th className="px-4 py-4 text-center">LEVEL</th>
                  <th className="px-4 py-4 text-center">EMAIL</th>
                  <th className="px-4 py-4 text-center">SESSION</th>
                  <th className="px-4 py-4 text-center">ACTION</th>
                </tr>
              </thead>
              <tbody>
                {rendered.map((student, index) => {
                  const isSitInned = activeSitIns.includes(student.idno);
                  return (
                    <tr key={student.id} className={index % 2 === 0 ? "bg-gray-100" : "bg-gray-200"}>
                      <td className="px-4 py-4 text-center text-black">{student.idno}</td>
                      <td className="px-4 py-4 text-center">
                        {student.firstname} {student.middlename} {student.lastname}
                      </td>
                      <td className="px-4 py-4 text-center text-black">{student.course}</td>
                      <td className="px-4 py-4 text-center text-black">{student.level}</td>
                      <td className="px-4 py-4 text-center text-black">{student.email}</td>
                      <td className="px-4 py-4 text-center text-black">{student.session_remaining}</td>
                      <td className="px-4 py-4 text-center">
                        {isSitInned ? (
                          <button type="button" className="rounded bg-gray-500 px-4 py-2 text-white">
                            Currently Sit-In
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => openSitIn(student)}
                            className="rounded bg-blue-500 px-4 py-2 text-white"
                          >
                            Sit-In
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="rounded-lg bg-white p-6 text-center text-red-500 shadow">
            {query ? "No results found." : "Enter a query in the search bar to find students."}
          </p>
        )}
      </div>

      {overlay ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-lg bg-white p-6">
            <h3 className="mb-4 text-xl font-bold">SIT-IN</h3>
            <form onSubmit={(event) => void saveSitIn(event)} className="space-y-3">
              <div>
                <label className="font-semibold">ID No:</label>
                <input
                  value={form.idno}
                  readOnly
                  className="w-full rounded border bg-gray-200 px-3 py-2"
                />
              </div>
              <div>
                <label className="font-semibold">Student Name:</label>
                <input
                  value={form.fullName}
                  readOnly
                  className="w-full rounded border bg-gray-200 px-3 py-2"
                />
              </div>
              <div>
                <label className="font-semibold">Lab:</label>
                <select
                  value={form.labNumber}
                  onChange={(event) => setForm((current) => ({ ...current, labNumber: event.target.value as LabNumber }))}
                  className="w-full rounded border bg-white px-3 py-2"
                  required
                >
                  <option value="" disabled>
                    Select Lab
                  </option>
                  {labOptions.map((lab) => (
                    <option key={lab} value={lab}>
                      {lab}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="font-semibold">Purpose:</label>
                <select
                  value={form.purpose}
                  onChange={(event) => setForm((current) => ({ ...current, purpose: event.target.value }))}
                  className="w-full rounded border bg-white px-3 py-2"
                  required
                >
                  <option value="" disabled>
                    Select Purpose
                  </option>
                  {purposeOptions.map((purpose) => (
                    <option key={purpose} value={purpose}>
                      {purpose}
                    </option>
                  ))}
                </select>
              </div>
              {form.purpose === "Others" ? (
                <div>
                  <label className="font-semibold">Specify Purpose:</label>
                  <input
                    value={form.otherReason}
                    onChange={(event) => setForm((current) => ({ ...current, otherReason: event.target.value }))}
                    className="w-full rounded border bg-white px-3 py-2"
                  />
                </div>
              ) : null}
              <div>
                <label className="font-semibold">Remaining Sessions:</label>
                <input
                  value={form.session}
                  readOnly
                  className="w-full rounded border bg-gray-200 px-3 py-2"
                />
              </div>

              <div className="mt-6 flex justify-center gap-6">
                <button
                  type="button"
                  onClick={() => setOverlay(false)}
                  className="h-12 w-40 rounded-lg border border-red-700 font-semibold text-red-700"
                >
                  Cancel
                </button>
                <button type="submit" className="h-12 w-40 rounded-lg bg-purple-700 font-semibold text-white">
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </AdminShell>
  );
}

export default function AdminSearchResultsPage() {
  return (
    <Suspense
      fallback={
        <AdminShell title="Search Results">
          <p className="rounded-lg bg-white p-6 text-center text-gray-700 shadow">Loading results...</p>
        </AdminShell>
      }
    >
      <AdminSearchResultsContent />
    </Suspense>
  );
}
