import { releaseStacksCollateral } from "./relayer";

async function run() {
    console.log("Processing missed closure for nonce 1...");
    await releaseStacksCollateral(1);
    console.log("Done.");
}

run().catch(console.error);
