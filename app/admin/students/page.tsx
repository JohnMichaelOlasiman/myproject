"use client";

import { AdminShell } from "@/components/admin-shell";
import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  createStudent,
  deleteStudent,
  listStudents,
  resetAllStudentSessions,
  updateStudent,
} from "@/lib/supabase/data";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { courseOptions, levelOptions } from "@/lib/supabase/constants";
import { ProfileRecord } from "@/lib/supabase/types";
import { isSupabaseConfigured } from "@/lib/supabase/client";

type Entries = "all" | "5" | "10" | "25" | "50";
type SortMode = "asc" | "desc";

type StudentForm = {
  idno: string;
  firstname: string;
  middlename: string;
  lastname: string;
  course: ProfileRecord["course"];
  level: ProfileRecord["level"];
  email: string;
  username: string;
  password: string;
  session: string;
  points: string;
  hours: string;
  tasks: string;
};

const emptyForm: StudentForm = {
  idno: "",
  firstname: "",
  middlename: "",
  lastname: "",
  course: "BSIT",
  level: "1",
  email: "",
  username: "",
  password: "",
  session: "0",
  points: "0",
  hours: "0",
  tasks: "0",
};

function toCSV(rows: ProfileRecord[]) {
  const headers = ["ID NUMBER", "FULL NAME", "COURSE", "LEVEL", "EMAIL", "SESSION", "POINTS"];
  const data = rows.map((row) => [
    row.idno,
    `${row.lastname}, ${row.firstname} ${row.middlename}`,
    row.course,
    row.level,
    row.email,
    String(row.session_remaining),
    String(row.points),
  ]);
  return [headers, ...data]
    .map((line) => line.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(","))
    .join("\n");
}

