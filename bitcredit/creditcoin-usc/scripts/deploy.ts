import { ethers } from "hardhat";
import * as dotenv from "dotenv";
dotenv.config();

async function main() {
    const [deployer] = await ethers.getSigners();
    const balance = await deployer.provider.getBalance(deployer.address);
    console.log("Deployer:", deployer.address);
    console.log("Balance: ", ethers.formatEther(balance), "BOT");

    // Mainnet Token Addresses
    const btcAddress = process.env.BTC_ADDRESS;
    const usdcAddress = process.env.USDC_ADDRESS;

    if (!btcAddress || !usdcAddress) {
        throw new Error("Missing BTC_ADDRESS or USDC_ADDRESS in .env");
    }

    console.log("Using BTC Address:", btcAddress);
    console.log("Using USDC Address:", usdcAddress);

    // Initial BTC Price (e.g. $97,000). The Oracle/Admin will update this live later.
    const INITIAL_BTC_PRICE = 97000;

    // Deploy BitCreditProtocol
    console.log("Deploying BitCreditProtocol...");
    const Factory = await ethers.getContractFactory("BitCreditProtocol");
    const protocol = await Factory.deploy(btcAddress, usdcAddress, INITIAL_BTC_PRICE);
    await protocol.waitForDeployment();
    const protocolAddress = await protocol.getAddress();
    
    console.log("BitCreditProtocol successfully deployed to:", protocolAddress);

    console.log("\n--- Mainnet Deployment Summary ---");
    console.log(`NEXT_PUBLIC_BTC_ADDRESS=${btcAddress}`);
    console.log(`NEXT_PUBLIC_USDC_ADDRESS=${usdcAddress}`);
    console.log(`NEXT_PUBLIC_POOL_ADDRESS=${protocolAddress}`);
    console.log("\nMake sure to update your frontend .env file and fund the protocol treasury with USDC so users can borrow!");
}

main().catch((err) => { console.error(err); process.exit(1); });
