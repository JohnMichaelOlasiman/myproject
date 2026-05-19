"use client";

import { StudentShell } from "@/components/student-shell";
import { useEffect, useMemo, useState } from "react";
import { listLabSchedules } from "@/lib/supabase/data";
import { LabNumber, LabScheduleRecord } from "@/lib/supabase/types";
import { labOptions } from "@/lib/supabase/constants";
import { isSupabaseConfigured } from "@/lib/supabase/client";

const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;

function generateTimeSlots() {
  const slots: string[] = [];
  const start = new Date("2000-01-01T07:30:00");
  const end = new Date("2000-01-01T20:00:00");
  const current = new Date(start);

  while (current <= end) {
    slots.push(
      current.toLocaleTimeString([], {
        hour: "numeric",
        minute: "2-digit",
      }),
    );
    current.setMinutes(current.getMinutes() + 30);
  }

  return slots;
}

function toHHMM(displayTime: string) {
  const date = new Date(`2000-01-01 ${displayTime}`);
  const hour = String(date.getHours()).padStart(2, "0");
  const minute = String(date.getMinutes()).padStart(2, "0");
  return `${hour}:${minute}`;
}

const timeSlots = generateTimeSlots();

export default function LabPage() {
  const [currentLab, setCurrentLab] = useState<LabNumber>("524");
  const [schedules, setSchedules] = useState<LabScheduleRecord[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    const load = async () => {
      if (!isSupabaseConfigured) {
        setError("Supabase is not configured.");
        return;
      }
      try {
        const rows = await listLabSchedules();
        if (active) {
          setSchedules(rows);
        }
      } catch (loadError) {
        if (active) {
          setError(loadError instanceof Error ? loadError.message : "Unable to load lab schedules.");
        }
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, []);

  const slots = useMemo(() => timeSlots, []);

  const resolveStatus = (day: string, slot: string) => {
    const current = toHHMM(slot);
    const matching = schedules.find(
      (item) =>
        item.lab_number === currentLab &&
        item.day === day &&
        current >= item.start_time &&
        current < item.end_time,
    );

    if (!matching) {
      return { status: "available", notes: "" };
    }
    return {
      status: matching.status === "available" ? "available" : "unavailable",
      notes: matching.notes,
    };
  };

  return (
    <StudentShell title="Lab Schedule">
      {error ? (
        <div className="mx-auto mb-4 w-full max-w-6xl rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-700">{error}</div>
      ) : null}

      <div className="mx-auto w-full max-w-6xl rounded-lg bg-white p-6 shadow">
        <h2 className="mb-3 text-lg font-semibold">Select Laboratory:</h2>
        <div className="mb-6 flex flex-wrap gap-3 border-b border-gray-200 pb-3">
          {labOptions.map((lab) => (
            <button
              key={lab}
              type="button"
              onClick={() => setCurrentLab(lab)}
              className={`rounded-md px-4 py-2 text-sm font-medium transition ${
                currentLab === lab
                  ? "border-b-2 border-[#002044] text-[#002044]"
                  : "text-gray-600 hover:bg-gray-100"
              }`}
            >
              Lab {lab}
            </button>
          ))}
        </div>

        <h2 className="mb-3 text-lg font-semibold">Schedule for Lab {currentLab}</h2>
        <div className="max-h-[70vh] overflow-auto rounded-lg border border-gray-200">
          <table className="min-w-[960px] w-full border-separate border-spacing-0">
            <thead className="sticky top-0 z-10 bg-gray-50">
              <tr>
                <th className="sticky left-0 bg-gray-50 px-4 py-3 text-left">Time</th>
                {days.map((day) => (
                  <th key={day} className="px-4 py-3 text-center">
                    {day}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {slots.map((slot) => (
                <tr key={slot} className="hover:bg-gray-50">
                  <td className="sticky left-0 bg-white px-4 py-3 text-sm">
                    {slot}
                  </td>
                  {days.map((day) => {
                    const { status, notes } = resolveStatus(day, slot);
                    const statusClasses =
                      status === "available"
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-rose-100 text-rose-700";

                    return (
                      <td key={day} className="px-4 py-3">
                        <div
                          className={`rounded-md px-3 py-2 text-center text-sm font-medium ${statusClasses}`}
                          title={notes}
                        >
                          {status.charAt(0).toUpperCase() + status.slice(1)}
                          {notes ? <i className="fas fa-info-circle ml-1 text-xs" /> : null}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </StudentShell>
  );
}
