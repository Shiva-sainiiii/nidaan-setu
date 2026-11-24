"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { one, rpc, type RpcResult } from "@/lib/db";
import { COOKIE, getUser, homeFor, type User } from "@/lib/session";
import { lookupPatient, patientForLab, previewLabs } from "@/lib/queries";

const denied: RpcResult = { ok: false, reason: "forbidden", message: "Please log in with the right role" };

async function need(role: User["role"]): Promise<User | null> {
  const u = await getUser();
  return u && u.role === role ? u : null;
}

// ---------------------------------------------------------------- session (DEMO ONLY)
export async function loginAs(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const u = await one<{ role: User["role"] }>(`select role from tb.demo_users where id = $1`, [id]);
  if (!u) redirect("/");
  (await cookies()).set(COOKIE, id, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 3 });
  redirect(homeFor(u.role));
}

export async function logout() {
  (await cookies()).delete(COOKIE);
  redirect("/");
}

// ---------------------------------------------------------------- doctor
export type ReferralForm = {
  phone: string;
  name?: string;
  abha?: string;
  tests: string[]; // one or more tests for the same patient (several → a bundle)
  priority: "P1" | "P2" | "P3";
  temp_med: boolean;
  note: string;
  max_km: number;
  consent: boolean;
  consent_mode?: "verbal" | "sms"; // sms: patient must reply YES before labs see anything
  wait_days?: number | null;
};

export async function createReferral(form: ReferralForm, idem: string): Promise<RpcResult> {
  const u = await need("doctor");
  if (!u) return denied;
  return rpc("create_bundle", [u.id, idem, JSON.stringify(form)]); // 1 test → plain referral
}

export async function lookupPatientAction(phone: string, tests: string[]) {
  const u = await need("doctor");
  if (!u) return null;
  return lookupPatient(u, phone, tests);
}

export async function previewLabsAction(tests: string[], km: number) {
  const u = await need("doctor");
  if (!u || tests.length === 0) return [];
  return previewLabs(u, tests, km);
}

// ---------------------------------------------------------------- lab + doctor transitions
export async function acceptReferral(id: number, slotLocal: string, idem: string): Promise<RpcResult> {
  const u = await need("lab");
  if (!u) return denied;
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(slotLocal)) return { ok: false, message: "Pick a date and time" };
  return rpc("accept_referral", [u.id, idem, id, `${slotLocal}:00+05:30`]); // datetime-local is IST
}

/** Accept every open test of a bundle this lab can do, at one slot (one trip for the patient). */
export async function acceptBundle(bundleId: number, slotLocal: string, idem: string): Promise<RpcResult> {
  const u = await need("lab");
  if (!u) return denied;
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(slotLocal)) return { ok: false, message: "Pick a date and time" };
  return rpc("accept_bundle", [u.id, idem, bundleId, `${slotLocal}:00+05:30`]);
}

/** During the offer window: offer a slot (the earliest slot wins when the window closes). */
export async function offerSlot(id: number, slotLocal: string, idem: string): Promise<RpcResult> {
  const u = await need("lab");
  if (!u) return denied;
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(slotLocal)) return { ok: false, message: "Pick a date and time" };
  return rpc("offer_slot", [u.id, idem, id, `${slotLocal}:00+05:30`]);
}

/** Offer one slot for every open test of a bundle this lab can do (one trip). */
export async function offerBundle(bundleId: number, slotLocal: string, idem: string): Promise<RpcResult> {
  const u = await need("lab");
  if (!u) return denied;
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(slotLocal)) return { ok: false, message: "Pick a date and time" };
  return rpc("offer_bundle", [u.id, idem, bundleId, `${slotLocal}:00+05:30`]);
}

export async function declineReferral(id: number, reason: string, idem: string): Promise<RpcResult> {
  const u = await need("lab");
  if (!u) return denied;
  return rpc("decline_referral", [u.id, idem, id, reason]);
}

const LAB_STEPS = ["arrived", "test_done", "no_show"];
const DOCTOR_STEPS = ["cancelled", "closed"];

export async function transition(id: number, to: string, idem: string): Promise<RpcResult> {
  const u = await getUser();
  if (!u) return denied;
  if (!(u.role === "lab" ? LAB_STEPS : u.role === "doctor" ? DOCTOR_STEPS : []).includes(to)) return denied;
  return rpc("transition_referral", [u.id, idem, id, to, "{}"]);
}

export async function revealPatient(id: number) {
  const u = await need("lab");
  if (!u) return null;
  const p = await patientForLab(u, id);
  if (p) await one(`select tb.log_view($1, $2, 'patient')`, [u.id, id]);
  return p;
}

// ---------------------------------------------------------------- patient (simulated SMS reply)
export async function patientReply(patientId: string, body: string, idem: string): Promise<RpcResult> {
  if (!body.trim()) return { ok: false, message: "Empty message" };
  return rpc("patient_reply", [patientId, idem, body.slice(0, 160)]);
}

// ---------------------------------------------------------------- demo controls
export async function resetDemo(): Promise<RpcResult> {
  return rpc("reset_demo", []);
}

export async function advanceClock(hours: number): Promise<RpcResult> {
  const u = await getUser();
  if (![1, 6, 24].includes(hours)) return { ok: false, message: "bad hours" };
  return rpc("advance_clock", [u?.id ?? null, hours]);
}
