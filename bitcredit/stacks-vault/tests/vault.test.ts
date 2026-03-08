import { describe, it, expect } from "vitest";
import { Cl } from "@stacks/transactions";

declare const simnet: any;

// ─── constants ───────────────────────────────────────────────────────────────

const VAULT = "vault";
const MOCK_SBTC = "mock-sbtc-token";
const ONE_SBTC = 100_000_000;
const SMALL_SBTC = 100_000;
const LOCK_EXPIRY_BLOCKS = 25_920n;

// ─── helpers ─────────────────────────────────────────────────────────────────

function accs() {
    return Object.fromEntries(simnet.getAccounts() as Map<string, string>);
}

function mintSbtc(recipient: string, amount: number, sender: string) {
    const r = simnet.callPublicFn(
        MOCK_SBTC, "mint",
        [Cl.uint(amount), Cl.standardPrincipal(recipient)],
        sender
    );
    expect(r.result).toBeOk(Cl.bool(true));
}

function lock(amount: number, sender: string) {
    return simnet.callPublicFn(VAULT, "lock-collateral", [Cl.uint(amount)], sender);
}

function getVault(owner: string) {
    const { deployer } = accs();
    return simnet.callReadOnlyFn(VAULT, "get-vault", [Cl.standardPrincipal(owner)], deployer);
}

/**
 * Unpack vault tuple fields from a callReadOnlyFn result.
 * @stacks/transactions v7 layout: OptionalSome -> TupleCV -> .data
 */
function vaultData(owner: string): Record<string, any> {
    const res = getVault(owner);
    if (!res.result || (res.result as any).type === 10) return {} as any;
    const val = (res.result as any).value;
    return val?.data || val?.value || val || {};
}

/**
 * Unpack a print event's tuple payload.
 */
function printPayload(events: any[]): Record<string, any> {
    const ev = events.find((e: any) => e.event === "print_event");
    expect(ev).toBeDefined();
    const val = ev.data.value;
    return val?.data || val?.value || val || {};
}

function mineBlocks(n: number) {
    simnet.mineEmptyBlocks(n);
}

// ─── lock-collateral ─────────────────────────────────────────────────────────

