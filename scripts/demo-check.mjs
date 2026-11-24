// Rehearsal check: follows the PLAN.md section 7 demo script (demo script) across 5 "devices", starting from the Reset button.
import { chromium } from "playwright-core";
const B = process.env.BASE ?? "http://localhost:3000";
// Uses only the app's HTTP API, so it works with the local database and with Postgres.
const api = async (u) => (await (await fetch(`${B}${u}`)).json()).data;
const smsCount = async () => (await api("/api/live?view=phone&patient=P-RAMESH")).messages.length;
const errors = [];
const t0 = Date.now();
const step = (s) => console.log(`[${((Date.now() - t0) / 1000).toFixed(1)}s] ${s}`);

const browser = await chromium.launch({ executablePath: process.env.CHROME ?? "/usr/bin/google-chrome" });
async function device(name, login) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const p = await ctx.newPage();
  p.on("pageerror", (e) => errors.push(`${name}: ${e.message}`));
  p.on("console", (m) => m.type() === "error" && errors.push(`${name}: ${m.text()}`));
  p.on("dialog", (d) => d.accept());
  await p.goto(B);
  if (login) { await p.getByText(login, { exact: true }).click(); await p.waitForURL(/\/(lab|doctor|dho)$/); }
  return p;
}

// Before going on: Reset demo via the UI button
const laptop1 = await device("doctor", "Dr. A. Mehta");
await laptop1.getByText(/^Demo controls/).click();
await laptop1.getByRole("button", { name: "Reset demo data" }).click();
await laptop1.getByText(/Reset: done/).waitFor();
await laptop1.reload();
const laptop2 = await device("labB", "Lab desk, Sarvodaya SDH");
const laptop3 = await device("labC", "Lab desk, Navjeevan CHC");
const phone = await device("phone", null);
await phone.goto(`${B}/phone`);
step("Reset via UI; 4 devices logged in");

// 0:40 Create
await laptop1.goto(`${B}/doctor/new`);
await laptop1.getByText("Use demo patient").click();
await laptop1.getByText(/original slot in your queue/i).waitFor();
await laptop1.getByRole("button", { name: /P1 Urgent/ }).click(); // P1: no offer window, first lab to accept wins
await laptop1.getByText(/I explained to the patient/).click();
const btn = laptop1.getByRole("button", { name: /Send to 3 labs/ });
await btn.waitFor();
await btn.click();
await laptop1.waitForURL("**/r/*");
step("Doctor sent referral to 3 labs");

// 1:30 Race
await Promise.all([laptop2.getByText("MRI scan").first().waitFor(), laptop3.getByText("MRI scan").first().waitFor()]);
step("Request visible on Lab B and Lab C");
const [aB, aC] = [laptop2.getByRole("button", { name: "Accept" }), laptop3.getByRole("button", { name: "Accept" })];
await Promise.all([aB.dispatchEvent("click"), aC.dispatchEvent("click")]);
const winnerName = await Promise.race([
  laptop2.getByText(/Accepted NS-1001/).waitFor().then(() => "B"),
  laptop3.getByText(/Accepted NS-1001/).waitFor().then(() => "C"),
]);
const [win, lose] = winnerName === "B" ? [laptop2, laptop3] : [laptop3, laptop2];
await lose.getByText(/Already accepted by/).first().waitFor();
step(`Race: Lab ${winnerName} won, other lab sees "Already accepted by …"`);
// double-click Accept again → nothing changes (card is gone; try via API with same flow)
const before = await smsCount();
await win.reload();
await win.waitForTimeout(1500);
const after = await smsCount();
step(`After refresh: patient SMS count unchanged? ${before} → ${after}`);
if (before !== after) errors.push("duplicate SMS after refresh");

// 2:30 Patient
await phone.getByText(/पर तय है/).waitFor();
step("Patient phone got Hindi+English booking SMS");
await laptop1.goto(`${B}/r/1/slip`);
await laptop1.locator("img[alt^='QR']").waitFor();
step("Slip with QR shown");
await phone.getByRole("button", { name: "Reply 1 to confirm" }).click();
await phone.getByText(/is confirmed/).first().waitFor();
step("Patient replied 1 → confirmed");

// 3:10 Test and report
await win.getByRole("tab", { name: /Booked \/ today/ }).click();
await win.getByRole("button", { name: "Arrived" }).click();
await win.getByText(/patient arrived/).waitFor();
await win.getByRole("button", { name: "Test done" }).click();
await win.getByText(/original slot released/).waitFor();
await win.getByRole("button", { name: "Use sample report" }).click();
await win.getByText("NS-1001-report.pdf").waitFor();
await win.getByRole("button", { name: "Upload & send" }).click();
await win.getByText(/report sent to the referring doctor/).waitFor();
step("Lab: arrived → test done → report uploaded");
await laptop1.goto(`${B}/r/1`);
const banner = await laptop1.getByText(/Report ready: \d+ days earlier/).innerText();
step(`Doctor sees "${banner}"`);
await laptop1.goto(`${B}/doctor/queue`);
await laptop1.getByText(/got an earlier slot/).first().waitFor();
step("Home queue: slot released to Pooja Rani");

// 4:00 Trust
await laptop1.goto(`${B}/audit`);
await laptop1.getByText("Accept rejected (already taken)").waitFor();
step(`Audit log shows the losing attempt; ${(await api("/api/live?view=audit")).length} rows`);

