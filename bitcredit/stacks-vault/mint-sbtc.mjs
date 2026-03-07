/**
 * mint-sbtc.mjs
 * 
 * Run this to mint mock sBTC (200,000,000 sats = 2 sBTC) to the relayer wallet.
 * 
 * Usage:
 *   node mint-sbtc.mjs
 */

import { makeContractCall, broadcastTransaction, uintCV, standardPrincipalCV, AnchorMode } from "@stacks/transactions";
import { STACKS_TESTNET } from "@stacks/network";
import * as dotenv from "dotenv";
import { join } from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, "../relayer/.env") });

const RELAYER_PRIV = process.env.STACKS_RELAYER_PRIV;
const VAULT_ADDRESS = process.env.VAULT_ADDRESS;

if (!RELAYER_PRIV || !VAULT_ADDRESS) {
    console.error("Missing STACKS_RELAYER_PRIV or VAULT_ADDRESS in .env");
    process.exit(1);
}

async function main() {
    console.log(`Minting 2 sBTC to ${VAULT_ADDRESS}...`);

    const tx = await makeContractCall({
        contractAddress: VAULT_ADDRESS,
        contractName: "mock-sbtc-token",
        functionName: "mint",
        functionArgs: [
            uintCV(200_000_000n),
            standardPrincipalCV(VAULT_ADDRESS),
        ],
        senderKey: RELAYER_PRIV,
        network: STACKS_TESTNET,
        anchorMode: AnchorMode.Any,
    });

    const result = await broadcastTransaction({ transaction: tx, network: STACKS_TESTNET });

    if ("error" in result) {
        console.error("Broadcast failed:", result.error, result.reason);
        process.exit(1);
    }

    console.log(`\n✓ Mint broadcast!`);
    console.log(`  TxID:     ${result.txid}`);
    console.log(`  Explorer: https://explorer.hiro.so/txid/${result.txid}?chain=testnet`);
}

main().catch(console.error);
