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
const STACKS_API = "https://api.testnet.hiro.so";

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
    const { stacksAddress, evmAddress, connectStacks, connectEVM, disconnect, isFullyConnected, isInitializing } = useWallet();
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
    const [isInitialLoading, setIsInitialLoading] = useState(true);

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
        if (isInitializing) return;
        if (!evmAddress || !stacksAddress) {
            if (isInitialLoading) { setPhase("idle"); setIsInitialLoading(false); }
            return;
        }

        try {
            // 1. Check EVM side (includes credit score if registered)
            const res = await fetch(`${RELAYER}/api/credit-line?evmAddress=${evmAddress}`);
            const data = await res.json() as { active: boolean, [key: string]: any };

            // ALWAYS store the credit data (reputation) even if not active
            setCreditLine(data as unknown as CreditLineData);

            if (data.active) {
                setPhase("active");
                if (data.tokenId) await loadPoolData(data.tokenId);
                return;
            }

            // 2. Not active on EVM, check Stacks vault status via Relayer
            let vaultData: any = { locked: false };
            try {
                const vaultRes = await fetch(`${RELAYER}/api/vault-status?stacksAddress=${stacksAddress}`);
                if (vaultRes.ok) {
                    vaultData = await vaultRes.json();
                } else {
                    console.warn("Vault status endpoint failure, skipping phase reset");
                    return;
                }
            } catch (e) {
                console.warn("Vault status fetch failed, skipping phase reset", e);
                return;
            }

            if (vaultData.locked && !vaultData.released) {
                setPhase("attesting");
            } else {
                if (phase !== "locking" && phase !== "attesting" && phase !== "closing") {
                    setPhase("idle");
                }
            }
        } catch (e) {
            console.error("Sync error:", e);
        } finally {
            setIsInitialLoading(false);
        }
    }, [evmAddress, stacksAddress, loadPoolData, phase, isInitialLoading, isInitializing]);

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

    useEffect(() => {
        checkCreditLine();
        const interval = setInterval(checkCreditLine, 10_000);
        return () => clearInterval(interval);
    }, [checkCreditLine]);

    function pollAttestation(id: string) {
        const interval = setInterval(async () => {
            try {
                const res = await fetch(`${RELAYER}/api/attestation-status?txId=${id}`);
                const data = await res.json() as { status: string, [key: string]: any };
                if (data.status === "active") {
                    clearInterval(interval);
                    localStorage.removeItem("bitcredit_txid");
                    await checkCreditLine();
                }
            } catch { }
        }, 10_000);
        setTimeout(() => {
            clearInterval(interval);
            if (phase === "attesting") { setErrorMsg("Attestation timed out."); setPhase("error"); }
        }, 30 * 60_000);
    }

    useEffect(() => {
        const savedTxId = localStorage.getItem("bitcredit_txid");
        if (savedTxId && isFullyConnected) {
            setTxId(savedTxId);
            setPhase("attesting");
            pollAttestation(savedTxId);
        }
    }, [isFullyConnected]);

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
            onFinish: (data) => {
                setTxId(data.txId);
                localStorage.setItem("bitcredit_txid", data.txId);
                setPhase("attesting");
                pollAttestation(data.txId);
            },
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
    const baseScore = creditLine?.creditScore ? parseInt(creditLine.creditScore) : null;
    const repaidCents = creditLine?.totalRepaidCents ? parseInt(creditLine.totalRepaidCents) : 0;
    const score = baseScore !== null ? Math.min(850, 300 + Math.floor(repaidCents / 100)) : null;

    // Minimalist score coloring
    const scoreColor = !score ? "text-gray-300"
        : score < 580 ? "text-orange-500" : score < 670 ? "text-orange-400"
            : score < 740 ? "text-gray-800" : "text-black";

    return (
        <main className="min-h-screen bg-white dark:bg-black text-black dark:text-white font-sans selection:bg-orange-200 dark:selection:bg-orange-900 transition-colors duration-300">
            {/* Minimalist Header */}
            <header className="border-b border-gray-100 dark:border-white/10 px-4 md:px-8 py-5 flex items-center justify-between sticky top-0 bg-white/80 dark:bg-black/60 backdrop-blur-xl z-50 transition-all">
                <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
                    <div className="flex items-center justify-center w-8 h-8 bg-black dark:bg-white text-white dark:text-black rounded-md shadow-sm">
                        <span className="font-bold text-lg leading-none">B</span>
                    </div>
                    <span className="text-xl font-bold tracking-tight hidden sm:inline">BitCredit</span>
                </Link>
                <div className="flex flex-row items-center gap-3 md:gap-6">
                    <ThemeToggle />
                    {isFullyConnected && (
                        <button onClick={disconnect}
                            className="text-[10px] md:text-xs font-bold text-red-500 hover:text-red-600 bg-red-50 dark:bg-red-900/20 px-2 md:px-3 py-1.5 rounded-full transition-all border border-red-100 dark:border-red-900/30">
                            <span className="hidden md:inline">Disconnect</span>
                            <span className="md:hidden">DC</span>
                        </button>
                    )}
                    <div className="flex items-center gap-2">
                        <button onClick={async () => { await fetchSbtcBalance(); await checkCreditLine(); }}
                            title="Refresh Data"
                            className="p-2 text-gray-400 hover:text-black dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/10 rounded-full transition-all">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                        </button>
                    </div>
                    <div className="flex gap-2 md:gap-4">
                        <button onClick={connectStacks}
                            className={`flex items-center gap-2 text-xs md:text-sm px-3 md:px-5 py-2.5 rounded-full transition-all duration-300 ${stacksAddress ? "bg-gray-50 dark:bg-white/5 text-black dark:text-white border border-gray-200 dark:border-white/10 shadow-sm" : "bg-white dark:bg-[#111] text-black dark:text-white border border-gray-200 dark:border-white/20 hover:border-black dark:hover:border-white/50 shadow-sm hover:shadow-md"}`}>
                            <span className={stacksAddress ? "text-[#5546FF]" : "text-gray-400 dark:text-gray-500"}><StacksLogo /></span>
                            <span className="hidden lg:inline">{stacksAddress ? `${stacksAddress.slice(0, 6)}...${stacksAddress.slice(-4)}` : "Connect Stacks"}</span>
                            {!stacksAddress && <span className="lg:hidden">Connect</span>}
                        </button>
                        <button onClick={connectEVM}
                            className={`flex items-center gap-2 text-xs md:text-sm px-3 md:px-5 py-2.5 rounded-full transition-all duration-300 ${evmAddress ? "bg-gray-50 dark:bg-white/5 text-black dark:text-white border border-gray-200 dark:border-white/10 shadow-sm" : "bg-black dark:bg-white text-white dark:text-black hover:bg-gray-900 dark:hover:bg-gray-200 shadow-sm hover:shadow-md"}`}>
                            <span className={evmAddress ? "text-[#00E599]" : "text-orange-400 dark:text-orange-500"}><CreditcoinLogo /></span>
                            <span className="hidden lg:inline">{evmAddress ? `${evmAddress.slice(0, 6)}...${evmAddress.slice(-4)}` : "Connect EVM"}</span>
                            {!evmAddress && <span className="lg:hidden">Connect</span>}
                        </button>
                    </div>
                </div>
            </header>

            {/* Main Content Dashboard */}
            <div className="max-w-6xl mx-auto px-4 md:px-6 py-8 md:py-12 space-y-8">

                {/* 1. Header Section with Transitions */}
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                    <div className="space-y-4">
                        {phase === "active" ? (
                            <>
                                <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight dark:text-white">Active Credit Line</h1>
                                <p className="text-gray-500 dark:text-gray-400 text-base md:text-lg max-w-xl leading-relaxed">
                                    Manage your liquidity across Stacks and Creditcoin. Your Bitcoin collateral is secure.
                                </p>
                            </>
                        ) : (
                            <>
                                <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight leading-tight">Vault Terminal</h1>
                                <p className="text-gray-500 text-base md:text-lg">Cross-chain liquidity powered by Bitcoin collateral.</p>
                            </>
                        )}
                    </div>

                    {phase === "active" && creditLine && (
                        <div className="flex items-center gap-4 bg-orange-50 dark:bg-orange-900/20 px-4 py-2 rounded-2xl border border-orange-100 dark:border-orange-900/30">
                            <div className="w-10 h-10 bg-orange-500 rounded-full flex items-center justify-center text-white shadow-lg shadow-orange-500/20">
                                <CreditcoinLogo />
                            </div>
                            <div>
                                <p className="text-[10px] font-bold text-orange-600 dark:text-orange-400 uppercase tracking-widest">NFT ID</p>
                                <p className="text-sm font-black text-gray-900 dark:text-white">#{creditLine.tokenId}</p>
                            </div>
                        </div>
                    )}
                </div>

                {/* 2. Financial Summary Bar (Only shown when active) */}
                {phase === "active" && creditLine && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-in slide-in-from-top-4 duration-700">
                        {/* Available Credit */}
                        <div className="bg-white dark:bg-[#111] rounded-3xl border border-gray-100 dark:border-white/10 p-6 shadow-sm flex items-center justify-between group hover:border-black dark:hover:border-white transition-all cursor-default">
                            <div>
                                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Available to Borrow</p>
                                <p className="text-3xl font-black text-black dark:text-white">
                                    ${(parseInt(creditLine.creditPowerUSD) - (loanState ? parseInt(loanState.amountBorrowedUSD) : 0)).toLocaleString()}
                                </p>
                            </div>
                            <div className="w-12 h-12 bg-green-50 dark:bg-green-900/20 text-green-500 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-110">
                                <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
                            </div>
                        </div>

                        {/* Current Debt */}
                        <div className="bg-white dark:bg-[#111] rounded-3xl border border-gray-100 dark:border-white/10 p-6 shadow-sm flex items-center justify-between group hover:border-red-500 transition-all cursor-default">
                            <div>
                                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Total Borrowed</p>
                                <p className="text-3xl font-black text-red-500">
                                    ${loanState?.amountBorrowedUSD || "0"}
                                </p>
                            </div>
                            <div className="w-12 h-12 bg-red-50 dark:bg-red-900/20 text-red-500 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-110">
                                <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15 12H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                            </div>
                        </div>

                        {/* Wallet Balance */}
                        <div className="bg-black dark:bg-[#1a1a1a] rounded-3xl p-6 shadow-xl flex items-center justify-between group cursor-default">
                            <div>
                                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">USDC Balance</p>
                                <p className="text-3xl font-black text-white">
                                    {usdcBalance}
                                </p>
                            </div>
                            <div className="w-12 h-12 bg-white/10 text-white rounded-2xl flex items-center justify-center transition-transform group-hover:scale-110">
                                <span className="font-bold text-xs">$</span>
                            </div>
                        </div>
                    </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-6 gap-8 items-start">

                    {/* Left/Main Column: Actions */}
                    <div className="lg:col-span-4 space-y-8">
                        {isInitializing || (isInitialLoading && isFullyConnected) ? (
                            <div className="bg-white dark:bg-[#111] rounded-[2.5rem] border border-gray-100 dark:border-white/10 p-16 text-center shadow-lg animate-pulse">
                                <div className="w-16 h-16 bg-gray-100 dark:bg-white/5 rounded-full mx-auto mb-6 flex items-center justify-center">
                                    <div className="w-8 h-8 rounded-full border-4 border-black/10 dark:border-white/10 border-t-black dark:border-t-white animate-spin"></div>
                                </div>
                                <h3 className="text-2xl font-bold dark:text-white">Synchronizing System</h3>
                                <p className="text-gray-400 mt-2">{isInitializing ? "Restoring session..." : "Connecting to decentralized credit graph..."}</p>
                            </div>
                        ) : !isFullyConnected ? (
                            <div className="bg-white dark:bg-[#111] rounded-[2.5rem] border border-gray-100 dark:border-white/10 p-16 text-center shadow-lg flex flex-col items-center justify-center gap-8">
                                <div className="w-24 h-24 bg-orange-50 dark:bg-orange-900/10 text-orange-500 rounded-full flex items-center justify-center shadow-inner">
                                    <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 15L12 9M12 9L9 12M12 9L15 12M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z" /></svg>
                                </div>
                                <div className="space-y-3">
                                    <h3 className="text-3xl font-black">Connection Required</h3>
                                    <p className="text-gray-500 dark:text-gray-400 text-lg max-w-sm mx-auto">Link both wallets to view your cross-chain vaults and manage credit lines.</p>
                                </div>
                                <div className="flex gap-4">
                                    <button onClick={connectStacks} className="px-8 py-3 bg-gray-100 dark:bg-white/5 rounded-2xl font-bold hover:bg-gray-200 transition-colors">Connect Stacks</button>
                                    <button onClick={connectEVM} className="px-8 py-3 bg-black text-white dark:bg-white dark:text-black rounded-2xl font-bold hover:opacity-90 transition-opacity">Connect EVM</button>
                                </div>
                            </div>
                        ) : phase === "active" && creditLine ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-in fade-in duration-1000">
                                {/* Borrow Card */}
                                <div className="bg-white dark:bg-[#111] rounded-[2rem] border border-gray-100 dark:border-white/10 p-8 shadow-sm hover:shadow-xl transition-all group">
                                    <div className="flex items-center gap-4 mb-8">
                                        <div className="w-12 h-12 bg-green-500 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-green-500/20">
                                            <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19 14l-7 7m0 0l-7-7m7 7V3" /></svg>
                                        </div>
                                        <div>
                                            <h3 className="text-xl font-bold dark:text-white tracking-tight">Withdraw Funds</h3>
                                            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Borrow Mock USDC</p>
                                        </div>
                                    </div>

                                    <div className="space-y-6">
                                        <div className="relative">
                                            <input type="number" min="1" step="1" value={borrowAmount}
                                                onChange={e => setBorrowAmount(e.target.value)}
                                                placeholder="0.00"
                                                className="w-full bg-gray-50 dark:bg-black/50 border-2 border-transparent focus:border-green-500 rounded-2xl px-6 py-4 text-2xl font-black outline-none transition-all dark:text-white" />
                                            <span className="absolute right-6 top-1/2 -translate-y-1/2 font-black text-gray-300 dark:text-gray-700">USDC</span>
                                        </div>

                                        <button onClick={handleBorrow} disabled={txLoading || !borrowAmount}
                                            className="w-full bg-green-500 hover:bg-green-600 dark:hover:bg-green-400 text-white font-black py-4 rounded-2xl transition-all shadow-lg shadow-green-500/10 active:scale-[0.98] disabled:opacity-20 flex items-center justify-center gap-2">
                                            {txLoading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white animate-spin rounded-full"></div> : "Execute Withdrawal"}
                                        </button>
                                    </div>
                                </div>

                                {/* Repay Card */}
                                <div className="bg-white dark:bg-[#111] rounded-[2rem] border border-gray-100 dark:border-white/10 p-8 shadow-sm hover:shadow-xl transition-all group">
                                    <div className="flex items-center gap-4 mb-8">
                                        <div className="w-12 h-12 bg-black dark:bg-white text-white dark:text-black rounded-2xl flex items-center justify-center shadow-lg dark:shadow-white/5">
                                            <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 10l7-7m0 0l7 7m-7-7v18" /></svg>
                                        </div>
                                        <div>
                                            <h3 className="text-xl font-bold dark:text-white tracking-tight">Repay Debt</h3>
                                            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Settle Credit Line</p>
                                        </div>
                                    </div>

                                    <div className="space-y-6">
                                        <div className="relative">
                                            <input type="number" min="1" step="1" value={repayAmount}
                                                onChange={e => setRepayAmount(e.target.value)}
                                                placeholder="0.00"
                                                className="w-full bg-gray-50 dark:bg-black/50 border-2 border-transparent focus:border-black dark:focus:border-white rounded-2xl px-6 py-4 text-2xl font-black outline-none transition-all dark:text-white" />
                                            <span className="absolute right-6 top-1/2 -translate-y-1/2 font-black text-gray-300 dark:text-gray-700">USDC</span>
                                        </div>

                                        <button onClick={handleRepay} disabled={txLoading || !repayAmount}
                                            className="w-full bg-black dark:bg-white text-white dark:text-black font-black py-4 rounded-2xl transition-all shadow-lg active:scale-[0.98] disabled:opacity-20 flex items-center justify-center gap-2">
                                            {txLoading ? <div className="w-5 h-5 border-2 border-gray-500 border-t-black animate-spin rounded-full"></div> : "Execute Repayment"}
                                        </button>
                                    </div>
                                </div>

                                {/* Closure Action if debt settled */}
                                {loanState?.amountBorrowedUSD === "0" && (
                                    <div className="md:col-span-2 bg-orange-50 dark:bg-orange-950/20 border border-orange-100 dark:border-orange-900/40 rounded-[2rem] p-8 flex flex-col md:flex-row items-center justify-between gap-6 animate-in zoom-in duration-500">
                                        <div className="space-y-2 text-center md:text-left">
                                            <h3 className="text-xl font-black text-orange-600 dark:text-orange-400 tracking-tight">Vault Ready for Closure</h3>
                                            <p className="text-gray-600 dark:text-gray-400 max-w-md">Your debt is fully settled. Closing this vault will instantly release your sBTC collateral back to your Stacks wallet.</p>
                                        </div>
                                        <button onClick={handleCloseVault} disabled={txLoading}
                                            className="whitespace-nowrap bg-orange-500 hover:bg-orange-600 text-white font-black px-8 py-4 rounded-2xl transition-all shadow-lg shadow-orange-500/20 active:scale-[0.95] disabled:opacity-50">
                                            Close & Withdraw sBTC
                                        </button>
                                    </div>
                                )}
                            </div>
                        ) : phase === "idle" ? (
                            <div className="bg-white dark:bg-[#111] rounded-[2.5rem] border border-gray-100 dark:border-white/10 p-12 shadow-sm space-y-10 animate-in fade-in duration-500">
                                <div className="flex items-center justify-between border-b dark:border-white/5 pb-8">
                                    <h3 className="text-2xl font-black dark:text-white">Deposit Collateral</h3>
                                    <button onClick={handleMint} disabled={isMinting}
                                        className="text-xs font-black uppercase tracking-widest text-orange-500 hover:bg-orange-50 dark:hover:bg-orange-900/20 px-4 py-2 rounded-full border border-orange-200 dark:border-orange-800 transition-all disabled:opacity-30">
                                        {isMinting ? "Minting..." : "Get Test sBTC"}
                                    </button>
                                </div>

                                <div className="space-y-6">
                                    <div className="space-y-3">
                                        <div className="flex justify-between px-2">
                                            <label className="text-xs font-black text-gray-400 uppercase tracking-widest">Amount to Lock</label>
                                            {sbtcBalance !== null && (
                                                <span className="text-xs font-bold text-gray-500">Wallet: {(Number(sbtcBalance) / 1e8).toFixed(4)} sBTC</span>
                                            )}
                                        </div>
                                        <div className="relative group">
                                            <input type="number" min="0.0001" step="0.0001" value={amountBTC}
                                                onChange={e => setAmountBTC(e.target.value)}
                                                className="w-full bg-gray-50 dark:bg-black/50 border-2 border-transparent focus:border-orange-500 rounded-2xl px-8 py-6 text-4xl font-black outline-none transition-all dark:text-white" />
                                            <div className="absolute right-8 top-1/2 -translate-y-1/2 flex items-center gap-2 bg-white dark:bg-[#222] px-4 py-2 rounded-xl shadow-sm border dark:border-white/10">
                                                <span className="text-[#5546FF]"><StacksLogo /></span>
                                                <span className="font-black text-sm">sBTC</span>
                                            </div>
                                        </div>
                                    </div>

                                    {estimated && (
                                        <div className="bg-gray-50 dark:bg-white/5 rounded-2xl p-6 flex justify-between items-center">
                                            <span className="text-gray-500 font-bold">Estimated Credit Power (70% LTV)</span>
                                            <span className="text-2xl font-black dark:text-white">${estimated}</span>
                                        </div>
                                    )}

                                    {errorMsg && <p className="text-sm font-black text-red-500 bg-red-50 dark:bg-red-900/20 p-4 rounded-xl flex items-center gap-2">⚠️ {errorMsg}</p>}

                                    <button onClick={handleLock}
                                        disabled={isMinting || (sbtcBalance !== null && sbtcBalance < BigInt(Math.floor(parseFloat(amountBTC || "0") * 1e8)))}
                                        className="w-full bg-black dark:bg-white text-white dark:text-black font-black text-xl py-6 rounded-[2rem] transition-all hover:scale-[1.01] active:scale-[0.99] shadow-xl disabled:opacity-20">
                                        Create Vault & Establish Credit
                                    </button>
                                </div>
                            </div>
                        ) : phase === "attesting" ? (
                            <div className="bg-white dark:bg-[#111] rounded-[2.5rem] border border-gray-100 dark:border-white/10 p-16 text-center shadow-lg space-y-8 animate-in zoom-in duration-500">
                                <div className="flex justify-center gap-3">
                                    <div className="w-4 h-4 bg-orange-500 rounded-full animate-bounce" style={{ animationDelay: "0s" }}></div>
                                    <div className="w-4 h-4 bg-orange-500 rounded-full animate-bounce" style={{ animationDelay: "0.2s" }}></div>
                                    <div className="w-4 h-4 bg-orange-500 rounded-full animate-bounce" style={{ animationDelay: "0.4s" }}></div>
                                </div>
                                <div className="space-y-2">
                                    <h3 className="text-3xl font-black tracking-tight dark:text-white">Validation in Progress</h3>
                                    <p className="text-gray-500 dark:text-gray-400 text-lg">Cross-chain validators are certifying your Bitcoin deposit on Creditcoin.</p>
                                </div>
                                {txId && (
                                    <a href={`https://explorer.hiro.so/txid/${txId}?chain=testnet`} target="_blank" rel="noreferrer"
                                        className="inline-block font-black text-orange-500 hover:underline">
                                        Track Stacks Transaction ↗
                                    </a>
                                )}
                            </div>
                        ) : (
                            /* Other phases simplified */
                            <div className="bg-white dark:bg-[#111] rounded-[2.5rem] p-16 text-center shadow-lg">
                                <div className="w-16 h-16 border-4 border-black/10 border-t-black rounded-full animate-spin mx-auto mb-6"></div>
                                <h3 className="text-xl font-bold uppercase tracking-widest">{phase}...</h3>
                            </div>
                        )}
                    </div>

                    {/* Right Column: Reputation & Stats */}
                    <div className="lg:col-span-2 space-y-8">
                        {/* Status Card */}
                        <div className="bg-white dark:bg-[#111] rounded-[2.5rem] border border-gray-100 dark:border-white/10 p-3 shadow-sm">
                            <div className={`rounded-[1.8rem] p-8 ${phase === 'active' ? 'bg-green-500 text-white' : 'bg-orange-50 dark:bg-white/5 text-gray-900 dark:text-white'}`}>
                                <div className="flex justify-between items-center mb-8">
                                    <h4 className="text-[10px] font-black uppercase tracking-widest opacity-60">System Status</h4>
                                    <div className={`w-2 h-2 rounded-full animate-pulse ${phase === 'active' ? 'bg-white' : 'bg-orange-500'}`}></div>
                                </div>
                                <p className="text-3xl font-black tracking-tight leading-none uppercase">
                                    {phase === "active" ? "Operational" :
                                        phase === "attesting" ? "Synchronizing" :
                                            phase === "idle" ? "Ready" : phase}
                                </p>
                                <p className="text-xs font-bold mt-2 opacity-60">
                                    {phase === "active" ? "Protocol synced via Creditcoin L1" : "Awaiting user collateral deposit"}
                                </p>
                            </div>
                        </div>

                        {/* Credit Score Card */}
                        <div className="bg-white dark:bg-[#111] rounded-[2.5rem] border border-gray-100 dark:border-white/10 p-8 shadow-sm space-y-8">
                            <div className="flex justify-between items-start">
                                <div>
                                    <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-1">On-Chain Reputation</h3>
                                    <p className="text-xl font-black dark:text-white">Credit Score</p>
                                </div>
                                <div className="w-10 h-10 bg-gray-50 dark:bg-white/5 rounded-xl flex items-center justify-center text-gray-400">
                                    <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
                                </div>
                            </div>

                            <div className={`text-7xl font-black tracking-tighter text-center ${scoreColor}`}>
                                {score ?? "—"}
                            </div>

                            <div className="space-y-4">
                                <div className="w-full h-3 bg-gray-100 dark:bg-white/5 rounded-full overflow-hidden">
                                    {score && (
                                        <div className="h-full bg-black dark:bg-white rounded-full transition-all duration-1000 ease-out shadow-[0_0_15px_rgba(0,0,0,0.1)]"
                                            style={{ width: `${((score - 300) / 550) * 100}%` }} />
                                    )}
                                </div>
                                <div className="flex justify-between text-[10px] font-black text-gray-400 uppercase tracking-tighter">
                                    <span>Subprime</span>
                                    <span>Prime</span>
                                    <span>Super Prime</span>
                                </div>
                            </div>
                        </div>

                        {/* Collateral Detail */}
                        {phase === "active" && creditLine && (
                            <div className="space-y-6 animate-in slide-in-from-right-4 duration-500">
                                <div className="bg-white dark:bg-[#111] rounded-[2.5rem] border border-gray-100 dark:border-white/10 p-8 shadow-sm">
                                    <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-6">Security Layer</h3>
                                    <div className="flex items-center gap-4 mb-6">
                                        <div className="w-12 h-12 bg-gray-50 dark:bg-white/5 rounded-2xl flex items-center justify-center text-[#5546FF]">
                                            <StacksLogo />
                                        </div>
                                        <div>
                                            <p className="text-xl font-black dark:text-white leading-none">{(parseInt(creditLine.collateralSats) / 1e8).toFixed(4)} sBTC</p>
                                            <p className="text-xs font-bold text-gray-500 mt-1">Locked in Stacks Ledger</p>
                                        </div>
                                    </div>
                                    <div className="text-[10px] font-bold text-gray-400 bg-gray-50 dark:bg-white/5 p-4 rounded-xl leading-relaxed">
                                        Collateral is non-custodial and cryptographically locked on Bitcoin L2 until debt is settled on Creditcoin.
                                    </div>
                                </div>

                                <div className="bg-black dark:bg-white dark:text-black text-white rounded-[2.5rem] p-8 shadow-xl">
                                    <div className="flex justify-between items-start mb-6">
                                        <div>
                                            <h3 className="text-xs font-black opacity-50 uppercase tracking-widest mb-1 text-inherit">Borrowing Power</h3>
                                            <p className="text-2xl font-black text-inherit">Max Credit Line</p>
                                        </div>
                                        <div className="w-10 h-10 bg-white/10 dark:bg-black/10 rounded-xl flex items-center justify-center">
                                            <CreditcoinLogo />
                                        </div>
                                    </div>
                                    <p className="text-4xl font-black text-inherit">${parseInt(creditLine.creditPowerUSD).toLocaleString()}</p>
                                    <p className="text-[10px] font-bold mt-4 opacity-50 uppercase tracking-widest leading-relaxed">
                                        Based on 70% LTV of Bitcoin at ${BTC_PRICE.toLocaleString()}
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>
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