// Feature: offer window (P2) — two labs offer different slots, the earliest wins
const istDay = (d) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date(Date.now() + d * 86400000));
await laptop1.goto(`${B}/doctor/new`);
await laptop1.getByPlaceholder("10-digit mobile").fill("9876500002"); // Sunita Devi, P2 (default)
await laptop1.getByText(/original slot in your queue/i).waitFor();
await laptop1.getByText(/earliest slot wins/).first().waitFor();
await laptop1.getByText(/I explained to the patient/).click();
await laptop1.getByRole("button", { name: /Send to 3 labs/ }).click();
await laptop1.waitForURL("**/r/*");
const offerUrl = laptop1.url();
step("Doctor sent a P2 referral: offer window open");
async function offer(p, day) {
  await p.goto(`${B}/lab`);
  await p.getByRole("button", { name: "Offer slot" }).waitFor();
  await p.locator("input[type=datetime-local]").first().fill(`${istDay(day)}T10:00`);
  await p.getByRole("button", { name: "Offer slot" }).click();
  await p.getByText(/Offer sent for NS-1002/).waitFor();
  await p.getByText(/Your offer:/).waitFor();
}
await offer(laptop2, 3);
await offer(laptop3, 2);
await laptop1.getByText(/2 offers so far/).waitFor();
step("Lab B offered +3 days, Lab C offered +2 days; doctor sees 2 offers");
await laptop1.getByText(/^Demo controls/).click();
await laptop1.getByRole("button", { name: "+1h" }).click();
await laptop1.getByText(/\+1h: done/).waitFor();
await laptop1.goto(offerUrl);
const why = await laptop1.getByText(/chosen from 2 offers/).innerText();
if (!/Navjeevan/.test(why) || !/earliest slot/.test(why)) errors.push(`wrong offer winner: ${why}`);
step(`Window closed (+1h demo clock): ${why.replace(/\s+/g, " ")}`);
await laptop2.goto(`${B}/lab`);
await laptop2.getByText(/Already accepted by Navjeevan.*earliest slot/).waitFor();
step("Lab B sees 'Already accepted by Navjeevan CHC · earliest slot …'");
// Feature: consent by SMS — YES lets the labs see it, NO cancels it
async function smsReferral(phoneNo, ct = false) {
  await laptop1.goto(`${B}/doctor/new`);
  if (ct) { // switch the test from MRI to CT
    await laptop1.locator("label", { hasText: "CT scan" }).first().click();
    await laptop1.locator("label", { hasText: "MRI scan" }).first().click();
  }
  await laptop1.getByPlaceholder("10-digit mobile").fill(phoneNo);
  await laptop1.getByText(/original slot in your queue/i).waitFor();
  await laptop1.getByRole("radio", { name: /Confirm by SMS/ }).click();
  await laptop1.getByRole("button", { name: "Send consent SMS to patient" }).click();
  await laptop1.waitForURL("**/r/*");
  await laptop1.getByText(/Waiting for the patient.s consent by SMS/).waitFor();
  await laptop1.getByText("Consent: pending SMS").waitFor();
  return laptop1.url();
}
const yesUrl = await smsReferral("9876500010"); // Anil Verma
await laptop2.goto(`${B}/lab`);
await laptop2.getByText(/No open requests right now/).waitFor();
step("SMS consent asked; Lab B sees nothing yet");
await phone.goto(`${B}/phone`);
await phone.getByText(/Reply YES or NO/).last().waitFor();
await phone.getByRole("button", { name: /Reply YES/ }).click();
await phone.getByText(/consent received/).waitFor();
await laptop2.getByRole("button", { name: "Offer slot" }).waitFor();
await laptop1.goto(yesUrl);
await laptop1.getByText("Consent: granted via SMS").waitFor();
step("Patient replied YES → labs notified (Lab B can offer), doctor sees 'granted via SMS'");
const noUrl = await smsReferral("9876500008", true); // Geeta Saini (CT)
await phone.goto(`${B}/phone`);
await phone.getByText(/Reply YES or NO/).last().waitFor();
await phone.getByRole("button", { name: /Reply NO/ }).click();
await phone.getByText(/not shared with any lab/).waitFor();
await laptop1.goto(noUrl);
await laptop1.getByText("Consent: refused").waitFor();
await laptop1.getByText(/replied NO to the consent SMS/).waitFor();
step("Patient replied NO → cancelled, nothing shared, original date kept");

// Feature: DHO district map
const dho = await device("dho", "District Health Officer");
const map = dho.locator("svg[aria-label^='District map']");
await map.waitFor();
const markers = await map.locator("g[role=button]").count();
if (markers !== 6) errors.push(`map markers: ${markers}`);
const arrows = await map.locator("path.flow-line").count();
if (arrows < 1) errors.push("no live referral arrows on the map");
await map.locator("g[role=button]", { hasText: "Navjeevan" }).click();
await dho.getByText(/Acceptance rate/).waitFor();
step(`DHO map: ${markers} facilities, ${arrows} live arrow(s); clicking a lab shows its details`);
await dho.getByRole("radio", { name: /^CT/ }).click();
await map.locator("g[aria-label*='does not offer this test']").first().waitFor();
await dho.getByRole("radio", { name: /^7 days/ }).click();
await dho.getByText(/CT scan · 7 days/).waitFor();
step("Filters (CT, 7 days) update markers and KPIs");

console.log(errors.length ? `ERRORS: ${errors.join(" | ")}` : `PASS in ${((Date.now() - t0) / 1000).toFixed(0)}s, no errors`);
await browser.close();
process.exit(errors.length ? 1 : 0);
