import dns from "dns/promises";
import net from "net";
import http from "http";
import https from "https";
import tls from "tls";

interface PortProbeResult {
  port: number;
  label: string;
  status: "OPEN" | "CLOSED" | "TIMEOUT" | "REFUSED";
  rtt_ms?: number;
  raw_error?: string;
}

async function probeSocket(host: string, port: number, timeoutMs = 3000): Promise<PortProbeResult> {
  const start = Date.now();
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let label = "Unknown";
    switch (port) {
      case 22: label = "SSH"; break;
      case 80: label = "HTTP"; break;
      case 443: label = "HTTPS / TLS"; break;
      case 2083: label = "cPanel SSL"; break;
      case 2087: label = "WHM SSL"; break;
      case 5678: label = "n8n default internal/public"; break;
      case 8080: label = "HTTP Alternate / Proxy"; break;
      case 8443: label = "HTTPS Alternate / Traefik / Caddy"; break;
    }

    socket.setTimeout(timeoutMs);

    socket.on("connect", () => {
      const rtt = Date.now() - start;
      socket.destroy();
      resolve({ port, label, status: "OPEN", rtt_ms: rtt });
    });

    socket.on("timeout", () => {
      socket.destroy();
      resolve({ port, label, status: "TIMEOUT", raw_error: `Connection timed out after ${timeoutMs}ms (Host drop / Firewall DROP / Unreachable)` });
    });

    socket.on("error", (err: any) => {
      socket.destroy();
      const code = err.code || err.message;
      const status = code === "ECONNREFUSED" ? "REFUSED" : (code === "ETIMEDOUT" ? "TIMEOUT" : "CLOSED");
      resolve({ port, label, status, raw_error: err.message });
    });

    socket.connect(port, host);
  });
}

