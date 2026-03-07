import { ethers } from "ethers";

const rpcUrl = "https://rpc.usc-testnet.creditcoin.network";
// Also checking alternative if the first fails
// const rpcUrl = "https://rpc.usc.testnet.creditcoin.network";

const privateKey = "0x20e67fdeec594589ecbbba9cb3a57c123aa3d77786cd3622f883df881dcd33a0";

async function main() {
    console.log(`Testing RPC: ${rpcUrl}`);
    const provider = new ethers.JsonRpcProvider(rpcUrl);

    try {
        const network = await provider.getNetwork();
        console.log(`Connected! Chain ID: ${network.chainId}`);

        const wallet = new ethers.Wallet(privateKey, provider);
        console.log(`Address: ${wallet.address}`);

        const balance = await provider.getBalance(wallet.address);
        console.log(`Balance: ${ethers.formatEther(balance)} CTC`);
    } catch (e) {
        console.error("RPC Error:", e.message);
    }
}

main().catch(console.error);
