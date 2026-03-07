import { ethers } from "ethers";
import {
    makeContractCall, broadcastTransaction,
    uintCV, standardPrincipalCV, AnchorMode, PostConditionMode
} from "@stacks/transactions";
import { STACKS_TESTNET } from "@stacks/network";
import { CONFIG } from "./config";
import { lookup } from "./addressRegistry";

const provider = new ethers.JsonRpcProvider(CONFIG.CREDITCOIN_RPC);
const evmSigner = new ethers.Wallet(CONFIG.EVM_PRIV, provider);
const network = STACKS_TESTNET;
const processedTxs = new Set<string>();

const USC_ABI = [
    "function attestAndIssueCreditLine(address,string,uint256,uint256) returns(uint256)",
    "event CreditLineClosed(uint256 indexed tokenId, address indexed borrower, uint256 stacksNonce)",
];

const usc = new ethers.Contract(CONFIG.USC_ADDRESS, USC_ABI, evmSigner);

interface StacksEvent {
    txId: string; owner: string; amount: number;
    nonce: number; lockedAt: number; expiryTime: number;
}

function parseEvent(txId: string, repr: string): StacksEvent | null {
    try {
        const num = (key: string) =>
            parseInt(repr.match(new RegExp(`${key} u(\\d+)`))?.[1] ?? "0");
        const addr = (key: string) =>
            repr.match(new RegExp(`${key} '([\\w\\.]+)`))?.[1] ?? "";
        return {
            txId, owner: addr("owner"), amount: num("amount"),
            nonce: num("nonce"), lockedAt: num("locked-at-block"), expiryTime: num("expiry-block"),
        };
    } catch { return null; }
}

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
            if (!parsed) continue;
            console.log(`\nCollateralLocked: owner=${parsed.owner} amount=${parsed.amount} nonce=${parsed.nonce}`);
            await handleCollateralLocked(parsed);
            processedTxs.add(txId);
        }
    } catch (err) { console.error("Poll error:", err); }
}

async function handleCollateralLocked(event: StacksEvent): Promise<void> {
    const evmAddress = lookup(event.owner);
    if (!evmAddress) {
        console.warn(`No EVM address mapped for ${event.owner}`);
        return;
    }
    try {
        const tx = await usc.attestAndIssueCreditLine(
            evmAddress, event.owner, event.nonce, event.amount, { gasLimit: 500_000 });
        const receipt = await tx.wait();
        console.log(`Credit Power NFT minted. Block: ${receipt.blockNumber}`);
        await markActiveOnStacks(event.nonce);
    } catch (err: any) { console.error(`Attestation failed: ${err.message}`); }
}

async function markActiveOnStacks(nonce: number): Promise<void> {
    try {
        const tx = await makeContractCall({
            contractAddress: CONFIG.VAULT_ADDRESS, contractName: CONFIG.VAULT_NAME,
            functionName: "mark-credit-active", functionArgs: [uintCV(nonce)],
            senderKey: CONFIG.RELAYER_PRIV, network,
        });
        const result = await broadcastTransaction({ transaction: tx });
        console.log(`Stacks marked active. TxID: ${result.txid}`);
    } catch (err: any) { console.error(`mark-active failed: ${err.message}`); }
}

let lastBlock = 0;
export async function listenForCreditLineClosed(): Promise<void> {
    console.log("Starting polling for CreditLineClosed on Creditcoin...");
    try {
        lastBlock = await provider.getBlockNumber();
    } catch (e: any) {
        console.error("Failed to get initial block number:", e.message);
    }

    setInterval(async () => {
        try {
            const currentBlock = await provider.getBlockNumber();
            if (currentBlock > lastBlock) {
                const filter = usc.filters.CreditLineClosed();
                const events = await usc.queryFilter(filter, lastBlock + 1, currentBlock);
                for (const event of events) {
                    if (event instanceof ethers.EventLog) {
                        const tokenId = event.args[0];
                        const stacksNonce = event.args[2];
                        console.log(`\nCreditLineClosed. NFT #${tokenId}, Nonce: ${stacksNonce}`);
                        await releaseStacksCollateral(Number(stacksNonce));
                    }
                }
                lastBlock = currentBlock;
            }
        } catch (e: any) {
            console.error("EVM Polling error:", e.message);
        }
    }, CONFIG.POLL_INTERVAL_MS);
}

async function releaseStacksCollateral(nonce: number): Promise<void> {
    try {
        const res = await fetch(
            `${CONFIG.STACKS_API}/v2/contracts/call-read/${CONFIG.VAULT_ADDRESS}/${CONFIG.VAULT_NAME}/get-owner-by-nonce`,
            {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    sender: CONFIG.VAULT_ADDRESS,
                    arguments: [`0x${Buffer.from(uintCV(nonce) as any).toString("hex")}`]
                })
            }
        );
        const data: any = await res.json();
        const ownerPrincipal = data?.result?.value?.value ?? "";
        if (!ownerPrincipal) { console.error("No owner found for nonce", nonce); return; }
        const tx = await makeContractCall({
            contractAddress: CONFIG.VAULT_ADDRESS, contractName: CONFIG.VAULT_NAME,
            functionName: "release-collateral", functionArgs: [standardPrincipalCV(ownerPrincipal)],
            senderKey: CONFIG.RELAYER_PRIV, network,
        });
        const result = await broadcastTransaction({ transaction: tx });
        console.log(`Collateral released. TxID: ${result.txid}`);
    } catch (err: any) { console.error(`Release failed: ${err.message}`); }
}
