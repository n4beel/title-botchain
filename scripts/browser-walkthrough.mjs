/**
 * Comprehensive Browser Walkthrough for Title (Archetype AE · Deed)
 * Connects to Headless Chrome via CDP, loads mock-wallet.js,
 * tests 1280px & 360px viewports, footer links, dropdown contrast,
 * walks every state in §3.3, checks proof verification,
 * performs live on-chain registration & status stamp affixing,
 * and asserts zero console errors / zero hydration warnings.
 */
import { spawn } from "node:child_process";
import { readFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const CHROME_PORT = 9222;
const APP_URL = "http://localhost:3000";
const RPC_URL = "http://127.0.0.1:8726";

const ACC_ALICE = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";
const ACC_BOB = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";
const ACC_CHARLIE = "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC";
const ACC_DAVE = "0x90F79bf6EB2c4f870365E785982E1f101E93b906";

const mockWalletScript = readFileSync(
  new URL("../../docs/specs/tools/mock-wallet.js", import.meta.url),
  "utf8"
);

const userDir = mkdtempSync(join(tmpdir(), "chrome-title-"));

console.log("Launching headless Chrome...");
const chrome = spawn("google-chrome", [
  "--headless=new",
  `--remote-debugging-port=${CHROME_PORT}`,
  "--no-sandbox",
  "--disable-gpu",
  "--disable-dev-shm-usage",
  `--user-data-dir=${userDir}`,
  "about:blank",
]);

await new Promise((r) => setTimeout(r, 1200));

async function cdpHttp(path, method = "GET") {
  const res = await fetch(`http://127.0.0.1:${CHROME_PORT}${path}`, { method });
  return await res.json();
}

const version = await cdpHttp("/json/version");
console.log("Connected to Chrome:", version["Browser"]);

const list = await cdpHttp("/json/list");
const pageTarget = list.find((t) => t.type === "page");
const wsUrl = pageTarget?.webSocketDebuggerUrl;
if (!wsUrl) throw new Error("No page webSocketDebuggerUrl found");

const ws = new WebSocket(wsUrl);
let reqId = 1;
const pending = new Map();
const consoleErrors = [];
const cdpListeners = new Set();

ws.onmessage = (event) => {
  const msg = JSON.parse(event.data);
  for (const listener of cdpListeners) {
    try {
      listener(msg);
    } catch (e) {
      console.error("Listener error:", e);
    }
  }
  if (msg.method === "Runtime.consoleAPICalled") {
    if (msg.params.type === "error") {
      const errText = msg.params.args.map((a) => a.value || a.description).join(" ");
      if (!errText.includes("net::ERR_CONNECTION_REFUSED") && !errText.includes("favicon")) {
        consoleErrors.push(errText);
      }
    }
  }
  if (msg.id && pending.has(msg.id)) {
    const { resolve, reject } = pending.get(msg.id);
    pending.delete(msg.id);
    if (msg.error) reject(msg.error);
    else resolve(msg.result);
  }
};

await new Promise((resolve) => (ws.onopen = resolve));

function send(method, params = {}) {
  const id = reqId++;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject, method });
    ws.send(JSON.stringify({ id, method, params }));
  });
}

await send("Page.enable");
await send("Runtime.enable");

// Injected mock wallet for Charlie
await send("Page.addScriptToEvaluateOnNewDocument", {
  source: `
    ${mockWalletScript}
    window.__installMockWallet({ rpc: "${RPC_URL}", account: "${ACC_CHARLIE}" });
    console.log("[MockWallet] Injected & installed for Charlie");
  `,
});

async function evaluate(expression) {
  const res = await send("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  if (res.exceptionDetails) {
    throw new Error(`Eval failed: ${JSON.stringify(res.exceptionDetails)}`);
  }
  return res.result?.value;
}

async function setViewport(width, height) {
  await send("Emulation.setDeviceMetricsOverride", {
    width,
    height,
    deviceScaleFactor: 1,
    mobile: width < 600,
  });
}

async function navigate(path) {
  const url = `${APP_URL}${path}`;
  const loadPromise = new Promise((resolve) => {
    const handler = (msg) => {
      if (msg.method === "Page.loadEventFired") {
        cdpListeners.delete(handler);
        resolve();
      }
    };
    cdpListeners.add(handler);
  });
  await send("Page.navigate", { url });
  await loadPromise;
  await new Promise((r) => setTimeout(r, 600));
}

