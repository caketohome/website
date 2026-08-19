import net from "net";

const targetHost = "198.54.117.242";
const ports = [22, 80, 443, 2083, 2087, 5678, 8080, 8443];

async function checkPort(port: number): Promise<{ port: number; open: boolean; error?: string }> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(2500);

    socket.on("connect", () => {
      socket.destroy();
      resolve({ port, open: true });
    });

    socket.on("timeout", () => {
      socket.destroy();
      resolve({ port, open: false, error: "TIMEOUT" });
    });

    socket.on("error", (err) => {
      socket.destroy();
      resolve({ port, open: false, error: err.message });
    });

    socket.connect(port, targetHost);
  });
}

async function main() {
  console.log(`Probing ports on ${targetHost} (n8n.caketohome.com)...`);
  for (const p of ports) {
    const res = await checkPort(p);
    console.log(`Port ${p}: ${res.open ? "✅ OPEN" : "❌ CLOSED/UNREACHABLE"} (${res.error || "Connected"})`);
  }
}

main();
