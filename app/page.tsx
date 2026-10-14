import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { Suspense } from "react";
import { ArrowRight, Award, CalendarDays, CirclePlay, GraduationCap, QrCode, UsersRound } from "lucide-react";

import { LandingHeader } from "@/components/landing/landing-header";
import { BrandLogo } from "@/components/shared/brand-logo";
import { getCurrentUser } from "@/lib/auth/dal";
import { defaultDashboard } from "@/lib/navigation";

export const metadata: Metadata = {
  title: "EventHub — Make Every Event Count",
  description: "A centralized platform for university events, attendance management, and digital certificates at Wesleyan University–Philippines.",
};

const features = [
  { title: "Event Management", text: "Create and manage university events, registrations, and participants.", icon: CalendarDays, position: "md:-rotate-3 md:translate-y-3 lg:-rotate-6 lg:translate-y-4" },
  { title: "QR Attendance", text: "Record and monitor event attendance through secure QR codes.", icon: QrCode, position: "z-10 md:-translate-y-2" },
  { title: "Digital Certificates", text: "Generate and verify certificates for eligible participants.", icon: Award, position: "md:rotate-3 md:translate-y-3 lg:rotate-6 lg:translate-y-4" },
];
const steps = [
  { title: "Discover & Register", text: "Find university events and register for the activities you want to attend." },
  { title: "Attend & Check In", text: "Scan the event QR code to record your attendance." },
  { title: "Get Your Certificate", text: "Access your verifiable digital certificate once you meet the event requirements." },
];
const container = "mx-auto w-full max-w-6xl px-5 sm:px-8";
const section = `${container} py-12 sm:py-16`;
const eyebrow = "text-xs font-semibold uppercase tracking-[.14em] text-orange-800";
const heading = "text-2xl font-semibold leading-tight tracking-[-.03em] text-balance sm:text-3xl";
const startButton = "inline-flex min-h-[54px] items-center justify-center gap-3 rounded-[8px] bg-orange-800 px-7 text-base font-semibold text-white transition-colors hover:bg-orange-900 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-orange-800 active:bg-orange-950 sm:px-8";
const demoButton = "inline-flex min-h-[54px] items-center justify-center gap-3 rounded-[8px] border border-stone-300 bg-white px-7 text-base font-semibold text-slate-900 transition-colors hover:border-slate-500 hover:bg-stone-50 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-orange-800 active:bg-stone-100 sm:px-8";

function StartLink({ href, label = "Get Started" }: { href: string; label?: string }) {
  return <Link href={href} className={startButton}>{label}<ArrowRight className="size-[18px]" aria-hidden="true" /></Link>;
}

async function GetStarted() {
  const user = await getCurrentUser();
  // Reuse the auth entry policy; destination routes still enforce onboarding and roles. The label
  // says where a signed-in visitor is going instead of implying sign-up.
  return user ? <StartLink href={defaultDashboard(user)} label="Go to Dashboard" /> : <StartLink href="/signup" />;
}

// The session is request data, so the static shell shows the guest header until it streams in.
async function AccountHeader() {
  const user = await getCurrentUser();
  return <LandingHeader dashboardHref={user ? defaultDashboard(user) : null} />;
}

