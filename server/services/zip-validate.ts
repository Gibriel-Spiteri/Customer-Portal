// ZIP code validation via the free Zippopotam.us API (no key required).
// Confirms a US ZIP exists and returns the city/state it belongs to.

export interface ZipInfo {
  exists: boolean;
  city?: string;        // primary place name, e.g. "Hauppauge"
  state?: string;       // state abbreviation, e.g. "NY"
  placeNames?: string[]; // all acceptable place names for this ZIP
}

export async function lookupZip(zip: string): Promise<ZipInfo | null> {
  const five = zip.trim().slice(0, 5);
  if (!/^\d{5}$/.test(five)) return { exists: false };
  try {
    const resp = await fetch(`https://api.zippopotam.us/us/${five}`, {
      signal: AbortSignal.timeout(8000),
    });
    if (resp.status === 404) return { exists: false };
    if (!resp.ok) return null; // service error — caller decides how to handle
    const data: any = await resp.json();
    const places: any[] = data?.places || [];
    if (places.length === 0) return { exists: false };
    return {
      exists: true,
      city: places[0]['place name'],
      state: places[0]['state abbreviation'],
      placeNames: places.map((p) => String(p['place name'])),
    };
  } catch {
    return null; // network/timeout — caller decides how to handle
  }
}
