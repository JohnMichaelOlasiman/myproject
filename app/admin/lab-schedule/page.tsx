"use client";

import { useEffect, useMemo, useState } from "react";
import { AdminShell } from "@/components/admin-shell";
import { labOptions } from "@/lib/supabase/constants";
import {
  listLabComputers,
  listLabSchedules,
  upsertLabComputerStatuses,
  upsertLabSchedule,
} from "@/lib/supabase/data";
import { LabComputerRecord, LabNumber, LabScheduleRecord } from "@/lib/supabase/types";
import { isSupabaseConfigured } from "@/lib/supabase/client";

type PcStatus = "available" | "unavailable";
type MainTab = "pc" | "schedule";
const daysOfWeek = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;
type DayOfWeek = (typeof daysOfWeek)[number];

function parseTime(time: string) {
  const [hour, minute] = time.split(":").map(Number);
  return hour * 60 + minute;
}

function timeLabel(hour24: number, minute: number) {
  const date = new Date();
  date.setHours(hour24, minute, 0, 0);
  return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

export default function AdminLabSchedulePage() {
  const [tab, setTab] = useState<MainTab>("pc");
  const [currentLab, setCurrentLab] = useState<LabNumber>("524");
  const [currentDay, setCurrentDay] = useState<DayOfWeek>("Monday");
  const [pcs, setPcs] = useState<LabComputerRecord[]>([]);
  const [schedules, setSchedules] = useState<LabScheduleRecord[]>([]);
  const [startTime, setStartTime] = useState("07:30");
  const [endTime, setEndTime] = useState("10:00");
  const [status, setStatus] = useState<PcStatus>("unavailable");
  const [notes, setNotes] = useState("");
  const [bulkSelection, setBulkSelection] = useState("");
  const [bulkStatus, setBulkStatus] = useState<PcStatus>("unavailable");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    const load = async () => {
      if (!isSupabaseConfigured) {
        setError("Supabase is not configured.");
        return;
      }
      try {
        const [computerRows, scheduleRows] = await Promise.all([listLabComputers(), listLabSchedules()]);
        if (active) {
          setPcs(computerRows);
          setSchedules(scheduleRows);
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

  const currentPcs = useMemo(
    () =>
      Array.from({ length: 30 }, (_, index) => {
        const pcNumber = index + 1;
        const found = pcs.find((item) => item.lab_number === currentLab && item.pc_number === pcNumber);
        return {
          pcNumber,
          status: found?.status === "unavailable" ? "unavailable" : "available",
        };
      }),
    [pcs, currentLab],
  );
  const daySchedules = schedules.filter((slot) => slot.day === currentDay && slot.lab_number === currentLab);

  const timeSlots = useMemo(
    () =>
      Array.from({ length: 26 }, (_, index) => {
        const base = parseTime("07:30") + index * 30;
        const startHour = Math.floor(base / 60);
        const startMinute = base % 60;
        const endMinutes = base + 30;
        const endHour = Math.floor(endMinutes / 60);
        const endMinute = endMinutes % 60;
        const start = `${String(startHour).padStart(2, "0")}:${String(startMinute).padStart(2, "0")}`;
        const end = `${String(endHour).padStart(2, "0")}:${String(endMinute).padStart(2, "0")}`;

        const matched = daySchedules.find((schedule) => start >= schedule.start_time && end <= schedule.end_time);
        return {
          start,
          end,
          status: matched?.status ?? "available",
          notes: matched?.notes ?? "",
        };
      }),
    [daySchedules],
  );

  const updatePcStatus = async (pcNumber: number, nextStatus: PcStatus) => {
    try {
      await upsertLabComputerStatuses([{ lab_number: currentLab, pc_number: pcNumber, status: nextStatus }]);
      setPcs((current) => {
        const existing = current.find((item) => item.lab_number === currentLab && item.pc_number === pcNumber);
        if (existing) {
          return current.map((item) =>
            item.lab_number === currentLab && item.pc_number === pcNumber
              ? { ...item, status: nextStatus, updated_at: new Date().toISOString() }
              : item,
          );
        }
        return [
          ...current,
          {
            id: Date.now(),
            lab_number: currentLab,
            pc_number: pcNumber,
            status: nextStatus,
            updated_at: new Date().toISOString(),
          },
        ];
      });
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "Unable to update PC status.");
    }
  };

  const applyBulkStatus = async () => {
    const numbers = bulkSelection
      .split(",")
      .map((value) => Number(value.trim()))
      .filter((value) => Number.isInteger(value) && value > 0);

    if (numbers.length === 0) {
      return;
    }

    try {
      await upsertLabComputerStatuses(
        numbers.map((pcNumber) => ({
          lab_number: currentLab,
          pc_number: pcNumber,
          status: bulkStatus,
        })),
      );
      const fresh = await listLabComputers();
      setPcs(fresh);
      setBulkSelection("");
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "Unable to apply bulk status.");
    }
  };

  const saveSchedule = async () => {
    if (parseTime(endTime) <= parseTime(startTime)) {
      return;
    }
    try {
      const existing = schedules.find(
        (item) =>
          item.lab_number === currentLab &&
          item.day === currentDay &&
          item.start_time === startTime &&
          item.end_time === endTime,
      );

      const saved = await upsertLabSchedule({
        id: existing?.id,
        lab_number: currentLab,
        day: currentDay,
        start_time: startTime,
        end_time: endTime,
        status,
        notes,
      });

      setSchedules((current) => {
        if (existing) {
          return current.map((item) => (item.id === existing.id ? saved : item));
        }
        return [...current, saved];
      });
      setNotes("");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save schedule.");
    }
  };

  return (
    <AdminShell title="Lab Schedule">
      {error ? (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-700">{error}</div>
      ) : null}

      <div className="mx-auto w-full max-w-6xl">
        <div className="mb-6 flex border-b">
          <button
            type="button"
            onClick={() => setTab("pc")}
            className={`px-4 py-2 ${
              tab === "pc" ? "border-b-[3px] border-[#002044] font-bold text-[#002044]" : ""
            }`}
          >
            <i className="fas fa-desktop mr-2" />
            Computer Laboratory Management
          </button>
          <button
            type="button"
            onClick={() => setTab("schedule")}
            className={`px-4 py-2 ${
              tab === "schedule" ? "border-b-[3px] border-[#002044] font-bold text-[#002044]" : ""
            }`}
          >
            <i className="fas fa-calendar-alt mr-2" />
            Lab Schedules
          </button>
        </div>

        {tab === "pc" ? (
          <div className="space-y-6">
            <div className="rounded-lg bg-white p-4 shadow">
              <h3 className="mb-2 font-semibold">Select Laboratory:</h3>
              <div className="flex flex-wrap gap-2">
                {labOptions.map((lab) => (
                  <button
                    key={lab}
                    type="button"
                    onClick={() => setCurrentLab(lab)}
                    className={`rounded-md px-4 py-2 ${
                      currentLab === lab ? "bg-[#002044] text-white" : "bg-gray-100 hover:bg-gray-200"
                    }`}
                  >
                    Lab {lab}
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-lg bg-white p-4 shadow">
              <h3 className="mb-3 font-semibold">Bulk PC Status Update</h3>
              <div className="grid gap-3 md:grid-cols-[1fr_auto_auto]">
                <input
                  value={bulkSelection}
                  onChange={(event) => setBulkSelection(event.target.value)}
                  placeholder="PC numbers (e.g. 1,2,3,10)"
                  className="rounded-md border border-gray-300 p-2"
                />
                <select
                  value={bulkStatus}
                  onChange={(event) => setBulkStatus(event.target.value as PcStatus)}
                  className="rounded-md border border-gray-300 p-2"
                >
                  <option value="available">available</option>
                  <option value="unavailable">unavailable</option>
                </select>
                <button
                  type="button"
                  onClick={() => void applyBulkStatus()}
                  className="rounded-md bg-[#002044] px-4 py-2 text-white"
                >
                  Apply
                </button>
              </div>
            </div>

            <div className="rounded-lg bg-white p-4 shadow">
              <h3 className="mb-3 font-semibold">PC Status (Lab {currentLab})</h3>
              <div className="grid grid-cols-5 gap-3 md:grid-cols-10">
                {currentPcs.map((pc) => (
                  <button
                    key={pc.pcNumber}
                    type="button"
                    onClick={() =>
                      void updatePcStatus(pc.pcNumber, pc.status === "available" ? "unavailable" : "available")
                    }
                    className={`rounded-md border px-2 py-3 text-sm transition ${
                      pc.status === "available"
                        ? "border-emerald-300 bg-emerald-100 text-emerald-700"
                        : "border-rose-300 bg-rose-100 text-rose-700"
                    }`}
                    title="Click to toggle status"
                  >
                    PC {pc.pcNumber}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="rounded-lg bg-white p-4 shadow">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <h3 className="font-semibold">Select Day:</h3>
                <select
                  value={currentLab}
                  onChange={(event) => setCurrentLab(event.target.value as LabNumber)}
                  className="rounded-md border border-gray-300 p-2"
                >
                  {labOptions.map((lab) => (
                    <option key={lab} value={lab}>
                      Lab {lab}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-wrap gap-2">
                {daysOfWeek.map((day) => (
                  <button
                    key={day}
                    type="button"
                    onClick={() => setCurrentDay(day)}
                    className={`rounded-md px-4 py-2 ${
                      currentDay === day ? "bg-[#002044] text-white" : "bg-gray-100 hover:bg-gray-200"
                    }`}
                  >
                    {day}
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-lg bg-white p-4 shadow">
              <h3 className="mb-3 font-semibold">Update Schedule ({currentDay} · Lab {currentLab})</h3>
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-5">
                <input
                  type="time"
                  value={startTime}
                  onChange={(event) => setStartTime(event.target.value)}
                  className="rounded-md border border-gray-300 p-2"
                />
                <input
                  type="time"
                  value={endTime}
                  onChange={(event) => setEndTime(event.target.value)}
                  className="rounded-md border border-gray-300 p-2"
                />
                <select
                  value={status}
                  onChange={(event) => setStatus(event.target.value as PcStatus)}
                  className="rounded-md border border-gray-300 p-2"
                >
                  <option value="available">available</option>
                  <option value="unavailable">unavailable</option>
                </select>
                <input
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  placeholder="Notes"
                  className="rounded-md border border-gray-300 p-2"
                />
                <button type="button" onClick={() => void saveSchedule()} className="rounded-md bg-[#002044] px-4 py-2 text-white">
                  Save
                </button>
              </div>
            </div>

            <div className="rounded-lg bg-white p-4 shadow">
              <h3 className="mb-3 font-semibold">Time Slots ({currentDay})</h3>
              <div className="grid gap-2">
                {timeSlots.map((slot) => (
                  <div
                    key={`${slot.start}-${slot.end}`}
                    className={`flex items-center justify-between rounded-md border-l-4 px-3 py-2 text-sm ${
                      slot.status === "available"
                        ? "border-emerald-500 bg-emerald-100"
                        : "border-rose-500 bg-rose-100"
                    }`}
                  >
                    <span>
                      {timeLabel(Number(slot.start.slice(0, 2)), Number(slot.start.slice(3, 5)))} -{" "}
                      {timeLabel(Number(slot.end.slice(0, 2)), Number(slot.end.slice(3, 5)))}
                    </span>
                    <span className="font-semibold">
                      {slot.status}
                      {slot.notes ? ` (${slot.notes})` : ""}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminShell>
  );
}
