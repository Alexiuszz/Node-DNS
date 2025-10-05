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

