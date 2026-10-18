import "server-only";

import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";

const name = "eh_organizer_acceptance";
export const hashProof = (proof: string) => createHash("sha256").update(proof).digest("hex");
export const newProof = () => randomBytes(32).toString("hex");

export async function readProof() {
  const proof = (await cookies()).get(name)?.value;
  return proof && /^[a-f0-9]{64}$/.test(proof) ? proof : null;
}
export async function rememberProof(proof: string) {
  (await cookies()).set(name, proof, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 3600 });
}
export async function clearProof() { (await cookies()).delete(name); }
