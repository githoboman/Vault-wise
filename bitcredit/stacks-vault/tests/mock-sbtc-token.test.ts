import { describe, it, expect } from "vitest";
import { Cl } from "@stacks/transactions";

// simnet is injected globally by the Clarinet vitest environment
declare const simnet: any;

const MOCK_SBTC = "mock-sbtc-token";

function accounts() {
    return simnet.getAccounts() as Map<string, string>;
}

describe("mock-sbtc-token.clar", () => {

    it("returns correct token metadata", () => {
        const { deployer } = Object.fromEntries(accounts());

        const nameRes = simnet.callReadOnlyFn(MOCK_SBTC, "get-name", [], deployer);
        expect(nameRes.result).toBeOk(Cl.stringAscii("Mock sBTC"));

        const symbolRes = simnet.callReadOnlyFn(MOCK_SBTC, "get-symbol", [], deployer);
        expect(symbolRes.result).toBeOk(Cl.stringAscii("msBTC"));

        const decRes = simnet.callReadOnlyFn(MOCK_SBTC, "get-decimals", [], deployer);
        expect(decRes.result).toBeOk(Cl.uint(8));
    });

    it("can mint tokens to any address", () => {
        const { deployer, wallet_1 } = Object.fromEntries(accounts());

        const amount = 500_000_000; // 5 BTC

        const mintRes = simnet.callPublicFn(MOCK_SBTC, "mint", [Cl.uint(amount), Cl.standardPrincipal(wallet_1)], deployer);
        expect(mintRes.result).toBeOk(Cl.bool(true));

        const balanceRes = simnet.callReadOnlyFn(MOCK_SBTC, "get-balance", [Cl.standardPrincipal(wallet_1)], deployer);
        expect(balanceRes.result).toBeOk(Cl.uint(amount));

        const supplyRes = simnet.callReadOnlyFn(MOCK_SBTC, "get-total-supply", [], deployer);
        expect(supplyRes.result).toBeOk(Cl.uint(amount));
    });

    it("allows token transfer between users", () => {
        const { deployer, wallet_1, wallet_2 } = Object.fromEntries(accounts());

        const amount = 500_000_000;
        simnet.callPublicFn(MOCK_SBTC, "mint", [Cl.uint(amount), Cl.standardPrincipal(wallet_1)], deployer);

        const transferRes = simnet.callPublicFn(
            MOCK_SBTC,
            "transfer",
            [Cl.uint(100_000_000), Cl.standardPrincipal(wallet_1), Cl.standardPrincipal(wallet_2), Cl.none()],
            wallet_1
        );
        expect(transferRes.result).toBeOk(Cl.bool(true));

        const bal1 = simnet.callReadOnlyFn(MOCK_SBTC, "get-balance", [Cl.standardPrincipal(wallet_1)], deployer);
        expect(bal1.result).toBeOk(Cl.uint(400_000_000));

        const bal2 = simnet.callReadOnlyFn(MOCK_SBTC, "get-balance", [Cl.standardPrincipal(wallet_2)], deployer);
        expect(bal2.result).toBeOk(Cl.uint(100_000_000));
    });
});
