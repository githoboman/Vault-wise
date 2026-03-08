import {
    makeContractDeploy,
    AnchorMode,
} from "@stacks/transactions";
import { STACKS_TESTNET } from "@stacks/network";
import fs from "fs";

const privateKey = "46572711f718393727f01dd2d13cb0107434ecb030c2f1affa9094cfc7ef9cda01";
const address = "ST9NSDHK5969YF6WJ2MRCVVAVTDENWBNTFJRVZ3E";
const network = STACKS_TESTNET;

async function getNonce(address) {
    const res = await fetch(`https://api.testnet.hiro.so/extended/v1/address/${address}/nonces`);
    const data = await res.json();
    return data.possible_next_nonce;
}

async function deploy(contractName, filePath, fee = 25000) {
    console.log(`\nDeploying ${contractName}...`);
    const code = fs.readFileSync(filePath, "utf-8");
    const nonce = await getNonce(address);
    console.log(`Using Nonce: ${nonce}`);

    const txOptions = {
        contractName,
        codeBody: code,
        senderKey: privateKey,
        network,
        anchorMode: AnchorMode.Any,
        fee,
        nonce
    };

    const transaction = await makeContractDeploy(txOptions);
    const txHex = transaction.serialize();
    const txBytes = Buffer.from(txHex, "hex");

    console.log("Broadcasting to Hiro API...");
    const res = await fetch(`https://api.testnet.hiro.so/v2/transactions`, {
        method: "POST",
        headers: { "Content-Type": "application/octet-stream" },
        body: txBytes
    });

    const resultText = await res.text();
    if (!res.ok) {
        throw new Error(`Broadcast failed with status ${res.status}: ${resultText}`);
    }

    const result = JSON.parse(resultText);
    console.log(`✓ Vault-v3 broadcasted! TXID: ${result.txid}`);
    console.log(`  Explorer Link: https://explorer.hiro.so/txid/${result.txid}?chain=testnet`);
    return result.txid;
}

async function run() {
    try {
        await deploy("vault-v3", "./contracts/vault-mainnet.clar", 30000);
        console.log("\nVault-v3 is now pending confirmation. Please update .env files once confirmed.");
    } catch (e) {
        console.error("\nERROR:", e.message);
    }
}

run();
