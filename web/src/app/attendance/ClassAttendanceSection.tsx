"use client";

import { useCallback, useEffect, useState } from "react";
import { AttendanceCapture } from "./AttendanceCapture";

const CLASSES = [
  { id: "MATH101", label: "MATH101 — Mathematics" },
  { id: "PHY102", label: "PHY102 — Physics" },
  { id: "CHEM203", label: "CHEM203 — Chemistry" },
  { id: "BIO102", label: "BIO102 — Biology" },
  { id: "ENG101", label: "ENG101 — English" },
] as const;

type StudentRow = { student_id: string; name: string; class_id: string };

export function ClassAttendanceSection() {
  const [classId, setClassId] = useState<string>("MATH101");
  const [students, setStudents] = useState<StudentRow[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const fetchStudents = useCallback(async (cid: string) => {
    setLoadError(null);
    setStudents(null);
    try {
      const res = await fetch(`/api/students?class_id=${encodeURIComponent(cid)}`);
      const json = await res.json();
      if (!res.ok) {
        setLoadError(json.message ?? "Could not load students");
        setStudents([]);
        return;
      }
      const rows = (json.data ?? []) as StudentRow[];
      setStudents(rows);
    } catch {
      setLoadError("Network error");
      setStudents([]);
    }
  }, []);

  useEffect(() => {
    void fetchStudents(classId);
  }, [classId, fetchStudents]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
        <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300" htmlFor="class-select">
          Class
        </label>
        <select
          id="class-select"
          value={classId}
          onChange={(e) => setClassId(e.target.value)}
          className="max-w-md rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-900"
        >
          {CLASSES.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </select>
      </div>

      <section className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="text-sm font-medium text-zinc-500">Roster (from MongoDB)</h2>
        {loadError && (
          <p className="mt-2 text-sm text-amber-800 dark:text-amber-200">{loadError}</p>
        )}
        {!loadError && students === null && <p className="mt-2 text-sm text-zinc-500">Loading…</p>}
        {!loadError && students && students.length === 0 && (
          <p className="mt-2 text-sm text-zinc-500">No students for this class. Run DB setup / initialize_scms.</p>
        )}
        {!loadError && students && students.length > 0 && (
          <ul className="mt-3 max-h-48 overflow-auto text-sm">
            {students.map((s) => (
              <li key={s.student_id} className="flex justify-between border-b border-zinc-100 py-1 dark:border-zinc-800">
                <span>{s.name}</span>
                <span className="text-zinc-500">{s.student_id}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <AttendanceCapture classId={classId} />
    </div>
  );
}
