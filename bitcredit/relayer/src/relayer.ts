import * as fs from "fs";
import { ethers } from "ethers";
import {
    makeContractCall, broadcastTransaction,
    uintCV, standardPrincipalCV, serializeCV,
    deserializeCV, cvToJSON,
    PostConditionMode, AnchorMode
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
            const success = await handleCollateralLocked(parsed);
            if (success) {
                addProcessedTx(txId);
            } else {
                console.warn(`Event ${txId} for nonce ${parsed.nonce} will be retried in next poll.`);
            }
        }
    } catch (err: any) {
        console.error("Poll error:", err.message);
    }
}

// ─── Cross-chain attestation ──────────────────────────────────────────────────

async function handleCollateralLocked(event: StacksEvent): Promise<boolean> {
    const evmAddress = lookup(event.owner);
    if (!evmAddress) {
        console.warn(`No EVM address mapped for ${event.owner}. User must register first.`);
        return false; // Retry later
    }

    // Pre-flight 1: check authorization
    try {
        const isAttestor = await usc.attestors(evmSigner.address);
        if (!isAttestor) {
            console.error(`Relayer ${evmSigner.address} is NOT an authorized attestor on ${CONFIG.USC_ADDRESS}`);
            return false;
        }
    } catch (e: any) {
        console.error("Attestor check failed:", e.message);
        return false;
    }

    // Pre-flight 2: check if nonce already processed on EVM
    try {
        const tokenId = await usc.nonceToTokenId(event.nonce);
        if (tokenId !== 0n) {
            console.log(`Nonce ${event.nonce} already processed (tokenId=${tokenId}). Marking active on Stacks.`);
            await markActiveOnStacks(event.nonce);
            return true; // Already done
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
            return true; // Already has a line, cannot issue another but we can mark this one's vault active
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
        return true;
    } catch (err: any) {
        if (err.message?.includes("already known") || err.data?.message?.includes("already known")) {
            console.log(`Nonce ${event.nonce} is already in mempool. Waiting for confirmation.`);
            return false; // Keep it in poll until confirmed
        } else if (err.message?.includes("revert") || err.data?.message?.includes("revert")) {
            console.error(`✗ Attestation reverted for nonce ${event.nonce}. Checking if already active...`);
            const tid = await usc.nonceToTokenId(event.nonce);
            if (tid !== 0n) {
                console.log(`Actually, tokenId ${tid} exists for nonce ${event.nonce}. Closing loop.`);
                await markActiveOnStacks(event.nonce);
                return true;
            }
            return false;
        } else {
            console.error(`✗ Attestation failed: ${err.reason || err.message}`);
            return false;
        }
    }
}

async function markActiveOnStacks(nonce: number): Promise<void> {
    try {
        // Find owner for this nonce to check current state
        let owner = "";
        const body = JSON.stringify({ sender: CONFIG.VAULT_ADDRESS, arguments: [cvToHex(uintCV(nonce))] });
        const res = await fetch(`${CONFIG.STACKS_API}/v2/contracts/call-read/${CONFIG.VAULT_ADDRESS}/${CONFIG.VAULT_NAME}/get-owner-by-nonce`, {
            method: "POST", headers: { "Content-Type": "application/json" }, body
        });
        const data: any = await res.json();
        if (data.okay && data.result) {
            const cv = deserializeCV(Buffer.from(data.result.slice(2), "hex"));
            const json: any = cvToJSON(cv);
            owner = json.value?.value?.owner?.value || "";
        }

        if (owner) {
            const vbody = JSON.stringify({ sender: owner, arguments: ["0x" + Buffer.from(serializeCV(standardPrincipalCV(owner))).toString("hex")] });
            const vres = await fetch(`${CONFIG.STACKS_API}/v2/contracts/call-read/${CONFIG.VAULT_ADDRESS}/${CONFIG.VAULT_NAME}/get-vault`, {
                method: "POST", headers: { "Content-Type": "application/json" }, body: vbody
            });
            const vdata: any = await vres.json();
            if (vdata.okay && vdata.result && vdata.result !== "0x09") {
                const vcv = deserializeCV(Buffer.from(vdata.result.slice(2), "hex"));
                const vjson: any = cvToJSON(vcv);
                if (vjson.value["credit-active"].value) {
                    console.log(`Vault for nonce ${nonce} already marked active on Stacks. Skipping broadcast.`);
                    return;
                }
            }
        }

        const tx = await makeContractCall({
            contractAddress: CONFIG.VAULT_ADDRESS,
            contractName: CONFIG.VAULT_NAME,
            functionName: "mark-credit-active",
            functionArgs: [uintCV(nonce)],
            senderKey: CONFIG.RELAYER_PRIV,
            network,
            postConditionMode: PostConditionMode.Allow,
        });
        const result = await broadcastTransaction({ transaction: tx });
        if ("txid" in result) {
            console.log(`✓ mark-credit-active broadcast: ${result.txid}`);
        } else {
            const msg = JSON.stringify(result);
            if (msg.includes("already known")) {
                console.log(`✓ mark-credit-active already in mempool.`);
            } else {
                console.error(`✗ mark-credit-active error: ${msg}`);
            }
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

export async function releaseStacksCollateral(nonce: number): Promise<void> {
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
        const hex = data?.result || "";
        if (!hex.startsWith("0x")) {
            console.error(`Unexpected data format for nonce ${nonce}: ${hex}`);
            return;
        }

        // Use a more robust way to extract the principal if possible, 
        // but given the urgency, I'll use the stacks transaction library to deserialize if I can.
        // For now, I'll try to get 'repr' if available, or use the hex.
        // Wait, the API response for call-read SHOULD have a 'repr' if requested correctly, 
        // but here it only has 'result'.

        // Let's decode the hex. Principal starts with 0x05 (or 0x0a0c...0x05 for optional tuple)
        // Manual extraction for testnet principals (21 bytes address + 1 byte type)
        // 0x05 1a <20 bytes>
        const principalIdx = hex.indexOf("051a");
        if (principalIdx !== -1) {
            const principalHex = hex.slice(principalIdx, principalIdx + 44);
            // We need to convert this to a string principal.
            // Actually, I'll just use the cvToHex/hexToCV logic if I had it.
            // I'll use a hacky but effective way for now: 
            // Call a different endpoint or use the Hiro 'repr' if possible.

            // Wait, I can just use get-vault-by-nonce and see if it has 'repr'?
            // No, I'll just fix the parsing.
        }

        // Better: HIRO API often returns 'repr' if you use the extended API or look at the right field.
        // Actually, let's just use the 'stacks-transactions' deserialize.
        const cv = deserializeCV(Buffer.from(hex.slice(2), "hex"));
        const json: any = cvToJSON(cv);

        // cvToJSON structure: { type: 'optional', value: { type: 'tuple', value: { owner: { type: 'principal', value: '...' } } } }
        let rawVal = json.value;
        if (json.type === "optional" || json.type === 10) rawVal = json.value;

        if (rawVal && rawVal.value && rawVal.value.owner) {
            owner = rawVal.value.owner.value || rawVal.value.owner;
        } else if (rawVal && rawVal.owner) {
            owner = rawVal.owner.value || rawVal.owner;
        }

        if (typeof owner !== 'string' || !owner.startsWith('ST')) {
            console.error(`Parsed owner invalid for nonce ${nonce}. raw: ${JSON.stringify(json)}`);
            owner = "";
        }

        if (!owner) {
            console.error(`No owner found for nonce ${nonce}. CV JSON: ${JSON.stringify(json)}`);
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
            postConditionMode: PostConditionMode.Allow,
        });
        const result = await broadcastTransaction({ transaction: tx });
        console.log(`✓ release-collateral broadcast: ${result.txid || JSON.stringify(result)}`);
    } catch (err: any) {
        console.error(`✗ release-collateral failed: ${err.message}`);
    }
}
