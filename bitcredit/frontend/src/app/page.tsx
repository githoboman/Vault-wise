import Link from "next/link";
import { ArrowRight, Lock, Repeat, TrendingUp, ShieldCheck, Zap, Activity } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";

export default function LandingPage() {
    return (
        <main className="min-h-screen bg-[#050505] text-white font-sans overflow-x-hidden selection:bg-orange-500/30">
            {/* Background Orbs */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none">
                <div className="absolute -top-[20%] -left-[10%] w-[50%] h-[50%] rounded-full bg-orange-600/20 blur-[120px]" />
                <div className="absolute top-[20%] -right-[10%] w-[40%] h-[40%] rounded-full bg-blue-600/10 blur-[120px]" />
                <div className="absolute -bottom-[20%] left-[20%] w-[60%] h-[60%] rounded-full bg-purple-600/10 blur-[150px]" />
            </div>

            {/* Premium Navigation */}
            <nav className="border-b border-white/5 px-6 py-5 flex items-center justify-between sticky top-0 bg-[#050505]/70 backdrop-blur-2xl z-50">
                <div className="flex items-center gap-2 group cursor-pointer">
                    <div className="flex items-center justify-center w-8 h-8 bg-gradient-to-br from-orange-400 to-orange-600 rounded-lg shadow-[0_0_15px_rgba(249,115,22,0.4)] group-hover:shadow-[0_0_25px_rgba(249,115,22,0.6)] transition-all">
                        <span className="font-bold text-lg text-white leading-none">B</span>
                    </div>
                    <span className="text-xl font-bold tracking-tight text-white group-hover:text-orange-100 transition-colors">BitCredit</span>
                </div>
                <div className="flex items-center gap-4">
                    <ThemeToggle />
                    <Link href="/dashboard" className="relative group overflow-hidden flex items-center gap-2 text-sm font-bold bg-white text-black px-6 py-2.5 rounded-full hover:bg-gray-100 transition-all shadow-[0_0_20px_rgba(255,255,255,0.1)] hover:shadow-[0_0_30px_rgba(255,255,255,0.2)] hover:scale-105 duration-300">
                        <span className="relative z-10">Launch App</span>
                        <ArrowRight className="w-4 h-4 relative z-10 group-hover:translate-x-1 transition-transform" />
                    </Link>
                </div>
            </nav>

            {/* Hero Section */}
            <section className="relative max-w-7xl mx-auto px-6 pt-32 pb-24 md:pt-48 md:pb-32 text-center z-10">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 mb-8 backdrop-blur-md">
                    <span className="flex h-2 w-2 relative">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-orange-500"></span>
                    </span>
                    <span className="text-xs font-semibold tracking-wider text-gray-300 uppercase">Live on BOT Chain Mainnet</span>
                </div>

                <h1 className="text-5xl md:text-7xl lg:text-[5.5rem] font-black tracking-tighter mb-8 leading-[1.05] drop-shadow-2xl">
                    Borrow USDT. <br className="hidden md:block" />
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 via-orange-500 to-red-500 animate-gradient">
                        Keep Your Bitcoin.
                    </span>
                </h1>

                <p className="text-lg md:text-2xl text-gray-400 max-w-3xl mx-auto mb-12 font-medium leading-relaxed">
                    Unlock immediate liquidity without selling your BTC. BitCredit bridges your Bitcoin into <span className="text-white">bWBTC</span> on the BOT Chain, allowing you to mint USDT instantly while building an on-chain credit reputation.
                </p>

                <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
                    <Link href="/dashboard" className="group relative text-lg font-bold w-full sm:w-auto overflow-hidden rounded-full">
                        <div className="absolute inset-0 bg-gradient-to-r from-orange-500 to-red-600 transition-transform duration-300 group-hover:scale-105"></div>
                        <div className="relative px-8 py-4 flex items-center justify-center gap-2 text-white shadow-[0_0_30px_rgba(249,115,22,0.3)] group-hover:shadow-[0_0_50px_rgba(249,115,22,0.5)] transition-all">
                            Enter Dashboard <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                        </div>
                    </Link>
                    <a href="#how-it-works" className="text-lg font-bold bg-white/5 border border-white/10 text-white w-full sm:w-auto px-8 py-4 rounded-full hover:bg-white/10 transition-colors backdrop-blur-md">
                        Learn How It Works
                    </a>
                </div>
            </section>

            {/* Glassmorphic Stats Banner */}
            <section className="relative z-10 max-w-6xl mx-auto px-6 mb-32">
                <div className="bg-white/5 border border-white/10 backdrop-blur-xl rounded-3xl p-8 md:p-12 shadow-2xl">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-4 divide-x-0 md:divide-x divide-white/10">
                        <div className="text-center">
                            <h4 className="text-4xl md:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-br from-white to-gray-500 mb-2">70%</h4>
                            <p className="text-xs font-bold tracking-widest uppercase text-gray-400">Max LTV Ratio</p>
                        </div>
                        <div className="text-center">
                            <h4 className="text-4xl md:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-br from-white to-gray-500 mb-2">1%</h4>
                            <p className="text-xs font-bold tracking-widest uppercase text-gray-400">Origination Fee</p>
                        </div>
                        <div className="text-center">
                            <h4 className="text-4xl md:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-br from-orange-400 to-red-500 mb-2">~3s</h4>
                            <p className="text-xs font-bold tracking-widest uppercase text-gray-400">Attestation Time</p>
                        </div>
                        <div className="text-center">
                            <h4 className="text-4xl md:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-br from-white to-gray-500 mb-2">300+</h4>
                            <p className="text-xs font-bold tracking-widest uppercase text-gray-400">Credit Score Range</p>
                        </div>
                    </div>
                </div>
            </section>

            {/* How It Works Section */}
            <section id="how-it-works" className="relative z-10 max-w-6xl mx-auto px-6 py-20">
                <div className="text-center mb-20">
                    <h2 className="text-sm font-black text-orange-500 tracking-widest uppercase mb-4">The Bridge Protocol</h2>
                    <h3 className="text-4xl md:text-5xl font-extrabold tracking-tight text-white">Cross-Chain Credit Pipeline</h3>
                </div>

                <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
                    {[
                        { icon: Lock, color: "text-blue-400", bg: "bg-blue-400/10", title: "1. Deposit bWBTC", desc: "Securely lock your BOT Wrapped Bitcoin as collateral in our audited mainnet smart contract." },
                        { icon: Repeat, color: "text-purple-400", bg: "bg-purple-400/10", title: "2. Verify Assets", desc: "The protocol instantly verifies your collateral and calculates your maximum 70% Loan-to-Value borrowing power." },
                        { icon: Zap, color: "text-orange-400", bg: "bg-orange-400/10", title: "3. Mint USDT", desc: "Instantly withdraw real USDT liquid cash against your credit limit to use anywhere in DeFi or the real world." },
                        { icon: Activity, color: "text-green-400", bg: "bg-green-400/10", title: "4. Build Credit", desc: "Repay your loan to seamlessly unlock your bWBTC and permanently boost your on-chain credit score." }
                    ].map((step, idx) => (
                        <div key={idx} className="group bg-white/[0.02] border border-white/5 rounded-3xl p-8 backdrop-blur-md hover:bg-white/[0.04] hover:border-white/20 transition-all duration-500 hover:-translate-y-2">
                            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-6 ${step.bg} ${step.color} group-hover:scale-110 transition-transform duration-500`}>
                                <step.icon className="w-7 h-7" />
                            </div>
                            <h4 className="text-xl font-bold mb-3 text-white">{step.title}</h4>
                            <p className="text-gray-400 leading-relaxed text-sm font-medium">
                                {step.desc}
                            </p>
                        </div>
                    ))}
                </div>
            </section>

            {/* BOT Chain Synergy Section */}
            <section className="relative z-10 py-32 mt-20 border-y border-white/5 bg-gradient-to-b from-transparent to-[#0a0a0a]">
                <div className="max-w-6xl mx-auto px-6 grid md:grid-cols-2 gap-16 items-center">
                    <div>
                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-12 h-12 bg-white/5 border border-white/10 rounded-xl flex items-center justify-center text-orange-500">
                                <TrendingUp className="w-6 h-6" />
                            </div>
                            <h2 className="text-sm font-black text-orange-500 tracking-widest uppercase">Ecosystem Synergy</h2>
                        </div>
                        <h3 className="text-4xl md:text-5xl font-black tracking-tight text-white mb-8 leading-tight">
                            Empowering the <br />
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-red-500">BOT Chain</span> Network
                        </h3>
                        <div className="space-y-6 text-lg text-gray-400 font-medium leading-relaxed">
                            <p>
                                BitCredit introduces the first **bWBTC** (BOT Wrapped Bitcoin) standard to the BOT Chain, acting as a massive liquidity catalyst for the entire ecosystem.
                            </p>
                            <ul className="space-y-4">
                                {[
                                    "On-Chain Reputation: Every loan repayment increases your credit score recorded immutably on the BOT Chain ledger.",
                                    "L1 Utility: BitCredit drives transaction volume and network demand, strengthening the security of the ecosystem.",
                                    "Global Standard: Bridging the world's most valuable collateral into BOT Chain's high-performance AI ecosystem."
                                ].map((item, i) => (
                                    <li key={i} className="flex gap-4 items-start">
                                        <div className="mt-2 w-1.5 h-1.5 bg-orange-500 rounded-full shrink-0 shadow-[0_0_10px_rgba(249,115,22,0.8)]"></div>
                                        <span className="text-gray-300 text-base">{item}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>
                    <div className="relative group perspective-1000">
                        <div className="absolute -inset-1 bg-gradient-to-r from-orange-500 to-purple-600 rounded-[3rem] blur-xl opacity-20 group-hover:opacity-40 transition-opacity duration-1000"></div>
                        <div className="relative bg-[#111]/80 backdrop-blur-2xl border border-white/10 p-10 rounded-[2.5rem] transform group-hover:-translate-y-2 group-hover:scale-[1.02] transition-transform duration-700">
                            <div className="flex items-center justify-between mb-8">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-gradient-to-br from-gray-700 to-black border border-gray-600 rounded-lg flex items-center justify-center text-white font-bold text-xs">BOT</div>
                                    <span className="font-bold text-white">BOT Chain L1</span>
                                </div>
                                <span className="px-3 py-1 bg-green-500/10 border border-green-500/20 text-green-400 text-xs font-bold rounded-full flex items-center gap-2">
                                    <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse"></span>
                                    ACTIVE
                                </span>
                            </div>
                            <div className="space-y-4">
                                <div className="p-5 bg-white/5 rounded-2xl border border-white/5">
                                    <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Standard Implemented</p>
                                    <p className="text-2xl font-black text-white">bWBTC Protocol</p>
                                </div>
                                <div className="p-5 bg-white/5 rounded-2xl border border-white/5">
                                    <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Settlement Asset</p>
                                    <p className="text-2xl font-black text-white">Mainnet USDT</p>
                                </div>
                                <div className="pt-4 flex items-center justify-between">
                                    <span className="text-sm font-bold text-gray-500">Node Sync</span>
                                    <div className="flex gap-1">
                                        {[1, 2, 3, 4, 5].map(i => <div key={i} className={`w-8 h-1.5 rounded-full ${i === 5 ? 'bg-green-500/30' : 'bg-green-500 shadow-[0_0_5px_rgba(34,197,94,0.5)]'}`}></div>)}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Security Assurance */}
            <section className="relative z-10 py-32">
                <div className="max-w-4xl mx-auto px-6 text-center">
                    <div className="w-20 h-20 bg-orange-500/10 border border-orange-500/20 rounded-3xl mx-auto flex items-center justify-center mb-8">
                        <ShieldCheck className="w-10 h-10 text-orange-500" />
                    </div>
                    <h3 className="text-4xl md:text-6xl font-black tracking-tight mb-6">Fully Verifiable On-Chain</h3>
                    <p className="text-gray-400 text-xl font-medium mb-12">
                        No off-chain ledgers. Your collateral is protected by strict smart contract rules, while your credit history lives permanently on BOT Chain.
                    </p>
                    <Link href="/dashboard" className="inline-flex items-center gap-2 text-lg font-bold bg-white text-black px-10 py-4 rounded-full hover:scale-105 hover:shadow-[0_0_30px_rgba(255,255,255,0.3)] transition-all duration-300">
                        Launch Application <ArrowRight className="w-5 h-5" />
                    </Link>
                </div>
            </section>

            {/* Footer */}
            <footer className="relative z-10 border-t border-white/10 py-12 text-center text-gray-500 font-medium">
                <div className="flex items-center justify-center gap-2 mb-4">
                    <div className="w-6 h-6 bg-white/10 text-white rounded-md flex items-center justify-center text-xs font-bold">B</div>
                    <span className="text-white font-bold tracking-wide">BitCredit</span>
                </div>
                <p>&copy; {new Date().getFullYear()} BitCredit Protocol. BOT Chain Mainnet.</p>
            </footer>
        </main>
    );
}
