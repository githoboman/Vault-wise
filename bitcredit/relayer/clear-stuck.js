const { ethers } = require("ethers");
require("dotenv").config();

async function main() {
    const provider = new ethers.JsonRpcProvider("https://rpc.usc-testnet.creditcoin.network");
    const wallet = new ethers.Wallet(process.env.EVM_PRIV, provider);

    console.log("Relayer Address:", wallet.address);

    const balance = await provider.getBalance(wallet.address);
    console.log("Balance:", ethers.formatEther(balance), "CTC");

    const count = await provider.getTransactionCount(wallet.address, "latest");
    const pendingCount = await provider.getTransactionCount(wallet.address, "pending");

    console.log("Latest Nonce:", count);
    console.log("Pending Nonce:", pendingCount);

    if (pendingCount > count) {
        console.log("Found stuck transactions. Attempting to clear...");
        // Send a 0 value transaction to the same address with a higher gas price
        for (let i = count; i < pendingCount; i++) {
            const feeData = await provider.getFeeData();
            // Increase gas price by 50% to be sure
            const gasPrice = (feeData.gasPrice * 150n) / 100n;

            console.log(`Clearing nonce ${i} with gasPrice ${ethers.formatUnits(gasPrice, 'gwei')} gwei`);

            const tx = await wallet.sendTransaction({
                to: wallet.address,
                value: 0,
                nonce: i,
                gasPrice: gasPrice
            });

            console.log(`Broadcast clear tx: ${tx.hash}`);
            await tx.wait();
            console.log(`Nonce ${i} cleared!`);
        }
    } else {
        console.log("No stuck transactions found.");
    }
}

main().catch(console.error);
