import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ArrowRight, Award, CalendarDays, GraduationCap, QrCode, Users, UsersRound } from "lucide-react";

import { LandingHeader } from "@/components/landing/landing-header";
import { BrandLogo } from "@/components/shared/brand-logo";
import { getCurrentUser } from "@/lib/auth/dal";
import { defaultDashboard } from "@/lib/navigation";

export const metadata: Metadata = {
  title: "EventHub — Make Every Event Count",
  description: "A centralized platform for university events, attendance management, and digital certificates at Wesleyan University–Philippines.",
};

const features = [
  { title: "Event Management", text: "Create, organize, and manage university events.", icon: CalendarDays, rotation: "md:-rotate-3", iconColor: "bg-orange-50 text-orange-800" },
  { title: "QR Attendance", text: "Record and monitor attendance using secure QR codes.", icon: QrCode, rotation: "md:rotate-3", iconColor: "bg-slate-100 text-slate-900" },
  { title: "Digital Certificates", text: "Generate verifiable certificates for eligible participants.", icon: Award, rotation: "md:-rotate-2", iconColor: "bg-orange-50 text-orange-800" },
  { title: "Participant Management", text: "Manage registrations and track event participation.", icon: Users, rotation: "md:rotate-2", iconColor: "bg-slate-100 text-slate-900" },
];
const steps = [
  { title: "Discover", text: "Find university events and activities." },
  { title: "Register", text: "Sign up for events you want to attend." },
  { title: "Attend", text: "Record your attendance through QR scanning." },
  { title: "Certificate", text: "Access your certificate when eligible." },
];
const container = "mx-auto w-full max-w-6xl px-5 sm:px-8";
const section = `${container} py-12 sm:py-16`;
const eyebrow = "text-xs font-semibold uppercase tracking-[.14em] text-orange-800";
const heading = "text-2xl font-semibold leading-tight tracking-[-.03em] text-balance sm:text-3xl";
const startButton = "inline-flex min-h-11 items-center justify-center gap-3 rounded-md bg-orange-800 px-6 text-sm font-semibold text-white transition-colors hover:bg-orange-900 active:bg-orange-950";

function StartLink({ href }: { href: string }) {
  return <Link href={href} className={startButton}>Get Started<ArrowRight className="size-4" aria-hidden="true" /></Link>;
}

async function GetStarted() {
  const user = await getCurrentUser();
  // Reuse the auth entry policy; destination routes still enforce onboarding and roles.
  return <StartLink href={user ? defaultDashboard(user) : "/signup"} />;
}

