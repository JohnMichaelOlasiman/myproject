"use client";

import { useEffect, useState } from "react";
import { AdminShell } from "@/components/admin-shell";
import { getAdminDashboardData } from "@/lib/supabase/data";
import { isSupabaseConfigured } from "@/lib/supabase/client";

export default function AdminDashboardPage() {
  const [metrics, setMetrics] = useState({
    totalStudents: 0,
    currentSitIn: 0,
    approvedReservations: 0,
    totalSitIn: 0,
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
          setMetrics(data);
        }
      } catch (loadError) {
        if (active) {
          setError(loadError instanceof Error ? loadError.message : "Unable to load dashboard.");
        }
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, []);

  return (
    <AdminShell title="Dashboard">
      {error ? (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-700">{error}</div>
      ) : null}

      <div className="space-y-8">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
          <div className="flex items-center justify-between rounded-lg bg-white p-6 shadow-md">
            <div>
              <p className="text-sm text-gray-500">Total Students</p>
              <p className="text-2xl font-bold">{metrics.totalStudents}</p>
            </div>
            <i className="fas fa-users text-3xl text-blue-800" />
          </div>
          <div className="flex items-center justify-between rounded-lg bg-white p-6 shadow-md">
            <div>
              <p className="text-sm text-gray-500">Currently Sit-in</p>
              <p className="text-2xl font-bold">{metrics.currentSitIn}</p>
            </div>
            <i className="fas fa-chair text-3xl text-green-800" />
          </div>
          <div className="flex items-center justify-between rounded-lg bg-white p-6 shadow-md">
            <div>
              <p className="text-sm text-gray-500">Reservations</p>
              <p className="text-2xl font-bold">{metrics.approvedReservations}</p>
            </div>
            <i className="fas fa-calendar-check text-3xl text-purple-800" />
          </div>
          <div className="flex items-center justify-between rounded-lg bg-white p-6 shadow-md">
            <div>
              <p className="text-sm text-gray-500">Total Sit-In</p>
              <p className="text-2xl font-bold">{metrics.totalSitIn}</p>
            </div>
            <i className="fas fa-clock text-3xl text-orange-800" />
          </div>
        </div>
      </div>
    </AdminShell>
  );
}
