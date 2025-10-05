import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { RR, toAbsolute } from './helpers';
import DNS from 'dns2';


// Async, safe loader with better defaults and errors
export async function loadZoneAsync(file?: string): Promise<RR[]> {
  const zonePath = file ?? process.env.ZONE_FILE ?? path.resolve(process.cwd(), 'data/records.json');
  try {
    const raw = await fsp.readFile(zonePath, 'utf8');
    let data: unknown;
    try {
      data = JSON.parse(raw);
    } catch (err: any) {
      throw new Error(`Invalid JSON in ${zonePath}: ${err?.message ?? err}`);
    }
    if (!Array.isArray(data)) {
      throw new Error(`Zone file ${zonePath} must be a JSON array`);
    }
    return (data as unknown[]).map((o, i) => {
      try {
        return validateRR(o);
      } catch (err: any) {
        throw new Error(`Invalid RR at index ${i} in ${zonePath}: ${err?.message ?? err}`);
      }
    });
  } catch (err: any) {
    throw new Error(`Failed to load zone from ${zonePath}: ${err?.message ?? err}`);
  }
}

export function loadZone(file = path.resolve(process.cwd(), 'data/records.json')): RR[] {
  const raw = fs.readFileSync(file, 'utf8');
  const data = JSON.parse(raw);
  if (!Array.isArray(data)) throw new Error(`Zone file ${file} must be a JSON array`);
  return (data as unknown[]).map((o, i) => {
    try {
      return validateRR(o);
    } catch (err: any) {
      throw new Error(`Invalid RR at index ${i} in ${file}: ${err?.message ?? err}`);
    }
  });
}

function validateRR(o: any): RR {
  if (typeof o !== 'object' || o === null) throw new Error('RR must be an object');
  let { name, type, ttl, value } = o as Record<string, unknown>;

  if (typeof name !== 'string' || name.length === 0) throw new Error('Invalid name');
  const normName = toAbsolute(name);

  if (typeof type !== 'string') throw new Error('Missing type');
  const upperType = type.toUpperCase();
  if (!Object.keys(DNS.Packet.TYPE).includes(upperType)) throw new Error(`Unsupported type: ${type}`);

  if (ttl !== undefined) {
    if (typeof ttl !== 'number' || !Number.isFinite(ttl) || ttl <= 0) throw new Error('Bad ttl');
  }

  if (typeof value !== 'string') throw new Error('Bad value');

  const rr: RR = { name: normName, type: upperType as any, value: String(value) };
  if (ttl !== undefined) {
    (rr as any).ttl = ttl as number;
  }
  return rr;
}
