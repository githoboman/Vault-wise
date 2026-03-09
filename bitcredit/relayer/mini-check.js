const { ethers } = require("ethers");

const RPC = "https://rpc.usc-testnet.creditcoin.network";
const USC_ADDR = "0xF37130A1869619F027268A5e3E28D60218bcB01f";

const ABI = [
    "function nonceToTokenId(uint256) view returns (uint256)",
    "function totalSupply() view returns (uint256)",
    "function activeCreditLine(address) view returns (uint256)"
];

async function check() {
    try {
        const provider = new ethers.JsonRpcProvider(RPC);
        const usc = new ethers.Contract(USC_ADDR, ABI, provider);

        console.log("Checking nonceToTokenId for nonces 1, 2, 3...");
        console.log("Nonce 1:", (await usc.nonceToTokenId(1)).toString());
        console.log("Nonce 2:", (await usc.nonceToTokenId(2)).toString());
        console.log("Nonce 3:", (await usc.nonceToTokenId(3)).toString());

        console.log("\nTotal Supply:", (await usc.totalSupply()).toString());

        const user = "0xf14bc9656c57d265c53da70f9b80453f759c1d27";
        console.log(`Active Credit Line for ${user}:`, (await usc.activeCreditLine(user)).toString());

    } catch (e) { console.error(e); }
}

check();
