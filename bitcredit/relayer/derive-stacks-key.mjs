import { generateWallet, getStxAddress } from "@stacks/wallet-sdk";

const mnemonic = "welcome beach clarify economy empower net clap click sausage suspect pizza dog jacket output bomb humble wait nut erupt discover carbon purity crucial defy";

async function main() {
    try {
        const wallet = await generateWallet({
            secretKey: mnemonic,
            password: "",
        });
        const account = wallet.accounts[0];
        console.log(`Address: ${getStxAddress({ account, network: "testnet" })}`);
        console.log(`Private Key: ${account.stxPrivateKey}`);
    } catch (e) {
        console.error("Derivation failed:", e.message);
    }
}

main().catch(console.error);
