import { ethers } from "hardhat";
import * as dotenv from "dotenv";
dotenv.config();

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("Deployer:", deployer.address);

    const uscAddress = process.env.USC_ADDRESS;
    if (!uscAddress) throw new Error("USC_ADDRESS missing in .env");

    // 1. Deploy MockUSDC
    const MockUSDC = await ethers.getContractFactory("MockUSDC");
    const mUSDC = await MockUSDC.deploy();
    await mUSDC.waitForDeployment();
    const musdcAddress = await mUSDC.getAddress();
    console.log("MockUSDC deployed to:", musdcAddress);

    // 2. Deploy BitCreditPool
    const BitCreditPool = await ethers.getContractFactory("BitCreditPool");
    const pool = await BitCreditPool.deploy(musdcAddress, uscAddress);
    await pool.waitForDeployment();
    const poolAddress = await pool.getAddress();
    console.log("BitCreditPool deployed to:", poolAddress);

    // 3. Fund the treasury and let deployer mint some for tests
    const FundAmount = ethers.parseUnits("1000000", 18); // 1 million mUSDC
    await mUSDC.mint(poolAddress, FundAmount);
    console.log("Treasury funded with 1M mUSDC");

    // Mint some dummy funds to deployer/relayer so they could test payback UI
    const deployerAmount = ethers.parseUnits("10000", 18);
    await mUSDC.mint(deployer.address, deployerAmount);

    // 4. Add the Pool as an Attestor in the parent BitCreditUSC contract
    const bitCreditUSC = await ethers.getContractAt("BitCreditUSC", uscAddress);
    const tx = await bitCreditUSC.addAttestor(poolAddress);
    await tx.wait();
    console.log(`Added Pool ${poolAddress} as Attestor on BitCreditUSC ${uscAddress}`);

    console.log("\n--- Frontend Env Vars ---");
    console.log(`NEXT_PUBLIC_MOCK_USDC_ADDRESS=${musdcAddress}`);
    console.log(`NEXT_PUBLIC_POOL_ADDRESS=${poolAddress}`);
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
