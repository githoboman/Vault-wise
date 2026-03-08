const { ethers } = require("ethers");

const RPC = "https://rpc.testnet.creditcoin.network";
const USC_ADDR = "0x27A38fe670556FcC1d2539f432E5C12A8FbC513B";
const USER_EVM = "0xf14bc9656c57d265c53da70f9b80453f759c1d27";

const ABI = [
    "function activeCreditLine(address) view returns (uint256)",
    "function getActiveCreditLine(address) view returns (tuple(address borrower, string stacksOwner, uint256 collateralSats, uint256 stacksNonce, uint256 creditPowerUSD, uint256 issuedAt, bool active, uint256 loansDisbursed, uint256 totalRepaidCents))"
];

async function check() {
    const provider = new ethers.JsonRpcProvider(RPC);
    const usc = new ethers.Contract(USC_ADDR, ABI, provider);

    try {
        const tokenId = await usc.activeCreditLine(USER_EVM);
        console.log("Token ID:", tokenId.toString());
        if (tokenId > 0n) {
            const cl = await usc.getActiveCreditLine(USER_EVM);
            console.log("Credit Line:", JSON.stringify({
                borrower: cl.borrower,
                stacksOwner: cl.stacksOwner,
                collateralSats: cl.collateralSats.toString(),
                stacksNonce: cl.stacksNonce.toString(),
                active: cl.active
            }, null, 2));
        }
    } catch (e) {
        console.error("Error:", e.message);
    }
}

check();
