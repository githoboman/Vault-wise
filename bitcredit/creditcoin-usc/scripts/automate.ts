import { ethers } from "hardhat";

async function main() {
    const BOTCHAIN_RPC = "https://rpc.botchain.ai";
    const provider = new ethers.JsonRpcProvider(BOTCHAIN_RPC);
    const DEPLOYER_PK = "0xc032447567a05259f291ddb20a75ffa0b5ff4d2bdf469c3e7aefb45541f885a8";
    const deployer = new ethers.Wallet(DEPLOYER_PK, provider);

    const MOCK_BTC_ADDRESS = "0xfF4c8f1109456c6791C5deDFf066dF5a7c6415d0";
    const POOL_ADDRESS = "0xDfA7e0E2b26E1752bCb4fa15f0Ad616933ccD3ef";

    const MOCK_BTC_ABI = [
        "function testnetDrip(address to) external",
        "function approve(address spender, uint256 amount) external returns (bool)",
        "function balanceOf(address account) external view returns (uint256)"
    ];
    
    const PROTOCOL_ABI = [
        "function depositCollateral(uint256 amountSats) external",
        "function borrow(uint256 amountUSD) external"
    ];

    console.log("Starting Automation...");
    console.log("Deployer Address:", deployer.address);
    const balance = await provider.getBalance(deployer.address);
    console.log("Deployer BOT Balance:", ethers.formatEther(balance));

    if (balance < ethers.parseEther("0.02")) {
        console.error("Not enough BOT in deployer wallet to fund the 3 test wallets.");
        return;
    }

    // Create 3 random wallets
    const wallets = [];
    for (let i = 0; i < 3; i++) {
        const w = ethers.Wallet.createRandom().connect(provider);
        wallets.push(w);
        console.log(`Created Wallet ${i + 1}: ${w.address}`);
        
        // Fund wallet with 0.005 BOT for gas
        console.log(`Funding Wallet ${i + 1} with BOT...`);
        const tx = await deployer.sendTransaction({
            to: w.address,
            value: ethers.parseEther("0.005")
        });
        await tx.wait();
        console.log(`Funded Wallet ${i + 1} (Tx: ${tx.hash})`);
    }

    // Now make the interactions
    for (let i = 0; i < wallets.length; i++) {
        const w = wallets[i];
        console.log(`\nStarting interactions for Wallet ${i + 1} (${w.address})...`);

        const btc = new ethers.Contract(MOCK_BTC_ADDRESS, MOCK_BTC_ABI, w);
        const protocol = new ethers.Contract(POOL_ADDRESS, PROTOCOL_ABI, w);

        // 1. Drip BTC
        console.log(`[Wallet ${i + 1}] Dripping MockBTC...`);
        const tx1 = await btc.testnetDrip(w.address);
        await tx1.wait();
        console.log(`[Wallet ${i + 1}] MockBTC Dripped (Tx: ${tx1.hash})`);

        const btcBal = await btc.balanceOf(w.address);
        console.log(`[Wallet ${i + 1}] BTC Balance:`, ethers.formatUnits(btcBal, 8));

        // 2. Approve Protocol
        console.log(`[Wallet ${i + 1}] Approving Protocol...`);
        const tx2 = await btc.approve(POOL_ADDRESS, ethers.MaxUint256);
        await tx2.wait();
        console.log(`[Wallet ${i + 1}] Protocol Approved (Tx: ${tx2.hash})`);

        // 3. Deposit Collateral
        console.log(`[Wallet ${i + 1}] Depositing Collateral...`);
        const tx3 = await protocol.depositCollateral(btcBal);
        await tx3.wait();
        console.log(`[Wallet ${i + 1}] Collateral Deposited (Tx: ${tx3.hash})`);

        // 4. Borrow USDT
        // With 1_000_000 sats (0.01 BTC at $60k = $600 collateral)
        // Max LTV is 70% ($420). Let's borrow $100.
        console.log(`[Wallet ${i + 1}] Borrowing USDT...`);
        const tx4 = await protocol.borrow(100n);
        await tx4.wait();
        console.log(`[Wallet ${i + 1}] Borrowed $100 USDT (Tx: ${tx4.hash})`);
    }

    console.log("\nAutomation Complete! Required on-chain activity generated.");
}

main().catch(console.error);
