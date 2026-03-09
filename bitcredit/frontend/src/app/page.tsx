import Link from "next/link";
import { ArrowRight, Lock, Repeat, TrendingUp, ShieldCheck } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";

export default function LandingPage() {
    return (
        <main className="min-h-screen bg-white dark:bg-black text-black dark:text-white font-sans selection:bg-orange-200 dark:selection:bg-orange-900 overflow-x-hidden transition-colors duration-300">
            {/* Minimalist Navigation */}
            <nav className="border-b border-gray-100 dark:border-white/10 px-8 py-5 flex items-center justify-between sticky top-0 bg-white/80 dark:bg-black/60 backdrop-blur-xl z-50">
                <div className="flex items-center gap-2">
                    <div className="flex items-center justify-center w-8 h-8 bg-black dark:bg-white text-white dark:text-black rounded-md shadow-sm">
                        <span className="font-bold text-lg leading-none">B</span>
                    </div>
                    <span className="text-xl font-bold tracking-tight">BitCredit</span>
                    <span className="text-[10px] uppercase tracking-widest bg-orange-100 dark:bg-orange-900/40 text-orange-600 dark:text-orange-400 px-2 py-1 rounded-sm font-semibold ml-2">
                        Protocol
                    </span>
                </div>
                <div className="flex flex-row items-center gap-6">
                    <ThemeToggle />
                    <Link href="/dashboard" className="flex items-center gap-2 text-sm font-bold bg-black dark:bg-white text-white dark:text-black px-6 py-2.5 rounded-full hover:bg-gray-800 dark:hover:bg-gray-200 transition-all shadow-sm hover:shadow-md">
                        Launch App <ArrowRight className="w-4 h-4" />
                    </Link>
                </div>
            </nav>

            {/* Hero Section */}
            <section className="max-w-6xl mx-auto px-6 pt-32 pb-20 text-center relative">
                <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-orange-50/50 dark:from-orange-500/10 via-white dark:via-black to-white dark:to-black transition-colors duration-500"></div>

                <h1 className="text-4xl md:text-6xl lg:text-8xl font-black tracking-tighter mb-8 leading-tight">
                    Borrow USD, <br />
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-500 to-red-500">
                        Keep Your Bitcoin.
                    </span>
                </h1>

                <p className="text-xl md:text-2xl text-gray-500 dark:text-gray-400 max-w-3xl mx-auto mb-12 font-medium leading-relaxed">
                    Unlock immediate liquidity without selling your BTC. BitCredit bridges Stacks Bitcoin collateral into Creditcoin lending markets—allowing you to mint Credit Power securely and build on-chain reputation.
                </p>

                <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                    <Link href="/dashboard" className="text-lg font-bold bg-black dark:bg-white text-white dark:text-black flex items-center justify-center gap-2 w-full sm:w-auto px-8 py-4 rounded-full hover:bg-[#FF6B00] dark:hover:bg-[#FF6B00] dark:hover:text-white transition-colors hover:shadow-lg hover:shadow-orange-500/20 transform active:scale-95 duration-200">
                        Enter Dashboard <ArrowRight className="w-5 h-5" />
                    </Link>
                    <a href="#how-it-works" className="text-lg font-bold bg-white dark:bg-black text-black dark:text-white border border-gray-200 dark:border-white/20 w-full sm:w-auto px-8 py-4 rounded-full hover:border-black dark:hover:border-white transition-colors">
                        Learn How It Works
                    </a>
                </div>
            </section>

            {/* Features/Stats Banner */}
            <section className="border-y border-gray-100 dark:border-white/10 bg-gray-50/50 dark:bg-white/[0.02]">
                <div className="max-w-6xl mx-auto px-6 py-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 divide-y sm:divide-y-0 sm:divide-x divide-gray-200 dark:divide-white/10">
                    <div className="text-center px-4 py-4 sm:py-0">
                        <h4 className="text-4xl font-black text-gray-900 dark:text-white mb-2">70%</h4>
                        <p className="text-sm font-bold tracking-widest uppercase text-gray-500 dark:text-gray-400">Max LTV Ratio</p>
                    </div>
                    <div className="text-center px-4 py-4 sm:py-0">
                        <h4 className="text-4xl font-black text-gray-900 dark:text-white mb-2">2</h4>
                        <p className="text-sm font-bold tracking-widest uppercase text-gray-500 dark:text-gray-400">Chains Bridged</p>
                    </div>
                    <div className="text-center px-4 py-4 sm:py-0">
                        <h4 className="text-4xl font-black text-gray-900 dark:text-white mb-2">~3s</h4>
                        <p className="text-sm font-bold tracking-widest uppercase text-gray-500 dark:text-gray-400">Attestation Time</p>
                    </div>
                    <div className="text-center px-4 py-4 sm:py-0">
                        <h4 className="text-4xl font-black text-gray-900 dark:text-white mb-2">300+</h4>
                        <p className="text-sm font-bold tracking-widest uppercase text-gray-500 dark:text-gray-400">Credit Score Range</p>
                    </div>
                </div>
            </section>

            {/* How It Works Section */}
            <section id="how-it-works" className="max-w-6xl mx-auto px-6 py-32">
                <div className="text-center mb-20">
                    <h2 className="text-sm font-black text-orange-500 tracking-widest uppercase mb-4">The Bridge</h2>
                    <h3 className="text-4xl md:text-5xl font-extrabold tracking-tight text-gray-900 dark:text-white">Cross-Chain Credit Pipeline</h3>
                </div>

                <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-10">

                    {/* Step 1 */}
                    <div className="bg-white dark:bg-[#111] rounded-[2rem] p-8 border border-gray-100 dark:border-white/10 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-none hover:shadow-xl dark:hover:-translate-y-2 hover:-translate-y-2 transition-all duration-300">
                        <div className="w-14 h-14 bg-purple-50 dark:bg-purple-900/20 rounded-2xl flex items-center justify-center mb-6 text-[#5546FF] dark:text-purple-400">
                            <Lock className="w-7 h-7" />
                        </div>
                        <h4 className="text-xl font-bold mb-3 dark:text-white">1. Deposit & Lock</h4>
                        <p className="text-gray-500 dark:text-gray-400 leading-relaxed font-medium">
                            Securely lock your sBTC in a non-custodial Stacks vault. You keep your Bitcoin on-chain, but it's now 'reserved' to back your new line of credit.
                        </p>
                    </div>

                    {/* Step 2 */}
                    <div className="bg-white dark:bg-[#111] rounded-[2rem] p-8 border border-gray-100 dark:border-white/10 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-none hover:shadow-xl dark:hover:-translate-y-2 hover:-translate-y-2 transition-all duration-300 transform md:translate-y-8">
                        <div className="w-14 h-14 bg-gray-50 dark:bg-gray-800/50 rounded-2xl flex items-center justify-center mb-6 text-black dark:text-white">
                            <Repeat className="w-7 h-7" />
                        </div>
                        <h4 className="text-xl font-bold mb-3 dark:text-white">2. Bridge to Creditcoin</h4>
                        <p className="text-gray-500 dark:text-gray-400 leading-relaxed font-medium">
                            Our protocol automatically verifies your deposit on Stacks and 'unlocks' its equivalent value on the Creditcoin network as lending power.
                        </p>
                    </div>

                    {/* Step 3 */}
                    <div className="bg-white dark:bg-[#111] rounded-[2rem] p-8 border border-gray-100 dark:border-white/10 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-none hover:shadow-xl dark:hover:-translate-y-2 hover:-translate-y-2 transition-all duration-300">
                        <div className="w-14 h-14 bg-emerald-50 dark:bg-emerald-900/20 rounded-2xl flex items-center justify-center mb-6 text-[#00E599]">
                            <TrendingUp className="w-7 h-7" />
                        </div>
                        <h4 className="text-xl font-bold mb-3 dark:text-white">3. Borrow & Repay</h4>
                        <p className="text-gray-500 dark:text-gray-400 leading-relaxed font-medium">
                            Withdraw real USDC against your Credit Power limit. Repay with interest to boost your on-chain credit score, unlocking even more liquidity over time.
                        </p>
                    </div>

                    {/* Step 4 */}
                    <div className="bg-white dark:bg-[#111] rounded-[2rem] p-8 border border-gray-100 dark:border-white/10 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-none hover:shadow-xl dark:hover:-translate-y-2 hover:-translate-y-2 transition-all duration-300 transform md:translate-y-8">
                        <div className="w-14 h-14 bg-orange-50 dark:bg-orange-900/20 rounded-2xl flex items-center justify-center mb-6 text-orange-500">
                            <TrendingUp className="w-7 h-7" />
                        </div>
                        <h4 className="text-xl font-bold mb-3 dark:text-white">4. Close & Withdraw</h4>
                        <p className="text-gray-500 dark:text-gray-400 leading-relaxed font-medium">
                            Once your debt is settled, you can close your vault at any time. Our relayer instantly releases your sBTC collateral back to your wallet.
                        </p>
                    </div>

                </div>
            </section>

            {/* Creditcoin Ecosystem Section */}
            <section className="bg-gray-50 dark:bg-[#050505] py-32 border-y border-gray-100 dark:border-white/5 transition-colors duration-300">
                <div className="max-w-6xl mx-auto px-6 grid md:grid-cols-2 gap-16 items-center">
                    <div>
                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-12 h-12 bg-orange-100 dark:bg-orange-900/30 rounded-xl flex items-center justify-center text-orange-600 dark:text-orange-400">
                                <TrendingUp className="w-6 h-6" />
                            </div>
                            <h2 className="text-sm font-black text-orange-500 tracking-widest uppercase">The CTC Synergy</h2>
                        </div>
                        <h3 className="text-4xl md:text-5xl font-extrabold tracking-tight text-gray-900 dark:text-white mb-8">
                            Empowering the <br />
                            <span className="text-orange-500">Creditcoin Ecosystem</span>
                        </h3>
                        <div className="space-y-6 text-lg text-gray-600 dark:text-gray-400 font-medium leading-relaxed">
                            <p>
                                BitCredit isn't just a bridge—it's a massive liquidity catalyst for the **Creditcoin (CTC)** network. By using CTC as our settlement and reputation layer, we bring real-world utility to the L1.
                            </p>
                            <ul className="space-y-4">
                                <li className="flex gap-3">
                                    <div className="mt-1.5 w-1.5 h-1.5 bg-orange-500 rounded-full shrink-0"></div>
                                    <span>**On-Chain Reputation**: Every loan repayment increases your credit score recorded immutably on the Creditcoin ledger.</span>
                                </li>
                                <li className="flex gap-3">
                                    <div className="mt-1.5 w-1.5 h-1.5 bg-orange-500 rounded-full shrink-0"></div>
                                    <span>**L1 Utility**: BitCredit drives transaction volume and network demand for CTC, strengthening the security of the entire credit ecosystem.</span>
                                </li>
                                <li className="flex gap-3">
                                    <div className="mt-1.5 w-1.5 h-1.5 bg-orange-500 rounded-full shrink-0"></div>
                                    <span>**Global Credit Standards**: We help build a global, decentralized credit protocol where Bitcoin collateral meets institutional-grade credit recording.</span>
                                </li>
                            </ul>
                        </div>
                    </div>
                    <div className="relative group">
                        <div className="absolute -inset-4 bg-gradient-to-r from-orange-500 to-red-500 rounded-[3rem] blur-2xl opacity-10 group-hover:opacity-20 transition-opacity duration-500"></div>
                        <div className="relative bg-white dark:bg-[#111] border border-gray-200 dark:border-white/10 p-10 rounded-[2.5rem] shadow-2xl dark:shadow-none transition-all duration-500">
                            <div className="flex items-center justify-between mb-8">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-black dark:bg-white rounded-lg flex items-center justify-center text-white dark:text-black font-bold">CTC</div>
                                    <span className="font-bold text-gray-900 dark:text-white">Creditcoin Network</span>
                                </div>
                                <span className="px-3 py-1 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 text-xs font-bold rounded-full">ACTIVE</span>
                            </div>
                            <div className="space-y-6">
                                <div className="p-4 bg-gray-50 dark:bg-white/5 rounded-2xl border border-gray-100 dark:border-white/5">
                                    <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Total Credited Value</p>
                                    <p className="text-2xl font-black text-gray-900 dark:text-white">$420M+</p>
                                </div>
                                <div className="p-4 bg-gray-50 dark:bg-white/5 rounded-2xl border border-gray-100 dark:border-white/5">
                                    <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Active Collateral (sBTC)</p>
                                    <p className="text-2xl font-black text-gray-900 dark:text-white">12.4K BTC</p>
                                </div>
                                <div className="pt-4 flex items-center justify-between">
                                    <span className="text-sm font-bold text-gray-500">Protocol Health</span>
                                    <div className="flex gap-1">
                                        {[1, 2, 3, 4, 5].map(i => <div key={i} className="w-6 h-1 bg-green-500 rounded-full"></div>)}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Security Assurance Layout */}
            <section className="bg-black dark:bg-[#0a0a0a] text-white py-24 border-t border-white/5">
                <div className="max-w-6xl mx-auto px-6 text-center">
                    <ShieldCheck className="w-16 h-16 mx-auto mb-8 text-orange-500" />
                    <h3 className="text-3xl md:text-5xl font-black tracking-tight mb-6">Fully Verifiable On-Chain</h3>
                    <p className="text-gray-400 text-xl font-medium max-w-2xl mx-auto mb-12">
                        No off-chain ledgers. Your collateral is protected by Bitcoin-level finality, while your credit history lives permanently and immutably on Creditcoin.
                    </p>
                    <Link href="/dashboard" className="inline-flex items-center gap-2 text-lg font-bold bg-white text-black px-10 py-4 rounded-full hover:bg-gray-100 transition-colors">
                        Get Started Now <ArrowRight className="w-5 h-5" />
                    </Link>
                </div>
            </section>

            {/* Footer */}
            <footer className="border-t border-gray-100 dark:border-white/10 py-12 text-center text-gray-400 font-medium">
                <div className="flex items-center justify-center gap-2 mb-4">
                    <div className="w-5 h-5 bg-gray-200 dark:bg-white/10 text-gray-500 dark:text-gray-400 rounded-sm flex items-center justify-center text-xs font-bold">B</div>
                    <span className="text-gray-900 dark:text-white font-bold">BitCredit</span>
                </div>
                <p>&copy; {new Date().getFullYear()} BitCredit Protocol. Testnet Only.</p>
            </footer>
        </main>
    );
}
