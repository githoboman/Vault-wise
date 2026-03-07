import { initSimnet } from "@stacks/clarinet-sdk";

const simnet = await initSimnet("./Clarinet.toml");
const accounts = simnet.getAccounts();
for (const [name, addr] of accounts) {
    console.log(`${name} = ${addr}`);
}
process.exit(0);
