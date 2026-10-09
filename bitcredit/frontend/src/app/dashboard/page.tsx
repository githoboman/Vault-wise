"use client";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { ethers } from "ethers";
import { useWallet } from "@/context/WalletContext";
import { ThemeToggle } from "@/components/ThemeToggle";
import { ArrowRight, Lock, Wallet, Activity, TrendingUp, ShieldCheck } from "lucide-react";

const POOL_ADDR = process.env.NEXT_PUBLIC_POOL_ADDRESS || "";
const BTC_ADDR = process.env.NEXT_PUBLIC_BTC_ADDRESS || process.env.NEXT_PUBLIC_MOCK_BTC_ADDRESS || "";
const USDT_ADDR = process.env.NEXT_PUBLIC_USDT_ADDRESS || process.env.NEXT_PUBLIC_MOCK_USDT_ADDRESS || "";

const PROTOCOL_ABI = [
    "function depositCollateral(uint256 amountSats) external",
    "function withdrawCollateral(uint256 amountSats) external",
    "function borrow(uint256 amountUSD) external",
    "function repay(uint256 amountUSD) external",
    "function getUserState(address user) external view returns (tuple(uint256 collateralSats, uint256 amountBorrowedUSD, uint256 amountRepaidCents, uint256 creditScore), uint256 availableCreditUSD)"
];

const ERC20_ABI = [
    "function approve(address spender, uint256 amount) external returns (bool)",
    "function allowance(address owner, address spender) external view returns (uint256)",
    "function balanceOf(address account) external view returns (uint256)"
];

const BotChainLogo = () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z" fill="currentColor" fillOpacity="0.1" />
        <path d="M15.5 8.5C14.5 7.5 13.5 7 12 7C9.23858 7 7 9.23858 7 12C7 14.7614 9.23858 17 12 17C13.5 17 14.5 16.5 15.5 15.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <circle cx="16" cy="12" r="1.5" fill="currentColor" />
    </svg>
);

