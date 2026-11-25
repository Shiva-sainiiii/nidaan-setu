// Rehearsal check for the multi-test bundle (MRI + CT for one patient). RESETS demo data.
// Usage: npm run check:bundle   (app running; BASE=http://host:3000; CHROME=/path/to/chrome)
import { chromium } from "playwright-core";

const B = process.env.BASE ?? "http://localhost:3000";
const errors = [];
const t0 = Date.now();
const step = (s) => console.log(`[${((Date.now() - t0) / 1000).toFixed(1)}s] ${s}`);
const browser = await chromium.launch({ executablePath: process.env.CHROME ?? "/usr/bin/google-chrome" });
async function device(name, login) {
  const p = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
  p.on("pageerror", (e) => errors.push(`${name}: ${e.message}`));
  p.on("console", (m) => m.type() === "error" && errors.push(`${name}: ${m.text()}`));
  p.on("dialog", (d) => d.accept());
  await p.goto(B);
  if (login) { await p.getByText(login, { exact: true }).click(); await p.waitForURL(/\/(lab|doctor|dho)$/); }
  return p;
}
const shot = (p, n) => process.env.SHOTS && p.screenshot({ path: `${process.env.SHOTS}/${n}.png`, fullPage: true });

const doc = await device("doctor", "Dr. A. Mehta");
await doc.getByText(/^Demo controls/).click();
await doc.getByRole("button", { name: "Reset demo data" }).click();
await doc.getByText(/Reset: done/).waitFor();
const labB = await device("labB", "Lab desk, Sarvodaya SDH");
const labC = await device("labC", "Lab desk, Navjeevan CHC");
const labD = await device("labD", "Lab desk, Arogya PPP");

await doc.goto(`${B}/doctor/new`);
await doc.getByText("Use demo patient").click();
await doc.locator("label", { hasText: "CT scan" }).first().click();
await doc.getByText(/2 tests → one bundle/).waitFor();
await doc.getByText(/all 2 tests, one trip/).first().waitFor();
await doc.getByRole("button", { name: /P1 Urgent/ }).click(); // P1: direct accept race (offer window is covered by tests/db)
await doc.getByText(/I explained to the patient/).click();
await shot(doc, "b1-form");
await doc.getByRole("button", { name: /Send 2 tests to/ }).dblclick();
await doc.waitForURL("**/r/*");
await doc.getByText(/Other tests in bundle NS-B501/).waitFor();
step("doctor created bundle NS-B501 (MRI + CT)");

await labB.getByText(/BUNDLE NS-B501/).waitFor();
await labC.getByText(/Part of bundle/).waitFor();
await labD.getByText(/BUNDLE NS-B501/).waitFor();
step("Lab B/D see the bundle card; Lab C (MRI only) sees one test marked 'part of bundle'");
await shot(labB, "b2-labB");

const [bb, bd] = [labB.getByRole("button", { name: /Accept all 2 here/ }), labD.getByRole("button", { name: /Accept all 2 here/ })];
await Promise.all([bb.dispatchEvent("click"), bd.dispatchEvent("click")]);
const winner = await Promise.race([
  labB.getByText(/together \(one trip\)/).waitFor().then(() => "B"),
  labD.getByText(/together \(one trip\)/).waitFor().then(() => "D"),
]);
const [win, lose] = winner === "B" ? [labB, labD] : [labD, labB];
await lose.getByText(/Already accepted by/).first().waitFor();
step(`race: Lab ${winner} got both tests; the other lab sees 'Already accepted by …'`);

const phone = await device("phone", null);
await phone.goto(`${B}/phone`);
await phone.getByText(/booked together \(one trip\)/).waitFor();
await phone.getByRole("button", { name: "Reply 1 to confirm" }).click();
await phone.getByText(/your 2 tests on .* are confirmed/).waitFor();
step("one combined SMS; reply 1 confirmed both tests");

await win.getByRole("tab", { name: /Booked \/ today/ }).click();
for (let i = 0; i < 2; i++) {
  await win.getByRole("button", { name: "Arrived" }).and(win.locator(":enabled")).first().click();
  await win.getByRole("button", { name: "Test done" }).and(win.locator(":enabled")).first().waitFor();
  await win.getByRole("button", { name: "Test done" }).and(win.locator(":enabled")).first().click();
  await win.getByRole("button", { name: "Use sample report" }).first().click();
  await win.getByText(/-report\.pdf/).first().waitFor();
  await win.getByRole("button", { name: "Upload & send" }).first().click();
  await win.getByText(/report sent to the referring doctor/).last().waitFor();
  await win.waitForTimeout(2500);
}
step("lab finished both tests and uploaded 2 reports");

await doc.reload();
await doc.getByText(/All booked tests at one lab: one trip for 2 tests/).waitFor();
step("doctor sees 'one trip for 2 tests'");
console.log(errors.length ? `ERRORS: ${errors.join(" | ")}` : `BUNDLE PASS in ${((Date.now() - t0) / 1000).toFixed(0)}s, no errors`);
await browser.close();
process.exit(errors.length ? 1 : 0);