export default function AdminStudentsPage() {
  const [records, setRecords] = useState<ProfileRecord[]>([]);
  const [entries, setEntries] = useState<Entries>("all");
  const [search, setSearch] = useState("");
  const [courseFilter, setCourseFilter] = useState<string>("");
  const [levelFilter, setLevelFilter] = useState<string>("");
  const [sort, setSort] = useState<SortMode>("asc");
  const [filterOpen, setFilterOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<ProfileRecord | null>(null);
  const [form, setForm] = useState<StudentForm>(emptyForm);
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
        if (active) {
          setRecords(rows);
        }
      } catch (loadError) {
        if (active) {
          setError(loadError instanceof Error ? loadError.message : "Unable to load student records.");
        }
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, []);

  const filtered = useMemo(() => {
    let rows = records.filter((student) => {
      const fullName = `${student.firstname} ${student.middlename} ${student.lastname}`.toLowerCase();
      const matchesSearch =
        student.idno.toLowerCase().includes(search.toLowerCase()) ||
        fullName.includes(search.toLowerCase()) ||
        student.email.toLowerCase().includes(search.toLowerCase());
      const matchesCourse = courseFilter ? student.course === courseFilter : true;
      const matchesLevel = levelFilter ? student.level === levelFilter : true;
      return matchesSearch && matchesCourse && matchesLevel;
    });

    rows = rows.sort((a, b) => {
      const nameA = `${a.lastname}, ${a.firstname}`.toLowerCase();
      const nameB = `${b.lastname}, ${b.firstname}`.toLowerCase();
      return sort === "asc" ? nameA.localeCompare(nameB) : nameB.localeCompare(nameA);
    });

    if (entries !== "all") {
      return rows.slice(0, Number(entries));
    }
    return rows;
  }, [records, search, courseFilter, levelFilter, sort, entries]);

  const openAddModal = () => {
    setForm(emptyForm);
    setEditing(null);
    setShowAdd(true);
  };

  const openEditModal = (student: ProfileRecord) => {
    setForm({
      idno: student.idno,
      firstname: student.firstname,
      middlename: student.middlename,
      lastname: student.lastname,
      course: student.course,
      level: student.level,
      email: student.email,
      username: student.username,
      password: "",
      session: String(student.session_remaining),
      points: String(student.points),
      hours: String(student.hours_spent),
      tasks: String(student.tasks_completed),
    });
    setEditing(student);
    setShowAdd(true);
  };

  const saveStudent = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(""); // Clear any previous errors
    
    // Validate required fields
    if (!form.email.trim()) {
      setError("Email is required.");
      return;
    }
    if (!form.firstname.trim()) {
      setError("First name is required.");
      return;
    }
    if (!form.lastname.trim()) {
      setError("Last name is required.");
      return;
    }
    if (!form.idno.trim()) {
      setError("ID number is required.");
      return;
    }
    
    try {
      if (editing) {
        console.log('Editing student with ID:', editing.id);
        if (!editing.id) {
          // Try to resolve missing ID by email or idno
          if (isSupabaseConfigured) {
            try {
              const supabase = getSupabaseBrowserClient();
              const { data: found, error } = await supabase
                .from('profiles')
                .select('id')
                .or(`email.eq.${form.email},idno.eq.${form.idno}`)
                .maybeSingle();
              if (error) {
                console.error('Error resolving profile id:', error);
              }
              if (found?.id) {
                const resolvedId = found.id as string;
                setEditing({ ...editing, id: resolvedId });
                console.log('Resolved missing editing.id from profiles:', resolvedId);
                // proceed using resolvedId
                const updated = await updateStudent(resolvedId, {
                  idno: form.idno,
                  firstname: form.firstname,
                  middlename: form.middlename,
                  lastname: form.lastname,
                  course: form.course,
                  level: form.level,
                  email: form.email,
                  username: form.username,
                  password: form.password || undefined,
                  session_remaining: Number(form.session || 0),
                  points: Number(form.points || 0),
                  hours_spent: Number(form.hours || 0),
                  tasks_completed: Number(form.tasks || 0),
                } as any);
                setRecords((current) => current.map((student) => (student.id === resolvedId ? updated : student)));
                setShowAdd(false);
                setEditing(null);
                return;
              }
            } catch (err) {
              console.error('Failed to resolve editing.id', err);
            }
          }

          setError('Student ID is missing. This record may be corrupted in the database.');
          return;
        }
        const updated = await updateStudent(editing.id, {
          idno: form.idno,
          firstname: form.firstname,
          middlename: form.middlename,
          lastname: form.lastname,
          course: form.course,
          level: form.level,
          email: form.email,
          username: form.username,
          password: form.password || undefined,
          session_remaining: Number(form.session || 0),
          points: Number(form.points || 0),
          hours_spent: Number(form.hours || 0),
          tasks_completed: Number(form.tasks || 0),
        } as any);
        setRecords((current) => current.map((student) => (student.id === editing.id ? updated : student)));
      } else {
        const created = await createStudent({
          idno: form.idno,
          firstname: form.firstname,
          middlename: form.middlename,
          lastname: form.lastname,
          course: form.course,
          level: form.level,
          email: form.email,
          username: form.username,
          password: form.password || undefined,
          session_remaining: Number(form.session || 0),
          points: Number(form.points || 0),
          hours_spent: Number(form.hours || 0),
          tasks_completed: Number(form.tasks || 0),
        });
        setRecords((current) => [created, ...current]);
      }
      setShowAdd(false);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to save student.");
    }
  };

  const onDeleteStudent = async (studentId: string | null | undefined, studentEmail?: string) => {
    console.log('onDeleteStudent called with ID:', studentId, 'email:', studentEmail);

    let uid = studentId ?? null;

    // Try to resolve missing ID by email or idno lookup
    if ((!uid || uid.trim() === '') && studentEmail && isSupabaseConfigured) {
      try {
        const supabase = getSupabaseBrowserClient();
        const { data: found, error } = await supabase.from('profiles').select('id').eq('email', studentEmail).maybeSingle();
        if (error) {
          console.error('Error resolving profile by email:', error);
        }
        if (found?.id) {
          uid = found.id;
          console.log('Resolved student ID from email:', uid);
        }
      } catch (err) {
        console.error('Failed to resolve student ID from email', err);
      }
    }

    if (!uid || uid.trim() === '') {
      setError('Student ID is missing. Unable to delete. Please fix the profile record in the database.');
      return;
    }

    if (!window.confirm('Are you sure you want to delete this student? This will remove their account and they will no longer be able to log in.')) {
      return;
    }

    try {
      await deleteStudent(uid);
      setRecords((current) => current.filter((student) => student.id !== uid));
      setError(''); // Clear error on success
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Unable to delete student.");
    }
  };

  const resetSessions = async () => {
    try {
      await resetAllStudentSessions(30);
      const rows = await listStudents();
      setRecords(rows);
    } catch (resetError) {
      setError(resetError instanceof Error ? resetError.message : "Unable to reset sessions.");
    }
  };

  const exportCSV = () => {
    const blob = new Blob([toCSV(filtered)], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "student_records.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  const exportExcel = () => {
    const rows = filtered
      .map(
        (student) => `
      <tr>
        <td>${student.idno}</td>
        <td>${student.lastname}, ${student.firstname} ${student.middlename}</td>
        <td>${student.course}</td>
        <td>${student.level}</td>
        <td>${student.email}</td>
        <td>${student.session_remaining}</td>
        <td>${student.points}</td>
      </tr>`,
      )
      .join("");
    const html = `<table>
      <thead><tr><th>ID NUMBER</th><th>FULL NAME</th><th>COURSE</th><th>LEVEL</th><th>EMAIL</th><th>SESSION</th><th>POINTS</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
    const blob = new Blob([html], { type: "application/vnd.ms-excel" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "student_records.xls";
    link.click();
    URL.revokeObjectURL(url);
  };

  const exportPDF = () => {
    const popup = window.open("", "_blank", "width=1000,height=800");
    if (!popup) {
      return;
    }
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
          <h2>Student Records</h2>
          <table>
            <thead>
              <tr><th>ID NUMBER</th><th>FULL NAME</th><th>COURSE</th><th>LEVEL</th><th>EMAIL</th><th>SESSION</th><th>POINTS</th></tr>
            </thead>
            <tbody>
              ${filtered
                .map(
                  (student) => `
                <tr>
                  <td>${student.idno}</td>
                  <td>${student.lastname}, ${student.firstname} ${student.middlename}</td>
                  <td>${student.course}</td>
                  <td>${student.level}</td>
                  <td>${student.email}</td>
                  <td>${student.session_remaining}</td>
                  <td>${student.points}</td>
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
    <AdminShell title="Student Records">
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
                onClick={() => {
                  setFilterOpen((open) => !open);
                  setSortOpen(false);
                }}
                className="flex items-center gap-2 text-gray-600"
              >
                <i className="fas fa-filter" />
                <span>Filter</span>
              </button>
              {filterOpen ? (
                <div className="absolute right-0 z-10 mt-2 w-48 rounded-lg border border-gray-200 bg-white shadow-lg">
                  <div className="p-2">
                    <label className="block text-sm font-medium text-gray-700">Course</label>
                    <select
                      value={courseFilter}
                      onChange={(event) => setCourseFilter(event.target.value)}
                      className="mt-1 w-full rounded-md border border-gray-300 p-2"
                    >
                      <option value="">All Courses</option>
                      {courseOptions.map((course) => (
                        <option key={course} value={course}>
                          {course}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="p-2">
                    <label className="block text-sm font-medium text-gray-700">Level</label>
                    <select
                      value={levelFilter}
                      onChange={(event) => setLevelFilter(event.target.value)}
                      className="mt-1 w-full rounded-md border border-gray-300 p-2"
                    >
                      <option value="">All Levels</option>
                      {levelOptions.map((level) => (
                        <option key={level} value={level}>
                          {level}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              ) : null}
            </div>

            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setSortOpen((open) => !open);
                  setFilterOpen(false);
                }}
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
                      setSort("asc");
                      setSortOpen(false);
                    }}
                    className="block w-full px-4 py-2 text-left hover:bg-gray-100"
                  >
                    A-Z
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSort("desc");
                      setSortOpen(false);
                    }}
                    className="block w-full px-4 py-2 text-left hover:bg-gray-100"
                  >
                    Z-A
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </div>

        <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={openAddModal}
              className="flex items-center gap-2 rounded-md bg-[#002044] px-4 py-2 text-white"
            >
              <i className="fas fa-plus" />
              <span>Add Student</span>
            </button>
            <button
              type="button"
              onClick={() => void resetSessions()}
              className="flex items-center gap-2 rounded-md bg-[#002044] px-4 py-2 text-white"
            >
              <i className="fas fa-clock" />
              <span>Reset Session</span>
            </button>
          </div>

          <div className="flex gap-2">
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
                <th className="px-4 py-4 text-center">COURSE</th>
                <th className="px-4 py-4 text-center">LEVEL</th>
                <th className="px-4 py-4 text-center">EMAIL</th>
                <th className="px-4 py-4 text-center">SESSION</th>
                <th className="px-4 py-4 text-center">POINTS</th>
                <th className="px-4 py-4 text-center">ACTION</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((student, index) => (
                <tr key={student.id} className={index % 2 === 0 ? "bg-gray-100" : "bg-gray-200"}>
                  <td className="px-4 py-4 text-center font-semibold">{student.idno}</td>
                  <td className="px-4 py-4 text-center">
                    {student.lastname}, {student.firstname} {student.middlename}
                  </td>
                  <td className="px-4 py-4 text-center">{student.course}</td>
                  <td className="px-4 py-4 text-center">{student.level}</td>
                  <td className="px-4 py-4 text-center">{student.email}</td>
                  <td className="px-4 py-4 text-center">{student.session_remaining}</td>
                  <td className="px-4 py-4 text-center">{student.points}</td>
                  <td className="px-4 py-4 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        type="button"
                        onClick={() => openEditModal(student)}
                        className="rounded-md px-2 py-2 text-blue-500"
                        aria-label={`Edit ${student.idno}`}
                      >
                        <i className="fas fa-pen" />
                      </button>
                      <button
                        type="button"
                        onClick={() => void onDeleteStudent(student.id, student.email)}
                        disabled={!student.id && !student.email}
                        className={`rounded-md px-2 py-2 ${student.id ? 'text-red-500 cursor-pointer' : 'text-gray-300 cursor-not-allowed'}`}
                        aria-label={`Delete ${student.idno}`}
                        title={student.id ? 'Delete student' : student.email ? 'Resolve by email then delete' : 'Student ID missing - cannot delete'}
                      >
                        <i className="fas fa-trash" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showAdd ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-2xl rounded-lg bg-white p-6">
            <h3 className="mb-4 text-xl font-semibold">{editing ? "Edit Student" : "Add Student"}</h3>
            <form onSubmit={(event) => void saveStudent(event)}>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <input
                  required
                  value={form.idno}
                  onChange={(event) => setForm((current) => ({ ...current, idno: event.target.value }))}
                  className="rounded-md border border-gray-300 p-2"
                  placeholder="ID Number"
                />
                <input
                  required
                  value={form.email}
                  onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
                  className="rounded-md border border-gray-300 p-2"
                  placeholder="Email"
                />
                <input
                  required
                  value={form.lastname}
                  onChange={(event) => setForm((current) => ({ ...current, lastname: event.target.value }))}
                  className="rounded-md border border-gray-300 p-2"
                  placeholder="Last Name"
                />
                <input
                  required
                  value={form.firstname}
                  onChange={(event) => setForm((current) => ({ ...current, firstname: event.target.value }))}
                  className="rounded-md border border-gray-300 p-2"
                  placeholder="First Name"
                />
                <input
                  value={form.middlename}
                  onChange={(event) => setForm((current) => ({ ...current, middlename: event.target.value }))}
                  className="rounded-md border border-gray-300 p-2"
                  placeholder="Middle Name"
                />
                <input
                  required
                  value={form.username}
                  onChange={(event) => setForm((current) => ({ ...current, username: event.target.value }))}
                  className="rounded-md border border-gray-300 p-2"
                  placeholder="Username"
                />
                <input
                  value={form.password}
                  onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
                  className="rounded-md border border-gray-300 p-2"
                  placeholder="Password (set initial password)"
                  type="password"
                />
                <select
                  value={form.course}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, course: event.target.value as ProfileRecord["course"] }))
                  }
                  className="rounded-md border border-gray-300 p-2"
                >
                  {courseOptions.map((course) => (
                    <option key={course} value={course}>
                      {course}
                    </option>
                  ))}
                </select>
                <select
                  value={form.level}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, level: event.target.value as ProfileRecord["level"] }))
                  }
                  className="rounded-md border border-gray-300 p-2"
                >
                  {levelOptions.map((level) => (
                    <option key={level} value={level}>
                      {level}
                    </option>
                  ))}
                </select>
              </div>
              <div className="mt-6 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowAdd(false)}
                  className="rounded-md border border-red-700 px-5 py-2 text-red-700"
                >
                  Cancel
                </button>
                <button type="submit" className="rounded-md bg-[#7952b3] px-5 py-2 text-white">
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