describe("lock-collateral", () => {

    it("returns nonce u1 for the first lock", () => {
        const { deployer, wallet_1: user1 } = accs();
        mintSbtc(user1, ONE_SBTC, deployer);
        expect(lock(SMALL_SBTC, user1).result).toBeOk(Cl.uint(1));
    });

    it("nonce increments independently for each user", () => {
        const { deployer, wallet_1: user1, wallet_2: user2 } = accs();
        mintSbtc(user1, ONE_SBTC, deployer);
        mintSbtc(user2, ONE_SBTC, deployer);
        expect(lock(SMALL_SBTC, user1).result).toBeOk(Cl.uint(1));
        expect(lock(SMALL_SBTC, user2).result).toBeOk(Cl.uint(2));
    });

    it("stores correct vault data after locking", () => {
        const { deployer, wallet_1: user1 } = accs();
        mintSbtc(user1, ONE_SBTC, deployer);
        lock(SMALL_SBTC, user1);

        const data = vaultData(user1);
        expect(data.amount).toEqual(Cl.uint(SMALL_SBTC));
        expect(data.nonce).toEqual(Cl.uint(1));
        expect(data.released).toEqual(Cl.bool(false));
        expect(data["credit-active"]).toEqual(Cl.bool(false));
        expect(data["locked-at-block"]).toBeDefined();
        expect(data["expiry-block"]).toBeDefined();
    });

    it("expiry-block is exactly locked-at-block + 25920", () => {
        const { deployer, wallet_1: user1 } = accs();
        mintSbtc(user1, ONE_SBTC, deployer);
        lock(SMALL_SBTC, user1);

        const data = vaultData(user1);
        const lockedAt = BigInt(data["locked-at-block"].value);
        const expiry = BigInt(data["expiry-block"].value);
        expect(expiry - lockedAt).toBe(LOCK_EXPIRY_BLOCKS);
    });

    it("nonce-counter data-var increments to 1 after first lock", () => {
        const { deployer, wallet_1: user1 } = accs();
        mintSbtc(user1, ONE_SBTC, deployer);
        expect(simnet.getDataVar(VAULT, "nonce-counter")).toBeUint(0);
        lock(SMALL_SBTC, user1);
        expect(simnet.getDataVar(VAULT, "nonce-counter")).toBeUint(1);
    });

    it("emits CollateralLocked print event with correct fields", () => {
        const { deployer, wallet_1: user1 } = accs();
        mintSbtc(user1, ONE_SBTC, deployer);
        const { events } = lock(SMALL_SBTC, user1);

        const p = printPayload(events);
        expect(p.event).toEqual(Cl.stringAscii("CollateralLocked"));
        expect(p.owner).toEqual(Cl.standardPrincipal(user1));
        expect(p.amount).toEqual(Cl.uint(SMALL_SBTC));
        expect(p.nonce).toEqual(Cl.uint(1));
    });

    it("emits ft_transfer_event moving sBTC from user to vault", () => {
        const { deployer, wallet_1: user1 } = accs();
        mintSbtc(user1, ONE_SBTC, deployer);
        const { events } = lock(SMALL_SBTC, user1);

        const ft = events.find((e: any) => e.event === "ft_transfer_event");
        expect(ft).toBeDefined();
        expect(ft.data.amount).toBe(String(SMALL_SBTC));
        expect(ft.data.sender).toBe(user1);
        expect(ft.data.recipient).toContain(".vault");
    });

    it("rejects zero amount — ERR-ZERO-AMOUNT (u101)", () => {
        const { deployer, wallet_1: user1 } = accs();
        mintSbtc(user1, ONE_SBTC, deployer);
        expect(lock(0, user1).result).toBeErr(Cl.uint(101));
    });

    it("rejects duplicate lock — ERR-ALREADY-LOCKED (u103)", () => {
        const { deployer, wallet_1: user1 } = accs();
        mintSbtc(user1, ONE_SBTC, deployer);
        lock(SMALL_SBTC, user1);
        expect(lock(SMALL_SBTC, user1).result).toBeErr(Cl.uint(103));
    });

    it("vault is none before any lock", () => {
        const { wallet_1: user1 } = accs();
        expect(getVault(user1).result).toBeNone();
    });

});

// ─── get-owner-by-nonce ───────────────────────────────────────────────────────

describe("get-owner-by-nonce", () => {

    it("returns the correct principal for each nonce", () => {
        const { deployer, wallet_1: user1, wallet_2: user2 } = accs();
        mintSbtc(user1, ONE_SBTC, deployer);
        mintSbtc(user2, ONE_SBTC, deployer);
        lock(SMALL_SBTC, user1);
        lock(SMALL_SBTC, user2);

        const r1 = simnet.callReadOnlyFn(VAULT, "get-owner-by-nonce", [Cl.uint(1)], deployer);
        const r2 = simnet.callReadOnlyFn(VAULT, "get-owner-by-nonce", [Cl.uint(2)], deployer);
        expect(r1.result).toBeSome(Cl.tuple({ owner: Cl.standardPrincipal(user1) }));
        expect(r2.result).toBeSome(Cl.tuple({ owner: Cl.standardPrincipal(user2) }));
    });

    it("returns none for a nonce never used", () => {
        const { deployer } = accs();
        expect(
            simnet.callReadOnlyFn(VAULT, "get-owner-by-nonce", [Cl.uint(99)], deployer).result
        ).toBeNone();
    });

});

// ─── mark-credit-active ───────────────────────────────────────────────────────

