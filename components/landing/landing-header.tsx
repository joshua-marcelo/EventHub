"use client";

import Link from "next/link";
import { type MouseEvent, useEffect, useId, useRef, useState } from "react";
import { Menu, X } from "lucide-react";
import { BrandLogo } from "@/components/shared/brand-logo";
import { LandingAccountMenu, type LandingAccount } from "@/components/landing/landing-account-menu";
import { cn } from "@/lib/utils";
import "./landing-header.css";

const links = [
  { label: "Features", href: "#features" },
  { label: "How It Works", href: "#how-it-works" },
  { label: "About", href: "#about" },
];
const button = "inline-flex h-11 items-center justify-center rounded-md px-4 text-sm font-semibold transition-colors active:translate-y-px";
const loginButton = cn(button, "border border-stone-300 bg-white text-slate-900 hover:border-slate-500 hover:bg-stone-50");
const signupButton = cn(button, "bg-slate-900 text-white hover:bg-slate-700");

function GuestActions({ className }: { className?: string }) {
  return <>
    <Link href="/login" className={cn(loginButton, className)}>Log In</Link>
    <Link href="/signup" className={cn(signupButton, className)}>Sign Up</Link>
  </>;
}

/** Landing navigation: logo left, section links centered, account buttons right; a disclosure menu below `lg`. */
export function LandingHeader({ account }: { account?: LandingAccount | null }) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState("");
  const [scrolled, setScrolled] = useState(false);
  const header = useRef<HTMLElement>(null);
  const toggle = useRef<HTMLButtonElement>(null);
  const menuId = useId();

  function returnToTop(event: MouseEvent<HTMLAnchorElement>) {
    if (window.location.pathname !== "/" || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    setOpen(false);
    if (window.location.hash) {
      window.history.replaceState(window.history.state, "", window.location.pathname + window.location.search);
    }
    // Native scrolling uses the existing CSS smooth/reduced-motion preference.
    // The observer clears the active indicator once the hero comes into view.
    window.scrollTo({ top: 0, behavior: "auto" });
  }

  useEffect(() => {
    const navbar = header.current;
    const landing = navbar?.closest<HTMLElement>(".landing");
    const hero = document.querySelector<HTMLElement>("section[aria-labelledby='hero-title']");
    const footer = landing?.querySelector("footer");
    const sections = links.flatMap(link => {
      const section = document.querySelector<HTMLElement>(link.href);
      return section ? [section] : [];
    });
    if (!navbar || !landing || !hero || !footer) return;

    let sectionObserver: IntersectionObserver;
    let heroObserver: IntersectionObserver;
    let navbarHeight = 0;
    let activationLine = 0;
    const updateActive = () => {
      const last = sections.at(-1);
      // Short final sections cannot always reach the activation line before scrolling ends.
      const atEnd = footer.getBoundingClientRect().top < window.innerHeight;
      const current = atEnd && last && last.getBoundingClientRect().top < window.innerHeight
        ? last
        : sections.find(section => {
          const rect = section.getBoundingClientRect();
          return rect.top <= activationLine && rect.bottom > activationLine;
        });
      setActive(current ? `#${current.id}` : "");
    };
    const observe = () => {
      navbarHeight = navbar.getBoundingClientRect().height;
      landing.style.setProperty("--landing-nav-height", `${navbarHeight}px`);
      activationLine = Math.min(window.innerHeight - 1, Math.max(navbarHeight + 12, window.innerHeight * 0.35));
      sectionObserver?.disconnect();
      heroObserver?.disconnect();
      // A one-pixel band gives each section a single, stable activation boundary.
      sectionObserver = new IntersectionObserver(updateActive, {
        rootMargin: `-${activationLine}px 0px -${window.innerHeight - activationLine - 1}px 0px`,
      });
      [hero, ...sections].forEach(section => sectionObserver.observe(section));
      heroObserver = new IntersectionObserver(([entry]) => setScrolled(!entry.isIntersecting), {
        rootMargin: `-${navbarHeight}px 0px 0px 0px`,
      });
      heroObserver.observe(hero);
      updateActive();
    };
    const footerObserver = new IntersectionObserver(updateActive);
    footerObserver.observe(footer);
    const resizeObserver = new ResizeObserver(observe);
    resizeObserver.observe(navbar);
    window.addEventListener("resize", observe);
    observe();
    return () => {
      sectionObserver.disconnect();
      heroObserver.disconnect();
      footerObserver.disconnect();
      resizeObserver.disconnect();
      window.removeEventListener("resize", observe);
      landing.style.removeProperty("--landing-nav-height");
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") { setOpen(false); toggle.current?.focus(); } };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return <header ref={header} data-landing-nav className={cn("sticky top-0 z-50 border-b bg-white motion-safe:transition-colors motion-safe:duration-200", scrolled ? "border-stone-200" : "border-transparent")}>
    <nav aria-label="Main navigation" className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-5 sm:px-8 lg:grid lg:grid-cols-[1fr_auto_1fr]">
      <Link href="/" onClick={returnToTop} aria-label="EventHub home" className="w-fit shrink-0"><BrandLogo preload className="w-32 sm:w-40" sizes="(min-width: 640px) 160px, 128px" /></Link>
      <ul className="hidden items-center gap-8 text-sm font-medium text-slate-700 lg:flex">
        {links.map(link => <li key={link.href}><a href={link.href} aria-current={active === link.href ? "location" : undefined} className="landing-section-link inline-flex min-h-11 items-center rounded-sm py-2 transition-colors hover:text-orange-800 active:text-orange-900 aria-[current=location]:text-orange-800"><span className="landing-nav-label">{link.label}</span></a></li>)}
      </ul>
      <div className="flex items-center justify-end gap-3">
        {account === undefined ? <span className="h-11 w-[68px] rounded-md bg-stone-100 sm:w-40" role="status"><span className="sr-only">Loading account</span></span>
          : account ? <LandingAccountMenu account={account} />
          : <GuestActions className="hidden sm:inline-flex" />}
        <button ref={toggle} type="button" aria-expanded={open} aria-controls={menuId} onClick={() => setOpen(value => !value)} className="inline-flex size-11 items-center justify-center rounded-md border border-stone-300 text-slate-900 hover:bg-stone-50 active:bg-stone-100 lg:hidden">
          {open ? <X className="size-5" aria-hidden="true" /> : <Menu className="size-5" aria-hidden="true" />}
          <span className="sr-only">{open ? "Close menu" : "Open menu"}</span>
        </button>
      </div>
    </nav>
    <div id={menuId} hidden={!open} className="absolute inset-x-0 top-full z-40 border-b border-stone-200 bg-white shadow-sm lg:hidden">
      <ul className="mx-auto max-w-6xl px-5 py-2 sm:px-8">
        {links.map(link => <li key={link.href}><a href={link.href} aria-current={active === link.href ? "location" : undefined} onClick={() => { setOpen(false); document.querySelector<HTMLElement>(link.href)?.focus({ preventScroll: true }); }} className="landing-section-link block border-b border-stone-100 py-3 text-sm font-medium text-slate-800 hover:text-orange-800 active:text-orange-900 aria-[current=location]:text-orange-800"><span className="landing-nav-label">{link.label}</span></a></li>)}
      </ul>
      {account === null && <div className="mx-auto grid max-w-6xl grid-cols-2 gap-3 px-5 pb-5 pt-2 sm:hidden">
        <GuestActions />
      </div>}
    </div>
  </header>;
}
