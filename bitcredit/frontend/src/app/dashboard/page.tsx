"use client";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { ethers } from "ethers";
import { useWallet } from "@/context/WalletContext";
import { ThemeToggle } from "@/components/ThemeToggle";

const POOL_ADDR = process.env.NEXT_PUBLIC_POOL_ADDRESS || "";
const BTC_ADDR = process.env.NEXT_PUBLIC_BTC_ADDRESS || process.env.NEXT_PUBLIC_MOCK_BTC_ADDRESS || "";
const USDC_ADDR = process.env.NEXT_PUBLIC_USDC_ADDRESS || process.env.NEXT_PUBLIC_MOCK_USDC_ADDRESS || "";

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
    const [usdcBalance, setUsdcBalance] = useState("0");
    
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
            const usdc = new ethers.Contract(USDC_ADDR, ERC20_ABI, provider);
            const protocol = new ethers.Contract(POOL_ADDR, PROTOCOL_ABI, provider);

            const bBal = await btc.balanceOf(evmAddress);
            setBtcBalance(parseFloat(ethers.formatUnits(bBal, 8)).toFixed(4));
            
            const uBal = await usdc.balanceOf(evmAddress);
            setUsdcBalance(parseFloat(ethers.formatUnits(uBal, 18)).toFixed(2));

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

    // Drip function removed for mainnet

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
            const usdc = new ethers.Contract(USDC_ADDR, ERC20_ABI, signer);
            
            const amt18 = ethers.parseUnits(repayAmount, 18);
            const allowance = await usdc.allowance(evmAddress, POOL_ADDR);
            if (allowance < amt18) {
                const txApprove = await usdc.approve(POOL_ADDR, ethers.MaxUint256);
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
        <div className="min-h-screen bg-[#FAFAFA] dark:bg-[#0A0A0A] text-black dark:text-white font-sans selection:bg-orange-500/30 selection:text-orange-900 dark:selection:text-orange-100 transition-colors duration-300">
            {/* Navbar */}
            <nav className="fixed top-0 w-full z-50 bg-white/80 dark:bg-[#0A0A0A]/80 backdrop-blur-2xl border-b border-gray-200 dark:border-white/5 transition-colors duration-300">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between items-center h-20">
                        <div className="flex items-center gap-3 group cursor-pointer">
                            <div className="w-10 h-10 bg-orange-500 rounded-xl flex items-center justify-center transform group-hover:rotate-12 transition-all duration-300 shadow-lg shadow-orange-500/20">
                                <span className="text-white font-black text-xl">B</span>
                            </div>
                            <Link href="/">
                                <span className="text-xl font-black tracking-tight dark:text-white">BitCredit</span>
                            </Link>
                        </div>
                        <div className="flex items-center gap-4">
                            <ThemeToggle />
                            <button onClick={isFullyConnected ? disconnect : connectEVM}
                                className={`flex items-center gap-2 text-xs md:text-sm px-3 md:px-5 py-2.5 rounded-full transition-all duration-300 ${isFullyConnected ? "bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10" : "bg-black dark:bg-white text-white dark:text-black"}`}>
                                <BotChainLogo />
                                <span>{isFullyConnected ? `${evmAddress?.slice(0,6)}...${evmAddress?.slice(-4)}` : "Connect Wallet"}</span>
                            </button>
                        </div>
                    </div>
                </div>
            </nav>

            <main className="pt-32 pb-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
                <div className="mb-12">
                    <h1 className="text-3xl md:text-4xl font-extrabold">BOT Chain Lending</h1>
                    <p className="text-gray-500 mt-2">Deposit Wrapped BTC to instantly open a credit line and borrow USDC.</p>
                </div>

                {errorMsg && (
                    <div className="mb-8 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/50 rounded-xl text-red-600 dark:text-red-400">
                        {errorMsg}
                    </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Left Column: Wallet Balances & Deposit */}
                    <div className="space-y-6">
                        <div className="bg-white dark:bg-[#111] p-6 rounded-3xl border border-gray-200 dark:border-white/5 shadow-sm">
                            <h2 className="text-xl font-bold mb-4">Wallet Balances</h2>
                            <div className="flex justify-between items-center mb-2">
                                <span className="text-gray-500">BTC</span>
                                <span className="font-mono">{btcBalance} BTC</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-gray-500">USDC</span>
                                <span className="font-mono">{usdcBalance} USDC</span>
                            </div>
                        </div>

                        <div className="bg-white dark:bg-[#111] p-6 rounded-3xl border border-gray-200 dark:border-white/5 shadow-sm">
                            <h2 className="text-xl font-bold mb-4">Deposit Collateral</h2>
                            <input type="number" value={depositAmount} onChange={e => setDepositAmount(e.target.value)} placeholder="Amount in BTC" className="w-full bg-gray-50 dark:bg-black border border-gray-200 dark:border-white/10 rounded-xl px-4 py-3 mb-4 outline-none focus:border-orange-500 transition-colors" />
                            <button onClick={handleDeposit} disabled={txLoading || !depositAmount} className="w-full py-3 bg-orange-500 hover:bg-orange-600 text-white rounded-xl font-bold transition-colors disabled:opacity-50">
                                {txLoading ? "Depositing..." : "Deposit & Open Credit Line"}
                            </button>
                        </div>
                    </div>

                    {/* Right Column: Credit Line Management */}
                    <div className="lg:col-span-2 space-y-6">
                        {hasCollateral ? (
                            <div className="bg-white dark:bg-[#111] p-8 rounded-3xl border border-gray-200 dark:border-white/5 shadow-sm relative overflow-hidden">
                                <div className="absolute top-0 right-0 p-8 opacity-5"><BotChainLogo /></div>
                                <h2 className="text-2xl font-black mb-6">Active Credit Line</h2>
                                
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-8">
                                    <div>
                                        <p className="text-xs text-gray-500 font-bold uppercase tracking-wider mb-1">Collateral</p>
                                        <p className="text-2xl font-black font-mono">{collateralBTC} BTC</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-gray-500 font-bold uppercase tracking-wider mb-1">Available Credit</p>
                                        <p className="text-2xl font-black text-green-500 font-mono">${availableCreditUSD.toString()}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-gray-500 font-bold uppercase tracking-wider mb-1">Borrowed</p>
                                        <p className="text-2xl font-black text-orange-500 font-mono">${amountBorrowedUSD.toString()}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-gray-500 font-bold uppercase tracking-wider mb-1">Credit Score</p>
                                        <p className="text-2xl font-black text-[#5546FF] font-mono">{creditScore}</p>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="p-6 bg-gray-50 dark:bg-white/5 rounded-2xl">
                                        <div className="flex justify-between items-center mb-4">
                                            <h3 className="font-bold">Borrow USDC</h3>
                                            <span className="text-[10px] text-gray-500 uppercase tracking-widest bg-gray-200 dark:bg-white/10 px-2 py-1 rounded-md">1% Origination Fee</span>
                                        </div>
                                        <input type="number" value={borrowAmount} onChange={e => setBorrowAmount(e.target.value)} placeholder="Amount to borrow" className="w-full bg-white dark:bg-black border border-gray-200 dark:border-white/10 rounded-xl px-4 py-3 mb-4 outline-none focus:border-green-500 transition-colors" />
                                        <button onClick={handleBorrow} disabled={txLoading || !borrowAmount} className="w-full py-3 bg-green-500 hover:bg-green-600 text-white rounded-xl font-bold transition-colors disabled:opacity-50">
                                            Borrow
                                        </button>
                                    </div>
                                    <div className="p-6 bg-gray-50 dark:bg-white/5 rounded-2xl">
                                        <h3 className="font-bold mb-4">Repay USDC</h3>
                                        <input type="number" value={repayAmount} onChange={e => setRepayAmount(e.target.value)} placeholder="Amount to repay" className="w-full bg-white dark:bg-black border border-gray-200 dark:border-white/10 rounded-xl px-4 py-3 mb-4 outline-none focus:border-orange-500 transition-colors" />
                                        <button onClick={handleRepay} disabled={txLoading || !repayAmount} className="w-full py-3 bg-black dark:bg-white text-white dark:text-black hover:bg-gray-800 dark:hover:bg-gray-200 rounded-xl font-bold transition-colors disabled:opacity-50">
                                            Repay
                                        </button>
                                    </div>
                                </div>

                                <div className="mt-8 pt-8 border-t border-gray-200 dark:border-white/10">
                                    <button onClick={handleWithdraw} disabled={txLoading || amountBorrowedUSD > 0n} className="px-6 py-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 font-bold rounded-xl hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                                        Close Line & Withdraw Collateral
                                    </button>
                                    {amountBorrowedUSD > 0n && <p className="text-xs text-red-500 mt-2">You must repay all debt before withdrawing collateral.</p>}
                                </div>
                            </div>
                        ) : (
                            <div className="bg-white dark:bg-[#111] p-8 rounded-3xl border border-gray-200 dark:border-white/5 shadow-sm text-center py-24">
                                <div className="w-20 h-20 bg-gray-50 dark:bg-white/5 rounded-full flex items-center justify-center mx-auto mb-6">
                                    <span className="text-gray-400"><BotChainLogo /></span>
                                </div>
                                <h2 className="text-2xl font-black mb-2">No Active Credit Line</h2>
                                <p className="text-gray-500 max-w-sm mx-auto">Deposit MockBTC collateral on the left to instantly open your BOT Chain credit line.</p>
                            </div>
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
}
