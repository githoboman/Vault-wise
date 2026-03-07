import * as dotenv from "dotenv";
dotenv.config();

const required = ["VAULT_ADDRESS", "STACKS_RELAYER_PRIV", "USC_ADDRESS", "EVM_PRIV"];
for (const key of required) {
    if (!process.env[key]) throw new Error(`Missing env var: ${key}`);
}

export const CONFIG = {
    STACKS_API: "https://api.testnet.hiro.so",
    VAULT_ADDRESS: process.env.VAULT_ADDRESS!,
    VAULT_NAME: process.env.VAULT_NAME || "vault",
    RELAYER_PRIV: process.env.STACKS_RELAYER_PRIV!,
    CREDITCOIN_RPC: "https://rpc.usc-testnet.creditcoin.network",
    USC_ADDRESS: process.env.USC_ADDRESS!,
    EVM_PRIV: process.env.EVM_PRIV!,
    PORT: process.env.PORT || 3001,
    POLL_INTERVAL_MS: 30_000,
};
