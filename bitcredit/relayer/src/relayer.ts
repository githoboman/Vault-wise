import * as fs from "fs";
import { ethers } from "ethers";
import {
    makeContractCall, broadcastTransaction,
    uintCV, standardPrincipalCV, serializeCV
} from "@stacks/transactions";
import { STACKS_TESTNET } from "@stacks/network";
import { CONFIG } from "./config";
import { lookup } from "./addressRegistry";

const provider = new ethers.JsonRpcProvider(CONFIG.CREDITCOIN_RPC);
const evmSigner = new ethers.Wallet(CONFIG.EVM_PRIV, provider);
const network = STACKS_TESTNET;

// ─── Persistent processed-tx cache ───────────────────────────────────────────

const PROCESSED_FILE = "./processed-txs.json";

function loadProcessedTxs(): Set<string> {
    try {
        if (fs.existsSync(PROCESSED_FILE)) {
            const data = fs.readFileSync(PROCESSED_FILE, "utf-8");
            return new Set(JSON.parse(data));
        }
    } catch (e: any) {
        console.warn("Could not load processed-txs.json, starting fresh:", e.message);
    }
    return new Set();
}

function addProcessedTx(txId: string): void {
    processedTxs.add(txId);
    try {
        fs.writeFileSync(PROCESSED_FILE, JSON.stringify([...processedTxs]));
    } catch (e: any) {
        console.error("Could not persist processed-txs.json:", e.message);
    }
}

const processedTxs = loadProcessedTxs();
console.log(`Loaded ${processedTxs.size} previously-processed Stacks txs from disk.`);

// ─── EVM setup ───────────────────────────────────────────────────────────────

const USC_ABI = [
    "function attestAndIssueCreditLine(address,string,uint256,uint256) returns (uint256)",
    "function activeCreditLine(address) view returns (uint256)",
    "function nonceToTokenId(uint256) view returns (uint256)",
    "function attestors(address) view returns (bool)",
    "event CreditLineClosed(uint256 indexed tokenId, address indexed borrower, uint256 stacksNonce)",
];

const usc = new ethers.Contract(CONFIG.USC_ADDRESS, USC_ABI, evmSigner);

// ─── Types ───────────────────────────────────────────────────────────────────

