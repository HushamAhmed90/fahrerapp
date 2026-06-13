import { NextResponse } from "next/server";
import * as cheerio from "cheerio";

const BASE = "https://merkurportal.fleurop.de";

async function login(): Promise<{ cookies: string; debug: Record<string, unknown> }> {
  // Step 1: Get login page
  const loginPage = await fetch(`${BASE}/?login=1`, {
    redirect: "follow",
    headers: { "User-Agent": "Mozilla/5.0" },
  });
  const loginHtml = await loginPage.text();
  const setCookie = loginPage.headers.get("set-cookie") ?? "";
  const sessionCookie = setCookie.split(";")[0];

  // Parse ALL input fields to find correct names
  const $ = cheerio.load(loginHtml);
  const allInputs: Record<string, string> = {};
  $("input").each((_, el) => {
    const name = $(el).attr("name");
    const type = $(el).attr("type") ?? "text";
    const value = $(el).attr("value") ?? "";
    if (name) allInputs[name] = `${type}=${value}`;
  });

  const formAction = $("form").attr("action") ?? "/?login=1";

  // Build form data with all fields
  const formData = new URLSearchParams();
  $('input[type="hidden"]').each((_, el) => {
    const n = $(el).attr("name"); const v = $(el).attr("value") ?? "";
    if (n) formData.append(n, v);
  });

  // Try common field name patterns
  const userField = Object.keys(allInputs).find(k => /user|name|login|benutz/i.test(k)) ?? "username";
  const passField = Object.keys(allInputs).find(k => /pass|wort|pwd/i.test(k)) ?? "password";

  formData.append(userField, process.env.FLEUROP_USER ?? "");
  formData.append(passField, process.env.FLEUROP_PASS ?? "");

  const postUrl = formAction.startsWith("http") ? formAction : `${BASE}${formAction}`;

  const loginRes = await fetch(postUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Cookie: sessionCookie,
      "User-Agent": "Mozilla/5.0",
      Referer: `${BASE}/?login=1`,
    },
    body: formData.toString(),
    redirect: "manual",
  });

  const allCookies = [sessionCookie];
  const newCookie = loginRes.headers.get("set-cookie");
  if (newCookie) allCookies.push(newCookie.split(";")[0]);
  const cookies = allCookies.filter(Boolean).join("; ");

  return {
    cookies,
    debug: { allInputs, formAction, postUrl, userField, passField, loginStatus: loginRes.status }
  };
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
  // Quick test - remove after debug
  return NextResponse.json({ success: false, message: "TEST: route works, OpenAI key: " + (process.env.OPENAI_API_KEY ? "SET" : "NOT SET") });

  try {
    const { cookies, debug: loginDebug } = await login();

    const checkRes = await fetch(`${BASE}/`, {
      headers: { Cookie: cookies, "User-Agent": "Mozilla/5.0" },
    });
    const checkHtml = await checkRes.text();
    const pageTitle = checkHtml.match(/<title>(.*?)<\/title>/i)?.[1] ?? "unknown";
    const isLoggedIn = checkHtml.toLowerCase().includes("auftrag") || checkHtml.toLowerCase().includes("abmelden");

    // Try to find the orders page URL
    const tryUrls = [
      `${BASE}/auftrag/`,
      `${BASE}/?page=auftrag`,
      `${BASE}/?action=auftrag`,
      `${BASE}/index.php?action=auftrag`,
    ];

    const urlResults: Record<string, string> = {};
    for (const url of tryUrls) {
      const r = await fetch(url, { headers: { Cookie: cookies, "User-Agent": "Mozilla/5.0" } });
      const h = await r.text();
      urlResults[url] = h.slice(0, 200);
    }

    // Also check main page for links
    const mainLinks: string[] = [];
    const $ = cheerio.load(checkHtml);
    $("a[href]").each((_, el) => {
      const href = $(el).attr("href") ?? "";
      if (href.includes("auftrag") || href.includes("liefern") || href.includes("order")) {
        mainLinks.push(href);
      }
    });

    const stops = await fetchOrders(cookies);

    return NextResponse.json({
      success: stops.length > 0,
      stops,
      debug: { ...loginDebug, pageTitle, isLoggedIn, stopsFound: stops.length, mainLinks: mainLinks.slice(0, 10), urlResults }
    });
  } catch (e: unknown) {
    return NextResponse.json({ success: false, message: String(e) });
  }
}
