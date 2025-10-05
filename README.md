# Simple Dns Implementation using dns2

## Authoritative DNS

CNAME handling 

```
+-------------------------------+
| Start handling query (q.name) |
+---------------+---------------+
                |
                v
+---------------+----------------------+
| Find CNAME in ZONE_RECORDS matching |
| toAbsolute(q.name) (case-insensitive)|
+---------------+----------------------+
                |
        +-------+-------+
    No  |               | Yes
        v               v
+---------------+   +------------------------------+
| matches stays |   | Build cnameAns =             |
| as previously |   | rrToAnswer(cname, DEFAULT_TTL)|
+-------+-------+   +--------------+---------------+
        |                          |
        |                          v
        |          +---------------+------------------+
        |          | Check if CNAME already in        |
        |          | matches (type/name/target)       |
        |          +---------------+------------------+
        |                          |
        |                  +-------+--------+
        |              Yes |                | No
        |                  v                v
        |      +---------------------+      +----------------------+
        |      | Do nothing          |   | matches.unshift      |
        |      | (already there)     |   | (insert CNAME RR)    |
        |      +----------+----------+   +----------+-----------+
        |                 |                         |
        |                 +-----------+-------------+
        |                             |
        |                             v
        |          +------------------+-------------------------+
        |          | target = toAbsolute(cname.value)           |
        |          | Filter ZONE_RECORDS for A/AAAA where name  |
        |          | equals target; map to rrToAnswer(...)      |
        |          | matches.push(...targetAs)                  |
        |          +------------------+-------------------------+
        |                             |
        +-------------+---------------+
                      |
                      v
+---------------------+----------------------------+
| response = DNS.Packet.createResponseFromRequest  |
| response.answers = matches                       |
+---------------------+----------------------------+
                      |
                      v
                 +----+----+
                 | Return |
                 +---------+
```

**Zone File Format**

- Default path: `data/records.json`. Override with `ZONE_FILE=/absolute/or/relative/path.json`.
- Structure: JSON array of record objects: `name`, `type`, `value`, optional `ttl`.
- Name: normalized to an absolute domain (trailing dot) during load.
- TTL: if omitted, responses use `DEFAULT_TTL` from the server.
- Value: for `NS`, `MX`, `SOA`, `TXT`, use a single string as shown below.

Example

```
[
  { "name": "example.test.", "type": "SOA", "ttl": 3600,
    "value": "ns1.example.test. hostmaster.example.test. 2025082901 3600 600 604800 300" },
  { "name": "example.test.", "type": "NS",  "ttl": 3600, "value": "ns1.example.test." },
  { "name": "ns1.example.test.", "type": "A",  "ttl": 3600, "value": "10.0.0.53" },

  { "name": "www.example.test.",  "type": "A",     "ttl": 120,  "value": "10.0.0.10" },
  { "name": "api.example.test.",  "type": "AAAA",  "ttl": 120,  "value": "2001:db8::42" },
  { "name": "docs.example.test.", "type": "CNAME",  "ttl": 120,  "value": "www.example.test." },

  { "name": "mail.example.test.", "type": "A",     "ttl": 300,  "value": "10.0.0.25" },
  { "name": "example.test.",      "type": "MX",    "ttl": 300,  "value": "10 mail.example.test." },
  { "name": "example.test.",      "type": "TXT",   "ttl": 300,  "value": "v=spf1 ip4:10.0.0.25 -all" }
]
```