interface StacksEvent {
    txId: string;
    owner: string;
    amount: number;
    nonce: number;
    lockedAt: number;
    expiryBlock: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function num(repr: string, key: string): number {
    return parseInt(repr.match(new RegExp(`${key} u(\\d+)`))?.[1] ?? "0");
}

function addr(repr: string, key: string): string {
    return repr.match(new RegExp(`${key} '([\\w\\.]+)`))?.[1] ?? "";
}

function parseEvent(txId: string, repr: string): StacksEvent | null {
    try {
        return {
            txId,
            owner: addr(repr, "owner"),
            amount: num(repr, "amount"),
            nonce: num(repr, "nonce"),
            lockedAt: num(repr, "locked-at-block"),
            expiryBlock: num(repr, "expiry-block"),
        };
    } catch {
        return null;
    }
}

/**
 * Serialize a Clarity CV to a 0x-prefixed hex string for the call-read API.
 */
function cvToHex(cv: any): string {
    const s = serializeCV(cv);
    if (typeof s === "string") return s.startsWith("0x") ? s : `0x${s}`;
    return `0x${Buffer.from(s as any).toString("hex")}`;
}

// ─── Stacks polling ──────────────────────────────────────────────────────────

export async function pollStacksEvents(): Promise<void> {
    try {
        const url = `${CONFIG.STACKS_API}/extended/v1/contract/${CONFIG.VAULT_ADDRESS}.${CONFIG.VAULT_NAME}/events?limit=20`;
        const res = await fetch(url);
        const data = await res.json() as { results: any[] };

        for (const event of (data.results ?? [])) {
            const txId: string = event.tx_id;
            if (processedTxs.has(txId)) continue;

            const repr: string = event?.contract_log?.value?.repr ?? "";
            if (!repr.includes("CollateralLocked")) continue;

            const parsed = parseEvent(txId, repr);
            if (!parsed || !parsed.owner) {
                console.warn(`Could not parse CollateralLocked in tx ${txId}`);
                addProcessedTx(txId);
                continue;
            }

            console.log(`\nCollateralLocked Event: tx=${txId} owner=${parsed.owner} nonce=${parsed.nonce}`);
            await handleCollateralLocked(parsed);
            addProcessedTx(txId);
        }
    } catch (err: any) {
        console.error("Poll error:", err.message);
    }
}

// ─── Cross-chain attestation ──────────────────────────────────────────────────

async function handleCollateralLocked(event: StacksEvent): Promise<void> {
    const evmAddress = lookup(event.owner);
    if (!evmAddress) {
        console.warn(`No EVM address mapped for ${event.owner}. User must register first.`);
        return;
    }

    // Pre-flight 1: check authorization
    try {
        const isAttestor = await usc.attestors(evmSigner.address);
        if (!isAttestor) {
            console.error(`Relayer ${evmSigner.address} is NOT an authorized attestor on ${CONFIG.USC_ADDRESS}`);
            return;
        }
    } catch (e: any) {
        console.error("Attestor check failed:", e.message);
        return;
    }

    // Pre-flight 2: check if nonce already processed on EVM
    try {
        const tokenId = await usc.nonceToTokenId(event.nonce);
        if (tokenId !== 0n) {
            console.log(`Nonce ${event.nonce} already processed (tokenId=${tokenId}). Marking active on Stacks.`);
            await markActiveOnStacks(event.nonce);
            return;
        }
    } catch (e: any) {
        console.error("Nonce check failed:", e.message);
    }

    // Pre-flight 3: check if borrower already has active credit line
    try {
        const currentLine = await usc.activeCreditLine(evmAddress);
        if (currentLine !== 0n) {
            console.log(`Borrower ${evmAddress} already has an active line ${currentLine}. Marking active on Stacks.`);
            await markActiveOnStacks(event.nonce);
            return;
        }
    } catch (e: any) {
        console.error("Active line check failed:", e.message);
    }

    try {
        console.log(`Attesting: borrower=${evmAddress} owner=${event.owner} nonce=${event.nonce}`);
        const tx = await usc.attestAndIssueCreditLine(
            evmAddress, event.owner, event.nonce, event.amount,
            { gasLimit: 500_000 }
        );
        const receipt = await tx.wait();
        console.log(`✓ Attestation successful! Receipt: ${receipt.hash}`);
        await markActiveOnStacks(event.nonce);
    } catch (err: any) {
        console.error(`✗ Attestation failed: ${err.reason || err.message}`);
    }
}

async function markActiveOnStacks(nonce: number): Promise<void> {
    try {
        const tx = await makeContractCall({
            contractAddress: CONFIG.VAULT_ADDRESS,
            contractName: CONFIG.VAULT_NAME,
            functionName: "mark-credit-active",
            functionArgs: [uintCV(nonce)],
            senderKey: CONFIG.RELAYER_PRIV,
            network,
        });
        const result = await broadcastTransaction({ transaction: tx });
        if ("txid" in result) {
            console.log(`✓ mark-credit-active broadcast: ${result.txid}`);
        } else {
            console.error(`✗ mark-credit-active error: ${JSON.stringify(result)}`);
        }
    } catch (err: any) {
        console.error(`✗ mark-credit-active failed: ${err.message}`);
    }
}

// ─── CreditLineClosed listener ────────────────────────────────────────────────

let lastBlock = 0;

export async function listenForCreditLineClosed(): Promise<void> {
    try {
        lastBlock = await provider.getBlockNumber();
        console.log(`Listening for EVM events from block ${lastBlock}`);
    } catch (e: any) {
        console.error("Failed to get block number:", e.message);
    }

    setInterval(async () => {
        try {
            const current = await provider.getBlockNumber();
            if (current <= lastBlock) return;

            const events = await usc.queryFilter(usc.filters.CreditLineClosed(), lastBlock + 1, current);
            for (const event of events) {
                if (event instanceof ethers.EventLog) {
                    const nonce = Number(event.args[2]);
                    console.log(`\nCreditLineClosed: nonce=${nonce}`);
                    await releaseStacksCollateral(nonce);
                }
            }
            lastBlock = current;
        } catch (e: any) {
            console.error("EVM poll error:", e.message);
        }
    }, CONFIG.POLL_INTERVAL_MS);
}

async function releaseStacksCollateral(nonce: number): Promise<void> {
    let owner = "";
    try {
        const body = JSON.stringify({
            sender: CONFIG.VAULT_ADDRESS,
            arguments: [cvToHex(uintCV(nonce))]
        });
        const res = await fetch(`${CONFIG.STACKS_API}/v2/contracts/call-read/${CONFIG.VAULT_ADDRESS}/${CONFIG.VAULT_NAME}/get-owner-by-nonce`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body
        });
        const data: any = await res.json();
        // v7 call-read response for (some { owner: '...' })
        const repr = data?.result || "";
        owner = repr.match(/owner '([\w.]+)/)?.[1] || "";
        if (!owner) {
            console.error(`No owner found for nonce ${nonce}. Data: ${JSON.stringify(data)}`);
            return;
        }
    } catch (e: any) {
        console.error(`get-owner-by-nonce failed: ${e.message}`);
        return;
    }

    try {
        const tx = await makeContractCall({
            contractAddress: CONFIG.VAULT_ADDRESS,
            contractName: CONFIG.VAULT_NAME,
            functionName: "release-collateral",
            functionArgs: [standardPrincipalCV(owner)],
            senderKey: CONFIG.RELAYER_PRIV,
            network,
        });
        const result = await broadcastTransaction({ transaction: tx });
        console.log(`✓ release-collateral broadcast: ${result.txid || JSON.stringify(result)}`);
    } catch (err: any) {
        console.error(`✗ release-collateral failed: ${err.message}`);
    }
}
