import { ethers } from "hardhat";
import * as dotenv from "dotenv";
dotenv.config();

async function main() {
    const [deployer] = await ethers.getSigners();
    const balance = await deployer.provider.getBalance(deployer.address);
    console.log("Deployer:", deployer.address);
    console.log("Balance: ", ethers.formatEther(balance), "CTC");

    const relayerAddress = process.env.RELAYER_ADDRESS;
    if (!relayerAddress) throw new Error("RELAYER_ADDRESS not set in .env");

    const Factory = await ethers.getContractFactory("BitCreditUSC");
    const usc = await Factory.deploy(relayerAddress);
    await usc.waitForDeployment();

    const address = await usc.getAddress();
    console.log("\nBitCreditUSC deployed to:", address);
    console.log("USC_ADDRESS=" + address);
}

main().catch((err) => { console.error(err); process.exit(1); });
