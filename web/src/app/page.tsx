"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import {
  Brain,
  Camera,
  Users,
  Calendar,
  Zap,
  Shield,
  BarChart3,
  MessageSquare,
  ArrowRight,
  Sparkles,
  GraduationCap,
  Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const features = [
  {
    icon: Camera,
    title: "AI Face Recognition",
    desc: "Automatic attendance via real-time facial detection. No manual marking needed.",
    color: "from-violet-500 to-purple-600",
    glow: "rgba(139, 92, 246, 0.2)",
  },
  {
    icon: Calendar,
    title: "Smart Timetable",
    desc: "Create, manage, and approve class schedules with a streamlined workflow.",
    color: "from-indigo-500 to-blue-600",
    glow: "rgba(99, 102, 241, 0.2)",
  },
  {
    icon: Users,
    title: "Role-Based Access",
    desc: "Separate dashboards for Super Admin, Teachers, and Students with precise permissions.",
    color: "from-cyan-500 to-teal-600",
    glow: "rgba(6, 182, 212, 0.2)",
  },
  {
    icon: BarChart3,
    title: "Analytics Dashboard",
    desc: "Visual insights on attendance rates, class participation, and trends.",
    color: "from-emerald-500 to-green-600",
    glow: "rgba(16, 185, 129, 0.2)",
  },
  {
    icon: MessageSquare,
    title: "AI Chatbot",
    desc: "Context-aware assistant for timetable queries, attendance info, and navigation.",
    color: "from-pink-500 to-rose-600",
    glow: "rgba(236, 72, 153, 0.2)",
  },
  {
    icon: Zap,
    title: "Real-Time Updates",
    desc: "Instant attendance sync, emergency alerts broadcast to all users simultaneously.",
    color: "from-amber-500 to-orange-600",
    glow: "rgba(245, 158, 11, 0.2)",
  },
];