describe("mark-credit-active", () => {

    it("attacker is rejected — ERR-NOT-AUTHORIZED (u105)", () => {
        const { deployer, wallet_1: user1, wallet_2: attacker } = accs();
        mintSbtc(user1, ONE_SBTC, deployer);
        lock(SMALL_SBTC, user1);
        expect(
            simnet.callPublicFn(VAULT, "mark-credit-active", [Cl.uint(1)], attacker).result
        ).toBeErr(Cl.uint(105));
    });

    it("relayer succeeds and sets credit-active to true", () => {
        const { deployer, wallet_1: user1 } = accs();
        mintSbtc(user1, ONE_SBTC, deployer);
        lock(SMALL_SBTC, user1);

        expect(
            simnet.callPublicFn(VAULT, "mark-credit-active", [Cl.uint(1)], deployer).result
        ).toBeOk(Cl.bool(true));

        expect(vaultData(user1)["credit-active"]).toEqual(Cl.bool(true));
    });

    it("emits CreditLineActivated print event", () => {
        const { deployer, wallet_1: user1 } = accs();
        mintSbtc(user1, ONE_SBTC, deployer);
        lock(SMALL_SBTC, user1);

        const { events } = simnet.callPublicFn(
            VAULT, "mark-credit-active", [Cl.uint(1)], deployer
        );
        const p = printPayload(events);
        expect(p.event).toEqual(Cl.stringAscii("CreditLineActivated"));
        expect(p.owner).toEqual(Cl.standardPrincipal(user1));
        expect(p.nonce).toEqual(Cl.uint(1));
    });

    it("fails ERR-VAULT-NOT-FOUND (u102) for unknown nonce", () => {
        const { deployer } = accs();
        expect(
            simnet.callPublicFn(VAULT, "mark-credit-active", [Cl.uint(99)], deployer).result
        ).toBeErr(Cl.uint(102));
    });

});

// ─── release-collateral ───────────────────────────────────────────────────────

describe("release-collateral", () => {

    it("relayer can release immediately", () => {
        const { deployer, wallet_1: user1 } = accs();
        mintSbtc(user1, ONE_SBTC, deployer);
        lock(SMALL_SBTC, user1);
        expect(
            simnet.callPublicFn(
                VAULT, "release-collateral", [Cl.standardPrincipal(user1)], deployer
            ).result
        ).toBeOk(Cl.uint(SMALL_SBTC));
    });

    it("marks released=true and credit-active=false after release", () => {
        const { deployer, wallet_1: user1 } = accs();
        mintSbtc(user1, ONE_SBTC, deployer);
        lock(SMALL_SBTC, user1);
        simnet.callPublicFn(VAULT, "release-collateral", [Cl.standardPrincipal(user1)], deployer);

        const data = vaultData(user1);
        expect(data.released).toEqual(Cl.bool(true));
        expect(data["credit-active"]).toEqual(Cl.bool(false));
    });

    it("emits CollateralReleased print event", () => {
        const { deployer, wallet_1: user1 } = accs();
        mintSbtc(user1, ONE_SBTC, deployer);
        lock(SMALL_SBTC, user1);

        const { events } = simnet.callPublicFn(
            VAULT, "release-collateral", [Cl.standardPrincipal(user1)], deployer
        );
        const p = printPayload(events);
        expect(p.event).toEqual(Cl.stringAscii("CollateralReleased"));
        expect(p.owner).toEqual(Cl.standardPrincipal(user1));
        expect(p.amount).toEqual(Cl.uint(SMALL_SBTC));
        expect(p.nonce).toEqual(Cl.uint(1));
    });

    it("owner cannot release before expiry — ERR-LOCK-ACTIVE (u104)", () => {
        const { deployer, wallet_1: user1 } = accs();
        mintSbtc(user1, ONE_SBTC, deployer);
        lock(SMALL_SBTC, user1);
        expect(
            simnet.callPublicFn(
                VAULT, "release-collateral", [Cl.standardPrincipal(user1)], user1
            ).result
        ).toBeErr(Cl.uint(104));
    });

    it("owner CAN self-release after mining past expiry", () => {
        const { deployer, wallet_1: user1 } = accs();
        mintSbtc(user1, ONE_SBTC, deployer);
        lock(SMALL_SBTC, user1);
        mineBlocks(25_921);
        expect(
            simnet.callPublicFn(
                VAULT, "release-collateral", [Cl.standardPrincipal(user1)], user1
            ).result
        ).toBeOk(Cl.uint(SMALL_SBTC));
    });

});

