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

Notes

- Port selection: reads `DNS_PORT` or `PORT`, defaults to `5300`.
- Zone data: served from in-memory `ZONE_RECORDS` for `example.test.`.
- Helpers: `toAbsolute`, `findRecordsByName`, and `rrToAnswer` live in `src/utils/helpers.ts`.
- CNAME handling: the CNAME rr is included in answers (first), and target A/AAAA are appended.
