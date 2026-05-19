"use client";

import { useEffect, useMemo, useState } from "react";
import { AdminShell } from "@/components/admin-shell";
import { getAdminDashboardData } from "@/lib/supabase/data";
import { labOptions, purposeOptions } from "@/lib/supabase/constants";
import { isSupabaseConfigured } from "@/lib/supabase/client";

function colorForIndex(index: number) {
  const colors = [
    "#1E3A8A",
    "#1D4ED8",
    "#3B82F6",
    "#60A5FA",
    "#93C5FD",
    "#4C1D95",
    "#7C3AED",
    "#8B5CF6",
    "#A78BFA",
    "#9333EA",
    "#5B21B6",
    "#7E22CE",
    "#BFDBFE",
    "#C4B5FD",
  ];
  return colors[index % colors.length];
}

export default function AdminAnalyticsPage() {
  const [metrics, setMetrics] = useState({
    purposeTotals: new Map<string, number>(),
    labTotals: new Map<string, number>(),
    daily: [] as Array<{ label: string; value: number }>,
  });
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    const load = async () => {
      if (!isSupabaseConfigured) {
        setError("Supabase is not configured.");
        return;
      }
      try {
        const data = await getAdminDashboardData();
        if (active) {
          setMetrics({
            purposeTotals: data.purposeTotals,
            labTotals: data.labTotals,
            daily: data.daily,
          });
        }
      } catch (loadError) {
        if (active) {
          setError(loadError instanceof Error ? loadError.message : "Unable to load analytics.");
        }
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, []);

  const purposeCounts = useMemo(
    () =>
      purposeOptions.map((purpose) => ({
        label: purpose,
        value: metrics.purposeTotals.get(purpose) ?? 0,
      })),
    [metrics.purposeTotals],
  );
  const labCounts = useMemo(
    () =>
      labOptions.map((lab) => ({
        label: lab,
        value: metrics.labTotals.get(lab) ?? 0,
      })),
    [metrics.labTotals],
  );

  const maxPurpose = Math.max(...purposeCounts.map((item) => item.value), 1);
  const maxLab = Math.max(...labCounts.map((item) => item.value), 1);
  const maxDaily = Math.max(...metrics.daily.map((item) => item.value), 1);

  return (
    <AdminShell title="Analytics">
      {error ? (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-700">{error}</div>
      ) : null}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_1fr_1.3fr]">
        <section className="rounded-lg bg-white p-5 shadow">
          <h3 className="mb-4 text-lg font-semibold">Purpose Distribution</h3>
          <div className="space-y-3">
            {purposeCounts.map((item, index) => (
              <div key={item.label}>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span className="truncate pr-3">{item.label}</span>
                  <span className="font-semibold">{item.value}</span>
                </div>
                <div className="h-2 w-full rounded-full bg-gray-100">
                  <div
                    className="h-2 rounded-full"
                    style={{
                      width: `${(item.value / maxPurpose) * 100}%`,
                      backgroundColor: colorForIndex(index),
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-lg bg-white p-5 shadow">
          <h3 className="mb-4 text-lg font-semibold">Lab Distribution</h3>
          <div className="space-y-4">
            {labCounts.map((item, index) => (
              <div key={item.label}>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span>Lab {item.label}</span>
                  <span className="font-semibold">{item.value}</span>
                </div>
                <div className="h-2 w-full rounded-full bg-gray-100">
                  <div
                    className="h-2 rounded-full"
                    style={{
                      width: `${(item.value / maxLab) * 100}%`,
                      backgroundColor: colorForIndex(index),
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-lg bg-white p-5 shadow">
          <h3 className="mb-4 text-lg font-semibold">Daily Sit-in Trends</h3>
          <div className="flex h-[260px] items-end gap-3 rounded-md bg-gray-50 p-4">
            {metrics.daily.map((item, index) => (
              <div key={item.label} className="flex flex-1 flex-col items-center gap-2">
                <div className="flex h-[180px] w-full items-end">
                  <div
                    className="w-full rounded-t-md bg-[#002044]"
                    style={{ height: `${(item.value / maxDaily) * 100}%`, opacity: 0.6 + index * 0.05 }}
                  />
                </div>
                <span className="text-xs text-gray-600">{item.label}</span>
                <span className="text-xs font-semibold text-gray-700">{item.value}</span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </AdminShell>
  );
}
