import { makeContractDeploy, broadcastTransaction, AnchorMode } from "@stacks/transactions";
import { STACKS_TESTNET } from "@stacks/network";
import fs from "fs";

const privKey = "46572711f718393727f01dd2d13cb0107434ecb030c2f1affa9094cfc7ef9cda01";
let codeBody = fs.readFileSync("../stacks-vault/contracts/vault-mainnet.clar", "utf8");
codeBody = codeBody.replace(/\r/g, "");

async function deploy() {
    console.log("Building deploy transaction...");
    const tx = await makeContractDeploy({
        contractName: "vault-v2",
        codeBody: codeBody,
        fee: 500000n, // 0.5 STX
        senderKey: privKey,
        network: STACKS_TESTNET,
        anchorMode: AnchorMode.Any,
        clarityVersion: 2,
    });

    console.log("Broadcasting...");
    const res = await broadcastTransaction({ transaction: tx, network: STACKS_TESTNET });
    console.log("Broadcast Result:", res);
}

deploy().catch(console.error);
