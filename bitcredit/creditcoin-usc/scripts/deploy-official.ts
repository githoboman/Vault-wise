import { ethers } from "hardhat";
async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("Deploying official mainnet contract with account:", deployer.address);
    const wbotAddress = "0xD5452816194a3784dBa983426cCe7c122F4abd30";
    const usdtAddress = "0xaBabc7Ddc03e501d190C676BF3d92ef0e6e87a3C";
    const INITIAL_PRICE = 1000;
    const Factory = await ethers.getContractFactory("BitCreditProtocol");
    const protocol = await Factory.deploy(wbotAddress, usdtAddress, INITIAL_PRICE);
    await protocol.waitForDeployment();
    console.log("BitCreditProtocol deployed to:", await protocol.getAddress());
}
main().catch((err) => { console.error(err); process.exit(1); });
