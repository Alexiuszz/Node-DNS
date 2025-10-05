import DNS = require("dns2");
import { RR, toAbsolute, findRecordsByName, rrToAnswer } from "./utils/helpers";
import { loadZoneAsync } from "./utils/loader";

// ---- In-memory zone (authoritative) ----
const ZONE = "example.test.";

const DEFAULT_TTL = 300;

let ZONE_RECORDS: RR[] = []; // loaded at startup from data/records.json

// const resolveCNAME:
// ---- Request handler (authoritative) ----
const handle: DNS.DnsHandler = (request, send) => {
  // so we serve all records we have for that name.
  const [q] = request.questions || []; //
  if (!q) {
    send({ answers: [] });
    return;
  }

  const matches = findRecordsByName(q.name, ZONE_RECORDS).map((rr) =>
    rrToAnswer(rr, DEFAULT_TTL)
  );

  const visited = new Set<string>(); // to detect CNAME loops
  const cnameChain: DNS.DnsAnswer[] = [];
  let current = ZONE_RECORDS.find(
    (rr) =>
      rr.name.toLowerCase() === toAbsolute(q.name).toLowerCase() &&
      rr.type === "CNAME"
  );
  let hops = 0;
  const MAX_HOPS = 8;

  while (current && hops < MAX_HOPS) {
    const owner = current.name.toLowerCase(); // owner is the CNAME name
    if (visited.has(owner)) {
      // loop detected
      break;
    }
    visited.add(owner);
    cnameChain.push(rrToAnswer(current, DEFAULT_TTL));

    const nextName = toAbsolute(current.value).toLowerCase(); // next name to resolve(target of CNAME)
    current = ZONE_RECORDS.find(
      (rr) => rr.name.toLowerCase() === nextName && rr.type === "CNAME"
    );
    hops++;
  }

  if (cnameChain.length > 0) {
    const cnameOwners = new Set(cnameChain.map((c) => c.name.toLowerCase())); // to avoid duplicates
    const isCnameAtOwner = (a?: DNS.DnsAnswer) =>
      !!a && a.type === DNS.Packet.TYPE.CNAME && cnameOwners.has(a.name.toLowerCase());
    for (let i = matches.length - 1; i >= 0; i--) {
      if (matches[i] && isCnameAtOwner(matches[i])) {
        matches.splice(i, 1);
      }
    }
    matches.unshift(...cnameChain);

    // If terminal is not a CNAME, append its A/AAAA, avoiding duplicates.
    const terminal = cnameChain[cnameChain.length - 1];
    const terminalName = (
      terminal?.domain ??
      terminal?.data ??
      ""
    ).toLowerCase();
    if (terminalName) {
      const terminalAs = ZONE_RECORDS.filter(
        (rr) =>
          rr.name.toLowerCase() === terminalName &&
          (rr.type === "A" || rr.type === "AAAA")
      ).map((rr) => rrToAnswer(rr, DEFAULT_TTL))
      .filter(a =>
        !matches.some(m =>
          m.type === a.type &&
          m.name.toLowerCase() === a.name.toLowerCase() &&
          (m.address ?? m.domain ?? m.data) === (a.address ?? a.domain ?? a.data)
        )
      )
      ;
      matches.push(...terminalAs);
    }
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