// ─── is-expired ───────────────────────────────────────────────────────────────

describe("is-expired", () => {

    it("returns false immediately after lock", () => {
        const { deployer, wallet_1: user1 } = accs();
        mintSbtc(user1, ONE_SBTC, deployer);
        lock(SMALL_SBTC, user1);
        expect(
            simnet.callReadOnlyFn(VAULT, "is-expired", [Cl.standardPrincipal(user1)], deployer).result
        ).toEqual(Cl.bool(false));
    });

    it("returns true after mining past expiry", () => {
        const { deployer, wallet_1: user1 } = accs();
        mintSbtc(user1, ONE_SBTC, deployer);
        lock(SMALL_SBTC, user1);
        mineBlocks(25_921);
        expect(
            simnet.callReadOnlyFn(VAULT, "is-expired", [Cl.standardPrincipal(user1)], deployer).result
        ).toEqual(Cl.bool(true));
    });

});

// ─── set-relayer ──────────────────────────────────────────────────────────────

describe("set-relayer", () => {

    it("owner can update the relayer", () => {
        const { deployer, wallet_1: newRelayer } = accs();
        expect(
            simnet.callPublicFn(VAULT, "set-relayer", [Cl.standardPrincipal(newRelayer)], deployer).result
        ).toBeOk(Cl.bool(true));
        expect(simnet.getDataVar(VAULT, "authorized-relayer"))
            .toEqual(Cl.standardPrincipal(newRelayer));
    });

    it("non-owner is rejected — ERR-NOT-OWNER (u100)", () => {
        const { wallet_1: user1, wallet_2: newRelayer } = accs();
        expect(
            simnet.callPublicFn(VAULT, "set-relayer", [Cl.standardPrincipal(newRelayer)], user1).result
        ).toBeErr(Cl.uint(100));
    });

});

// ─── full lifecycle ───────────────────────────────────────────────────────────

describe("full lifecycle", () => {

    it("lock → mark-active → relayer release completes cleanly", () => {
        const { deployer, wallet_1: user1 } = accs();
        mintSbtc(user1, ONE_SBTC, deployer);

        expect(lock(SMALL_SBTC, user1).result).toBeOk(Cl.uint(1));
        expect(
            simnet.callPublicFn(VAULT, "mark-credit-active", [Cl.uint(1)], deployer).result
        ).toBeOk(Cl.bool(true));

        expect(vaultData(user1)["credit-active"]).toEqual(Cl.bool(true));
        expect(vaultData(user1).released).toEqual(Cl.bool(false));

        expect(
            simnet.callPublicFn(
                VAULT, "release-collateral", [Cl.standardPrincipal(user1)], deployer
            ).result
        ).toBeOk(Cl.uint(SMALL_SBTC));

        expect(vaultData(user1).released).toEqual(Cl.bool(true));
        expect(vaultData(user1)["credit-active"]).toEqual(Cl.bool(false));
    });

    it("allows re-locking after a previous vault has been released", () => {
        const { deployer, wallet_1: user1 } = accs();
        mintSbtc(user1, ONE_SBTC * 2, deployer);

        // First lock
        lock(SMALL_SBTC, user1);
        // Release first lock
        simnet.callPublicFn(VAULT, "release-collateral", [Cl.standardPrincipal(user1)], deployer);
        expect(vaultData(user1).released).toEqual(Cl.bool(true));

        // Second lock (should now succeed)
        const result2 = lock(SMALL_SBTC, user1);
        expect(result2.result).toBeOk(Cl.uint(2));
        expect(vaultData(user1).nonce).toEqual(Cl.uint(2));
        expect(vaultData(user1).released).toEqual(Cl.bool(false));
    });

});
