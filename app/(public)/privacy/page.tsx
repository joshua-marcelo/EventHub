import type { Metadata } from "next";
import Link from "next/link";

import { PRIVACY_NOTICE_VERSION } from "@/lib/privacy";

export const metadata: Metadata = { title: "Privacy notice" };

// Draft notice (SYSTEM_SPEC §21.2). The data controller, contact and retention periods are
// client decisions (K-06, K-07) and must be filled in before launch.
export default function PrivacyPage() {
  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-10">
      <Link href="/" className="text-lg font-semibold tracking-tight">
        EventHub
      </Link>
      <article className="mt-8 flex flex-col gap-4 text-sm leading-6">
        <h1 className="text-2xl font-semibold tracking-tight">Privacy notice</h1>
        <p className="text-muted-foreground">Version {PRIVACY_NOTICE_VERSION}. This notice follows the Data Privacy Act of 2012 (Republic Act No. 10173).</p>

        <h2 className="text-base font-semibold">Who is responsible</h2>
        <p>
          EventHub is operated for the College Local Council of Wesleyan University–Philippines. The data
          controller and the privacy contact will be named here before EventHub is used for real events.
        </p>

        <h2 className="text-base font-semibold">What we collect</h2>
        <ul className="ml-5 list-disc">
          <li>Account: your name, personal email address and password (stored only as a secure hash).</li>
          <li>Student profile: student ID, college, program, year level and a profile photo.</li>
          <li>Activity: event registrations, attendance times, and certificates issued to you.</li>
          <li>For organizer applicants: organization, position, contact number and the documents you upload.</li>
        </ul>
        <p>We do not collect your home address, birthdate or government IDs.</p>

        <h2 className="text-base font-semibold">Why we use it</h2>
        <p>
          To create your account, let you register for council events, record your attendance, and issue
          certificates that others can verify. Your photo lets organizers recognize you at events.
        </p>

        <h2 className="text-base font-semibold">Who can see it</h2>
        <ul className="ml-5 list-disc">
          <li>You can see and update your own profile.</li>
          <li>Organizers see the profiles of people registered for their own events.</li>
          <li>
            During check-in, your photo, name and college appear on the organizer&apos;s attendance screen at the
            venue, which other attendees may see.
          </li>
          <li>Anyone with a certificate&apos;s verification link sees the name, event and date printed on it.</li>
          <li>EventHub administrators can see accounts to manage organizer access and resolve disputes.</li>
        </ul>

        <h2 className="text-base font-semibold">How long we keep it</h2>
        <p>
          Retention periods will be confirmed by the data controller. Technical device information used to
          detect shared-device check-ins is deleted after the event.
        </p>

        <h2 className="text-base font-semibold">Your rights</h2>
        <p>
          You may access and correct your data in your profile. To request deletion of your account, contact the
          EventHub administrators; issued certificates keep the name printed on them so they stay verifiable.
        </p>
      </article>
    </div>
  );
}
