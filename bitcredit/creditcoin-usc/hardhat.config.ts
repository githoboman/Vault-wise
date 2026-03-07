import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import * as dotenv from "dotenv";
dotenv.config();

const config: HardhatUserConfig = {
    solidity: {
        version: "0.8.20",
        settings: { optimizer: { enabled: true, runs: 200 } }
    },
    networks: {
        creditcoin_testnet: {
            url: "https://rpc.usc-testnet.creditcoin.network",
            chainId: 102033,
            accounts: process.env.EVM_PRIVATE_KEY ? [process.env.EVM_PRIVATE_KEY] : []
        },
        hardhat: { chainId: 31337 }
    }
};

export default config;
