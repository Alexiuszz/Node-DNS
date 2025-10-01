import DNS = require("dns2");

export type RRType = keyof typeof DNS.Packet.TYPE;

export type RR = {
  name: string; // absolute, trailing dot preferred
  type: RRType; // 'A' | 'AAAA' | 'CNAME' | 'MX' | 'NS' | 'SOA' | 'TXT' | ...
  ttl?: number;
  // unified value; we will map it to address/domain/data per DnsAnswer shape
  value: string;
};

// ---- Helpers ----
export function toAbsolute(name: string): string {
  return name.endsWith(".") ? name : name + ".";
}

export function findRecordsByName(qname: string, records: RR[]): RR[] {
  const abs = toAbsolute(qname).toLowerCase();
  return records.filter((rr) => rr.name.toLowerCase() === abs);
}

export function rrToAnswer(rr: RR, defaultTtl: number): DNS.DnsAnswer {
  const typeNum = DNS.Packet.TYPE[rr.type]; // map 'A' -> number
  const clsNum = DNS.Packet.CLASS.IN;

  switch (rr.type) {
    case "A":
    case "AAAA":
      return {
        name: rr.name,
        type: typeNum,
        class: clsNum,
        ttl: rr.ttl ?? defaultTtl,
        address: rr.value,
      };
    case "CNAME":
      return {
        name: rr.name,
        type: typeNum,
        class: clsNum,
        ttl: rr.ttl ?? defaultTtl,
        domain: rr.value,
      };
    default:
      return {
        name: rr.name,
        type: typeNum,
        class: clsNum,
        ttl: rr.ttl ?? defaultTtl,
        data: rr.value,
      };
  }
}

