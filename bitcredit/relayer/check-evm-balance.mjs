import { ethers } from "ethers";

const mnemonic = "welcome beach clarify economy empower net clap click sausage suspect pizza dog jacket output bomb humble wait nut erupt discover carbon purity crucial defy";

async function main() {
    try {
        const wallet = ethers.Wallet.fromPhrase(mnemonic);
        console.log(`Address: ${wallet.address}`);
        console.log(`Private Key: ${wallet.privateKey}`);

        const provider = new ethers.JsonRpcProvider("https://rpc.cc3-testnet.creditcoin.network");
        const balance = await provider.getBalance(wallet.address);
        console.log(`Balance on CC3 Testnet: ${ethers.formatEther(balance)} CTC`);
    } catch (e) {
        console.error("Error:", e.message);
    }
}

main().catch(console.error);
