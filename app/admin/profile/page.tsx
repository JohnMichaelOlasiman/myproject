"use client";

import Image from "next/image";
import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import { AdminShell } from "@/components/admin-shell";
import { getCurrentProfile, updatePassword, updateProfile } from "@/lib/supabase/data";
import { isSupabaseConfigured } from "@/lib/supabase/client";

type ProfileForm = {
  id: string;
  idno: string;
  lastname: string;
  firstname: string;
  middlename: string;
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
  email: "",
  username: "",
  avatar_url: null,
};

export default function AdminProfilePage() {
  const [form, setForm] = useState<ProfileForm>(emptyForm);
  const [initialForm, setInitialForm] = useState<ProfileForm>(emptyForm);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [avatar, setAvatar] = useState<string | null>(null);
  const [dialog, setDialog] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    const load = async () => {
      if (!isSupabaseConfigured) {
        setError("Supabase is not configured.");
        return;
      }
      try {
        const profile = await getCurrentProfile();
        if (!active || !profile) {
          setError("Please log in as admin.");
          return;
        }
        const mapped: ProfileForm = {
          id: profile.id,
          idno: profile.idno,
          lastname: profile.lastname,
          firstname: profile.firstname,
          middlename: profile.middlename,
          email: profile.email,
          username: profile.username,
          avatar_url: profile.avatar_url,
        };
        setForm(mapped);
        setInitialForm(mapped);
        setAvatar(mapped.avatar_url);
      } catch (loadError) {
        if (active) {
          setError(loadError instanceof Error ? loadError.message : "Unable to load profile.");
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

  const onAvatar = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const value = String(reader.result);
      setAvatar(value);
      setForm((current) => ({ ...current, avatar_url: value }));
    };
    reader.readAsDataURL(file);
  };

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!form.id) return;
    try {
      await updateProfile(form.id, {
        idno: form.idno,
        lastname: form.lastname,
        firstname: form.firstname,
        middlename: form.middlename,
        email: form.email,
        username: form.username,
        avatar_url: form.avatar_url,
      });
      if (password.trim()) {
        await updatePassword(password.trim());
      }
      setInitialForm(form);
      setPassword("");
      setDialog(true);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to update profile.");
    }
  };

  return (
    <AdminShell title="Profile Settings">
      {error ? (
        <div className="mx-auto mb-4 max-w-xl rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-700">{error}</div>
      ) : null}

      <div className="mx-auto max-w-xl rounded-lg bg-white p-6 shadow-lg">
        <form onSubmit={(event) => void onSubmit(event)} className="space-y-4">
          <div className="flex justify-center">
            <label htmlFor="avatar-upload" className="relative cursor-pointer">
              <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-full border-2 border-gray-300 bg-gray-100">
                {avatar ? (
                  <Image src={avatar} alt="Profile preview" width={96} height={96} className="h-full w-full object-cover" />
                ) : (
                  <span className="text-2xl font-semibold">{initials}</span>
                )}
              </div>
              <span className="absolute bottom-1 right-1 rounded-full bg-gray-700 p-1 text-white">
                <i className="fas fa-camera text-xs" />
              </span>
            </label>
            <input id="avatar-upload" type="file" accept="image/*" onChange={onAvatar} className="hidden" />
          </div>

          <input
            value={form.idno}
            readOnly
            className="w-full rounded-md border border-gray-300 bg-gray-50 p-2"
            placeholder="ID Number"
          />

          <div className="grid gap-3 sm:grid-cols-3">
            <input
              value={form.lastname}
              onChange={(event) => setForm((current) => ({ ...current, lastname: event.target.value }))}
              className="w-full rounded-md border border-gray-300 p-2"
              placeholder="Last Name"
            />
            <input
              value={form.firstname}
              onChange={(event) => setForm((current) => ({ ...current, firstname: event.target.value }))}
              className="w-full rounded-md border border-gray-300 p-2"
              placeholder="First Name"
            />
            <input
              value={form.middlename}
              onChange={(event) => setForm((current) => ({ ...current, middlename: event.target.value }))}
              className="w-full rounded-md border border-gray-300 p-2"
              placeholder="Middle Name"
            />
          </div>

          <input
            type="email"
            value={form.email}
            onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
            className="w-full rounded-md border border-gray-300 p-2"
            placeholder="Email Address"
          />

          <input
            value={form.username}
            onChange={(event) => setForm((current) => ({ ...current, username: event.target.value }))}
            className="w-full rounded-md border border-gray-300 p-2"
            placeholder="Username"
          />

          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full rounded-md border border-gray-300 p-2 pr-10"
              placeholder="Password"
            />
            <button
              type="button"
              onClick={() => setShowPassword((current) => !current)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500"
            >
              <i className={`fas ${showPassword ? "fa-lock-open" : "fa-lock"}`} />
            </button>
          </div>

          <div className="flex justify-center gap-10 pt-2">
            <button
              type="button"
              onClick={() => {
                setForm(initialForm);
                setPassword("");
                setAvatar(initialForm.avatar_url);
              }}
              className="h-[51px] rounded-md border border-[#951313] px-8 text-[#951313]"
            >
              Cancel
            </button>
            <button type="submit" className="h-[51px] rounded-md bg-[#7952b3] px-8 text-white">
              Save
            </button>
          </div>
        </form>
      </div>

      {dialog ? (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 pt-16">
          <div className="w-[320px] rounded-lg bg-white p-5 text-center shadow-xl">
            <p className="text-lg font-semibold">Profile updated successfully!</p>
            <button
              type="button"
              onClick={() => setDialog(false)}
              className="mt-4 rounded-lg bg-[#7952b3] px-4 py-2 text-white"
            >
              OK
            </button>
          </div>
        </div>
      ) : null}
    </AdminShell>
  );
}
