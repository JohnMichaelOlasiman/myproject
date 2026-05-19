"use client";

import Image from "next/image";
import { StudentShell } from "@/components/student-shell";
import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import { courseOptions, levelOptions } from "@/lib/supabase/constants";
import { getCurrentProfileWithRetry, updatePassword, updateProfile } from "@/lib/supabase/data";
import { ProfileRecord } from "@/lib/supabase/types";
import { isSupabaseConfigured } from "@/lib/supabase/client";

type ProfileForm = {
  id: string;
  idno: string;
  lastname: string;
  firstname: string;
  middlename: string;
  course: string;
  level: string;
  email: string;
  username: string;
  avatar_url: string | null;
};

const emptyForm: ProfileForm = {
  id: "",
  idno: "",
  lastname: "",
  firstname: "",
  middlename: "",
  course: "BSIT",
  level: "1",
  email: "",
  username: "",
  avatar_url: null,
};

function toForm(profile: ProfileRecord): ProfileForm {
  return {
    id: profile.id,
    idno: profile.idno,
    lastname: profile.lastname,
    firstname: profile.firstname,
    middlename: profile.middlename,
    course: profile.course,
    level: profile.level,
    email: profile.email,
    username: profile.username,
    avatar_url: profile.avatar_url,
  };
}

export default function ProfilePage() {
  const [form, setForm] = useState<ProfileForm>(emptyForm);
  const [initialForm, setInitialForm] = useState<ProfileForm>(emptyForm);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [showDialog, setShowDialog] = useState(false);
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
        const profile = await getCurrentProfileWithRetry();
        if (!active || !profile) {
          return;
        }
        const mapped = toForm(profile);
        setForm(mapped);
        setInitialForm(mapped);
        setAvatarPreview(mapped.avatar_url);
      } catch (loadError) {
        if (active) {
          setError(loadError instanceof Error ? loadError.message : "Unable to load profile.");
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

  const initials = useMemo(
    () => `${form.firstname.slice(0, 1)}${form.lastname.slice(0, 1)}`.toUpperCase(),
    [form.firstname, form.lastname],
  );

  const handleAvatarChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const value = String(reader.result);
      setAvatarPreview(value);
      setForm((current) => ({ ...current, avatar_url: value }));
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!form.id) return;
    try {
      await updateProfile(form.id, {
        idno: form.idno,
        lastname: form.lastname,
        firstname: form.firstname,
        middlename: form.middlename,
        course: form.course as ProfileRecord["course"],
        level: form.level as ProfileRecord["level"],
        email: form.email,
        username: form.username,
        avatar_url: form.avatar_url,
      });
      if (password.trim()) {
        await updatePassword(password.trim());
      }
      setInitialForm(form);
      setPassword("");
      setShowDialog(true);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to update profile.");
    }
  };

  const resetForm = () => {
    setForm(initialForm);
    setPassword("");
    setShowPassword(false);
    setAvatarPreview(initialForm.avatar_url);
  };

  return (
    <StudentShell title="Profile">
      {!loading && error ? (
        <div className="mx-auto mb-4 max-w-3xl rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-700">{error}</div>
      ) : null}

      {loading ? (
        <div className="mx-auto max-w-3xl rounded-lg bg-white p-6 shadow-lg">
          <p className="text-center text-gray-600">Loading profile...</p>
        </div>
      ) : null}

      {!loading ? (
      <div className="mx-auto max-w-3xl rounded-lg bg-white p-6 shadow-lg">
        <form onSubmit={(event) => void handleSubmit(event)} className="space-y-5">
          <div className="flex justify-center">
            <label htmlFor="profile-picture-upload" className="relative cursor-pointer">
              <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-full border-2 border-gray-300 bg-gray-100">
                {avatarPreview ? (
                  <Image
                    src={avatarPreview}
                    alt="Profile preview"
                    width={96}
                    height={96}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span className="text-2xl font-semibold text-gray-700">{initials}</span>
                )}
              </div>
              <span className="absolute bottom-1 right-1 flex h-7 w-7 items-center justify-center rounded-full bg-gray-700 text-white">
                <i className="fas fa-camera text-xs" />
              </span>
            </label>
            <input
              id="profile-picture-upload"
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleAvatarChange}
            />
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <label className="mb-1 block text-sm font-medium">ID Number</label>
              <input
                value={form.idno}
                readOnly
                className="w-full rounded-lg border border-gray-300 bg-gray-50 px-3 py-2"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Last Name</label>
              <input
                value={form.lastname}
                onChange={(event) => setForm((current) => ({ ...current, lastname: event.target.value }))}
                className="w-full rounded-lg border border-gray-300 px-3 py-2"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">First Name</label>
              <input
                value={form.firstname}
                onChange={(event) => setForm((current) => ({ ...current, firstname: event.target.value }))}
                className="w-full rounded-lg border border-gray-300 px-3 py-2"
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <label className="mb-1 block text-sm font-medium">Middle Name</label>
              <input
                value={form.middlename}
                onChange={(event) => setForm((current) => ({ ...current, middlename: event.target.value }))}
                className="w-full rounded-lg border border-gray-300 px-3 py-2"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Course</label>
              <select
                value={form.course}
                onChange={(event) => setForm((current) => ({ ...current, course: event.target.value }))}
                className="w-full rounded-lg border border-gray-300 px-3 py-2"
              >
                {courseOptions.map((course) => (
                  <option key={course} value={course}>
                    {course}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Year Level</label>
              <select
                value={form.level}
                onChange={(event) => setForm((current) => ({ ...current, level: event.target.value }))}
                className="w-full rounded-lg border border-gray-300 px-3 py-2"
              >
                {levelOptions.map((level) => (
                  <option key={level} value={level}>
                    {level}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium">Email Address</label>
              <input
                type="email"
                value={form.email}
                onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
                className="w-full rounded-lg border border-gray-300 px-3 py-2"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Username</label>
              <input
                value={form.username}
                onChange={(event) => setForm((current) => ({ ...current, username: event.target.value }))}
                className="w-full rounded-lg border border-gray-300 px-3 py-2"
              />
            </div>
          </div>

          <div className="relative">
            <label className="mb-1 block text-sm font-medium">Password</label>
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 pr-10"
              placeholder="Enter a new password"
            />
            <button
              type="button"
              onClick={() => setShowPassword((current) => !current)}
              className="absolute right-3 top-9 text-gray-500"
            >
              <i className={`fas ${showPassword ? "fa-lock-open" : "fa-lock"}`} />
            </button>
          </div>

          <div className="flex justify-center gap-4 pt-2">
            <button
              type="button"
              onClick={resetForm}
              className="rounded-lg border border-red-500 px-6 py-3 text-red-600"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-lg bg-[#7952b3] px-6 py-3 text-white hover:bg-[#68439f]"
            >
              Save
            </button>
          </div>
        </form>
      </div>
      ) : null}

      {showDialog ? (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/30 pt-16">
          <div className="w-[320px] rounded-lg bg-white p-5 text-center shadow-xl">
            <p className="text-lg font-semibold">Profile updated successfully!</p>
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