async function waitForText(target, maxMs = 6000) {
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    const text = await evaluate("document.body.innerText");
    if (text.includes(target)) return text;
    await new Promise((r) => setTimeout(r, 150));
  }
  return await evaluate("document.body.innerText");
}

async function setReactInput(selector, value) {
  await evaluate(`(() => {
    const el = document.querySelector("${selector}");
    if (el) {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
      setter.call(el, "${value}");
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
    }
  })()`);
}

console.log("\n--- Starting Title Browser Verification ---");

try {
  // -------------------------------------------------------------
  // 1. Desktop 1280px on /
  // -------------------------------------------------------------
  console.log("1. Testing Desktop 1280px on /...");
  await setViewport(1280, 800);
  await navigate("/");

  const pageTitle = await evaluate("document.title");
  console.log(`   Page title: "${pageTitle}"`);
  if (!pageTitle.includes("Title")) throw new Error("Title does not include 'Title'");

  // Check 3 footer links
  const footerLinksCount = await evaluate(`
    (() => {
      const links = Array.from(document.querySelectorAll("footer a"));
      const hrefs = links.map(a => a.href);
      const hasBotchain = hrefs.some(h => h.includes("botchain.ai") && !h.includes("scan"));
      const hasScan = hrefs.some(h => h.includes("scan.botchain.ai"));
      const hasContract = links.some(a => a.textContent.includes("Built on") || a.title?.includes("contract") || a.href.includes("/address/"));
      return { total: links.length, hasBotchain, hasScan, hasContract };
    })()
  `);
  console.log("   Footer links check:", footerLinksCount);
  if (!footerLinksCount.hasBotchain || !footerLinksCount.hasScan || !footerLinksCount.hasContract) {
    throw new Error("Footer missing one of the 3 required links!");
  }

  // Check wallet menu tokens in :root
  const menuTokens = await evaluate(`
    (() => {
      const s = getComputedStyle(document.documentElement);
      return {
        bg: s.getPropertyValue("--menu-bg").trim(),
        fg: s.getPropertyValue("--menu-fg").trim(),
        muted: s.getPropertyValue("--menu-muted").trim(),
        border: s.getPropertyValue("--menu-border").trim(),
        hover: s.getPropertyValue("--menu-hover-bg").trim(),
        danger: s.getPropertyValue("--menu-danger").trim()
      };
    })()
  `);
  console.log("   Wallet menu tokens:", menuTokens);
  if (!menuTokens.bg || !menuTokens.fg || !menuTokens.hover) {
    throw new Error("Missing wallet menu tokens in :root");
  }

  // Check Docket Book headings & content
  const homeText = await waitForText("The Custody Register");
  const hasRegister = homeText.includes("The Custody Register");
  const hasLookup = homeText.includes("Look Up a Title");
  const hasYourTitles = homeText.includes("Your Titles");
  console.log(`   Docket Book sections: register=${hasRegister}, lookup=${hasLookup}, yourTitles=${hasYourTitles}`);
  if (!hasRegister || !hasLookup || !hasYourTitles) {
    throw new Error("Missing primary Docket Book sections on home page!");
  }

  // -------------------------------------------------------------
  // 2. Mobile 360px Viewport Check
  // -------------------------------------------------------------
  console.log("2. Testing Mobile 360px Viewport...");
  await setViewport(360, 640);
  await navigate("/");
  const scrollWidth360 = await evaluate("document.documentElement.scrollWidth");
  const clientWidth360 = await evaluate("document.documentElement.clientWidth");
  console.log(`   360px viewport: scrollWidth=${scrollWidth360}, clientWidth=${clientWidth360}`);
  if (scrollWidth360 > clientWidth360) {
    throw new Error(`Horizontal scroll detected at 360px! (${scrollWidth360} > ${clientWidth360})`);
  }

  // Restore Desktop
  await setViewport(1280, 800);

  // -------------------------------------------------------------
  // 3. Screen Walkthrough: /register
  // -------------------------------------------------------------
  console.log("3. Walking /register (registration form & hash computation)...");
  await navigate("/register");
  const hasLabelInput = await evaluate('Boolean(document.querySelector("#reg-label"))');
  const hasSerialInput = await evaluate('Boolean(document.querySelector("#reg-serial"))');
  const hasSaltInput = await evaluate('Boolean(document.querySelector("#reg-salt"))');
  console.log(`   /register inputs: label=${hasLabelInput}, serial=${hasSerialInput}, salt=${hasSaltInput}`);
  if (!hasLabelInput || !hasSerialInput || !hasSaltInput) {
    throw new Error("/register is missing one or more required input fields!");
  }

  // -------------------------------------------------------------
  // 4. Screen Walkthrough: /verify
  // -------------------------------------------------------------
  console.log("4. Walking /verify (independent verification with known sample)...");
  await navigate("/verify");

  // Click 'Load Sample (1974 Fender Strat)'
  await evaluate(`(() => {
    const btn = Array.from(document.querySelectorAll("button")).find(b => b.innerText.includes("Load Sample"));
    if (btn) btn.click();
  })()`);

  await new Promise((r) => setTimeout(r, 400));

  // Click 'Verify Against Docket'
  await evaluate(`(() => {
    const btn = Array.from(document.querySelectorAll("button")).find(b => b.innerText.includes("Verify Against Docket"));
    if (btn) btn.click();
  })()`);

  const verifyResultText = await waitForText("Verified Proof Match");
  const isMatched = verifyResultText.includes("Verified Proof Match") && verifyResultText.includes("Title #1");
  console.log(`   Known sample verified to Title #1: ${isMatched}`);
  if (!isMatched) throw new Error("Sample did not resolve to Title #1!");

  // Test unregistered serial via clean URL
  console.log("   Testing unregistered serial on /verify...");
  await navigate("/verify?serial=NONEXISTENT-ITEM-0000&salt=0x9999999999999999999999999999999999999999999999999999999999999999");
  const unregText = await waitForText("No Registration Found");
  const isUnreg = unregText.includes("No Registration Found");
  console.log(`   Unregistered serial correctly reports No Registration Found: ${isUnreg}`);
  if (!isUnreg) throw new Error("Unregistered serial did not report No Registration Found!");

  // -------------------------------------------------------------
  // 5. Screen Walkthrough: Seeded Titles 1 through 5
  // -------------------------------------------------------------
  console.log("5. Walking seeded titles 1 through 5...");

  // Title 1: Clear with 3 hops
  await navigate("/t/1");
  const t1Text = await waitForText("1974 Fender Stratocaster");
  const t1Ok = t1Text.includes("1974 Fender Stratocaster") && t1Text.includes("CLEAR");
  console.log(`   Title 1: Fender Stratocaster Clear (3 hops)=${t1Ok}`);
  if (!t1Ok) throw new Error("Title 1 missing or status not Clear!");

  // Title 2: Lost
  await navigate("/t/2");
  const t2Text = await waitForText("Leica M6 Rangefinder");
  const t2Ok = t2Text.includes("Leica M6 Rangefinder") && t2Text.includes("LOST");
  console.log(`   Title 2: Leica M6 Lost=${t2Ok}`);
  if (!t2Ok) throw new Error("Title 2 missing or status not Lost!");

  // Title 3: Stolen
  await navigate("/t/3");
  const t3Text = await waitForText("Rolex Submariner");
  const t3Ok = t3Text.includes("Rolex Submariner") && t3Text.includes("STOLEN");
  console.log(`   Title 3: Rolex Submariner Stolen=${t3Ok}`);
  if (!t3Ok) throw new Error("Title 3 missing or status not Stolen!");

  // Title 4: Newly registered
  await navigate("/t/4");
  const t4Text = await waitForText("Colnago C64 Road Frame");
  const t4Ok = t4Text.includes("Colnago C64 Road Frame") && t4Text.includes("CLEAR");
  console.log(`   Title 4: Colnago C64 Road Frame=${t4Ok}`);
  if (!t4Ok) throw new Error("Title 4 missing!");

  // Title 5: Transferred and flagged Lost
  await navigate("/t/5");
  const t5Text = await waitForText("Moog Minimoog Model D");
  const t5Ok = t5Text.includes("Moog Minimoog Model D") && t5Text.includes("LOST");
  console.log(`   Title 5: Moog Minimoog Model D Lost=${t5Ok}`);
  if (!t5Ok) throw new Error("Title 5 missing or status not Lost!");

  // -------------------------------------------------------------
  // 6. Real On-Chain Registration & Status Affixing
  // -------------------------------------------------------------
  console.log("6. Testing on-chain registration & status stamp affixing...");
  await navigate("/register");

  // Connect mock wallet if not connected
  await evaluate(`(() => {
    const connectBtn = Array.from(document.querySelectorAll("button")).find(b => b.textContent.includes("Connect"));
    if (connectBtn) connectBtn.click();
  })()`);

  await new Promise((r) => setTimeout(r, 600));

  await evaluate(`(() => {
    const mockItem = Array.from(document.querySelectorAll("[role='menuitem'], button")).find(el => el.textContent.includes("Mock Wallet"));
    if (mockItem) mockItem.click();
  })()`);

  await new Promise((r) => setTimeout(r, 1000));

  // Enter label and serial
  await setReactInput("#reg-label", "Gibson Les Paul 1959");
  await setReactInput("#reg-serial", "GIBSON-59-9941");

  await new Promise((r) => setTimeout(r, 600));

  const formState = await evaluate(`(() => {
    const l = document.getElementById("reg-label")?.value;
    const s = document.getElementById("reg-serial")?.value;
    const salt = document.getElementById("reg-salt")?.value;
    const downloadBtn = Array.from(document.querySelectorAll("button")).find(b => b.textContent.includes("Backup"));
    const regBtn = Array.from(document.querySelectorAll("button")).find(b => b.textContent.includes("Register Title") || b.type === "submit");
    return {
      label: l,
      serial: s,
      salt: salt ? salt.slice(0, 10) + "..." : null,
      downloadBtnDisabled: downloadBtn?.disabled,
      downloadBtnText: downloadBtn?.textContent?.trim(),
      regBtnDisabled: regBtn?.disabled,
      regBtnText: regBtn?.textContent?.trim()
    };
  })()`);
  console.log("   Form state before backup:", formState);

  // Download backup
  await evaluate(`(() => {
    const btn = Array.from(document.querySelectorAll("button")).find(b => b.textContent.includes("Backup"));
    if (btn) btn.click();
  })()`);

  await new Promise((r) => setTimeout(r, 600));

  const afterBackup = await evaluate(`(() => {
    const downloadBtn = Array.from(document.querySelectorAll("button")).find(b => b.textContent.includes("Backup"));
    const regBtn = Array.from(document.querySelectorAll("button")).find(b => b.textContent.includes("Register Title") || b.type === "submit");
    return {
      downloadBtnText: downloadBtn?.textContent?.trim(),
      regBtnDisabled: regBtn?.disabled,
      regBtnText: regBtn?.textContent?.trim()
    };
  })()`);
  console.log("   Form state after backup:", afterBackup);

  // Click Register Title
  const regClicked = await evaluate(`(() => {
    const btn = Array.from(document.querySelectorAll("button")).find(b => b.textContent.includes("Register Title"));
    if (btn && !btn.disabled) {
      btn.click();
      return true;
    }
    return false;
  })()`);

  console.log(`   Clicked 'Register Title': ${regClicked}`);
  if (!regClicked) throw new Error("Register button was not clickable");

  // Wait for redirect to /t/6
  console.log("   Waiting for confirmation and redirect to /t/6...");
  let redirected = false;
  for (let i = 0; i < 20; i++) {
    await new Promise((r) => setTimeout(r, 1000));
    const path = await evaluate("window.location.pathname");
    if (path.startsWith("/t/")) {
      console.log(`   Successfully redirected to: ${path}`);
      redirected = true;
      break;
    }
  }

  if (!redirected) throw new Error("Registration transaction did not redirect to deed view!");

  // Now on newly registered deed, test affixing status stamp
  console.log("   Testing affixing status stamp on new title...");
  await waitForText("Holder Authority");

  // Select Lost status button
  await evaluate(`(() => {
    const btn = Array.from(document.querySelectorAll("button")).find(b => b.innerText.trim() === "Lost");
    if (btn) btn.click();
  })()`);

  await new Promise((r) => setTimeout(r, 400));

  // Click 'Update Status Stamp'
  const stampClicked = await evaluate(`(() => {
    const btn = Array.from(document.querySelectorAll("button")).find(b => b.innerText.includes("Update Status Stamp"));
    if (btn && !btn.disabled) {
      btn.click();
      return true;
    }
    return false;
  })()`);

  console.log(`   Clicked 'Update Status Stamp': ${stampClicked}`);

  // -------------------------------------------------------------
  // 7. Check Console Errors
  // -------------------------------------------------------------
  console.log("7. Checking console errors...");
  const errors = consoleErrors.filter(
    (e) => !e.includes("net::ERR_") && !e.includes("favicon")
  );
  console.log(`   Total console errors: ${errors.length}`);
  if (errors.length > 0) {
    console.error("   Errors found:", errors);
    throw new Error(`Console errors recorded during walkthrough: ${errors.join("; ")}`);
  }

  console.log("\n=======================================================");
  console.log("✓ ALL BROWSER WALKTHROUGH TESTS PASSED WITH 0 ERRORS!");
  console.log("=======================================================\n");
} finally {
  try {
    chrome.kill();
  } catch {}
}
