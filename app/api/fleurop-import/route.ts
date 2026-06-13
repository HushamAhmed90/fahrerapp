import { NextResponse } from "next/server";
import * as cheerio from "cheerio";

const BASE = "https://merkurportal.fleurop.de";

async function login(): Promise<string> {
  // Step 1: Get login page to extract any hidden fields
  const loginPage = await fetch(`${BASE}/?login=1`, { redirect: "follow" });
  const loginHtml = await loginPage.text();
  const setCookie = loginPage.headers.get("set-cookie") ?? "";
  const sessionCookie = setCookie.split(";")[0];

  // Parse hidden fields
  const $ = cheerio.load(loginHtml);
  const hiddenFields: Record<string, string> = {};
  $('input[type="hidden"]').each((_, el) => {
    const name = $(el).attr("name");
    const value = $(el).attr("value") ?? "";
    if (name) hiddenFields[name] = value;
  });

  // Step 2: POST login
  const formData = new URLSearchParams({
    ...hiddenFields,
    username: process.env.FLEUROP_USER ?? "",
    password: process.env.FLEUROP_PASS ?? "",
  });

  const loginRes = await fetch(`${BASE}/?login=1`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Cookie: sessionCookie,
      "User-Agent": "Mozilla/5.0",
    },
    body: formData.toString(),
    redirect: "manual",
  });

  // Collect all cookies
  const allCookies = [sessionCookie];
  const newCookie = loginRes.headers.get("set-cookie");
  if (newCookie) allCookies.push(newCookie.split(";")[0]);

  return allCookies.filter(Boolean).join("; ");
}

async function fetchOrders(cookies: string): Promise<{ name: string; adresse: string; telefon: string; notiz: string; order: number }[]> {
  const today = new Date().toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });

  const res = await fetch(
    `${BASE}/auftrag/list?status=zu_liefern&lieferdatum_von=${today}&lieferdatum_bis=${today}`,
    {
      headers: {
        Cookie: cookies,
        "User-Agent": "Mozilla/5.0",
      },
    }
  );

  const html = await res.text();
  const $ = cheerio.load(html);
  const stops: { name: string; adresse: string; telefon: string; notiz: string; order: number }[] = [];

  let idx = 1;
  $("table tr").each((_, row) => {
    const cells = $(row).find("td");
    if (cells.length < 4) return;

    const empfaenger = $(cells[3]).text().trim();
    if (!empfaenger || empfaenger.includes("Empfänger")) return;

    // Parse "Name, Straße Hausnr, PLZ Stadt"
    const lines = empfaenger.split("\n").map(l => l.trim()).filter(Boolean);
    if (lines.length < 2) return;

    const name = lines[0];
    const adresse = lines.slice(1).join(", ");
    const auftrNr = $(cells[0]).text().trim();

    stops.push({ name, adresse, telefon: "", notiz: `Fleurop ${auftrNr}`, order: idx++ });
  });

  return stops;
}

export async function POST() {
  try {
    const cookies = await login();

    // Debug: fetch the main page after login to check if logged in
    const checkRes = await fetch(`${BASE}/`, {
      headers: { Cookie: cookies, "User-Agent": "Mozilla/5.0" },
    });
    const checkHtml = await checkRes.text();
    const isLoggedIn = !checkHtml.includes("login") && !checkHtml.includes("Anmelden");
    const pageTitle = checkHtml.match(/<title>(.*?)<\/title>/i)?.[1] ?? "unknown";

    const stops = await fetchOrders(cookies);

    return NextResponse.json({
      success: stops.length > 0,
      stops,
      debug: { isLoggedIn, pageTitle, cookieLength: cookies.length, stopsFound: stops.length }
    });
  } catch (e: unknown) {
    return NextResponse.json({ success: false, message: String(e) });
  }
}
