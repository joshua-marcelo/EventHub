"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { Menu, X } from "lucide-react";
import { BrandLogo } from "@/components/shared/brand-logo";
import { cn } from "@/lib/utils";

const links = [
  { label: "Features", href: "#features" },
  { label: "How It Works", href: "#how-it-works" },
  { label: "About", href: "#about" },
];
const button = "inline-flex h-11 items-center justify-center rounded-md px-4 text-sm font-semibold transition-colors active:translate-y-px";
const loginButton = cn(button, "border border-stone-300 bg-white text-slate-900 hover:border-slate-500 hover:bg-stone-50");
const signupButton = cn(button, "bg-slate-900 text-white hover:bg-slate-700");

/** Landing navigation: logo left, section links centered, auth buttons right; a disclosure menu below `lg`. */
export function LandingHeader() {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState("");
  const toggle = useRef<HTMLButtonElement>(null);
  const menuId = useId();

  useEffect(() => {
    const sections = links.flatMap(link => {
      const section = document.querySelector(link.href);
      return section ? [section] : [];
    });
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (entry.isIntersecting) setActive(`#${entry.target.id}`);
      }
    }, { rootMargin: "-10% 0px -50% 0px" });
    sections.forEach(section => observer.observe(section));
    const clearAtTop = () => { if (window.scrollY < 80) setActive(""); };
    window.addEventListener("scroll", clearAtTop, { passive: true });
    return () => { observer.disconnect(); window.removeEventListener("scroll", clearAtTop); };
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") { setOpen(false); toggle.current?.focus(); } };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return <header className="relative border-b border-stone-200 bg-white">
    <nav aria-label="Main navigation" className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-5 sm:px-8 lg:grid lg:grid-cols-[1fr_auto_1fr]">
      <Link href="/" aria-label="EventHub home" className="w-fit shrink-0"><BrandLogo preload className="w-32 sm:w-40" sizes="(min-width: 640px) 160px, 128px" /></Link>
      <ul className="hidden items-center gap-8 text-sm font-medium text-slate-700 lg:flex">
        {links.map(link => <li key={link.href}><a href={link.href} aria-current={active === link.href ? "location" : undefined} onClick={() => setActive(link.href)} className="inline-flex min-h-11 items-center rounded-sm py-2 transition-colors hover:text-orange-800 active:text-orange-900 aria-[current=location]:text-orange-800 aria-[current=location]:underline aria-[current=location]:underline-offset-8">{link.label}</a></li>)}
      </ul>
      <div className="flex items-center justify-end gap-3">
        <Link href="/login" className={cn(loginButton, "hidden sm:inline-flex")}>Log In</Link>
        <Link href="/signup" className={cn(signupButton, "hidden sm:inline-flex")}>Sign Up</Link>
        <button ref={toggle} type="button" aria-expanded={open} aria-controls={menuId} onClick={() => setOpen(value => !value)} className="inline-flex size-11 items-center justify-center rounded-md border border-stone-300 text-slate-900 hover:bg-stone-50 active:bg-stone-100 lg:hidden">
          {open ? <X className="size-5" aria-hidden="true" /> : <Menu className="size-5" aria-hidden="true" />}
          <span className="sr-only">{open ? "Close menu" : "Open menu"}</span>
        </button>
      </div>
    </nav>
    <div id={menuId} hidden={!open} className="absolute inset-x-0 top-full z-40 border-b border-stone-200 bg-white shadow-sm lg:hidden">
      <ul className="mx-auto max-w-6xl px-5 py-2 sm:px-8">
        {links.map(link => <li key={link.href}><a href={link.href} aria-current={active === link.href ? "location" : undefined} onClick={() => { setOpen(false); setActive(link.href); document.querySelector<HTMLElement>(link.href)?.focus({ preventScroll: true }); }} className="block border-b border-stone-100 py-3 text-sm font-medium text-slate-800 hover:text-orange-800 active:text-orange-900 aria-[current=location]:text-orange-800">{link.label}</a></li>)}
      </ul>
      <div className="mx-auto grid max-w-6xl grid-cols-2 gap-3 px-5 pb-5 pt-2 sm:hidden">
        <Link href="/login" className={loginButton}>Log In</Link>
        <Link href="/signup" className={signupButton}>Sign Up</Link>
      </div>
    </div>
  </header>;
}
