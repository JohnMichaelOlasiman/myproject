import { Course, LabNumber, Level } from "@/lib/supabase/types";

export const courseOptions: Course[] = ["BSIT", "BSCS", "ACT"];
export const levelOptions: Level[] = ["1", "2", "3", "4"];
export const labOptions: LabNumber[] = ["524", "526", "528", "530", "542", "544"];

export const purposeOptions = [
  "C Programming",
  "C# Programming",
  "Java Programming",
  "PHP Programming",
  "ASP Net",
  "Web Development",
  "Systems Integration & Architecture",
  "Embedded Systems & IoT",
  "Digital Logic & Design",
  "Computer Application",
  "Database",
  "Project Management",
  "Mobile Application",
  "Others",
] as const;
