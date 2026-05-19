"use client";

import { StudentShell } from "@/components/student-shell";
import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  createReservation,
  getCurrentProfileWithRetry,
  listLabComputers,
  listReservationsByIdno,
} from "@/lib/supabase/data";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { LabComputerRecord, LabNumber, ProfileRecord, ReservationRecord } from "@/lib/supabase/types";
import { labOptions, purposeOptions } from "@/lib/supabase/constants";

type ReservationRow = {
  id: number;
  lab: number;
  pc: number;
  purpose: string;
  date: string;
  timeIn: string;
  status: "Approved" | "Pending" | "Rejected";
  timeInStatus: string;
};

function mapStatus(status: ReservationRecord["status"]): ReservationRow["status"] {
  if (status === "approved" || status === "sit-inned" || status === "completed") return "Approved";
  if (status === "declined") return "Rejected";
  return "Pending";
}

function mapTimeStatus(status: ReservationRecord["status"]) {
  if (status === "completed") return "Completed";
  if (status === "sit-inned") return "In Progress";
  if (status === "approved") return "Approved";
  if (status === "declined") return "N/A";
  return "Pending";
}

export default function ReservationPage() {
  const [profile, setProfile] = useState<ProfileRecord | null>(null);
  const [lab, setLab] = useState<LabNumber>("524");
  const [pc, setPc] = useState("1");
  const [purpose, setPurpose] = useState("C Programming");
  const [otherReason, setOtherReason] = useState("");
  const [reservationDate, setReservationDate] = useState("");
  const [timeIn, setTimeIn] = useState("");
  const [showDialog, setShowDialog] = useState(false);
  const [reservations, setReservations] = useState<ReservationRow[]>([]);
  const [computers, setComputers] = useState<LabComputerRecord[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const availablePurpose = purpose === "Others" ? otherReason.trim() : purpose;

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
        const [reservationRows, labComputers] = await Promise.all([
          listReservationsByIdno(currentProfile.idno),
          listLabComputers(),
        ]);
        if (!active) return;

        setComputers(labComputers);
        setReservations(
          reservationRows.map((row) => ({
            id: row.id,
            lab: Number(row.lab_number),
            pc: row.pc_number,
            purpose: row.purpose,
            date: row.reservation_date,
            timeIn: row.time_in,
            status: mapStatus(row.status),
            timeInStatus: mapTimeStatus(row.status),
          })),
        );
      } catch (loadError) {
        if (active) {
          setError(loadError instanceof Error ? loadError.message : "Unable to load reservations.");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };
    void load();
    const intervalId = window.setInterval(() => {
      void load();
    }, 15000);
    return () => {
      active = false;
      window.clearInterval(intervalId);
    };
  }, []);

  const pcGrid = useMemo(
    () =>
      Array.from({ length: 20 }, (_, index) => {
        const number = index + 1;
        const current = computers.find(
          (item) => item.lab_number === lab && item.pc_number === number,
        );
        const status = current?.status ?? "available";
        const selected = pc === String(number);
        return { number, status, selected };
      }),
    [computers, lab, pc],
  );

  const submitReservation = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!profile) return;
    if (!reservationDate || !timeIn) {
      setError("Reservation date and time in are required.");
      return;
    }
    const selectedPcNumber = Number(pc);
    const selectedPc = computers.find(
      (item) => item.lab_number === lab && item.pc_number === selectedPcNumber,
    );
    if (selectedPc && selectedPc.status !== "available") {
      setError("The selected PC is unavailable. Please choose an available PC.");
      return;
    }
    try {
      setError("");
      const created = await createReservation({
        user_id: profile.id,
        idno: profile.idno,
        full_name: `${profile.firstname} ${profile.middlename} ${profile.lastname}`.replace(/\s+/g, " ").trim(),
        course: profile.course,
        level: profile.level,
        lab_number: lab,
        pc_number: selectedPcNumber,
        reservation_date: reservationDate,
        time_in: timeIn,
        purpose: availablePurpose || "C Programming",
      });

      setReservations((current) => [
        {
          id: created.id,
          lab: Number(created.lab_number),
          pc: created.pc_number,
          purpose: created.purpose,
          date: created.reservation_date,
          timeIn: created.time_in,
          status: mapStatus(created.status),
          timeInStatus: mapTimeStatus(created.status),
        },
        ...current,
      ]);
      setShowDialog(true);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to create reservation.");
    }
  };

  const statusClasses = {
    Approved: "text-emerald-700 bg-emerald-100",
    Pending: "text-amber-700 bg-amber-100",
    Rejected: "text-rose-700 bg-rose-100",
  } as const;

  return (
    <StudentShell title="Reservations">
      {!loading && error ? (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-700">{error}</div>
      ) : null}

      {loading ? (
        <div className="rounded-lg bg-white p-6 shadow">
          <p className="text-center text-gray-600">Loading reservations...</p>
        </div>
      ) : null}

      {!loading ? (
      <div className="space-y-6">
        <div className="rounded-lg bg-[#002044] p-5 text-white shadow">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm uppercase tracking-wide text-blue-200">Session Summary</p>
              <h3 className="text-2xl font-semibold">{profile?.session_remaining ?? 0} sessions left</h3>
            </div>
            <div className="rounded-lg bg-white/10 px-4 py-3 text-sm">
              Use the laboratory status grid to reserve available PCs.
            </div>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <form onSubmit={(event) => void submitReservation(event)} className="rounded-lg bg-white p-6 shadow">
            <h2 className="mb-4 text-lg font-semibold">Create Reservation</h2>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium">Laboratory</label>
                <select
                  value={lab}
                  onChange={(event) => {
                    setLab(event.target.value as LabNumber);
                    setPc("1");
                  }}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2"
                >
                  {labOptions.map((labNumber) => (
                    <option key={labNumber} value={labNumber}>
                      Lab {labNumber}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">PC Number</label>
                <input
                  value={pc}
                  readOnly
                  className="w-full rounded-lg border border-gray-300 bg-gray-50 px-3 py-2"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">Reservation Date</label>
                <input
                  type="date"
                  value={reservationDate}
                  onChange={(event) => setReservationDate(event.target.value)}
                  required
                  className="w-full rounded-lg border border-gray-300 px-3 py-2"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">Time In</label>
                <input
                  type="time"
                  value={timeIn}
                  onChange={(event) => setTimeIn(event.target.value)}
                  required
                  className="w-full rounded-lg border border-gray-300 px-3 py-2"
                />
              </div>
            </div>

            <div className="mt-4">
              <label className="mb-1 block text-sm font-medium">Purpose</label>
              <select
                value={purpose}
                onChange={(event) => setPurpose(event.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2"
              >
                {purposeOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>

            {purpose === "Others" ? (
              <div className="mt-4">
                <label className="mb-1 block text-sm font-medium">Other Reason</label>
                <input
                  value={otherReason}
                  onChange={(event) => setOtherReason(event.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2"
                  placeholder="Specify your purpose"
                />
              </div>
            ) : null}

            <div className="mt-6 flex gap-3">
              <button
                type="submit"
                className="rounded-lg bg-[#7952b3] px-5 py-3 text-white hover:bg-[#68439f]"
              >
                Reserve
              </button>
              <button
                type="button"
                onClick={() => {
                  setLab("524");
                  setPc("1");
                  setPurpose("C Programming");
                  setOtherReason("");
                  setReservationDate("");
                  setTimeIn("");
                }}
                className="rounded-lg border border-gray-300 px-5 py-3"
              >
                Reset
              </button>
            </div>
          </form>

          <div className="rounded-lg bg-white p-6 shadow">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">PC Availability</h2>
              <span className="text-sm text-gray-500">Lab {lab}</span>
            </div>

            <div className="grid grid-cols-5 gap-3">
              {pcGrid.map((item) => (
                <button
                  key={item.number}
                  type="button"
                  onClick={() => item.status === "available" && setPc(String(item.number))}
                  className={`rounded-lg border px-3 py-3 text-sm font-semibold transition ${
                    item.selected
                      ? "border-[#002044] bg-[#002044] text-white"
                      : item.status === "available"
                        ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                        : item.status === "reserved"
                          ? "border-amber-200 bg-amber-50 text-amber-700"
                          : "border-rose-200 bg-rose-50 text-rose-700"
                  }`}
                >
                  {item.number}
                </button>
              ))}
            </div>

            <div className="mt-4 flex flex-wrap gap-3 text-sm">
              <span className="inline-flex items-center gap-2">
                <span className="h-3 w-3 rounded-full bg-emerald-500" />
                Available
              </span>
              <span className="inline-flex items-center gap-2">
                <span className="h-3 w-3 rounded-full bg-amber-500" />
                Reserved
              </span>
              <span className="inline-flex items-center gap-2">
                <span className="h-3 w-3 rounded-full bg-rose-500" />
                Occupied/Unavailable
              </span>
            </div>
          </div>
        </div>

        <div className="rounded-lg bg-white p-6 shadow">
          <h2 className="mb-4 text-lg font-semibold">Reservation List</h2>
          <div className="overflow-x-auto">
            <table className="min-w-[900px] w-full border-collapse">
              <thead className="bg-gray-50">
                <tr>
                  <th className="border-b px-4 py-3 text-left">Lab</th>
                  <th className="border-b px-4 py-3 text-left">PC</th>
                  <th className="border-b px-4 py-3 text-left">Purpose</th>
                  <th className="border-b px-4 py-3 text-left">Date</th>
                  <th className="border-b px-4 py-3 text-left">Time In</th>
                  <th className="border-b px-4 py-3 text-left">Status</th>
                  <th className="border-b px-4 py-3 text-left">Time In Status</th>
                </tr>
              </thead>
              <tbody>
                {reservations.map((row) => (
                  <tr key={row.id} className="hover:bg-gray-50">
                    <td className="border-b px-4 py-3">{row.lab}</td>
                    <td className="border-b px-4 py-3">{row.pc}</td>
                    <td className="border-b px-4 py-3">{row.purpose}</td>
                    <td className="border-b px-4 py-3">
                      {new Date(row.date).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </td>
                    <td className="border-b px-4 py-3">{row.timeIn}</td>
                    <td className="border-b px-4 py-3">
                      <span className={`rounded-full px-3 py-1 text-sm font-semibold ${statusClasses[row.status]}`}>
                        {row.status}
                      </span>
                    </td>
                    <td className="border-b px-4 py-3">{row.timeInStatus}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      ) : null}

      {!loading && showDialog ? (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/30 pt-16">
          <div className="w-[340px] rounded-lg bg-white p-5 text-center shadow-xl">
            <p className="text-lg font-semibold">Reservation created successfully!</p>
            <button
              type="button"
              onClick={() => setShowDialog(false)}
              className="mt-4 rounded-lg bg-[#7952b3] px-4 py-2 text-white"
            >
              OK
            </button>
          </div>
        </div>
      ) : null}
    </StudentShell>
  );
}
