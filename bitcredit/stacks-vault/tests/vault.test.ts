import { describe, it, expect, beforeEach } from "vitest";
import { Cl } from "@stacks/transactions";

// simnet is injected globally by the Clarinet vitest environment
declare const simnet: any;

// ─── helpers ────────────────────────────────────────────────────────────────

const VAULT = "vault";
const MOCK_SBTC = "mock-sbtc-token";
const ONE_SBTC = 100_000_000;   // 1 BTC in sats
const SMALL_SBTC = 100_000;       // 0.001 BTC in sats

function accounts() {
    return simnet.getAccounts() as Map<string, string>;
}

/** Mint mock sBTC to a principal so they can lock collateral. */
function mintSbtc(recipient: string, amount: number, sender: string) {
    return simnet.callPublicFn(
        MOCK_SBTC,
        "mint",
        [Cl.uint(amount), Cl.standardPrincipal(recipient)],
        sender
    );
}

/** Lock collateral as a given user. */
function lockCollateral(amount: number, sender: string) {
    return simnet.callPublicFn(
        VAULT,
        "lock-collateral",
        [Cl.uint(amount)],
        sender
    );
}

/** Read the vault map entry for a given owner. */
function getVault(owner: string, sender: string) {
    return simnet.callReadOnlyFn(
        VAULT,
        "get-vault",
        [Cl.standardPrincipal(owner)],
        sender
    );
}

// ─── describe blocks ────────────────────────────────────────────────────────

