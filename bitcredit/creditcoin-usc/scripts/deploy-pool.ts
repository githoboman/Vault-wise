import { ethers } from "hardhat";
import * as dotenv from "dotenv";
dotenv.config();

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("Deployer:", deployer.address);

    const uscAddress = process.env.USC_ADDRESS;
    const usdcAddress = process.env.MOCK_USDC_ADDRESS;
    if (!uscAddress || !usdcAddress) throw new Error("USC_ADDRESS and MOCK_USDC_ADDRESS must be set in .env");

    // 1. Deploy BitCreditPool
    const BitCreditPool = await ethers.getContractFactory("BitCreditPool");
    const pool = await BitCreditPool.deploy(usdcAddress, uscAddress);
    await pool.waitForDeployment();
    const poolAddress = await pool.getAddress();
    console.log("BitCreditPool deployed to:", poolAddress);

    // 2. Fund the treasury
    const FundAmount = ethers.parseUnits("1000000", 18); // 1 million mUSDC
    const mUSDC = await ethers.getContractAt("MockUSDC", usdcAddress);
    await mUSDC.mint(poolAddress, FundAmount);
    console.log("Treasury funded with 1M mUSDC");

    // Mint some dummy funds to deployer
    const deployerAmount = ethers.parseUnits("10000", 18);
    await mUSDC.mint(deployer.address, deployerAmount);

    // 3. Add the Pool as an Attestor in the parent BitCreditUSC contract
    const bitCreditUSC = await ethers.getContractAt("BitCreditUSC", uscAddress);
    const tx = await bitCreditUSC.addAttestor(poolAddress);
    await tx.wait();
    console.log(`Added Pool ${poolAddress} as Attestor on BitCreditUSC ${uscAddress}`);

    console.log("\n--- Frontend Env Vars ---");
    console.log(`NEXT_PUBLIC_POOL_ADDRESS=${poolAddress}`);
    console.log(`NEXT_PUBLIC_MOCK_USDC_ADDRESS=${usdcAddress}`);
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
