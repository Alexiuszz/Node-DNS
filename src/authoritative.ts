import DNS = require("dns2");
import { RR, toAbsolute, findRecordsByName, rrToAnswer } from "./utils/helpers";

// ---- In-memory zone (authoritative) ----
const ZONE = "example.test."; // trailing dot recommended

const DEFAULT_TTL = 300;

const ZONE_RECORDS: RR[] = [
  // Minimal SOA + NS + glue
  {
    name: ZONE,
    type: "SOA",
    ttl: 3600,
    value:
      "ns1.example.test. hostmaster.example.test. 2025082901 3600 600 604800 300",
  },
  { name: ZONE, type: "NS", ttl: 3600, value: "ns1.example.test." },
  { name: "ns1.example.test.", type: "A", ttl: 3600, value: "10.0.0.53" },

  // Some host records
  { name: "www.example.test.", type: "A", ttl: 120, value: "10.0.0.10" },
  { name: "api.example.test.", type: "AAAA", ttl: 120, value: "2001:db8::42" },
  { name: "docs.example.test.", type: "CNAME", ttl: 120, value: "www.example.test." },

  // Mail
  { name: "mail.example.test.", type: "A", ttl: 300, value: "10.0.0.25" },
  // MX requires preference + exchange; your DnsAnswer lacks fields for that,
  // so we encode both as a single string "pref exchange" in `data`.
  { name: ZONE, type: "MX", ttl: 300, value: "10 mail.example.test." },

  // SPF / verification
  { name: ZONE, type: "TXT", ttl: 300, value: "v=spf1 ip4:10.0.0.25 -all" },
];


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

  // include the target A/AAAA if present when the name itself is a CNAME.
  const cname = ZONE_RECORDS.find(
    (rr) => rr.name.toLowerCase() === toAbsolute(q.name).toLowerCase() && rr.type === "CNAME",
  );
  if (cname) {
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