describe("vault.clar", () => {

    // ── lock-collateral ────────────────────────────────────────────────────────

    describe("lock-collateral", () => {

        it("succeeds and returns nonce u1 for first lock", () => {
            const { deployer, wallet_1: user1 } = Object.fromEntries(accounts());
            mintSbtc(user1, ONE_SBTC, deployer);

            const { result } = lockCollateral(SMALL_SBTC, user1);
            expect(result).toBeOk(Cl.uint(1));
        });

        it("nonce increments correctly for successive users", () => {
            const { deployer, wallet_1: user1, wallet_2: user2 } = Object.fromEntries(accounts());
            mintSbtc(user1, ONE_SBTC, deployer);
            mintSbtc(user2, ONE_SBTC, deployer);

            const r1 = lockCollateral(SMALL_SBTC, user1);
            const r2 = lockCollateral(SMALL_SBTC, user2);

            expect(r1.result).toBeOk(Cl.uint(1));
            expect(r2.result).toBeOk(Cl.uint(2));
        });

        it("stores correct vault data after lock", () => {
            const { deployer, wallet_1: user1 } = Object.fromEntries(accounts());
            mintSbtc(user1, ONE_SBTC, deployer);
            lockCollateral(SMALL_SBTC, user1);

            const { result } = getVault(user1, deployer);
            const vault = result.value.value as Record<string, any>;
            expect(vault.amount).toEqual(Cl.uint(SMALL_SBTC));
            expect(vault.nonce).toEqual(Cl.uint(1));
            expect(vault["locked-at-block"]).toBeDefined();
            expect(vault["expiry-block"]).toBeDefined();
            expect(vault.released).toEqual(Cl.bool(false));
            expect(vault["credit-active"]).toEqual(Cl.bool(false));
        });

        it("expiry-block is locked-at-block + 25920 blocks (~6 months)", () => {
            const { deployer, wallet_1: user1 } = Object.fromEntries(accounts());
            mintSbtc(user1, ONE_SBTC, deployer);
            lockCollateral(SMALL_SBTC, user1);

            const { result } = getVault(user1, deployer);
            const vault = result.value.value as Record<string, any>;

            const lockedAt = BigInt(vault["locked-at-block"].value);
            const expiry = BigInt(vault["expiry-block"].value);

            // ~6 months at 10 min/block = 25920 blocks
            expect(expiry - lockedAt).toBe(25_920n);
        });

        it("emits CollateralLocked print event", () => {
            const { deployer, wallet_1: user1 } = Object.fromEntries(accounts());
            mintSbtc(user1, ONE_SBTC, deployer);

            const { events } = lockCollateral(SMALL_SBTC, user1);
            const printEvent = events.find((e: any) => e.event === "print_event");

            expect(printEvent).toBeDefined();
            const payload = printEvent.data.value.value;
            expect(payload.event).toEqual(Cl.stringAscii("CollateralLocked"));
            expect(payload.owner).toEqual(Cl.standardPrincipal(user1));
            expect(payload.amount).toEqual(Cl.uint(SMALL_SBTC));
            expect(payload.nonce).toEqual(Cl.uint(1));
            expect(payload["locked-at-block"].value).toBeDefined();
            expect(payload["expiry-block"].value).toBeDefined();
        });

        it("rejects zero amount with ERR-ZERO-AMOUNT (u101)", () => {
            const { deployer, wallet_1: user1 } = Object.fromEntries(accounts());
            mintSbtc(user1, ONE_SBTC, deployer);

            const { result } = lockCollateral(0, user1);
            expect(result).toBeErr(Cl.uint(101));
        });

        it("rejects duplicate lock from same address with ERR-ALREADY-LOCKED (u103)", () => {
            const { deployer, wallet_1: user1 } = Object.fromEntries(accounts());
            mintSbtc(user1, ONE_SBTC, deployer);

            lockCollateral(SMALL_SBTC, user1);
            const { result } = lockCollateral(SMALL_SBTC, user1);
            expect(result).toBeErr(Cl.uint(103));
        });

        it("vault is none before any lock", () => {
            const { deployer, wallet_1: user1 } = Object.fromEntries(accounts());
            const { result } = getVault(user1, deployer);
            expect(result).toBeNone();
        });

        it("nonce-counter data-var increments after lock", () => {
            const { deployer, wallet_1: user1 } = Object.fromEntries(accounts());
            mintSbtc(user1, ONE_SBTC, deployer);

            const before = simnet.getDataVar(VAULT, "nonce-counter");
            expect(before).toBeUint(0);

            lockCollateral(SMALL_SBTC, user1);

            const after = simnet.getDataVar(VAULT, "nonce-counter");
            expect(after).toBeUint(1);
        });

    });

    // ── get-owner-by-nonce ─────────────────────────────────────────────────────

    describe("get-owner-by-nonce", () => {

        it("returns correct principal for each nonce", () => {
            const { deployer, wallet_1: user1, wallet_2: user2 } = Object.fromEntries(accounts());
            mintSbtc(user1, ONE_SBTC, deployer);
            mintSbtc(user2, ONE_SBTC, deployer);
            lockCollateral(SMALL_SBTC, user1);
            lockCollateral(SMALL_SBTC, user2);

            const r1 = simnet.callReadOnlyFn(VAULT, "get-owner-by-nonce", [Cl.uint(1)], deployer);
            const r2 = simnet.callReadOnlyFn(VAULT, "get-owner-by-nonce", [Cl.uint(2)], deployer);

            expect(r1.result).toBeSome(Cl.tuple({ owner: Cl.standardPrincipal(user1) }));
            expect(r2.result).toBeSome(Cl.tuple({ owner: Cl.standardPrincipal(user2) }));
        });

        it("returns none for a nonce that has never been used", () => {
            const { deployer } = Object.fromEntries(accounts());
            const { result } = simnet.callReadOnlyFn(VAULT, "get-owner-by-nonce", [Cl.uint(99)], deployer);
            expect(result).toBeNone();
        });

    });

    // ── mark-credit-active ────────────────────────────────────────────────────

    describe("mark-credit-active", () => {

        it("only the relayer (deployer) can call it", () => {
            const { deployer, wallet_1: user1, wallet_2: attacker } = Object.fromEntries(accounts());
            mintSbtc(user1, ONE_SBTC, deployer);
            lockCollateral(SMALL_SBTC, user1);

            // Attacker attempt — should fail with ERR-NOT-AUTHORIZED (u105)
            const attackerResult = simnet.callPublicFn(
                VAULT, "mark-credit-active", [Cl.uint(1)], attacker
            );
            expect(attackerResult.result).toBeErr(Cl.uint(105));

            // Relayer (deployer) succeeds
            const relayerResult = simnet.callPublicFn(
                VAULT, "mark-credit-active", [Cl.uint(1)], deployer
            );
            expect(relayerResult.result).toBeOk(Cl.bool(true));
        });

        it("sets credit-active to true in vault map", () => {
            const { deployer, wallet_1: user1 } = Object.fromEntries(accounts());
            mintSbtc(user1, ONE_SBTC, deployer);
            lockCollateral(SMALL_SBTC, user1);

            simnet.callPublicFn(VAULT, "mark-credit-active", [Cl.uint(1)], deployer);

            const { result } = getVault(user1, deployer);
            const vault = result.value.value as Record<string, any>;
            expect(vault["credit-active"]).toEqual(Cl.bool(true));
        });

        it("emits CreditLineActivated print event", () => {
            const { deployer, wallet_1: user1 } = Object.fromEntries(accounts());
            mintSbtc(user1, ONE_SBTC, deployer);
            lockCollateral(SMALL_SBTC, user1);

            const { events } = simnet.callPublicFn(
                VAULT, "mark-credit-active", [Cl.uint(1)], deployer
            );
            const printEvent = events.find((e: any) => e.event === "print_event");
            const payload = printEvent.data.value.value;
            expect(payload.event).toEqual(Cl.stringAscii("CreditLineActivated"));
            expect(payload.owner).toEqual(Cl.standardPrincipal(user1));
            expect(payload.nonce).toEqual(Cl.uint(1));
        });

        it("fails with ERR-VAULT-NOT-FOUND for unknown nonce", () => {
            const { deployer } = Object.fromEntries(accounts());
            const { result } = simnet.callPublicFn(
                VAULT, "mark-credit-active", [Cl.uint(99)], deployer
            );
            expect(result).toBeErr(Cl.uint(102));
        });

        it("fails if vault is already released", () => {
            const { deployer, wallet_1: user1 } = Object.fromEntries(accounts());
            mintSbtc(user1, ONE_SBTC, deployer);
            lockCollateral(SMALL_SBTC, user1);

            // Relayer releases first
            simnet.callPublicFn(
                VAULT, "release-collateral", [Cl.standardPrincipal(user1)], deployer
            );

            // Now try to mark active on a released vault
            const { result } = simnet.callPublicFn(
                VAULT, "mark-credit-active", [Cl.uint(1)], deployer
            );
            expect(result).toBeErr(Cl.uint(105));
        });

    });

    // ── release-collateral ────────────────────────────────────────────────────

    describe("release-collateral", () => {

        it("relayer can release at any time regardless of expiry", () => {
            const { deployer, wallet_1: user1 } = Object.fromEntries(accounts());
            mintSbtc(user1, ONE_SBTC, deployer);
            lockCollateral(SMALL_SBTC, user1);

            const { result } = simnet.callPublicFn(
                VAULT, "release-collateral", [Cl.standardPrincipal(user1)], deployer
            );
            expect(result).toBeOk(Cl.uint(SMALL_SBTC));
        });

        it("marks vault as released after relayer releases", () => {
            const { deployer, wallet_1: user1 } = Object.fromEntries(accounts());
            mintSbtc(user1, ONE_SBTC, deployer);
            lockCollateral(SMALL_SBTC, user1);

            simnet.callPublicFn(
                VAULT, "release-collateral", [Cl.standardPrincipal(user1)], deployer
            );

            const { result } = getVault(user1, deployer);
            const vault = result.value.value as Record<string, any>;
            expect(vault.released).toEqual(Cl.bool(true));
            expect(vault["credit-active"]).toEqual(Cl.bool(false));
        });

        it("owner cannot release before expiry — ERR-LOCK-ACTIVE (u104)", () => {
            const { deployer, wallet_1: user1 } = Object.fromEntries(accounts());
            mintSbtc(user1, ONE_SBTC, deployer);
            lockCollateral(SMALL_SBTC, user1);

            // stacks-block-time in simnet is 0, expiry is 15_552_000 — not expired yet
            const { result } = simnet.callPublicFn(
                VAULT, "release-collateral", [Cl.standardPrincipal(user1)], user1
            );
            expect(result).toBeErr(Cl.uint(104));
        });

        it("third party cannot release — ERR-LOCK-ACTIVE (u104)", () => {
            const { deployer, wallet_1: user1, wallet_2: stranger } = Object.fromEntries(accounts());
            mintSbtc(user1, ONE_SBTC, deployer);
            lockCollateral(SMALL_SBTC, user1);

            const { result } = simnet.callPublicFn(
                VAULT, "release-collateral", [Cl.standardPrincipal(user1)], stranger
            );
            expect(result).toBeErr(Cl.uint(104));
        });

        it("cannot release an already-released vault — ERR-NOT-AUTHORIZED (u105)", () => {
            const { deployer, wallet_1: user1 } = Object.fromEntries(accounts());
            mintSbtc(user1, ONE_SBTC, deployer);
            lockCollateral(SMALL_SBTC, user1);

            // First release — succeeds
            simnet.callPublicFn(
                VAULT, "release-collateral", [Cl.standardPrincipal(user1)], deployer
            );

            // Second release — should fail
            const { result } = simnet.callPublicFn(
                VAULT, "release-collateral", [Cl.standardPrincipal(user1)], deployer
            );
            expect(result).toBeErr(Cl.uint(105));
        });

        it("fails with ERR-VAULT-NOT-FOUND for address with no vault", () => {
            const { deployer, wallet_2: noVault } = Object.fromEntries(accounts());
            const { result } = simnet.callPublicFn(
                VAULT, "release-collateral", [Cl.standardPrincipal(noVault)], deployer
            );
            expect(result).toBeErr(Cl.uint(102));
        });

        it("emits CollateralReleased print event", () => {
            const { deployer, wallet_1: user1 } = Object.fromEntries(accounts());
            mintSbtc(user1, ONE_SBTC, deployer);
            lockCollateral(SMALL_SBTC, user1);

            const { events } = simnet.callPublicFn(
                VAULT, "release-collateral", [Cl.standardPrincipal(user1)], deployer
            );
            const printEvent = events.find((e: any) => e.event === "print_event");
            const payload = printEvent.data.value.value;
            expect(payload.event).toEqual(Cl.stringAscii("CollateralReleased"));
            expect(payload.owner).toEqual(Cl.standardPrincipal(user1));
            expect(payload.amount).toEqual(Cl.uint(SMALL_SBTC));
            expect(payload.nonce).toEqual(Cl.uint(1));
        });

    });

    // ── set-relayer ────────────────────────────────────────────────────────────

    describe("set-relayer", () => {

        it("contract owner can update the relayer address", () => {
            const { deployer, wallet_1: newRelayer } = Object.fromEntries(accounts());

            const { result } = simnet.callPublicFn(
                VAULT, "set-relayer", [Cl.standardPrincipal(newRelayer)], deployer
            );
            expect(result).toBeOk(Cl.bool(true));

            const stored = simnet.getDataVar(VAULT, "authorized-relayer");
            expect(stored).toEqual(Cl.standardPrincipal(newRelayer));
        });

        it("non-owner cannot update the relayer — ERR-NOT-OWNER (u100)", () => {
            const { wallet_1: user1, wallet_2: newRelayer } = Object.fromEntries(accounts());

            const { result } = simnet.callPublicFn(
                VAULT, "set-relayer", [Cl.standardPrincipal(newRelayer)], user1
            );
            expect(result).toBeErr(Cl.uint(100));
        });

        it("new relayer can call mark-credit-active after being set", () => {
            const { deployer, wallet_1: user1, wallet_2: newRelayer } = Object.fromEntries(accounts());
            mintSbtc(user1, ONE_SBTC, deployer);

            // Set wallet_2 as the new relayer
            simnet.callPublicFn(
                VAULT, "set-relayer", [Cl.standardPrincipal(newRelayer)], deployer
            );

            lockCollateral(SMALL_SBTC, user1);

            // Old relayer (deployer) should now fail
            const oldResult = simnet.callPublicFn(
                VAULT, "mark-credit-active", [Cl.uint(1)], deployer
            );
            expect(oldResult.result).toBeErr(Cl.uint(105));

            // New relayer should succeed
            const newResult = simnet.callPublicFn(
                VAULT, "mark-credit-active", [Cl.uint(1)], newRelayer
            );
            expect(newResult.result).toBeOk(Cl.bool(true));
        });

    });

    // ── is-expired (read-only) ────────────────────────────────────────────────

    describe("is-expired", () => {

        it("returns false immediately after lock (simnet timestamp is 0)", () => {
            const { deployer, wallet_1: user1 } = Object.fromEntries(accounts());
            mintSbtc(user1, ONE_SBTC, deployer);
            lockCollateral(SMALL_SBTC, user1);

            const { result } = simnet.callReadOnlyFn(
                VAULT, "is-expired", [Cl.standardPrincipal(user1)], deployer
            );
            // stacks-block-time in simnet ≈ 0, expiry = 15_552_000 — not expired
            expect(result).toEqual(Cl.bool(false));
        });

        it("returns false for an address with no vault", () => {
            const { deployer, wallet_2: noVault } = Object.fromEntries(accounts());
            const { result } = simnet.callReadOnlyFn(
                VAULT, "is-expired", [Cl.standardPrincipal(noVault)], deployer
            );
            expect(result).toEqual(Cl.bool(false));
        });

    });

    // ── full lifecycle ─────────────────────────────────────────────────────────

    describe("full lifecycle", () => {

        it("lock → mark-active → release completes cleanly", () => {
            const { deployer, wallet_1: user1 } = Object.fromEntries(accounts());
            mintSbtc(user1, ONE_SBTC, deployer);

            // 1. Lock
            const lockResult = lockCollateral(SMALL_SBTC, user1);
            expect(lockResult.result).toBeOk(Cl.uint(1));

            // 2. Mark active
            const activeResult = simnet.callPublicFn(
                VAULT, "mark-credit-active", [Cl.uint(1)], deployer
            );
            expect(activeResult.result).toBeOk(Cl.bool(true));

            // Verify credit-active is true
            const midVault = getVault(user1, deployer).result.value.value;
            expect(midVault["credit-active"]).toEqual(Cl.bool(true));
            expect(midVault.released).toEqual(Cl.bool(false));

            // 3. Release
            const releaseResult = simnet.callPublicFn(
                VAULT, "release-collateral", [Cl.standardPrincipal(user1)], deployer
            );
            expect(releaseResult.result).toBeOk(Cl.uint(SMALL_SBTC));

            // Verify final state
            const finalVault = getVault(user1, deployer).result.value.value;
            expect(finalVault.released).toEqual(Cl.bool(true));
            expect(finalVault["credit-active"]).toEqual(Cl.bool(false));
        });

        it("two different users have independent vaults and nonces", () => {
            const { deployer, wallet_1: user1, wallet_2: user2 } = Object.fromEntries(accounts());
            mintSbtc(user1, ONE_SBTC, deployer);
            mintSbtc(user2, ONE_SBTC, deployer);

            const lock1 = lockCollateral(SMALL_SBTC, user1);
            const lock2 = lockCollateral(SMALL_SBTC * 2, user2);

            const v1res = getVault(user1, deployer);
            const v2res = getVault(user2, deployer);

            const v1 = v1res.result.value.value;
            const v2 = v2res.result.value.value;

            expect(v1.nonce).toEqual(Cl.uint(1));
            expect(v2.nonce).toEqual(Cl.uint(2));
            expect(v1.amount).toEqual(Cl.uint(SMALL_SBTC));
            expect(v2.amount).toEqual(Cl.uint(SMALL_SBTC * 2));

            // Releasing user1 does not affect user2
            simnet.callPublicFn(
                VAULT, "release-collateral", [Cl.standardPrincipal(user1)], deployer
            );

            const v2After = getVault(user2, deployer).result.value.value;
            expect(v2After.released).toEqual(Cl.bool(false));
        });

    });

});