export default function Dashboard() {
    const { evmAddress, connectEVM, disconnect, isFullyConnected, provider, signer } = useWallet();
    
    const [btcBalance, setBtcBalance] = useState("0");
    const [USDTBalance, setUSDTBalance] = useState("0");
    
    const [collateralSats, setCollateralSats] = useState<bigint>(0n);
    const [amountBorrowedUSD, setAmountBorrowedUSD] = useState<bigint>(0n);
    const [creditScore, setCreditScore] = useState<number>(0);
    const [availableCreditUSD, setAvailableCreditUSD] = useState<bigint>(0n);

    const [depositAmount, setDepositAmount] = useState("");
    const [borrowAmount, setBorrowAmount] = useState("");
    const [repayAmount, setRepayAmount] = useState("");
    
    const [txLoading, setTxLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState("");

    const loadUserData = useCallback(async () => {
        if (!evmAddress || !provider) return;
        try {
            const btc = new ethers.Contract(BTC_ADDR, ERC20_ABI, provider);
            const USDT = new ethers.Contract(USDT_ADDR, ERC20_ABI, provider);
            const protocol = new ethers.Contract(POOL_ADDR, PROTOCOL_ABI, provider);

            const bBal = await btc.balanceOf(evmAddress);
            setBtcBalance(parseFloat(ethers.formatUnits(bBal, 8)).toFixed(4));
            
            const uBal = await USDT.balanceOf(evmAddress);
            setUSDTBalance(parseFloat(ethers.formatUnits(uBal, 18)).toFixed(2));

            const [state, avail] = await protocol.getUserState(evmAddress);
            setCollateralSats(state.collateralSats);
            setAmountBorrowedUSD(state.amountBorrowedUSD);
            setCreditScore(Number(state.creditScore));
            setAvailableCreditUSD(avail);
        } catch (e) {
            console.error(e);
        }
    }, [evmAddress, provider]);

    useEffect(() => {
        loadUserData();
        const interval = setInterval(loadUserData, 10000);
        return () => clearInterval(interval);
    }, [loadUserData]);

    const handleDeposit = async () => {
        if (!signer || !depositAmount) return;
        setTxLoading(true); setErrorMsg("");
        try {
            const amtSats = ethers.parseUnits(depositAmount, 8);
            const btc = new ethers.Contract(BTC_ADDR, ERC20_ABI, signer);
            const protocol = new ethers.Contract(POOL_ADDR, PROTOCOL_ABI, signer);
            
            const allowance = await btc.allowance(evmAddress, POOL_ADDR);
            if (allowance < amtSats) {
                const txApprove = await btc.approve(POOL_ADDR, ethers.MaxUint256);
                await txApprove.wait();
            }
            const tx = await protocol.depositCollateral(amtSats);
            await tx.wait();
            setDepositAmount("");
            await loadUserData();
        } catch (e: any) {
            setErrorMsg(e.message || "Deposit failed");
        }
        setTxLoading(false);
    };

    const handleWithdraw = async () => {
        if (!signer || collateralSats === 0n) return;
        setTxLoading(true); setErrorMsg("");
        try {
            const protocol = new ethers.Contract(POOL_ADDR, PROTOCOL_ABI, signer);
            const tx = await protocol.withdrawCollateral(collateralSats);
            await tx.wait();
            await loadUserData();
        } catch (e: any) {
            setErrorMsg(e.message || "Withdrawal failed");
        }
        setTxLoading(false);
    };

    const handleBorrow = async () => {
        if (!signer || !borrowAmount) return;
        setTxLoading(true); setErrorMsg("");
        try {
            const protocol = new ethers.Contract(POOL_ADDR, PROTOCOL_ABI, signer);
            const tx = await protocol.borrow(BigInt(borrowAmount));
            await tx.wait();
            setBorrowAmount("");
            await loadUserData();
        } catch (e: any) {
            setErrorMsg(e.message || "Borrow failed");
        }
        setTxLoading(false);
    };

    const handleRepay = async () => {
        if (!signer || !repayAmount) return;
        setTxLoading(true); setErrorMsg("");
        try {
            const protocol = new ethers.Contract(POOL_ADDR, PROTOCOL_ABI, signer);
            const USDT = new ethers.Contract(USDT_ADDR, ERC20_ABI, signer);
            
            const amt18 = ethers.parseUnits(repayAmount, 18);
            const allowance = await USDT.allowance(evmAddress, POOL_ADDR);
            if (allowance < amt18) {
                const txApprove = await USDT.approve(POOL_ADDR, ethers.MaxUint256);
                await txApprove.wait();
            }
            const tx = await protocol.repay(BigInt(repayAmount));
            await tx.wait();
            setRepayAmount("");
            await loadUserData();
        } catch (e: any) {
            setErrorMsg(e.message || "Repay failed");
        }
        setTxLoading(false);
    };

    const collateralBTC = ethers.formatUnits(collateralSats, 8);
    const hasCollateral = collateralSats > 0n;

    return (
        <div className="min-h-screen bg-[#050505] text-white font-sans selection:bg-orange-500/30 overflow-x-hidden">
            {/* Background Orbs */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
                <div className="absolute -top-[20%] -right-[10%] w-[50%] h-[50%] rounded-full bg-orange-600/10 blur-[150px]" />
                <div className="absolute bottom-[0%] -left-[10%] w-[40%] h-[40%] rounded-full bg-blue-600/10 blur-[120px]" />
            </div>

            {/* Premium Navigation */}
            <nav className="fixed top-0 w-full z-50 bg-[#050505]/70 backdrop-blur-2xl border-b border-white/5 transition-colors duration-300">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between items-center h-20">
                        <div className="flex items-center gap-3 group cursor-pointer">
                            <div className="flex items-center justify-center w-10 h-10 bg-gradient-to-br from-orange-400 to-orange-600 rounded-xl shadow-[0_0_15px_rgba(249,115,22,0.4)] group-hover:shadow-[0_0_25px_rgba(249,115,22,0.6)] transition-all transform group-hover:rotate-12 duration-300">
                                <span className="font-bold text-xl text-white leading-none">B</span>
                            </div>
                            <Link href="/">
                                <span className="text-xl font-black tracking-tight text-white group-hover:text-orange-100 transition-colors">BitCredit</span>
                            </Link>
                        </div>
                        <div className="flex items-center gap-4">
                            <ThemeToggle />
                            <button onClick={isFullyConnected ? disconnect : connectEVM}
                                className={`flex items-center gap-2 text-xs md:text-sm px-4 py-2.5 rounded-full transition-all duration-300 shadow-[0_0_15px_rgba(255,255,255,0.05)] hover:shadow-[0_0_25px_rgba(255,255,255,0.1)] hover:scale-105 ${isFullyConnected ? "bg-white/5 border border-white/10 text-white" : "bg-white text-black font-bold"}`}>
                                <BotChainLogo />
                                <span>{isFullyConnected ? `${evmAddress?.slice(0,6)}...${evmAddress?.slice(-4)}` : "Connect Wallet"}</span>
                            </button>
                        </div>
                    </div>
                </div>
            </nav>

            <main className="relative z-10 pt-32 pb-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
                <div className="mb-12 flex flex-col md:flex-row md:items-end justify-between gap-4">
                    <div>
                        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 mb-4 backdrop-blur-md">
                            <span className="flex h-2 w-2 relative">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                            </span>
                            <span className="text-xs font-semibold tracking-wider text-gray-300 uppercase">BOT Chain Mainnet</span>
                        </div>
                        <h1 className="text-4xl md:text-5xl font-black tracking-tight drop-shadow-lg">Dashboard</h1>
                        <p className="text-gray-400 mt-2 text-lg">Deposit bWBTC to instantly open a credit line and borrow USDT.</p>
                    </div>
                    {isFullyConnected && (
                        <div className="flex items-center gap-4 bg-white/5 border border-white/10 backdrop-blur-md p-4 rounded-2xl">
                            <div>
                                <p className="text-xs text-gray-500 font-bold uppercase tracking-widest mb-1">bWBTC Balance</p>
                                <p className="font-mono text-lg font-bold text-white">{btcBalance}</p>
                            </div>
                            <div className="w-px h-8 bg-white/10"></div>
                            <div>
                                <p className="text-xs text-gray-500 font-bold uppercase tracking-widest mb-1">USDT Balance</p>
                                <p className="font-mono text-lg font-bold text-white">{USDTBalance}</p>
                            </div>
                        </div>
                    )}
                </div>

                {errorMsg && (
                    <div className="mb-8 p-4 bg-red-500/10 border border-red-500/30 backdrop-blur-md rounded-xl text-red-400 flex items-center gap-3">
                        <ShieldCheck className="w-5 h-5" />
                        <span className="font-medium">{errorMsg}</span>
                    </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left Column: Deposit */}
                    <div className="space-y-6">
                        <div className="bg-white/5 backdrop-blur-xl p-8 rounded-[2rem] border border-white/10 shadow-2xl relative overflow-hidden group">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-orange-500/10 rounded-full blur-3xl -mr-10 -mt-10 group-hover:bg-orange-500/20 transition-colors duration-500"></div>
                            <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
                                <Wallet className="text-orange-400" />
                                Deposit Collateral
                            </h2>
                            <div className="relative mb-6">
                                <input type="number" value={depositAmount} onChange={e => setDepositAmount(e.target.value)} placeholder="0.00" className="w-full bg-[#0a0a0a] border border-white/10 rounded-xl px-4 py-4 outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-all text-xl font-mono" />
                                <span className="absolute right-4 top-4 text-gray-500 font-bold">bWBTC</span>
                            </div>
                            <div className="flex flex-col gap-3">
                                <button onClick={handleDeposit} disabled={txLoading || !depositAmount} className="group relative w-full overflow-hidden rounded-xl disabled:opacity-50 disabled:cursor-not-allowed">
                                    <div className="absolute inset-0 bg-gradient-to-r from-orange-500 to-red-600 transition-transform duration-300 group-hover:scale-105"></div>
                                    <div className="relative px-4 py-4 flex items-center justify-center gap-2 text-white font-bold shadow-[0_0_20px_rgba(249,115,22,0.3)] transition-all">
                                        {txLoading ? "Processing..." : "Deposit & Open Line"} <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                                    </div>
                                </button>
                                <button onClick={async () => {
                                    if(!signer) return;
                                    setTxLoading(true); setErrorMsg("");
                                    try {
                                        const btc = new ethers.Contract(BTC_ADDR, ["function testnetDrip(address) external"], signer);
                                        const tx = await btc.testnetDrip(evmAddress);
                                        await tx.wait();
                                        await loadUserData();
                                    } catch(e:any) {
                                        setErrorMsg(e.message || "Failed to claim BTC");
                                    }
                                    setTxLoading(false);
                                }} disabled={txLoading} className="w-full py-3 bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white rounded-xl font-medium transition-colors text-sm border border-white/5">
                                    Claim Testnet bWBTC Faucet
                                </button>
                            </div>
                        </div>

                        {/* Credit Score Teaser */}
                        {!hasCollateral && (
                            <div className="bg-gradient-to-br from-[#111] to-[#0a0a0a] p-8 rounded-[2rem] border border-white/5 shadow-xl">
                                <div className="w-12 h-12 bg-blue-500/10 rounded-xl flex items-center justify-center mb-4 text-blue-400">
                                    <Activity className="w-6 h-6" />
                                </div>
                                <h3 className="text-lg font-bold text-white mb-2">On-Chain Reputation</h3>
                                <p className="text-gray-400 text-sm leading-relaxed">Deposit collateral and repay your loans to build a permanent credit score on the BOT Chain. Unlock higher LTV limits and lower fees in V2.</p>
                            </div>
                        )}
                    </div>

                    {/* Right Column: Credit Line Management */}
                    <div className="lg:col-span-2 space-y-6">
                        {hasCollateral ? (
                            <div className="bg-white/5 backdrop-blur-xl p-8 md:p-10 rounded-[2.5rem] border border-white/10 shadow-2xl relative overflow-hidden">
                                <div className="absolute top-0 right-0 p-12 opacity-5 text-white pointer-events-none transform scale-150"><BotChainLogo /></div>
                                
                                <div className="flex items-center justify-between mb-10">
                                    <h2 className="text-3xl font-black text-white drop-shadow-md">Active Credit Line</h2>
                                    <div className="flex items-center gap-2 px-4 py-2 bg-green-500/10 border border-green-500/20 rounded-full">
                                        <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></div>
                                        <span className="text-sm font-bold text-green-400">HEALTHY</span>
                                    </div>
                                </div>
                                
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-8 mb-12">
                                    <div className="p-4 bg-black/40 rounded-2xl border border-white/5 backdrop-blur-sm">
                                        <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-2">Locked Collateral</p>
                                        <p className="text-2xl font-black font-mono text-white">{collateralBTC} <span className="text-sm text-gray-500">bWBTC</span></p>
                                    </div>
                                    <div className="p-4 bg-black/40 rounded-2xl border border-white/5 backdrop-blur-sm">
                                        <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-2">Available Credit</p>
                                        <p className="text-2xl font-black text-green-400 font-mono drop-shadow-[0_0_10px_rgba(74,222,128,0.3)]">${availableCreditUSD.toString()}</p>
                                    </div>
                                    <div className="p-4 bg-black/40 rounded-2xl border border-white/5 backdrop-blur-sm">
                                        <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-2">Total Borrowed</p>
                                        <p className="text-2xl font-black text-orange-400 font-mono drop-shadow-[0_0_10px_rgba(251,146,60,0.3)]">${amountBorrowedUSD.toString()}</p>
                                    </div>
                                    <div className="p-4 bg-black/40 rounded-2xl border border-white/5 backdrop-blur-sm relative overflow-hidden group">
                                        <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-purple-500/5 group-hover:from-blue-500/10 group-hover:to-purple-500/10 transition-colors"></div>
                                        <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-2 relative z-10">Credit Score</p>
                                        <p className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400 font-mono relative z-10">{creditScore}</p>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="p-6 md:p-8 bg-gradient-to-b from-white/[0.03] to-transparent rounded-[2rem] border border-white/5 hover:border-white/10 transition-colors">
                                        <div className="flex justify-between items-center mb-6">
                                            <h3 className="text-lg font-bold text-white">Borrow USDT</h3>
                                            <span className="text-[10px] text-orange-400 font-bold uppercase tracking-widest bg-orange-400/10 border border-orange-400/20 px-3 py-1.5 rounded-full">1% Origination Fee</span>
                                        </div>
                                        <div className="relative mb-6">
                                            <input type="number" value={borrowAmount} onChange={e => setBorrowAmount(e.target.value)} placeholder="0.00" className="w-full bg-[#0a0a0a] border border-white/10 rounded-xl px-4 py-4 outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500 transition-all text-xl font-mono text-white" />
                                            <span className="absolute right-4 top-4 text-gray-500 font-bold">USDT</span>
                                        </div>
                                        <button onClick={handleBorrow} disabled={txLoading || !borrowAmount} className="w-full py-4 bg-green-500/10 hover:bg-green-500/20 border border-green-500/30 text-green-400 hover:text-green-300 rounded-xl font-bold transition-all disabled:opacity-50 shadow-[0_0_15px_rgba(74,222,128,0.1)] hover:shadow-[0_0_25px_rgba(74,222,128,0.2)]">
                                            Borrow Funds
                                        </button>
                                    </div>

                                    <div className="p-6 md:p-8 bg-gradient-to-b from-white/[0.03] to-transparent rounded-[2rem] border border-white/5 hover:border-white/10 transition-colors">
                                        <div className="flex justify-between items-center mb-6">
                                            <h3 className="text-lg font-bold text-white">Repay USDT</h3>
                                            <span className="text-[10px] text-blue-400 font-bold uppercase tracking-widest bg-blue-400/10 border border-blue-400/20 px-3 py-1.5 rounded-full">+1 Score / $1</span>
                                        </div>
                                        <div className="relative mb-6">
                                            <input type="number" value={repayAmount} onChange={e => setRepayAmount(e.target.value)} placeholder="0.00" className="w-full bg-[#0a0a0a] border border-white/10 rounded-xl px-4 py-4 outline-none focus:border-white/30 focus:ring-1 focus:ring-white/30 transition-all text-xl font-mono text-white" />
                                            <span className="absolute right-4 top-4 text-gray-500 font-bold">USDT</span>
                                        </div>
                                        <button onClick={handleRepay} disabled={txLoading || !repayAmount} className="w-full py-4 bg-white text-black hover:bg-gray-200 rounded-xl font-bold transition-all disabled:opacity-50 shadow-[0_0_15px_rgba(255,255,255,0.1)] hover:shadow-[0_0_25px_rgba(255,255,255,0.2)]">
                                            Repay Loan
                                        </button>
                                    </div>
                                </div>

                                <div className="mt-10 pt-8 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4">
                                    <p className="text-gray-500 text-sm font-medium">Want to unlock your collateral? Repay all active debt first.</p>
                                    <button onClick={handleWithdraw} disabled={txLoading || amountBorrowedUSD > 0n} className="w-full sm:w-auto px-6 py-3 bg-red-500/10 border border-red-500/20 text-red-400 font-bold rounded-xl hover:bg-red-500/20 hover:text-red-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                                        Close Line & Withdraw
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="bg-white/5 backdrop-blur-xl p-12 rounded-[2.5rem] border border-white/10 shadow-2xl text-center py-32 relative overflow-hidden group">
                                <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/50 z-0"></div>
                                <div className="relative z-10">
                                    <div className="w-24 h-24 bg-white/5 border border-white/10 rounded-full flex items-center justify-center mx-auto mb-8 group-hover:scale-110 transition-transform duration-500 shadow-[0_0_30px_rgba(255,255,255,0.05)]">
                                        <span className="text-gray-400 opacity-50 transform scale-150"><BotChainLogo /></span>
                                    </div>
                                    <h2 className="text-3xl font-black mb-3 text-white">No Active Credit Line</h2>
                                    <p className="text-gray-400 max-w-md mx-auto text-lg leading-relaxed">Deposit BOT Wrapped Bitcoin (bWBTC) collateral on the left to instantly open your decentralized credit line.</p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
}
