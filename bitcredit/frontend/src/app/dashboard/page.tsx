"use client";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { ethers } from "ethers";
import { useWallet } from "@/context/WalletContext";
import { openContractCall } from "@stacks/connect";
import { STACKS_TESTNET } from "@stacks/network";
import { uintCV, standardPrincipalCV, AnchorMode, PostConditionMode } from "@stacks/transactions";

const RELAYER = process.env.NEXT_PUBLIC_RELAYER_URL!;
const VAULT_ADDR = process.env.NEXT_PUBLIC_VAULT_ADDRESS!;
const VAULT_NAME = process.env.NEXT_PUBLIC_VAULT_NAME!;
const POOL_ADDR = process.env.NEXT_PUBLIC_POOL_ADDRESS!;
const USDC_ADDR = process.env.NEXT_PUBLIC_MOCK_USDC_ADDRESS!;
const BTC_PRICE = 97_000;

type Phase = "idle" | "locking" | "attesting" | "active" | "error" | "closing";

interface CreditLineData {
    tokenId: string;
    creditPowerUSD: string; collateralSats: string;
    loansDisbursed: string; totalRepaidCents: string;
    creditScore: string; stacksNonce: string;
}

const POOL_ABI = [
    "function borrow(uint256 amountUSD) external",
    "function repay(uint256 amountUSD) external",
    "function closeCreditLine() external",
    "function getLoan(uint256 tokenId) external view returns (tuple(uint256 amountBorrowedUSD, uint256 amountRepaidCents))"
];

const USDC_ABI = [
    "function approve(address spender, uint256 amount) external returns (bool)",
    "function allowance(address owner, address spender) external view returns (uint256)",
    "function balanceOf(address account) external view returns (uint256)"
];

const StacksLogo = () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path fillRule="evenodd" clipRule="evenodd" d="M21 7.5L12 2.5L3 7.5L12 12.5L21 7.5ZM12 4.67104L17.0921 7.5L12 10.329L6.90793 7.5L12 4.67104ZM21 16.5L12 21.5L3 16.5V10.743L12 15.743L21 10.743V16.5ZM12 19.329L6.90793 16.5V13.671L12 16.4474L17.0921 13.671V16.5L12 19.329Z" fill="currentColor" />
    </svg>
);

const CreditcoinLogo = () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z" fill="currentColor" fillOpacity="0.1" />
        <path d="M15.5 8.5C14.5 7.5 13.5 7 12 7C9.23858 7 7 9.23858 7 12C7 14.7614 9.23858 17 12 17C13.5 17 14.5 16.5 15.5 15.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <circle cx="16" cy="12" r="1.5" fill="currentColor" />
    </svg>
);

import { ThemeToggle } from "@/components/ThemeToggle";

