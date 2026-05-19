"use client";

import Image from "next/image";
import { FormEvent, ReactNode, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { getCurrentProfile, listPublicLeaderboard, signInWithPassword, signUpStudent } from "@/lib/supabase/data";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { courseOptions, levelOptions } from "@/lib/supabase/constants";
import { computeLeaderboardScore, formatMinutesAsDuration } from "@/lib/sit-in-metrics";
import { Course, Level } from "@/lib/supabase/types";
import styles from "./auth-experience.module.css";

type AuthMode = "login" | "signup";
type LoginField = "identifier" | "password";
type SignupField =
  | "idno"
  | "lastname"
  | "firstname"
  | "course"
  | "level"
  | "email"
  | "username"
  | "password";
type DropdownKey = "course" | "level" | null;
type FieldErrors<T extends string> = Partial<Record<T, string>>;

type AuthExperienceProps = {
  defaultMode?: AuthMode;
};

type FloatingFieldProps = {
  id: string;
  label: string;
  value: string;
  type?: "text" | "password" | "email";
  autoComplete?: string;
  error?: string;
  action?: ReactNode;
  onChange: (value: string) => void;
};

type SelectFieldProps<T extends string> = {
  id: string;
  label: string;
  value: T;
  options: readonly T[];
  isOpen: boolean;
  error?: string;
  onToggle: () => void;
  onSelect: (value: T) => void;
};

function stripError<T extends string>(errors: FieldErrors<T>, key: T): FieldErrors<T> {
  if (!errors[key]) {
    return errors;
  }
  const next = { ...errors };
  delete next[key];
  return next;
}

function initials(name: string) {
  return name
    .split(" ")
    .slice(0, 2)
    .map((part) => part[0] ?? "")
    .join("")
    .toUpperCase();
}

function FloatingField({
  id,
  label,
  value,
  type = "text",
  autoComplete,
  error,
  action,
  onChange,
}: FloatingFieldProps) {
  return (
    <div className={styles.fieldBlock}>
      <div
        className={[
          styles.field,
          value ? styles.fieldFilled : "",
          action ? styles.fieldWithAction : "",
          error ? styles.fieldInvalid : "",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        <input
          id={id}
          type={type}
          value={value}
          autoComplete={autoComplete}
          placeholder=" "
          onChange={(event) => onChange(event.target.value)}
        />
        <label htmlFor={id}>{label}</label>
        {action ? <div className={styles.fieldAction}>{action}</div> : null}
      </div>
      {error ? <p className={styles.fieldError}>{error}</p> : null}
    </div>
  );
}

function SelectField<T extends string>({
  id,
  label,
  value,
  options,
  isOpen,
  error,
  onToggle,
  onSelect,
}: SelectFieldProps<T>) {
  return (
    <div className={styles.fieldBlock}>
      <div className={[styles.selectWrap, isOpen ? styles.selectOpen : "", error ? styles.fieldInvalid : ""].join(" ")}>
        <label htmlFor={id} className={styles.selectLabel}>
          {label}
        </label>
        <button id={id} type="button" className={styles.selectButton} onClick={onToggle} aria-expanded={isOpen}>
          <span className={styles.selectValue}>{value}</span>
          <span className={styles.selectChevron} aria-hidden>
            v
          </span>
        </button>
        <div className={styles.selectOptions}>
          {options.map((option) => (
            <button
              key={option}
              type="button"
              className={[styles.selectOption, option === value ? styles.selectOptionActive : ""].join(" ")}
              onClick={() => onSelect(option)}
            >
              {option}
            </button>
          ))}
        </div>
      </div>
      {error ? <p className={styles.fieldError}>{error}</p> : null}
    </div>
  );
}

export default function AuthExperience({ defaultMode = "login" }: AuthExperienceProps) {
  const router = useRouter();
  const selectContainerRef = useRef<HTMLDivElement>(null);

  const [mode, setMode] = useState<AuthMode>(defaultMode);
  const [openDropdown, setOpenDropdown] = useState<DropdownKey>(null);
  const [redirectPath, setRedirectPath] = useState("/dashboard");
  const [showSuccessDialog, setShowSuccessDialog] = useState<null | "login" | "register">(null);
  const [leaderboardRows, setLeaderboardRows] = useState<
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
  const [leaderboardError, setLeaderboardError] = useState("");
  const [leaderboardLastUpdated, setLeaderboardLastUpdated] = useState("");

  const [loginLoading, setLoginLoading] = useState(false);
  const [signupLoading, setSignupLoading] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [signupError, setSignupError] = useState("");
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [showSignupPassword, setShowSignupPassword] = useState(false);

  const [identifier, setIdentifier] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginErrors, setLoginErrors] = useState<FieldErrors<LoginField>>({});

  const [idno, setIdno] = useState("");
  const [lastname, setLastname] = useState("");
  const [firstname, setFirstname] = useState("");
  const [middlename, setMiddlename] = useState("");
  const [course, setCourse] = useState<Course>("BSIT");
  const [level, setLevel] = useState<Level>("1");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [signupErrors, setSignupErrors] = useState<FieldErrors<SignupField>>({});

  useEffect(() => {
    const closeSelect = (event: MouseEvent) => {
      if (selectContainerRef.current?.contains(event.target as Node)) {
        return;
      }
      setOpenDropdown(null);
    };
    document.addEventListener("mousedown", closeSelect);
    return () => {
      document.removeEventListener("mousedown", closeSelect);
    };
  }, []);

  useEffect(() => {
    let active = true;

    const loadLeaderboard = async () => {
      if (!isSupabaseConfigured) {
        if (active) {
          setLeaderboardRows([]);
          setLeaderboardError("Supabase is not configured.");
        }
        return;
      }

      try {
        const rows = await listPublicLeaderboard(10);
        if (!active) {
          return;
        }
        const ranking = rows.map((student) => ({
          id: student.id,
          fullName: `${student.firstname} ${student.lastname}`.trim(),
          course: student.course,
          level: student.level,
          points: student.points,
          totalMinutes: student.hours_spent,
          tasks: student.tasks_completed,
          totalScore: computeLeaderboardScore(student.points, student.hours_spent, student.tasks_completed),
        }));
        setLeaderboardRows(ranking);
        setLeaderboardError("");
        setLeaderboardLastUpdated(new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }));
      } catch (error) {
        if (active) {
          setLeaderboardRows([]);
          setLeaderboardError(error instanceof Error ? error.message : "Unable to load leaderboard.");
        }
      }
    };

    void loadLeaderboard();
    const intervalId = window.setInterval(() => {
      void loadLeaderboard();
    }, 12000);

    return () => {
      active = false;
      window.clearInterval(intervalId);
    };
  }, []);

  const changeMode = (nextMode: AuthMode) => {
    if (nextMode === mode) {
      return;
    }
    setMode(nextMode);
    setOpenDropdown(null);
    setLoginError("");
    setSignupError("");
    if (typeof window !== "undefined") {
      const nextPath = nextMode === "signup" ? "/register" : "/login";
      if (window.location.pathname !== nextPath) {
        window.history.replaceState(window.history.state, "", nextPath);
      }
    }
  };

  const validateLogin = (): FieldErrors<LoginField> => {
    const nextErrors: FieldErrors<LoginField> = {};
    if (!identifier.trim()) {
      nextErrors.identifier = "Please enter your ID number.";
    }
    if (!loginPassword.trim()) {
      nextErrors.password = "Please enter your password.";
    }
    return nextErrors;
  };

  const validateSignup = (): FieldErrors<SignupField> => {
    const nextErrors: FieldErrors<SignupField> = {};
    if (!idno.trim()) {
      nextErrors.idno = "Please provide your ID number.";
    }
    if (!lastname.trim()) {
      nextErrors.lastname = "Last name is required.";
    }
    if (!firstname.trim()) {
      nextErrors.firstname = "First name is required.";
    }
    if (!course) {
      nextErrors.course = "Please choose your course.";
    }
    if (!level) {
      nextErrors.level = "Please choose your level.";
    }
    if (!email.trim()) {
      nextErrors.email = "Please enter your email address.";
    } else if (!email.includes("@")) {
      nextErrors.email = "Enter a valid email address.";
    }
    if (!username.trim()) {
      nextErrors.username = "Please create a username.";
    }
    if (!signupPassword.trim()) {
      nextErrors.password = "Please create a password.";
    }
    return nextErrors;
  };

  const handleLoginSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextErrors = validateLogin();
    setLoginErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      return;
    }
    if (!isSupabaseConfigured) {
      setLoginError(
        "Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (or NEXT_PUBLIC_SUPABASE_ANON_KEY).",
      );
      return;
    }

    setLoginLoading(true);
    setLoginError("");
    try {
      const normalizedIdentifier = identifier.trim().toLowerCase();
      const session = await signInWithPassword(identifier, loginPassword);
      let profile = null;
      try {
        profile = await getCurrentProfile();
      } catch (profileError) {
        const isFetchError =
          profileError instanceof TypeError && profileError.message.toLowerCase().includes("failed to fetch");
        const isReachabilityError =
          profileError instanceof Error && profileError.message.includes("Unable to reach Supabase API");
        if (!isFetchError && !isReachabilityError) {
          throw profileError;
        }
      }
      const isAdminLogin =
        session.user?.user_metadata?.role === "admin" ||
        profile?.role === "admin" ||
        normalizedIdentifier === "admin" ||
        normalizedIdentifier === "admin@example.com";
      setRedirectPath(isAdminLogin ? "/admin/dashboard" : "/dashboard");
      setShowSuccessDialog("login");
    } catch (submitError) {
      setLoginError(submitError instanceof Error ? submitError.message : "Unable to login.");
    } finally {
      setLoginLoading(false);
    }
  };

  const handleSignupSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextErrors = validateSignup();
    setSignupErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      return;
    }
    if (!isSupabaseConfigured) {
      setSignupError(
        "Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (or NEXT_PUBLIC_SUPABASE_ANON_KEY).",
      );
      return;
    }

    setSignupLoading(true);
    setSignupError("");
    try {
      await signUpStudent({
        idno,
        lastname,
        firstname,
        middlename,
        course,
        level,
        email,
        username,
        password: signupPassword,
      });
      setShowSuccessDialog("register");
    } catch (submitError) {
      setSignupError(submitError instanceof Error ? submitError.message : "Unable to register account.");
    } finally {
      setSignupLoading(false);
    }
  };

  return (
    <main className={styles.scene}>
      <div className={styles.card}>
        <section className={styles.leftColumn}>
          <header className={styles.brandBlock}>
            <Image src="/inc/CCS_LOGO.png" alt="CCS shield logo" width={80} height={80} priority />
            <div>
              <p className={styles.brandTitle}>SIT-IN MONITORING SYSTEM</p>
              <p className={styles.brandSubtitle}>Live Leaderboard</p>
            </div>
          </header>

          <div className={styles.publicLeaderboard}>
            <div className={styles.publicLeaderboardHeader}>
              <div>
                <h2>Top 10</h2>
              </div>
              <div className={styles.leaderLivePill}>
                <span className={styles.leaderLiveDot} aria-hidden />
                <span>Live</span>
                <span className={styles.leaderLiveMeta}>{leaderboardLastUpdated ? `Updated ${leaderboardLastUpdated}` : "Refreshing"}</span>
              </div>
            </div>
            <p className={styles.publicLeaderboardState}>Ranked by 60% points, 20% hours, and 20% tasks.</p>
            {leaderboardError ? <p className={styles.publicLeaderboardState}>{leaderboardError}</p> : null}
            {!leaderboardError && leaderboardRows.length === 0 ? (
              <p className={styles.publicLeaderboardState}>Leaderboard will appear here once data is available.</p>
            ) : null}
            {leaderboardRows.length > 0 ? (
              <div className={styles.publicLeaderboardList}>
                {leaderboardRows.map((student, index) => (
                  <div key={student.id} className={styles.leaderItem}>
                    <div className={styles.leaderPrimary}>
                      <span className={styles.leaderRank}>#{index + 1}</span>
                      <span className={styles.leaderAvatar}>{initials(student.fullName)}</span>
                      <div>
                        <p className={styles.leaderName}>{student.fullName}</p>
                        <p className={styles.leaderMeta}>
                          {student.course} • Level {student.level}
                        </p>
                      </div>
                    </div>
                    <div className={styles.leaderSecondary}>
                      <p className={styles.leaderScore}>{student.totalScore.toFixed(2)}</p>
                      <p className={styles.leaderStats}>
                        {student.points} pts • {formatMinutesAsDuration(student.totalMinutes)} • {student.tasks} tasks
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </section>

        <section className={styles.rightColumn}>
          <div className={styles.formContainer}>
            <div className={styles.headerBlock}>
              <h1 className={styles.heading}>{mode === "login" ? "SIGN IN" : "SIGN UP"}</h1>
              <p className={styles.subheading}>
                {mode === "login"
                  ? "Welcome back! Please enter your details."
                  : "Create your account to access the SIT-IN monitoring dashboard."}
              </p>
            </div>

            <div className={styles.formsStack}>
              <form
                noValidate
                onSubmit={handleLoginSubmit}
                className={[
                  styles.formPanel,
                  mode === "login" ? styles.panelActive : styles.panelExitUp,
                ].join(" ")}
              >
                <FloatingField
                  id="identifier"
                  label="ID Number"
                  value={identifier}
                  autoComplete="off"
                  error={loginErrors.identifier}
                  onChange={(value) => {
                    setIdentifier(value);
                    setLoginErrors((current) => stripError(current, "identifier"));
                  }}
                />

                <FloatingField
                  id="login-password"
                  label="Password"
                  value={loginPassword}
                  type={showLoginPassword ? "text" : "password"}
                  autoComplete="current-password"
                  error={loginErrors.password}
                  action={
                    <button
                      type="button"
                      className={styles.showButton}
                      onClick={() => setShowLoginPassword((current) => !current)}
                    >
                      <i className={showLoginPassword ? "far fa-eye-slash" : "far fa-eye"} aria-hidden />
                      <span>{showLoginPassword ? "Hide" : "Show"}</span>
                    </button>
                  }
                  onChange={(value) => {
                    setLoginPassword(value);
                    setLoginErrors((current) => stripError(current, "password"));
                  }}
                />

                <div className={styles.buttonRow}>
                  <button type="submit" disabled={loginLoading} className={styles.primaryButton}>
                    {loginLoading ? "Signing In..." : "Sign In"}
                  </button>
                </div>
                {loginError ? <p className={styles.formError}>{loginError}</p> : null}
                <p className={styles.footerText}>
                  Don&apos;t have an account?{" "}
                  <button type="button" className={styles.inlineLink} onClick={() => changeMode("signup")}>
                    Sign Up here
                  </button>
                </p>
              </form>

              <form
                noValidate
                onSubmit={handleSignupSubmit}
                className={[
                  styles.formPanel,
                  mode === "signup" ? styles.panelActive : styles.panelExitDown,
                ].join(" ")}
              >
                <div className={styles.twoColumnGrid}>
                  <FloatingField
                    id="idno"
                    label="ID Number"
                    value={idno}
                    error={signupErrors.idno}
                    onChange={(value) => {
                      setIdno(value);
                      setSignupErrors((current) => stripError(current, "idno"));
                    }}
                  />
                </div>

                <div className={styles.nameBlock}>
                  <p className={styles.groupLabel}>Name (Last, First, Middle)</p>
                  <div className={styles.nameGrid}>
                    <FloatingField
                      id="lastname"
                      label="Last Name"
                      value={lastname}
                      error={signupErrors.lastname}
                      onChange={(value) => {
                        setLastname(value);
                        setSignupErrors((current) => stripError(current, "lastname"));
                      }}
                    />
                    <FloatingField
                      id="firstname"
                      label="First Name"
                      value={firstname}
                      error={signupErrors.firstname}
                      onChange={(value) => {
                        setFirstname(value);
                        setSignupErrors((current) => stripError(current, "firstname"));
                      }}
                    />
                    <FloatingField
                      id="middlename"
                      label="Middle Name"
                      value={middlename}
                      onChange={(value) => {
                        setMiddlename(value);
                      }}
                    />
                  </div>
                </div>

                <div className={styles.twoColumnGrid} ref={selectContainerRef}>
                  <SelectField
                    id="course"
                    label="Course"
                    value={course}
                    options={courseOptions}
                    isOpen={openDropdown === "course"}
                    error={signupErrors.course}
                    onToggle={() => setOpenDropdown((current) => (current === "course" ? null : "course"))}
                    onSelect={(value) => {
                      setCourse(value);
                      setOpenDropdown(null);
                      setSignupErrors((current) => stripError(current, "course"));
                    }}
                  />
                  <SelectField
                    id="level"
                    label="Level"
                    value={level}
                    options={levelOptions}
                    isOpen={openDropdown === "level"}
                    error={signupErrors.level}
                    onToggle={() => setOpenDropdown((current) => (current === "level" ? null : "level"))}
                    onSelect={(value) => {
                      setLevel(value);
                      setOpenDropdown(null);
                      setSignupErrors((current) => stripError(current, "level"));
                    }}
                  />
                </div>

                <FloatingField
                  id="email"
                  label="Email Address"
                  value={email}
                  type="email"
                  autoComplete="email"
                  error={signupErrors.email}
                  onChange={(value) => {
                    setEmail(value);
                    setSignupErrors((current) => stripError(current, "email"));
                  }}
                />

                <FloatingField
                  id="username"
                  label="Username"
                  value={username}
                  autoComplete="username"
                  error={signupErrors.username}
                  onChange={(value) => {
                    setUsername(value);
                    setSignupErrors((current) => stripError(current, "username"));
                  }}
                />

                <FloatingField
                  id="signup-password"
                  label="Password"
                  value={signupPassword}
                  type={showSignupPassword ? "text" : "password"}
                  autoComplete="new-password"
                  error={signupErrors.password}
                  action={
                    <button
                      type="button"
                      className={styles.showButton}
                      onClick={() => setShowSignupPassword((current) => !current)}
                    >
                      <i className={showSignupPassword ? "far fa-eye-slash" : "far fa-eye"} aria-hidden />
                      <span>{showSignupPassword ? "Hide" : "Show"}</span>
                    </button>
                  }
                  onChange={(value) => {
                    setSignupPassword(value);
                    setSignupErrors((current) => stripError(current, "password"));
                  }}
                />

                <div className={styles.buttonRow}>
                  <button type="submit" disabled={signupLoading} className={styles.primaryButton}>
                    {signupLoading ? "Registering..." : "Register"}
                  </button>
                </div>
                {signupError ? <p className={styles.formError}>{signupError}</p> : null}
                <p className={styles.footerText}>
                  Already have an account?{" "}
                  <button type="button" className={styles.inlineLink} onClick={() => changeMode("login")}>
                    Login here
                  </button>
                </p>
              </form>
            </div>
          </div>
        </section>
      </div>

      {showSuccessDialog ? (
        <div className={styles.dialogOverlay}>
          <div className={styles.dialog}>
            <p className={styles.dialogTitle}>
              {showSuccessDialog === "login" ? "Login Successful!" : "Registration Successful!"}
            </p>
            <button
              type="button"
              className={styles.dialogButton}
              onClick={() => {
                if (showSuccessDialog === "login") {
                  router.push(redirectPath);
                  return;
                }
                setShowSuccessDialog(null);
                changeMode("login");
              }}
            >
              {showSuccessDialog === "login" ? "Continue" : "Go to Sign In"}
            </button>
          </div>
        </div>
      ) : null}
    </main>
  );
}
