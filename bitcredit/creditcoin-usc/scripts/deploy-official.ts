import { ethers } from "hardhat";
async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("Deploying official mainnet contracts with account:", deployer.address);
    
    // 1. Deploy the custom BOT Wrapped Bitcoin (bWBTC)
    console.log("Deploying BOT Wrapped Bitcoin (bWBTC)...");
    const MockBTC = await ethers.getContractFactory("MockBTC");
    // We reuse the MockBTC contract logic, but give it the official bWBTC name
    const bWBTC = await MockBTC.deploy("BOT Wrapped Bitcoin", "bWBTC");
    await bWBTC.waitForDeployment();
    const wbotAddress = await bWBTC.getAddress();
    console.log("bWBTC deployed to:", wbotAddress);

    // 2. Official BOT Chain USDT
    const usdtAddress = "0xaBabc7Ddc03e501d190C676BF3d92ef0e6e87a3C";
    const INITIAL_PRICE = 1000;
    
    // 3. Deploy Protocol
    console.log("Deploying BitCreditProtocol...");
    const Factory = await ethers.getContractFactory("BitCreditProtocol");
    const protocol = await Factory.deploy(wbotAddress, usdtAddress, INITIAL_PRICE);
    await protocol.waitForDeployment();
    console.log("BitCreditProtocol deployed to:", await protocol.getAddress());
}
main().catch((err) => { console.error(err); process.exit(1); });