export default function Dashboard() {
    const { stacksAddress, evmAddress, connectStacks, connectEVM, disconnect, isFullyConnected } = useWallet();
    const [phase, setPhase] = useState<Phase>("idle");
    const [amountBTC, setAmountBTC] = useState("0.001");
    const [txId, setTxId] = useState("");
    const [creditLine, setCreditLine] = useState<CreditLineData | null>(null);
    const [errorMsg, setErrorMsg] = useState("");

    // Pool states
    const [borrowAmount, setBorrowAmount] = useState("");
    const [repayAmount, setRepayAmount] = useState("");
    const [loanState, setLoanState] = useState<{ amountBorrowedUSD: string, amountRepaidCents: string } | null>(null);
    const [usdcBalance, setUsdcBalance] = useState("0");
    const [sbtcBalance, setSbtcBalance] = useState<bigint | null>(null);
    const [isMinting, setIsMinting] = useState(false);
    const [txLoading, setTxLoading] = useState(false);

    const loadPoolData = useCallback(async (tokenId: string) => {
        if (!evmAddress || !(window as any).ethereum) return;
        try {
            const provider = new ethers.BrowserProvider((window as any).ethereum);
            const pool = new ethers.Contract(POOL_ADDR, POOL_ABI, provider);
            const usdc = new ethers.Contract(USDC_ADDR, USDC_ABI, provider);

            const ls = await pool.getLoan(tokenId);
            setLoanState({ amountBorrowedUSD: ls[0].toString(), amountRepaidCents: ls[1].toString() });

            const bal = await usdc.balanceOf(evmAddress);
            setUsdcBalance(parseFloat(ethers.formatUnits(bal, 18)).toFixed(2));
        } catch (e) { console.error("Pool load error", e); }
    }, [evmAddress]);

    const checkCreditLine = useCallback(async () => {
        if (!evmAddress) return;
        try {
            const res = await fetch(`${RELAYER}/api/credit-line?evmAddress=${evmAddress}`);
            const data = await res.json() as { active: boolean, [key: string]: any };
            if (data.active) {
                setCreditLine(data as unknown as CreditLineData);
                setPhase("active");
                if (data.tokenId) {
                    await loadPoolData(data.tokenId);
                }
            }
        } catch { }
    }, [evmAddress, loadPoolData]);

    const fetchSbtcBalance = useCallback(async () => {
        if (!stacksAddress) return;
        try {
            const res = await fetch(`https://api.testnet.hiro.so/extended/v1/address/${stacksAddress}/balances`);
            const data = await res.json();
            const ftKey = Object.keys(data.fungible_tokens || {}).find(k => k.includes("mock-sbtc-token"));
            if (ftKey) {
                setSbtcBalance(BigInt(data.fungible_tokens[ftKey].balance));
            } else {
                setSbtcBalance(0n);
            }
        } catch (e) {
            console.error("Failed to fetch sBTC balance", e);
        }
    }, [stacksAddress]);

    useEffect(() => {
        if (isFullyConnected && stacksAddress && evmAddress) {
            fetch(`${RELAYER}/api/register`, {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ stacksAddress, evmAddress }),
            });
            fetchSbtcBalance();
        }
    }, [isFullyConnected, stacksAddress, evmAddress, fetchSbtcBalance]);

    useEffect(() => {
        const interval = setInterval(fetchSbtcBalance, 20_000);
        return () => clearInterval(interval);
    }, [fetchSbtcBalance]);

    useEffect(() => { checkCreditLine(); }, [checkCreditLine]);

    function pollAttestation(id: string) {
        const interval = setInterval(async () => {
            try {
                const res = await fetch(`${RELAYER}/api/attestation-status?txId=${id}`);
                const data = await res.json() as { status: string, [key: string]: any };
                if (data.status === "active") { clearInterval(interval); await checkCreditLine(); }
            } catch { }
        }, 10_000);
        setTimeout(() => {
            clearInterval(interval);
            if (phase === "attesting") { setErrorMsg("Attestation timed out."); setPhase("error"); }
        }, 30 * 60_000);
    }

    async function waitForStacksTx(txId: string) {
        setIsMinting(true);
        const interval = setInterval(async () => {
            try {
                const res = await fetch(`https://api.testnet.hiro.so/extended/v1/tx/${txId}`);
                const data = await res.json();
                if (data.tx_status === "success" || data.tx_status.startsWith("abort")) {
                    clearInterval(interval);
                    setIsMinting(false);
                    await fetchSbtcBalance();
                }
            } catch { }
        }, 8_000);
    }

    async function handleMint() {
        if (!stacksAddress) return;
        setErrorMsg("");
        await openContractCall({
            contractAddress: VAULT_ADDR, contractName: "mock-sbtc-token",
            functionName: "mint", functionArgs: [uintCV(100_000_000), standardPrincipalCV(stacksAddress)],
            network: STACKS_TESTNET, anchorMode: AnchorMode.Any,
            postConditionMode: PostConditionMode.Deny,
            onFinish: (data) => {
                setTxId(data.txId);
                waitForStacksTx(data.txId);
            },
            onCancel: () => setPhase("idle"),
        });
    }

    async function handleLock() {
        if (!amountBTC || isNaN(parseFloat(amountBTC))) return;
        const sats = Math.floor(parseFloat(amountBTC) * 1e8);

        if (sbtcBalance !== null && sbtcBalance < BigInt(sats)) {
            setErrorMsg("Insufficient mock sBTC — use the Faucet first");
            return;
        }

        setPhase("locking"); setErrorMsg("");
        await openContractCall({
            contractAddress: VAULT_ADDR, contractName: VAULT_NAME,
            functionName: "lock-collateral", functionArgs: [uintCV(sats)],
            network: STACKS_TESTNET, anchorMode: AnchorMode.Any,
            postConditionMode: PostConditionMode.Allow,
            onFinish: (data) => { setTxId(data.txId); setPhase("attesting"); pollAttestation(data.txId); },
            onCancel: () => setPhase("idle"),
        });
    }

    async function handleBorrow() {
        if (!borrowAmount || isNaN(parseFloat(borrowAmount)) || !(window as any).ethereum) return;
        setTxLoading(true);
        try {
            const provider = new ethers.BrowserProvider((window as any).ethereum);
            const signer = await provider.getSigner();
            const pool = new ethers.Contract(POOL_ADDR, POOL_ABI, signer);

            const tx = await pool.borrow(Math.floor(parseFloat(borrowAmount)));
            await tx.wait();
            await checkCreditLine(); // Refresh entirely
            setBorrowAmount("");
        } catch (e: any) {
            alert("Borrow failed: " + e.message);
        }
        setTxLoading(false);
    }

    async function handleRepay() {
        if (!repayAmount || isNaN(parseFloat(repayAmount)) || !(window as any).ethereum) return;
        setTxLoading(true);
        try {
            const provider = new ethers.BrowserProvider((window as any).ethereum);
            const signer = await provider.getSigner();
            const pool = new ethers.Contract(POOL_ADDR, POOL_ABI, signer);
            const usdc = new ethers.Contract(USDC_ADDR, USDC_ABI, signer);

            const amtWei = ethers.parseUnits(repayAmount, 18);

            // Check allowance
            const allowance = await usdc.allowance(await signer.getAddress(), POOL_ADDR);
            if (allowance < amtWei) {
                const approveTx = await usdc.approve(POOL_ADDR, ethers.MaxUint256);
                await approveTx.wait();
            }

            const tx = await pool.repay(Math.floor(parseFloat(repayAmount)));
            await tx.wait();
            await checkCreditLine(); // Refresh completely to see new credit score
            setRepayAmount("");
        } catch (e: any) {
            alert("Repay failed: " + e.message);
        }
        setTxLoading(false);
    }

    async function handleCloseVault() {
        if (!(window as any).ethereum) return;
        setTxLoading(true);
        try {
            const provider = new ethers.BrowserProvider((window as any).ethereum);
            const signer = await provider.getSigner();
            const pool = new ethers.Contract(POOL_ADDR, POOL_ABI, signer);

            const tx = await pool.closeCreditLine();
            await tx.wait();

            setPhase("closing");
            pollVaultClosure();
        } catch (e: any) {
            alert("Failed to close credit line: " + e.message);
        }
        setTxLoading(false);
    }

    function pollVaultClosure() {
        const interval = setInterval(async () => {
            try {
                const res = await fetch(`${RELAYER}/api/credit-line?evmAddress=${evmAddress}`);
                const data = await res.json() as { active: boolean, [key: string]: any };
                if (!data.active) {
                    clearInterval(interval);
                    setPhase("idle");
                    setCreditLine(null);
                    setLoanState(null);
                    alert("Vault successfully closed! Your sBTC has been returned to your Leather wallet.");
                }
            } catch { }
        }, 10_000);
    }

    const estimated = amountBTC ? Math.floor(parseFloat(amountBTC) * BTC_PRICE * 0.7).toLocaleString() : null;

    // Testnet UI Gamification: The smart contract normally requires $100 repaid per 1 point. 
    // Since we are doing smaller $20 loans, we will manually boost the UI presentation (1 USD = 1 Point)
    const baseScore = creditLine ? parseInt(creditLine.creditScore) : null;
    const repaidCents = creditLine ? parseInt(creditLine.totalRepaidCents) : 0;
    const score = baseScore !== null ? Math.min(850, 300 + Math.floor(repaidCents / 100)) : null;

    // Minimalist score coloring
    const scoreColor = !score ? "text-gray-300"
        : score < 580 ? "text-orange-500" : score < 670 ? "text-orange-400"
            : score < 740 ? "text-gray-800" : "text-black";

    return (
        <main className="min-h-screen bg-white dark:bg-black text-black dark:text-white font-sans selection:bg-orange-200 dark:selection:bg-orange-900 transition-colors duration-300">
            {/* Minimalist Header */}
            <header className="border-b border-gray-100 dark:border-white/10 px-8 py-5 flex items-center justify-between sticky top-0 bg-white/80 dark:bg-black/60 backdrop-blur-xl z-50">
                <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
                    <div className="flex items-center justify-center w-8 h-8 bg-black dark:bg-white text-white dark:text-black rounded-md shadow-sm">
                        <span className="font-bold text-lg leading-none">B</span>
                    </div>
                    <span className="text-xl font-bold tracking-tight">BitCredit</span>
                </Link>
                <div className="flex flex-row items-center gap-6">
                    <ThemeToggle />
                    {isFullyConnected && (
                        <button onClick={disconnect}
                            className="text-xs font-bold text-red-500 hover:text-red-600 bg-red-50 dark:bg-red-900/20 px-3 py-1.5 rounded-full transition-all border border-red-100 dark:border-red-900/30">
                            Disconnect
                        </button>
                    )}
                    <div className="flex items-center gap-2">
                        <button onClick={async () => { await fetchSbtcBalance(); await checkCreditLine(); }}
                            title="Refresh Data"
                            className="p-2 text-gray-400 hover:text-black dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/10 rounded-full transition-all">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                        </button>
                        <span className="text-[10px] uppercase tracking-widest bg-orange-100 dark:bg-orange-900/40 text-orange-600 dark:text-orange-400 px-2 py-1 rounded-sm font-semibold ml-2">
                            Testnet
                        </span>
                    </div>
                    <div className="flex gap-4">
                        <button onClick={connectStacks}
                            className={`flex items-center gap-2 text-sm px-5 py-2.5 rounded-full transition-all duration-300 ${stacksAddress ? "bg-gray-50 dark:bg-white/5 text-black dark:text-white border border-gray-200 dark:border-white/10 shadow-sm" : "bg-white dark:bg-[#111] text-black dark:text-white border border-gray-200 dark:border-white/20 hover:border-black dark:hover:border-white/50 shadow-sm hover:shadow-md"}`}>
                            <span className={stacksAddress ? "text-[#5546FF]" : "text-gray-400 dark:text-gray-500"}><StacksLogo /></span>
                            {stacksAddress ? `${stacksAddress.slice(0, 6)}...${stacksAddress.slice(-4)}` : "Connect Stacks"}
                        </button>
                        <button onClick={connectEVM}
                            className={`flex items-center gap-2 text-sm px-5 py-2.5 rounded-full transition-all duration-300 ${evmAddress ? "bg-gray-50 dark:bg-white/5 text-black dark:text-white border border-gray-200 dark:border-white/10 shadow-sm" : "bg-black dark:bg-white text-white dark:text-black hover:bg-gray-900 dark:hover:bg-gray-200 shadow-sm hover:shadow-md"}`}>
                            <span className={evmAddress ? "text-[#00E599]" : "text-orange-400 dark:text-orange-500"}><CreditcoinLogo /></span>
                            {evmAddress ? `${evmAddress.slice(0, 6)}...${evmAddress.slice(-4)}` : "Connect EVM"}
                        </button>
                    </div>
                </div>
            </header>

            {/* Main Content Dashboard */}
            <div className="max-w-4xl mx-auto px-6 py-16 grid grid-cols-1 md:grid-cols-5 gap-10">

                {/* Left Column: Action Card */}
                <div className="md:col-span-3 space-y-6">
                    <div className="mb-8">
                        {phase === "active" ? (
                            <>
                                <h1 className="text-4xl font-extrabold tracking-tight mb-2 dark:text-white">Liquidity Treasury</h1>
                                <p className="text-gray-500 dark:text-gray-400 text-lg">Your Stacks collateral has been activated. You may now borrow Mock USDC against your Credit Power limit.</p>
                            </>
                        ) : (
                            <>
                                <h1 className="text-4xl font-extrabold tracking-tight mb-2">Unlock Liquid Credit.</h1>
                                <p className="text-gray-500 text-lg">Deposit Stacks Bitcoin collateral to instantly mint Creditcoin lending power.</p>
                            </>
                        )}
                    </div>

                    <div className="bg-white rounded-[2rem] border border-gray-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] overflow-hidden transition-all duration-300 hover:shadow-[0_8px_40px_rgb(0,0,0,0.08)]">
                        <div className="p-8 space-y-8">
                            {!isFullyConnected ? (
                                <div className="text-center py-12 space-y-6">
                                    <div className="w-16 h-16 bg-orange-50 text-orange-500 rounded-full flex items-center justify-center mx-auto mb-4">
                                        <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
                                    </div>
                                    <h3 className="text-xl font-bold">Connect Wallets</h3>
                                    <p className="text-gray-500 text-sm max-w-xs mx-auto">Please connect both your Leather and MetaMask wallets to establish the cross-chain bridge.</p>
                                </div>
                            ) : phase === "active" && creditLine ? (
                                <div className="space-y-8 animate-in fade-in zoom-in duration-500">
                                    {/* Borrow Section */}
                                    <div className="space-y-4">
                                        <div className="flex justify-between items-center">
                                            <label className="text-sm font-bold text-gray-900">Borrow USDC</label>
                                            <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                                                Available: ${(parseInt(creditLine.creditPowerUSD) - (loanState ? parseInt(loanState.amountBorrowedUSD) : 0)).toLocaleString()}
                                            </span>
                                        </div>
                                        <div className="flex gap-4">
                                            <div className="relative flex-1">
                                                <input type="number" min="1" step="1" value={borrowAmount}
                                                    onChange={e => setBorrowAmount(e.target.value)}
                                                    placeholder="Enter USD amount"
                                                    className="w-full bg-gray-50 dark:bg-[#1a1a1a] border border-transparent dark:border-white/10 focus:border-green-500 focus:bg-white dark:focus:bg-black rounded-xl px-4 py-3 text-lg font-bold outline-none transition-colors text-gray-900 dark:text-white" />
                                            </div>
                                            <button onClick={handleBorrow} disabled={txLoading}
                                                className="bg-green-500 hover:bg-green-600 text-white font-bold px-6 py-3 rounded-xl transition-all shadow-md hover:shadow-green-500/20 disabled:opacity-50">
                                                Withdraw
                                            </button>
                                        </div>
                                    </div>

                                    {/* Divider */}
                                    <div className="h-px w-full bg-gray-100"></div>

                                    {/* Repay Section */}
                                    <div className="space-y-4">
                                        <div className="flex justify-between items-center">
                                            <label className="text-sm font-bold text-gray-900">Repay Loan</label>
                                            <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                                                Wallet Balance: {usdcBalance} mUSDC
                                            </span>
                                        </div>
                                        <div className="flex gap-4">
                                            <div className="relative flex-1">
                                                <input type="number" min="1" step="1" value={repayAmount}
                                                    onChange={e => setRepayAmount(e.target.value)}
                                                    placeholder="Enter USD amount"
                                                    className="w-full bg-gray-50 dark:bg-[#1a1a1a] border border-transparent dark:border-white/10 focus:border-orange-500 focus:bg-white dark:focus:bg-black rounded-xl px-4 py-3 text-lg font-bold outline-none transition-colors text-gray-900 dark:text-white" />
                                            </div>
                                            <button onClick={handleRepay} disabled={txLoading}
                                                className="bg-black hover:bg-gray-800 text-white font-bold px-6 py-3 rounded-xl transition-all shadow-md disabled:opacity-50">
                                                Repay
                                            </button>
                                        </div>
                                    </div>

                                    {/* Divider for Vault Closure */}
                                    {loanState?.amountBorrowedUSD === "0" && (
                                        <>
                                            <div className="h-px w-full bg-gray-100 mt-8 mb-4"></div>
                                            <div className="bg-orange-50 rounded-xl p-4 border border-orange-100 flex items-center justify-between">
                                                <div>
                                                    <p className="text-sm font-bold text-gray-900">Debt Settled.</p>
                                                    <p className="text-xs text-gray-500 mt-1">You may close this line to unlock your sBTC.</p>
                                                </div>
                                                <button onClick={handleCloseVault} disabled={txLoading}
                                                    className="bg-white border border-gray-200 text-black hover:border-black font-bold px-4 py-2 text-sm rounded-lg transition-all shadow-sm disabled:opacity-50">
                                                    Close Vault & Withdraw
                                                </button>
                                            </div>
                                        </>
                                    )}

                                    {txLoading && <p className="text-sm text-center text-orange-500 font-bold animate-pulse mt-4">Confirming Transaction in MetaMask...</p>}
                                </div>
                            ) : phase === "idle" ? (
                                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                    <div>
                                        <div className="flex justify-between items-center mb-[-0.5rem]">
                                            <div className="flex items-center gap-2">
                                                <label className="text-sm font-semibold text-gray-900 dark:text-gray-100 block">Collateral Amount</label>
                                                {sbtcBalance !== null && (
                                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${sbtcBalance >= BigInt(Math.floor(parseFloat(amountBTC || "0") * 1e8)) ? "bg-green-100 text-green-600" : "bg-orange-100 text-orange-600"}`}>
                                                        Balance: {(Number(sbtcBalance) / 1e8).toFixed(2)} sBTC
                                                    </span>
                                                )}
                                            </div>
                                            <button onClick={handleMint} disabled={isMinting}
                                                className="text-xs text-orange-500 hover:text-orange-600 font-bold underline bg-orange-50 dark:bg-orange-900/40 px-2 py-1 rounded-md transition-colors disabled:opacity-50">
                                                {isMinting ? "Minting..." : "Faucet: Mint 1 Test sBTC"}
                                            </button>
                                        </div>
                                        <div className="relative flex items-center group mt-2">
                                            <input type="number" min="0.0001" step="0.0001" value={amountBTC}
                                                onChange={e => setAmountBTC((e.target as HTMLInputElement).value)}
                                                className="w-full bg-gray-50 dark:bg-[#1a1a1a] hover:bg-gray-100 dark:hover:bg-[#222] border border-transparent dark:border-white/10 focus:border-orange-500 dark:focus:border-orange-500 focus:bg-white dark:focus:bg-black rounded-2xl px-6 py-5 text-2xl font-bold text-gray-900 dark:text-white transition-all duration-300 outline-none" />
                                            <div className="absolute right-4 flex items-center gap-2 bg-white dark:bg-[#2a2a2a] px-3 py-1.5 rounded-lg border border-gray-200 dark:border-white/10 shadow-sm pointer-events-none">
                                                <span className="text-[#5546FF] dark:text-[#786cff]"><StacksLogo /></span>
                                                <span className="text-sm font-bold text-gray-900 dark:text-gray-100">sBTC</span>
                                            </div>
                                        </div>
                                        {errorMsg && <p className="text-xs text-red-500 font-bold mt-2 ml-2">{errorMsg}</p>}
                                    </div>

                                    {estimated && (
                                        <div className="flex justify-between items-center py-4 border-t border-b border-gray-100">
                                            <span className="text-sm text-gray-500 font-medium">Est. Credit Power (70% LTV)</span>
                                            <span className="text-xl font-bold">${estimated} <span className="text-gray-400 text-sm">USD</span></span>
                                        </div>
                                    )}

                                    <button
                                        onClick={handleLock}
                                        disabled={isMinting || (sbtcBalance !== null && sbtcBalance < BigInt(Math.floor(parseFloat(amountBTC || "0") * 1e8)))}
                                        className="w-full bg-black text-white hover:bg-[#FF6B00] hover:shadow-lg hover:shadow-orange-500/20 font-bold text-lg py-5 rounded-2xl transition-all duration-300 transform active:scale-[0.98] disabled:opacity-30 disabled:hover:bg-black disabled:hover:shadow-none"
                                    >
                                        {isMinting ? "Waiting for Mint..." : "Lock & Issue Credit"}
                                    </button>
                                </div>
                            ) : phase === "locking" ? (
                                <div className="text-center py-16 animate-in zoom-in duration-300">
                                    <div className="w-16 h-16 animate-spin rounded-full border-4 border-gray-100 border-t-black mx-auto mb-6"></div>
                                    <h3 className="text-xl font-bold">Sign Transaction</h3>
                                    <p className="text-gray-500 mt-2">Please confirm the Stacks deposit in your wallet.</p>
                                </div>
                            ) : phase === "attesting" ? (
                                <div className="text-center py-16 animate-in fade-in duration-500">
                                    <div className="flex justify-center gap-2 mb-6">
                                        <div className="w-3 h-3 bg-orange-500 rounded-full animate-bounce" style={{ animationDelay: "0s" }}></div>
                                        <div className="w-3 h-3 bg-orange-500 rounded-full animate-bounce" style={{ animationDelay: "0.15s" }}></div>
                                        <div className="w-3 h-3 bg-orange-500 rounded-full animate-bounce" style={{ animationDelay: "0.3s" }}></div>
                                    </div>
                                    <h3 className="text-xl font-bold dark:text-white">Cross-Chain Attestation</h3>
                                    <p className="text-gray-500 dark:text-gray-400 mt-2">Waiting for Creditcoin validators to mint your USC...</p>
                                    {txId && (
                                        <a href={`https://explorer.hiro.so/txid/${txId}?chain=testnet`} target="_blank" rel="noreferrer"
                                            className="inline-block mt-4 text-sm font-medium text-orange-500 hover:text-orange-600 dark:hover:text-orange-400 transition-colors">
                                            View Stacks Tx ↗
                                        </a>
                                    )}
                                </div>
                            ) : phase === "closing" ? (
                                <div className="text-center py-16 animate-in fade-in duration-500">
                                    <div className="flex justify-center gap-2 mb-6">
                                        <div className="w-3 h-3 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: "0s" }}></div>
                                        <div className="w-3 h-3 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: "0.15s" }}></div>
                                        <div className="w-3 h-3 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: "0.3s" }}></div>
                                    </div>
                                    <h3 className="text-xl font-bold">Settling Credit Line & Returning Collateral</h3>
                                    <p className="text-gray-500 mt-2">Relaying closure directly to the Stacks network to unlock your sBTC...</p>
                                </div>
                            ) : phase === "error" ? (
                                <div className="text-center py-12 bg-gray-50 rounded-2xl border border-gray-100">
                                    <div className="w-12 h-12 bg-red-100 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">✕</div>
                                    <h3 className="text-lg font-bold text-gray-900">Deployment Failed</h3>
                                    <p className="text-gray-500 text-sm mt-2 mb-6">{errorMsg}</p>
                                    <button onClick={() => setPhase("idle")} className="text-sm font-bold bg-black text-white px-6 py-2.5 rounded-full hover:bg-gray-800 transition-colors">Try Again</button>
                                </div>
                            ) : null}
                        </div>
                    </div>
                </div>

                {/* Right Column: Statistics / Credit Line */}
                <div className="md:col-span-2 space-y-6">
                    {/* Minimalist Score Widget */}
                    <div className="bg-white dark:bg-[#111] rounded-[2rem] border border-gray-100 dark:border-white/10 p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-none transition-all duration-300 hover:shadow-[0_8px_40px_rgb(0,0,0,0.08)] flex flex-col justify-between h-full min-h-[220px]">
                        <div>
                            <div className="flex justify-between items-start">
                                <div>
                                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">On-Chain Reputation</h3>
                                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Credit Score</h2>
                                </div>
                                <div className="text-[10px] text-gray-400 font-bold px-2 py-1 bg-gray-50 dark:bg-white/5 rounded-md">
                                    1 USD REPAID = +1 PT
                                </div>
                            </div>
                        </div>

                        <div className="my-6">
                            <div className={`text-6xl font-black tracking-tighter ${scoreColor}`}>
                                {score ?? "—"}
                            </div>
                        </div>

                        <div>
                            <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden mb-2">
                                {score && (
                                    <div className="h-full bg-black rounded-full transition-all duration-1000 ease-out"
                                        style={{ width: `${((score - 300) / 550) * 100}%` }} />
                                )}
                            </div>
                            <div className="flex justify-between text-[10px] font-bold text-gray-400 uppercase">
                                <span>Risk Area</span>
                                <span>Excellent</span>
                            </div>
                        </div>
                    </div>

                    {/* Active Credit Line Widget */}
                    {phase === "active" && creditLine && (
                        <div className="bg-black text-white rounded-[2rem] p-8 shadow-xl shadow-black/10 animate-in slide-in-from-right-8 duration-500">
                            <div className="flex justify-between items-start mb-8">
                                <div>
                                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Active Vault</h3>
                                    <h2 className="text-lg font-semibold text-white">Credit Power</h2>
                                </div>
                                <div className="w-8 h-8 bg-[#FF6B00] rounded-full flex items-center justify-center">
                                    <CreditcoinLogo />
                                </div>
                            </div>

                            <p className="text-4xl font-black mb-2">${parseInt(creditLine.creditPowerUSD).toLocaleString()}</p>
                            <p className="text-sm text-gray-400 mb-8 border-b border-gray-800 pb-8">{(parseInt(creditLine.collateralSats) / 1e8).toFixed(4)} sBTC Locked</p>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Borrowed</p>
                                    <p className="text-xl font-bold mt-1 text-red-400">${loanState?.amountBorrowedUSD || "0"}</p>
                                </div>
                                <div>
                                    <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Repaid</p>
                                    <p className="text-xl font-bold text-[#FF6B00] mt-1">${(parseInt(creditLine.totalRepaidCents) / 100).toLocaleString()}</p>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Minimal Background Decor */}
            <div className="fixed top-0 left-0 w-full h-full overflow-hidden -z-10 pointer-events-none">
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-orange-500/5 blur-[120px] rounded-full"></div>
                <div className="absolute bottom-[-10%] right-[-10%] w-[30%] h-[30%] bg-blue-500/5 blur-[100px] rounded-full"></div>
            </div>
        </main >
    );
}
