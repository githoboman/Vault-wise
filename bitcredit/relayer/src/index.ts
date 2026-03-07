import cron from "node-cron";
import { pollStacksEvents, listenForCreditLineClosed } from "./relayer";
import { startApi } from "./api";
import { CONFIG } from "./config";

async function main() {
    console.log("BitCredit Relayer starting...");
    console.log(`Vault: ${CONFIG.VAULT_ADDRESS}.${CONFIG.VAULT_NAME}`);
    console.log(`USC:   ${CONFIG.USC_ADDRESS}`);
    startApi(CONFIG.PORT);
    listenForCreditLineClosed();
    cron.schedule("*/30 * * * * *", pollStacksEvents);
    await pollStacksEvents();
    console.log("Relayer live.");
}

main().catch(console.error);