export default function Home() {
  return (
    <div className="landing min-h-svh bg-[#faf9f6] text-slate-900">
      <a href="#main-content" className="sr-only z-50 rounded bg-white px-4 py-2 focus:not-sr-only focus:fixed focus:left-4 focus:top-4">Skip to content</a>
      <LandingHeader />
      <main id="main-content" tabIndex={-1}>
        {/* The navbar is h-16 (4rem) plus its 1px bottom border. */}
        <section aria-labelledby="hero-title" className="border-b border-stone-200 lg:flex lg:min-h-[calc(100dvh-4rem-1px)] lg:items-center">
          <div className={`${container} grid gap-9 py-10 sm:py-12 lg:grid-cols-[1.15fr_1fr] lg:items-center lg:gap-14 lg:py-8`}>
            <div className="min-w-0">
              <p className={`mb-5 ${eyebrow} lg:text-sm`}>Wesleyan University–Philippines</p>
              <h1 id="hero-title" className="max-w-xl text-[2.25rem] font-bold leading-[1.1] tracking-[-.04em] text-balance sm:text-[2.75rem] lg:text-[4rem]">Make Every<br className="hidden lg:block" /> Event <span className="text-orange-800">Count.</span></h1>
              <p className="mt-5 max-w-md text-base leading-relaxed text-slate-600 sm:text-lg lg:text-xl">A centralized platform for university events, attendance management, and digital certificates.</p>
              <div className="mt-7">
                <Suspense fallback={<StartLink href="/signup" />}><GetStarted /></Suspense>
              </div>
            </div>
            <aside className="min-w-0 rounded-xl bg-slate-900 p-6 text-white sm:p-8" aria-labelledby="roles-title">
              <p className="text-xs font-semibold uppercase tracking-[.14em] text-orange-300">Built for university events</p>
              <h2 id="roles-title" className="mt-3 max-w-sm text-2xl font-medium leading-snug tracking-tight text-balance lg:text-3xl">One platform for students and organizers.</h2>
              <div className="mt-6 divide-y divide-slate-700 border-t border-slate-700">
                <div className="flex gap-4 py-5">
                  <GraduationCap className="mt-0.5 size-5 shrink-0 text-orange-300" aria-hidden="true" />
                  <div><h3 className="text-sm font-semibold lg:text-base">For Students</h3><p className="mt-1.5 text-sm leading-relaxed text-slate-300 lg:text-[1.0625rem]">Discover university events, manage participation, and access digital certificates.</p></div>
                </div>
                <div className="flex gap-4 pt-5">
                  <UsersRound className="mt-0.5 size-5 shrink-0 text-orange-300" aria-hidden="true" />
                  <div><h3 className="text-sm font-semibold lg:text-base">For Organizers</h3><p className="mt-1.5 text-sm leading-relaxed text-slate-300 lg:text-[1.0625rem]">Create and manage events, monitor attendance, and issue certificates.</p></div>
                </div>
              </div>
            </aside>
          </div>
        </section>

        <section id="features" tabIndex={-1} aria-labelledby="features-title" className="border-b border-stone-200 bg-[#faf9f6]">
          <div className={section}>
            <div className="mx-auto max-w-2xl text-center">
              <p className={`mb-2 ${eyebrow}`}>Features</p>
              <h2 id="features-title" className={heading}>Everything You Need for Better Events.</h2>
              <p className="mt-3 text-sm leading-relaxed text-slate-600 sm:text-base">Tools designed to simplify university event management.</p>
            </div>
            <div className="mx-auto mt-8 grid max-w-3xl auto-rows-fr gap-5 sm:mt-10 sm:grid-cols-2 sm:gap-8 md:gap-10 md:py-3">
              {features.map(feature => (
                <article key={feature.title} className={`min-w-0 rounded-xl border border-stone-200 bg-white p-6 shadow-[0_10px_32px_-8px_rgba(15,23,42,0.10)] sm:p-7 ${feature.rotation} motion-safe:transition-transform motion-safe:duration-200 motion-safe:md:hover:rotate-0`}>
                  <span className={`mb-5 flex size-10 items-center justify-center rounded-lg ${feature.iconColor}`}>
                    <feature.icon className="size-5" strokeWidth={1.75} aria-hidden="true" />
                  </span>
                  <h3 className="text-base font-bold sm:text-lg">{feature.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">{feature.text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="how-it-works" tabIndex={-1} aria-labelledby="how-title" className="border-b border-stone-200">
          <div className={`${section} grid gap-8 lg:grid-cols-[1fr_1.15fr] lg:gap-16`}>
            <div><p className={`mb-2 ${eyebrow}`}>How It Works</p><h2 id="how-title" className={`${heading} max-w-sm`}>From Registration to Recognition.</h2></div>
            <ol className="relative before:absolute before:bottom-6 before:left-5 before:top-5 before:w-px before:bg-stone-300">
              {steps.map((step, index) => (
                <li key={step.title} className="relative flex gap-5 pb-6 last:pb-0">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-full border border-stone-300 bg-[#faf9f6] text-xs font-semibold tabular-nums text-orange-800">0{index + 1}</span>
                  <div className="min-w-0 pt-1"><h3 className="text-base font-semibold">{step.title}</h3><p className="mt-1 text-sm leading-relaxed text-slate-600">{step.text}</p></div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section id="about" tabIndex={-1} aria-labelledby="about-title" className="bg-white">
          <div className={`${section} grid gap-8 lg:grid-cols-[1.4fr_1fr] lg:items-center lg:gap-20`}>
            <div>
              <p className={`mb-2 ${eyebrow}`}>About EventHub</p>
              <h2 id="about-title" className={heading}>Connecting Events and People.</h2>
              <p className="mt-4 max-w-xl text-sm leading-7 text-slate-600">EventHub is a university event management platform developed for the College Local Council of Wesleyan University–Philippines. It provides a centralized digital space for organizing activities and managing student participation.</p>
            </div>
            <div className="border-l-2 border-orange-700 py-2 pl-6">
              <p className="max-w-xs text-xl font-medium leading-snug tracking-tight">Wesleyan University–Philippines</p>
              <p className="mt-3 text-sm text-slate-600">College Local Council</p>
            </div>
          </div>
        </section>
      </main>
      <footer className="border-t border-stone-200 bg-white">
        <div className={`${container} flex flex-col gap-4 py-6 sm:flex-row sm:items-center sm:justify-between`}>
          <Link href="/" aria-label="EventHub home" className="w-fit"><BrandLogo className="w-28" sizes="112px" /></Link>
          <p className="text-xs leading-relaxed text-slate-500">© 2026 EventHub. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
