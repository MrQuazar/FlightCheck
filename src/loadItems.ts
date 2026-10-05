export type Item = {
    name: string;
    hasFlight: boolean;
};

/**
 * Deterministic flight rules (checked in order):
 * 1. Hard no: no wings/fuel, stone/steel, underwater, water-filled, parachute, hurricane.
 * 2. Projectiles are not flying (thrown / kicked / fired / hit into the air).
 * 3. Hard yes: wings, jetpack, propellers, rocket, flying vehicle, "flying …".
 * 4. Otherwise use the CSV flag for the base object.
 */
export function resolveFlight(name: string, csvFlag: boolean): boolean {
    const n = name.toLowerCase();

    if (
        /\bno wings\b/.test(n) ||
        /\bwithout wings\b/.test(n) ||
        /\bno fuel\b/.test(n) ||
        /\bmade of stone\b/.test(n) ||
        /\bmade of steel\b/.test(n) ||
        /\bfull of water\b/.test(n) ||
        /\bunderwater\b/.test(n) ||
        /\bparachute\b/.test(n) ||
        /\bin a hurricane\b/.test(n)
    ) {
        return false;
    }

    if (
        /\bthrown\b/.test(n) ||
        /\bkicked\b/.test(n) ||
        /\bfired from\b/.test(n) ||
        /\bhit into the air\b/.test(n)
    ) {
        return false;
    }

    if (
        /\bwith wings\b/.test(n) ||
        /\bwith a jetpack\b/.test(n) ||
        /\bwith propellers\b/.test(n) ||
        /\bon a rocket\b/.test(n) ||
        /\bwith a rocket\b/.test(n) ||
        /\bin a helicopter\b/.test(n) ||
        /\bin a balloon\b/.test(n) ||
        /\bin a hot-air balloon\b/.test(n) ||
        /\bflying\b/.test(n)
    ) {
        return true;
    }

    return csvFlag;
}

export function shuffleItems<T>(items: T[]): T[] {
    const shuffled = [...items];

    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    return shuffled;
}

function parseBool(value: string): boolean {
    const v = value.trim().toLowerCase();
    return v === 'true' || v === '1' || v === 'yes';
}

/** Load and parse a CSV with columns: name, hasFlight */
export async function loadItems(url = './items.csv'): Promise<Item[]> {
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Failed to load ${url}: ${response.status}`);
    }

    const text = await response.text();
    const lines = text
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line.length > 0);

    if (lines.length < 2) {
        return [];
    }

    const seen = new Set<string>();
    const items: Item[] = [];

    for (const line of lines.slice(1)) {
        const [nameRaw, hasFlightRaw = 'false'] = line.split(',');
        const name = nameRaw.trim();
        if (!name || seen.has(name.toLowerCase())) continue;
        seen.add(name.toLowerCase());
        items.push({
            name,
            hasFlight: resolveFlight(name, parseBool(hasFlightRaw)),
        });
    }

    return items;
}
