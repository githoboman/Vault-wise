import { ethers } from "hardhat";
import * as dotenv from "dotenv";
dotenv.config();

async function main() {
    const [deployer] = await ethers.getSigners();
    const balance = await deployer.provider.getBalance(deployer.address);
    console.log("Deployer:", deployer.address);
    console.log("Balance: ", ethers.formatEther(balance), "BOT");

    console.log("\n--- Starting Testnet Deployment ---");

    // 1. Deploy MockBTC
    const MockBTC = await ethers.getContractFactory("MockBTC");
    const mockBTC = await MockBTC.deploy();
    await mockBTC.waitForDeployment();
    const mockBTCAddress = await mockBTC.getAddress();
    console.log("MockBTC deployed to:", mockBTCAddress);

    // 2. Deploy MockUSDT
    const MockUSDT = await ethers.getContractFactory("MockUSDT");
    const mUSDT = await MockUSDT.deploy();
    await mUSDT.waitForDeployment();
    const USDTAddress = await mUSDT.getAddress();
    console.log("MockUSDT deployed to:", USDTAddress);

    // 3. Deploy BitCreditProtocol with initial BTC Price of $97,000
    const INITIAL_BTC_PRICE = 97000;
    const Factory = await ethers.getContractFactory("BitCreditProtocol");
    const protocol = await Factory.deploy(mockBTCAddress, USDTAddress, INITIAL_BTC_PRICE);
    await protocol.waitForDeployment();
    const protocolAddress = await protocol.getAddress();
    console.log("BitCreditProtocol deployed to:", protocolAddress);

    // 4. Mint test BTC and USDT to deployer for testing
    const mintBTC = ethers.parseUnits("10", 8); // 10 BTC
    await mockBTC.mint(deployer.address, mintBTC);
    console.log("Minted 10 MockBTC to deployer");

    const mintUSDT = ethers.parseUnits("1000000", 18); // 1,000,000 USDT
    await mUSDT.mint(deployer.address, mintUSDT);
    console.log("Minted 1,000,000 MockUSDT to deployer");

    // 5. Fund the protocol Treasury with USDT so users can borrow
    // The protocol needs USDT to lend out
    const fundAmount = ethers.parseUnits("500000", 18); // 500k USDT
    await mUSDT.approve(protocolAddress, fundAmount);
    await protocol.fundTreasury(fundAmount);
    console.log("Funded BitCreditProtocol Treasury with 500,000 MockUSDT");

    console.log("\n--- Testnet Deployment Summary ---");
    console.log(`NEXT_PUBLIC_MOCK_BTC_ADDRESS=${mockBTCAddress}`);
    console.log(`NEXT_PUBLIC_MOCK_USDT_ADDRESS=${USDTAddress}`);
    console.log(`NEXT_PUBLIC_POOL_ADDRESS=${protocolAddress}`);
    console.log("\nPlease copy these variables into your frontend .env.local file to test the application.");
}

main().catch((err) => { console.error(err); process.exit(1); });