const stats = [
  { value: "99%", label: "Recognition Accuracy" },
  { value: "<1s", label: "Real-Time Updates" },
  { value: "3", label: "Role Levels" },
  { value: "AI", label: "Powered Automation" },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen grid-bg overflow-hidden">
      {/* Ambient glow */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-indigo-600/5 rounded-full blur-3xl" />
      </div>

      {/* Nav */}
      <nav className="relative z-10 flex items-center justify-between px-8 py-5 max-w-7xl mx-auto">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm">
            SC
          </div>
          <span className="font-semibold text-zinc-100">SCMS</span>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/login">Sign In</Link>
          </Button>
          <Button size="sm" asChild>
            <Link href="/register">Get Started</Link>
          </Button>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative z-10 px-8 pt-20 pb-28 max-w-7xl mx-auto text-center">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7 }}
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-indigo-950/60 border border-indigo-800/60 text-indigo-300 text-sm mb-8">
            <Sparkles className="h-3.5 w-3.5" />
            AI-Powered Smart Classroom System
          </div>

          <h1 className="text-5xl sm:text-7xl font-bold tracking-tight text-zinc-50 mb-6 leading-[1.1]">
            The future of{" "}
            <span className="gradient-text">classroom</span>
            <br />management is here
          </h1>

          <p className="text-lg sm:text-xl text-zinc-400 max-w-2xl mx-auto mb-10 leading-relaxed">
            Automate attendance with facial recognition, manage timetables with
            approval workflows, and monitor everything in real-time — all in one
            intelligent platform.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button size="lg" asChild className="glow-accent">
              <Link href="/register">
                Start for Free
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link href="/login">Sign In</Link>
            </Button>
          </div>
        </motion.div>

        {/* Stats */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.3 }}
          className="mt-20 grid grid-cols-2 sm:grid-cols-4 gap-6"
        >
          {stats.map((s) => (
            <div key={s.label} className="glass rounded-2xl p-5 text-center">
              <p className="text-3xl font-bold gradient-text">{s.value}</p>
              <p className="text-sm text-zinc-500 mt-1">{s.label}</p>
            </div>
          ))}
        </motion.div>
      </section>

      {/* Features */}
      <section className="relative z-10 px-8 py-20 max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <p className="text-xs font-semibold uppercase tracking-widest text-indigo-400 mb-4">Features</p>
            <h2 className="text-4xl font-bold text-zinc-50 mb-4">
              Everything you need to run a smart classroom
            </h2>
            <p className="text-zinc-400 max-w-xl mx-auto">
              From AI-powered attendance to real-time dashboards, SCMS has every
              tool to make classroom management effortless.
            </p>
          </motion.div>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((f, i) => {
            const Icon = f.icon;
            return (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="glass rounded-2xl p-6 group hover:border-zinc-700 transition-all duration-300"
                style={{
                  boxShadow: `0 0 0 0 ${f.glow}`,
                  transition: "box-shadow 0.3s ease, border-color 0.3s ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.boxShadow = `0 0 30px 0 ${f.glow}`;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.boxShadow = `0 0 0 0 ${f.glow}`;
                }}
              >
                <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${f.color} flex items-center justify-center mb-4 shadow-lg group-hover:scale-110 transition-transform duration-200`}>
                  <Icon className="h-6 w-6 text-white" />
                </div>
                <h3 className="text-lg font-semibold text-zinc-100 mb-2">{f.title}</h3>
                <p className="text-sm text-zinc-400 leading-relaxed">{f.desc}</p>
              </motion.div>
            );
          })}
        </div>
      </section>

      {/* Roles */}
      <section className="relative z-10 px-8 py-20 max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
          >
            <h2 className="text-4xl font-bold text-zinc-50 mb-4">
              Built for every role
            </h2>
            <p className="text-zinc-400">
              Tailored experiences for administrators, teachers, and students.
            </p>
          </motion.div>
        </div>

        <div className="grid sm:grid-cols-3 gap-6">
          {[
            {
              icon: Shield,
              role: "Super Admin",
              color: "from-violet-500 to-purple-600",
              perks: ["Approve users & timetables", "Full database access", "System-wide control"],
            },
            {
              icon: GraduationCap,
              role: "Teacher (Admin)",
              color: "from-indigo-500 to-blue-600",
              perks: ["Create timetables", "AI attendance camera", "Emergency alerts"],
            },
            {
              icon: Clock,
              role: "Student",
              color: "from-emerald-500 to-teal-600",
              perks: ["View approved schedule", "Check attendance", "AI assistant"],
            },
          ].map((r, i) => {
            const Icon = r.icon;
            return (
              <motion.div
                key={r.role}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.15 }}
                className="glass rounded-2xl p-6"
              >
                <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${r.color} flex items-center justify-center mb-4`}>
                  <Icon className="h-6 w-6 text-white" />
                </div>
                <h3 className="text-lg font-semibold text-zinc-100 mb-4">{r.role}</h3>
                <ul className="space-y-2">
                  {r.perks.map((p) => (
                    <li key={p} className="flex items-center gap-2 text-sm text-zinc-400">
                      <div className={`w-1.5 h-1.5 rounded-full bg-gradient-to-r ${r.color}`} />
                      {p}
                    </li>
                  ))}
                </ul>
              </motion.div>
            );
          })}
        </div>
      </section>

      {/* CTA */}
      <section className="relative z-10 px-8 py-20 max-w-3xl mx-auto text-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          className="glass rounded-3xl p-12 border border-indigo-800/30"
          style={{ boxShadow: "0 0 60px rgba(99, 102, 241, 0.1)" }}
        >
          <Brain className="h-12 w-12 mx-auto mb-6 text-indigo-400" />
          <h2 className="text-4xl font-bold text-zinc-50 mb-4">
            Ready to transform your classroom?
          </h2>
          <p className="text-zinc-400 mb-8">
            Join the intelligent classroom revolution. Register your account and
            start managing smarter today.
          </p>
          <Button size="lg" asChild className="glow-accent">
            <Link href="/register">
              Create Account
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </motion.div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-zinc-800/60 px-8 py-8 text-center text-sm text-zinc-600">
        <p>© 2025 SCMS — Smart Classroom Management System. Built for the future of education.</p>
      </footer>
    </div>
  );
}
