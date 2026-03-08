import express from "express";
import cors from "cors";
import { ethers } from "ethers";
import { register, getAll } from "./addressRegistry";
import { CONFIG } from "./config";

const app = express();
const provider = new ethers.JsonRpcProvider(CONFIG.CREDITCOIN_RPC);
app.use(cors());
app.use(express.json());
app.get("/", (req, res) => res.json({ status: "ok", service: "BitCredit Relayer" }));

const USC_ABI = [
    "function getCreditScore(address) view returns (uint256)",
    "function getActiveCreditLine(address) view returns (tuple(address borrower, string stacksOwner, uint256 collateralSats, uint256 stacksNonce, uint256 creditPowerUSD, uint256 issuedAt, bool active, uint256 loansDisbursed, uint256 totalRepaidCents))",
    "function activeCreditLine(address) view returns (uint256)",
];

const usc = new ethers.Contract(CONFIG.USC_ADDRESS, USC_ABI, provider);

app.post("/api/register", (req, res) => {
    const { stacksAddress, evmAddress } = req.body;
    if (!stacksAddress || !evmAddress)
        return res.status(400).json({ error: "Missing stacksAddress or evmAddress" });
    register(stacksAddress, evmAddress);
    res.json({ success: true });
});

app.get("/api/credit-line", async (req, res) => {
    const { evmAddress } = req.query as { evmAddress: string };
    console.log(`API: GET /api/credit-line?evmAddress=${evmAddress}`);
    try {
        const tokenId = await usc.activeCreditLine(evmAddress);
        console.log(`API: tokenId for ${evmAddress} is ${tokenId}`);
        if (tokenId === 0n) return res.json({ active: false });
        const cl = await usc.getActiveCreditLine(evmAddress);
        const score = await usc.getCreditScore(evmAddress);
        res.json({
            active: true, tokenId: tokenId.toString(),
            creditPowerUSD: cl.creditPowerUSD.toString(),
            collateralSats: cl.collateralSats.toString(),
            stacksOwner: cl.stacksOwner,
            stacksNonce: cl.stacksNonce.toString(),
            loansDisbursed: cl.loansDisbursed.toString(),
            totalRepaidCents: cl.totalRepaidCents.toString(),
            creditScore: score.toString(),
        });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
});

app.get("/api/attestation-status", async (req, res) => {
    const registry = getAll();
    for (const [, evmAddr] of Object.entries(registry)) {
        try {
            const tokenId = await usc.activeCreditLine(evmAddr);
            if (tokenId !== 0n) {
                const cl = await usc.getActiveCreditLine(evmAddr);
                return res.json({
                    status: "active",
                    nonce: cl.stacksNonce.toString(),
                    creditPowerUSD: cl.creditPowerUSD.toString(),
                });
            }
        } catch { continue; }
    }
    res.json({ status: "pending" });
});

export function startApi(port: number | string): void {
    app.listen(port, () => console.log(`API running at http://localhost:${port}`));
}