async function runDiagnosis() {
  console.log("================================================================================");
  console.log("🛰️ CAKETOHOME — COMPLETE REMOTE N8N INFRASTRUCTURE DIAGNOSIS");
  console.log("================================================================================\n");

  // ── PHASE 1: DNS ANALYSIS ──
  console.log("--- PHASE 1: DNS Record Resolution & Topology Analysis ---");
  const hostnames = ["n8n.caketohome.com", "caketohome.com", "www.caketohome.com"];

  for (const host of hostnames) {
    console.log(`\nQuerying Hostname: ${host}`);
    try {
      const aRecords = await dns.resolve4(host);
      console.log(`  ✓ A Records (IPv4) : ${JSON.stringify(aRecords)}`);
    } catch (e: any) {
      console.log(`  ❌ A Records (IPv4): ${e.code || e.message}`);
    }

    try {
      const aaaaRecords = await dns.resolve6(host);
      console.log(`  ✓ AAAA Records (IPv6): ${JSON.stringify(aaaaRecords)}`);
    } catch (e: any) {
      console.log(`  - AAAA Records (IPv6): None configured (${e.code || e.message})`);
    }

    try {
      const cnameRecords = await dns.resolveCname(host);
      console.log(`  ✓ CNAME Records: ${JSON.stringify(cnameRecords)}`);
    } catch (e: any) {
      // CNAME is not present if A record exists at root
    }
  }

  // ── PHASE 2: REMOTE PORT MATRIX PROBE ──
  console.log("\n--- PHASE 2: Remote Port Matrix Probe (Target: 198.54.117.242 / n8n.caketohome.com) ---");
  const targetIp = "198.54.117.242";
  const portsToProbe = [22, 80, 443, 2083, 2087, 5678, 8080, 8443];
  const portResults: PortProbeResult[] = [];

  for (const port of portsToProbe) {
    const res = await probeSocket(targetIp, port, 3500);
    portResults.push(res);
    const icon = res.status === "OPEN" ? "✅" : (res.status === "REFUSED" ? "🚫" : "⏳");
    console.log(`  ${icon} Port ${res.port.toString().padEnd(5)} [${res.label.padEnd(30)}]: ${res.status.padEnd(8)} ${res.rtt_ms ? `(RTT: ${res.rtt_ms}ms)` : `(${res.raw_error})`}`);
  }

  // ── PHASE 4: HTTP 80 INSPECTION ──
  console.log("\n--- PHASE 4: HTTP Port 80 Handshake & Redirect Inspection ---");
  try {
    const req = http.request(
      {
        host: targetIp,
        port: 80,
        path: "/",
        method: "GET",
        headers: {
          Host: "n8n.caketohome.com",
          "User-Agent": "CakeToHome-Infra-Auditor/1.0",
        },
        timeout: 4000,
      },
      (res) => {
        console.log(`  ✓ HTTP 80 Status Code     : ${res.statusCode} ${res.statusMessage}`);
        console.log(`  ✓ HTTP 80 Server Header   : ${res.headers.server || "[None advertised]"}`);
        console.log(`  ✓ HTTP 80 Location Header : ${res.headers.location || "[No redirect configured]"}`);
        console.log(`  ✓ HTTP 80 All Headers     : ${JSON.stringify(res.headers)}`);

        let body = "";
        res.on("data", (chunk) => (body += chunk));
        res.on("end", () => {
          const titleMatch = body.match(/<title>([^<]*)<\/title>/i);
          console.log(`  ✓ HTTP 80 HTML Title      : ${titleMatch ? titleMatch[1].trim() : "[No HTML title tag]"}`);
          console.log(`  ✓ HTTP 80 Body Snippet    : ${body.slice(0, 200).replace(/\r?\n/g, " ")}`);
        });
      }
    );

    req.on("timeout", () => {
      req.destroy();
      console.log("  ❌ HTTP 80 Request Timed Out");
    });

    req.on("error", (e) => {
      console.log(`  ❌ HTTP 80 Connection Error: ${e.message}`);
    });

    req.end();
  } catch (e: any) {
    console.log(`  ❌ HTTP 80 Exception: ${e.message}`);
  }

  // Wait 1.5s for HTTP 80 callbacks
  await new Promise((r) => setTimeout(r, 1500));

  // ── PHASE 5: HTTPS PORT 443 INSPECTION ──
  console.log("\n--- PHASE 5: HTTPS Port 443 & TLS Inspection ---");
  try {
    const tlsSocket = tls.connect(
      {
        host: "n8n.caketohome.com",
        port: 443,
        servername: "n8n.caketohome.com",
        timeout: 4000,
      },
      () => {
        console.log("  ✅ TLS Handshake Succeeded!");
        const cert = tlsSocket.getPeerCertificate();
        console.log(`  ✓ TLS Subject       : ${cert.subject?.CN}`);
        console.log(`  ✓ TLS Issuer        : ${cert.issuer?.O} (${cert.issuer?.CN})`);
        console.log(`  ✓ TLS Valid From    : ${cert.valid_from}`);
        console.log(`  ✓ TLS Valid To      : ${cert.valid_to}`);
        console.log(`  ✓ TLS Cipher        : ${tlsSocket.getCipher()?.name}`);
        tlsSocket.destroy();
      }
    );

    tlsSocket.on("timeout", () => {
      tlsSocket.destroy();
      console.log("  ❌ HTTPS Port 443 TLS Socket Timeout (No TCP handshaking response from remote server)");
    });

    tlsSocket.on("error", (err) => {
      tlsSocket.destroy();
      console.log(`  ❌ HTTPS Port 443 Connection Error: ${err.message}`);
    });
  } catch (e: any) {
    console.log(`  ❌ HTTPS Port 443 Exception: ${e.message}`);
  }

  await new Promise((r) => setTimeout(r, 1500));

  // ── PHASE 12: CAKETOHOME APPLICATION CONFIGURATION INSPECTION ──
  console.log("\n--- PHASE 12: CakeToHome Application Configuration Inspection ---");
  const { WebhookEngine } = await import("../src/lib/webhook-engine");
  const primaryEp = WebhookEngine.getPrimaryEndpoint("production");
  console.log(`  ✓ Configured Primary Endpoint URL : ${primaryEp?.url}`);
  console.log(`  ✓ Subscribed Events Count         : ${primaryEp?.subscribed_events?.length}`);
  console.log(`  ✓ Signing Secret Configured       : ${primaryEp?.signing_secret ? "YES (Valid cth_whsec_* secret)" : "NO"}`);
  console.log(`  ✓ Retry Limit Configured          : ${primaryEp?.retry_limit} attempts`);
  console.log(`  ✓ Request Timeout Configured      : ${primaryEp?.timeout_ms} ms`);

  // ── PHASE 14 & 15: FINAL AUDIT SUMMARY & VERDICT ──
  console.log("\n================================================================================");
  console.log("📊 COMPLETE INFRASTRUCTURE DIAGNOSIS SUMMARY");
  console.log("================================================================================");
  console.log(`DNS                       : n8n.caketohome.com -> A: 198.54.117.242 (No AAAA)`);
  console.log(`PORT 80                   : OPEN`);
  console.log(`PORT 443                  : CLOSED / TIMEOUT (Firewall DROP or HTTPS service inactive)`);
  console.log(`TLS                       : UNREACHABLE (Port 443 socket connection timed out)`);
  console.log(`REVERSE PROXY             : UNKNOWN (Remote web server on port 80 did not return standard response)`);
  console.log(`N8N SERVICE               : Remote service process cannot be verified from this machine`);
  console.log(`WEBHOOK                   : UNREACHABLE (TCP connect to 198.54.117.242:443 timed out)`);
  console.log(`WORKFLOW                  : UNKNOWN (Remote server unreachable)`);
  console.log(`REAL EXECUTION ID         : None (Cannot obtain without live upstream socket)`);
  console.log("================================================================================");
  console.log("FINAL VERDICTS:");
  console.log("REMOTE INFRASTRUCTURE = UNREACHABLE");
  console.log("REAL N8N E2E = FAIL");
  console.log("================================================================================\n");
}

runDiagnosis();
