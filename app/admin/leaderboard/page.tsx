"use client";

import { useEffect, useMemo, useState } from "react";
import { AdminShell } from "@/components/admin-shell";
import { computeLeaderboardScore, formatMinutesAsDuration } from "@/lib/sit-in-metrics";
import { listStudents } from "@/lib/supabase/data";
import { isSupabaseConfigured } from "@/lib/supabase/client";

function initials(name: string) {
  return name
    .split(" ")
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function formatScore(score: number) {
  return score.toFixed(2);
}

export default function AdminLeaderboardPage() {
  const [ranking, setRanking] = useState<
      Array<{
        id: string;
        fullName: string;
        course: string;
        level: string;
        points: number;
        totalMinutes: number;
        tasks: number;
        totalScore: number;
      }>
    >([]);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    const load = async () => {
      if (!isSupabaseConfigured) {
        setError("Supabase is not configured.");
        return;
      }
      try {
        const rows = await listStudents();
        if (!active) return;
        const sorted = rows
          .map((student) => ({
            id: student.id,
            fullName: `${student.firstname} ${student.lastname}`.trim(),
            course: student.course,
            level: student.level,
            points: student.points,
            totalMinutes: student.hours_spent,
            tasks: student.tasks_completed,
            totalScore: computeLeaderboardScore(student.points, student.hours_spent, student.tasks_completed),
          }))
          .sort((a, b) => b.totalScore - a.totalScore)
          .slice(0, 10);
        setRanking(sorted);
      } catch (loadError) {
        if (active) {
          setError(loadError instanceof Error ? loadError.message : "Unable to load leaderboard.");
        }
      }
    };
    void load();
    const intervalId = window.setInterval(() => {
      void load();
    }, 12000);
    return () => {
      active = false;
      window.clearInterval(intervalId);
    };
  }, []);

  const podium = useMemo(() => [ranking[0], ranking[1], ranking[2]], [ranking]);

  return (
    <AdminShell title="Leaderboard">
      {error ? (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-700">{error}</div>
      ) : null}

      <div className="mx-auto max-w-6xl rounded-2xl bg-gradient-to-br from-slate-50 to-blue-50 p-6 shadow-sm">
        <div className="mb-8 text-center">
          <h2 className="text-5xl font-extrabold uppercase tracking-wide text-indigo-600">Leaderboard</h2>
          <p className="mt-2 text-lg font-semibold text-gray-600">Top-performing students by 60% points, 20% hours, 20% tasks</p>
        </div>

        <div className="mb-10 rounded-2xl border border-indigo-100 bg-white/80 p-6 shadow-lg">
          <div className="grid gap-6 md:grid-cols-3 md:items-end">
            <div className="order-2 flex flex-col items-center md:order-1">
              <div className="mb-3 flex h-20 w-20 items-center justify-center rounded-full border-4 border-slate-300 bg-slate-100 text-xl font-bold text-slate-700">
                {podium[1] ? initials(podium[1].fullName) : "--"}
              </div>
              <div className="w-full rounded-t-xl bg-gradient-to-b from-slate-300 to-slate-400 px-6 py-8 text-center shadow-xl">
                <p className="text-sm font-semibold text-slate-800">2nd</p>
                <p className="mt-2 text-lg font-bold text-slate-950">{podium[1]?.fullName ?? "—"}</p>
                <p className="text-sm text-slate-950/80">{podium[1]?.course ?? ""}</p>
                <p className="mt-3 text-2xl font-extrabold text-slate-950">{formatScore(podium[1]?.totalScore ?? 0)}</p>
              </div>
            </div>

            <div className="order-1 flex flex-col items-center md:order-2">
              <div className="mb-3 flex h-24 w-24 items-center justify-center rounded-full border-4 border-yellow-300 bg-yellow-100 text-2xl font-bold text-yellow-700">
                {podium[0] ? initials(podium[0].fullName) : "--"}
              </div>
              <div className="w-full rounded-t-xl bg-gradient-to-b from-yellow-300 to-yellow-400 px-6 py-10 text-center shadow-xl">
                <p className="text-sm font-semibold text-yellow-900">1st</p>
                <p className="mt-2 text-lg font-bold text-yellow-950">{podium[0]?.fullName ?? "—"}</p>
                <p className="text-sm text-yellow-950/80">{podium[0]?.course ?? ""}</p>
                <p className="mt-3 text-3xl font-extrabold text-yellow-950">{formatScore(podium[0]?.totalScore ?? 0)}</p>
              </div>
            </div>

            <div className="order-3 flex flex-col items-center">
              <div className="mb-3 flex h-20 w-20 items-center justify-center rounded-full border-4 border-amber-700 bg-amber-100 text-xl font-bold text-amber-700">
                {podium[2] ? initials(podium[2].fullName) : "--"}
              </div>
              <div className="w-full rounded-t-xl bg-gradient-to-b from-amber-700 to-amber-800 px-6 py-7 text-center text-white shadow-xl">
                <p className="text-sm font-semibold">3rd</p>
                <p className="mt-2 text-lg font-bold">{podium[2]?.fullName ?? "—"}</p>
                <p className="text-sm text-amber-100">{podium[2]?.course ?? ""}</p>
                <p className="mt-3 text-2xl font-extrabold">{formatScore(podium[2]?.totalScore ?? 0)}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-2xl bg-white p-6 shadow">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-semibold">Top 10 Students</h3>
            <span className="text-sm text-gray-500">Sorted by computed score</span>
          </div>
          <div className="space-y-3">
            {ranking.map((student, index) => (
              <div
                key={student.id}
                className="flex flex-col gap-3 rounded-xl border border-gray-100 bg-gray-50 px-4 py-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-indigo-600 text-sm font-bold text-white">
                    {initials(student.fullName)}
                  </div>
                  <div>
                    <p className="font-semibold">
                      #{index + 1} {student.fullName}
                    </p>
                    <p className="text-sm text-gray-500">
                      {student.course} • Level {student.level}
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-4 gap-4 text-center sm:min-w-[420px]">
                  <div>
                    <p className="text-xs uppercase text-gray-400">Score</p>
                    <p className="font-semibold text-indigo-600">{formatScore(student.totalScore)}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase text-gray-400">Points</p>
                    <p className="font-semibold">{student.points}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase text-gray-400">Hours</p>
                    <p className="font-semibold">{formatMinutesAsDuration(student.totalMinutes)}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase text-gray-400">Tasks</p>
                    <p className="font-semibold">{student.tasks}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AdminShell>
  );
}
