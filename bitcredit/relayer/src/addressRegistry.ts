import * as fs from "fs";

const DB_FILE = "./address-registry.json";
type Registry = Record<string, string>;

function load(): Registry {
    if (fs.existsSync(DB_FILE)) return JSON.parse(fs.readFileSync(DB_FILE, "utf-8"));
    return {};
}

function save(r: Registry): void { fs.writeFileSync(DB_FILE, JSON.stringify(r, null, 2)); }

export function register(stacksPrincipal: string, evmAddress: string): void {
    const r = load();
    r[stacksPrincipal] = evmAddress;
    save(r);
    console.log(`Registered: ${stacksPrincipal} <-> ${evmAddress}`);
}

export function lookup(stacksPrincipal: string): string | null {
    return load()[stacksPrincipal] ?? null;
}

export function getAll(): Registry { return load(); }
