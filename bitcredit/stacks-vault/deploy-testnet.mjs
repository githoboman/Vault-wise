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

async function deploy(contractName, filePath, fee = 10000) {
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

    // Explicitly convert hex string to Buffer for binary transmission
    const txBytes = Buffer.from(txHex, "hex");

    console.log("Broadcasting manually to capture full error...");
    const res = await fetch(`https://api.testnet.hiro.so/v2/transactions`, {
        method: "POST",
        headers: { "Content-Type": "application/octet-stream" },
        body: txBytes
    });

    const resultText = await res.text();
    console.log(`Node Response: ${resultText}`);

    if (!res.ok) {
        throw new Error(`Broadcast failed with status ${res.status}: ${resultText}`);
    }

    const result = JSON.parse(resultText);
    console.log(`Deployment broadcasted! TXID: ${result.txid}`);
    console.log(`Explorer Link: https://explorer.hiro.so/txid/${result.txid}?chain=testnet`);
    return result.txid;
}

async function run() {
    try {
        // Mock Token is ALREADY DEPLOYED: feab0ac5df72f44a876a376c5f3822bfd8e3b0eb19553560bc6abcaf1fb78e3f

        // 2. Deploy Vault (pointing to the new mock token)
        const vaultTx = await deploy("vault", "./contracts/vault-clean.clar", 100000);

        console.log("\n--- DEPLOYMENT SUMMARY ---");
        console.log(`Mock Token: ${address}.mock-sbtc-token`);
        console.log(`Vault Contract: ${address}.vault`);
        console.log("\nVault contract is now pending confirmation on Stacks Testnet.");
    } catch (e) {
        console.error("\nERROR:", e.message);
    }
}

run();
