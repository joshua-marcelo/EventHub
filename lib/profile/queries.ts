import "server-only";

import { createClient } from "@/lib/supabase/server";

export type CollegeOption = { id: number; name: string };
export type ProgramOption = { id: number; collegeId: number; name: string };

/** Active colleges and programs for the profile form (admin-managed lookups, D-011). */
export async function getProfileOptions(current: { collegeId: number | null; programId: number | null }) {
  const supabase = await createClient();
  const [colleges, programs] = await Promise.all([
    supabase.from("colleges").select("id, name, is_active").order("name"),
    supabase.from("programs").select("id, college_id, name, is_active").order("name"),
  ]);

  // Deactivated entries disappear from pickers but stay visible on profiles that use them.
  return {
    colleges: (colleges.data ?? [])
      .filter((c) => c.is_active || c.id === current.collegeId)
      .map<CollegeOption>((c) => ({ id: c.id, name: c.name })),
    programs: (programs.data ?? [])
      .filter((p) => p.is_active || p.id === current.programId)
      .map<ProgramOption>((p) => ({ id: p.id, collegeId: p.college_id, name: p.name })),
  };
}

/** Short-lived signed URL for the user's own photo (private bucket). */
export async function getAvatarUrl(path: string | null): Promise<string | null> {
  if (!path) return null;
  const supabase = await createClient();
  const { data } = await supabase.storage.from("avatars").createSignedUrl(path, 60 * 60);
  return data?.signedUrl ?? null;
}
