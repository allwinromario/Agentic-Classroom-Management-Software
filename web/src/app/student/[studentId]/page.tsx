import { notFound } from "next/navigation";
import { loadStudentDashboard } from "@/lib/studentDashboard";
import { getDemoDashboard } from "@/lib/demoDashboard";
import { StudentDashboardView } from "@/components/StudentDashboardView";

export default async function StudentDashboardPage({
  params,
}: {
  params: Promise<{ studentId: string }>;
}) {
  const { studentId } = await params;
  const result = await loadStudentDashboard(studentId);

  if (result.ok === false && result.reason === "not_found") {
    notFound();
  }

  if (result.ok === false && result.reason === "error") {
    return (
      <main className="space-y-6">
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
          <p className="font-medium">MongoDB error</p>
          <p className="mt-1 opacity-90">{result.message}</p>
        </div>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Fix <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-800">MONGODB_URI</code> in{" "}
          <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-800">.env.local</code> or check Atlas IP allowlist.
        </p>
        <StudentDashboardView d={getDemoDashboard(studentId)} />
      </main>
    );
  }

  const d = result.ok ? result.data : getDemoDashboard(studentId);
  const showDemoNote = !result.ok && result.reason === "no_database";

  return (
    <main className="space-y-8">
      {showDemoNote && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
          <p className="font-medium">Demo data</p>
          <p className="mt-1 opacity-90">
            Set <code className="rounded bg-amber-100/80 px-1 dark:bg-amber-900/50">MONGODB_URI</code> in{" "}
            <code className="rounded bg-amber-100/80 px-1 dark:bg-amber-900/50">scms/web/.env.local</code> (same as
            Python <code className="rounded bg-amber-100/80 px-1 dark:bg-amber-900/50">agents/config.py</code>) to load
            real students and attendance.
          </p>
        </div>
      )}
      <StudentDashboardView d={d} />
    </main>
  );
}
