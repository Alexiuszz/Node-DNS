import DNS = require("dns2");
import { RR, toAbsolute, findRecordsByName, rrToAnswer } from "./utils/helpers";
import { loadZoneAsync } from "./utils/loader";

// ---- In-memory zone (authoritative) ----
const ZONE = "example.test."; // trailing dot recommended

const DEFAULT_TTL = 300;

let ZONE_RECORDS: RR[] = []; // loaded at startup from data/records.json


// ---- Request handler (authoritative) ----
const handle: DNS.DnsHandler = (request, send) => {
  // so we serve all records we have for that name.
  const [q] = request.questions || []; //
  if (!q) {
    send({ answers: [] });
    return;
  }

  const matches = findRecordsByName(q.name, ZONE_RECORDS).map((rr) =>
    rrToAnswer(rr, DEFAULT_TTL),
  );

  // include the target A/AAAA if present when the name itself is a CNAME.(Single-hop CNAME chase)
  const cname = ZONE_RECORDS.find(
    (rr) => rr.name.toLowerCase() === toAbsolute(q.name).toLowerCase() && rr.type === "CNAME",
  );
  if (cname) {
    // Ensure the CNAME RR itself is present in the answer (at the front).
    const cnameAns = rrToAnswer(cname, DEFAULT_TTL);
    const cnamePresent = matches.some(
      (a) =>
        a.type === DNS.Packet.TYPE.CNAME &&
        a.name.toLowerCase() === cname.name.toLowerCase() &&
        (a.domain?.toLowerCase?.() ?? a.data?.toLowerCase?.()) === cname.value.toLowerCase(),
    );
    if (!cnamePresent) {
      matches.unshift(cnameAns);
    }

    // Also include target A/AAAA for convenience.
    const target = toAbsolute(cname.value).toLowerCase();
    const targetAs = ZONE_RECORDS.filter(
      (rr) => rr.name.toLowerCase() === target && (rr.type === "A" || rr.type === "AAAA"),
    ).map((rr) => rrToAnswer(rr, DEFAULT_TTL));
    matches.push(...targetAs);
  }

  // Create a response via Packet helper, then attach our answers.
  const response = DNS.Packet.createResponseFromRequest(request);
  response.answers = matches;

  send(response);
};

// ---- Start UDP + TCP authoritative server on port 5300 ----
async function main() {
  // Load zone records from JSON (async, safe)
  ZONE_RECORDS = await loadZoneAsync();

  const envPortRaw = process.env.DNS_PORT ?? process.env.PORT;
  const parsed = envPortRaw ? Number(envPortRaw) : NaN;
  const PORT = Number.isFinite(parsed) && parsed > 0 ? parsed : 5300;

  const server = DNS.createServer({
    udp: { type: "udp4" },
    tcp: true,
    doh: false,
    handle,
  });

  await server.listen({ udp: PORT, tcp: PORT });

  const addrs = server.addresses();
  console.log(`Authoritative DNS listening on port ${PORT}:`);
  if (addrs.udp) console.log("  UDP:", addrs.udp);
  if (addrs.tcp) console.log("  TCP:", addrs.tcp);
}

main().catch((err) => {
  console.error("Failed to start DNS server:", err);
  process.exit(1);
});
