const { ethers } = require("ethers");

const RPC = "https://rpc.usc-testnet.creditcoin.network";
const USC_ADDR = "0xF37130A1869619F027268A5e3E28D60218bcB01f";
const USER_EVM = "0xf14bc9656c57d265c53da70f9b80453f759c1d27";

const ABI = [
    "function activeCreditLine(address) view returns (uint256)",
    "function getActiveCreditLine(address) view returns (tuple(address borrower, string stacksOwner, uint256 collateralSats, uint256 stacksNonce, uint256 creditPowerUSD, uint256 issuedAt, bool active, uint256 loansDisbursed, uint256 totalRepaidCents))"
];

const POOL_ADDR = "0x7F0DDCA9dBC8597218F391aE835750777A55274a";
const POOL_ABI = ["function bitCreditUSC() view returns (address)"];

async function check() {
    try {
        const provider = new ethers.JsonRpcProvider(RPC);
        const usc = new ethers.Contract(USC_ADDR, ABI, provider);
        const pool = new ethers.Contract(POOL_ADDR, POOL_ABI, provider);

        const storedUsc = await pool.bitCreditUSC();
        console.log("Pool's Stored USC:", storedUsc);

        const tokenId = await usc.activeCreditLine(USER_EVM);
        console.log("Token ID:", tokenId.toString());

        if (tokenId !== 0n) {
            const cl = await usc.getActiveCreditLine(USER_EVM);
            console.log("Credit Line:", JSON.stringify({
                borrower: cl.borrower,
                stacksOwner: cl.stacksOwner,
                collateralSats: cl.collateralSats.toString(),
                stacksNonce: cl.stacksNonce.toString(),
                active: cl.active
            }, null, 2));
        }
    } catch (e) { console.error(e); }
}

check();