export default function Home() {
  return (
    <div className="landing min-h-svh bg-[#faf9f6] text-slate-900">
      <a href="#main-content" className="sr-only z-50 rounded bg-white px-4 py-2 focus:not-sr-only focus:fixed focus:left-4 focus:top-4">Skip to content</a>
      <Suspense fallback={<LandingHeader />}><AccountHeader /></Suspense>
      <main id="main-content" tabIndex={-1}>
        {/* The navbar is h-16 (4rem) plus its 1px bottom border. */}
        <section aria-labelledby="hero-title" className="border-b border-transparent bg-[#faf9f6] lg:flex lg:min-h-[calc(100dvh-4rem-1px)] lg:items-center">
          <div className={`${container} grid gap-9 py-10 sm:py-12 lg:grid-cols-[1.15fr_1fr] lg:items-center lg:gap-14 lg:py-8`}>
            <div className="min-w-0">
              <p className={`mb-5 ${eyebrow} lg:text-sm`}>Wesleyan University–Philippines</p>
              <h1 id="hero-title" className="max-w-xl text-[2.25rem] font-bold leading-[1.1] tracking-[-.04em] text-balance sm:text-[2.75rem] lg:text-[4rem]">Make Every<br className="hidden lg:block" /> Event <span className="text-orange-800">Count.</span></h1>
              <p className="mt-5 max-w-md text-base leading-relaxed text-slate-600 sm:text-lg lg:text-xl">A centralized platform for university events, attendance management, and digital certificates.</p>
              {/* Stacked full width on narrow phones; side by side once both fit. */}
              <div className="mt-7 flex flex-col gap-3 min-[420px]:flex-row min-[420px]:items-center">
                <Suspense fallback={<StartLink href="/signup" />}><GetStarted /></Suspense>
                <Link href="/demo" className={demoButton}><CirclePlay className="size-[18px]" aria-hidden="true" />View Demo</Link>
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

        <section id="features" tabIndex={-1} aria-labelledby="features-title" className="border-b border-transparent bg-[#f5f5f5]">
          <div className={section}>
            <div className="mx-auto max-w-2xl text-center">
              <p className={`mb-2 ${eyebrow}`}>Features</p>
              <h2 id="features-title" className={heading}>Everything You Need for Better Events.</h2>
            </div>
            <div className="mx-auto mt-8 grid max-w-sm auto-rows-fr gap-5 md:mt-10 md:max-w-5xl md:grid-cols-3 md:gap-4 md:px-6 md:pb-8 md:pt-5 lg:px-10 lg:pb-10 lg:pt-8">
              {features.map((feature, index) => (
                <article key={feature.title} className={`relative flex min-w-0 origin-bottom flex-col rounded-xl border border-slate-700 bg-slate-900 p-6 text-white shadow-[0_12px_28px_-12px_rgba(15,23,42,0.35)] lg:p-7 ${feature.position} motion-safe:transition-transform motion-safe:duration-200 motion-safe:md:hover:rotate-0`}>
                  <div className="flex items-center justify-between text-orange-300">
                    <span className="text-sm font-semibold tabular-nums tracking-wider">0{index + 1}</span>
                    <feature.icon className="size-5" strokeWidth={1.75} aria-hidden="true" />
                  </div>
                  <h3 className="mt-6 text-lg font-bold leading-snug tracking-tight lg:text-xl">{feature.title}</h3>
                  <p className="mt-3 text-sm leading-relaxed text-slate-300">{feature.text}</p>
                  <div aria-hidden="true" className="mt-6 flex min-h-28 flex-1 items-center justify-center border-t border-slate-700 pt-5 text-orange-300">
                    {index === 0 ? (
                      <div className="flex items-center gap-4">
                        <CalendarDays className="size-16" strokeWidth={1} />
                        <span className="h-px w-5 bg-slate-600" />
                        <UsersRound className="size-8" strokeWidth={1.25} />
                      </div>
                    ) : index === 1 ? (
                      <div className="relative p-3">
                        <span className="absolute left-0 top-0 size-5 rounded-tl border-l border-t border-orange-300/60" />
                        <span className="absolute bottom-0 right-0 size-5 rounded-br border-b border-r border-orange-300/60" />
                        <QrCode className="size-20" strokeWidth={1.25} />
                      </div>
                    ) : (
                      <div className="flex h-28 w-24 items-center justify-center rounded-sm border border-slate-600">
                        <Award className="size-16" strokeWidth={1} />
                      </div>
                    )}
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="how-it-works" tabIndex={-1} aria-labelledby="how-title" className="border-b border-stone-200/60 bg-[#faf9f6]">
          <div className={`${section} grid items-center gap-8 lg:grid-cols-[.9fr_1.1fr] lg:gap-12`}>
            <div className="mx-auto w-full max-w-[320px] lg:max-w-[352px]">
              <Image
                src="/images/howitworks.png"
                alt="University student scanning an event QR code displayed on a laptop."
                width={1122}
                height={1402}
                sizes="(min-width: 1024px) 352px, (min-width: 360px) 320px, calc(100vw - 40px)"
                className="block aspect-[1122/1402] h-auto w-full rounded-xl object-contain"
              />
            </div>
            <div className="min-w-0">
              <p className={`mb-2 ${eyebrow}`}>How It Works</p>
              <h2 id="how-title" className={heading}>Three Steps.<br />One Seamless Experience.</h2>
              <ol className="mt-7">
                {steps.map((step, index) => (
                  <li key={step.title} className="relative flex gap-4 pb-7 last:pb-0 sm:gap-5">
                    {index < steps.length - 1 && <span aria-hidden="true" className="absolute bottom-0 left-[19.5px] top-10 w-px bg-stone-300" />}
                    <span className="relative flex size-10 shrink-0 items-center justify-center rounded-full border border-stone-300 bg-[#faf9f6] text-xs font-semibold tabular-nums text-orange-800">0{index + 1}</span>
                    <div className="min-w-0 pt-1"><h3 className="text-base font-semibold">{step.title}</h3><p className="mt-1.5 max-w-md text-sm leading-relaxed text-slate-600">{step.text}</p></div>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </section>

        <section id="about" tabIndex={-1} aria-labelledby="about-title" className="bg-[#faf9f6]">
          <div className={`${section} grid gap-8 lg:grid-cols-[3fr_2fr] lg:items-center lg:gap-14`}>
            <div className="min-w-0">
              <p className={`mb-3 ${eyebrow}`}>About EventHub</p>
              <h2 id="about-title" className={`${heading} max-w-xl lg:text-4xl`}>Connecting Events.<br />Empowering Participation.</h2>
              <p className="mt-5 max-w-xl text-base leading-7 text-slate-600">EventHub is an event management platform developed for the College Local Council of Wesleyan University–Philippines, designed to bring students and organizers together through a more organized digital experience.</p>
            </div>
            <div className="min-w-0 border-t border-stone-200 pt-6 lg:border-l lg:border-t-0 lg:py-2 lg:pl-8">
              <div className="flex items-start gap-4">
                <GraduationCap className="mt-1 size-6 shrink-0 text-orange-800" strokeWidth={1.5} aria-hidden="true" />
                <div className="min-w-0 max-w-xs">
                  <p className="text-xl font-semibold leading-snug tracking-tight text-balance lg:text-2xl">Wesleyan University–Philippines</p>
                  <p className="mt-4 border-t border-stone-200 pt-4 text-sm font-medium text-slate-600">College Local Council</p>
                </div>
              </div>
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
