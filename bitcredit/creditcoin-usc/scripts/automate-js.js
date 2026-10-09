const { ethers } = require("ethers");

async function main() {
    console.log("Starting automation script...");
    
    // Explicitly set network details to avoid relying on auto-detection which can be slow
    const BOTCHAIN_RPC = "https://rpc.botchain.ai";
    const provider = new ethers.JsonRpcProvider(BOTCHAIN_RPC, 677, {
        staticNetwork: true
    });
    
    console.log("Provider initialized. Connecting deployer wallet...");
    const DEPLOYER_PK = "0xc032447567a05259f291ddb20a75ffa0b5ff4d2bdf469c3e7aefb45541f885a8";
    const deployer = new ethers.Wallet(DEPLOYER_PK, provider);
    console.log("Deployer Address:", deployer.address);

    const MOCK_BTC_ADDRESS = "0xfF4c8f1109456c6791C5deDFf066dF5a7c6415d0";
    const POOL_ADDRESS = "0xDfA7e0E2b26E1752bCb4fa15f0Ad616933ccD3ef";

    const MOCK_BTC_ABI = [
        "function testnetDrip(address to) external",
        "function approve(address spender, uint256 amount) external returns (bool)",
        "function balanceOf(address account) external view returns (uint256)",
        "function mint(address to, uint256 amount) external"
    ];
    
    const PROTOCOL_ABI = [
        "function depositCollateral(uint256 amountSats) external",
        "function borrow(uint256 amountUSD) external"
    ];

    try {
        console.log("Fetching balance...");
        const balance = await provider.getBalance(deployer.address);
        console.log("Deployer BOT Balance:", ethers.formatEther(balance));

        if (balance < ethers.parseEther("0.02")) {
            console.error("Not enough BOT in deployer wallet to fund the 3 test wallets.");
            return;
        }

        const btcDeployer = new ethers.Contract(MOCK_BTC_ADDRESS, MOCK_BTC_ABI, deployer);

        for (let i = 0; i < 3; i++) {
            const w = ethers.Wallet.createRandom().connect(provider);
            console.log(`\nCreated Wallet ${i + 1}: ${w.address}`);
            
            console.log(`[Wallet ${i + 1}] Funding with 0.005 BOT...`);
            const tx = await deployer.sendTransaction({
                to: w.address,
                value: ethers.parseEther("0.005")
            });
            await tx.wait();
            console.log(`[Wallet ${i + 1}] Funded BOT (Tx: ${tx.hash})`);

            const protocol = new ethers.Contract(POOL_ADDRESS, PROTOCOL_ABI, w);
            const btcUser = new ethers.Contract(MOCK_BTC_ADDRESS, MOCK_BTC_ABI, w);

            console.log(`[Wallet ${i + 1}] Minting MockBTC...`);
            try {
                const tx1 = await btcDeployer.mint(w.address, 1000000); // 0.01 BTC
                await tx1.wait();
                console.log(`[Wallet ${i + 1}] MockBTC Minted (Tx: ${tx1.hash})`);
            } catch(e) {
                console.log("Mint failed, trying drip...");
                const tx1b = await btcUser.testnetDrip(w.address);
                await tx1b.wait();
                console.log(`[Wallet ${i + 1}] MockBTC Dripped (Tx: ${tx1b.hash})`);
            }

            console.log(`[Wallet ${i + 1}] Approving Protocol...`);
            const tx2 = await btcUser.approve(POOL_ADDRESS, ethers.MaxUint256);
            await tx2.wait();
            console.log(`[Wallet ${i + 1}] Protocol Approved (Tx: ${tx2.hash})`);

            console.log(`[Wallet ${i + 1}] Depositing Collateral...`);
            const btcBal = await btcUser.balanceOf(w.address);
            const tx3 = await protocol.depositCollateral(btcBal);
            await tx3.wait();
            console.log(`[Wallet ${i + 1}] Collateral Deposited (Tx: ${tx3.hash})`);

            console.log(`[Wallet ${i + 1}] Borrowing USDT...`);
            const tx4 = await protocol.borrow(100n);
            await tx4.wait();
            console.log(`[Wallet ${i + 1}] Borrowed $100 USDT (Tx: ${tx4.hash})`);
        }

        console.log("\nAutomation Complete! Required on-chain activity generated.");
    } catch(e) {
        console.error("Error occurred:", e);
    }
}

main().catch(console.error);
