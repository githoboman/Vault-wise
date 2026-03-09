const { ethers } = require("ethers");

const RPC = "https://rpc.usc-testnet.creditcoin.network";
const USC_ADDR = "0xF37130A1869619F027268A5e3E28D60218bcB01f";
const USER_EVM = "0xf14bc9656c57d265c53da70f9b80453f759c1d27";

const ABI = [
    "function activeCreditLine(address) view returns (uint256)",
    "function nonceToTokenId(uint256) view returns (uint256)",
    "function getActiveCreditLine(address) view returns (tuple(address borrower, string stacksOwner, uint256 collateralSats, uint256 stacksNonce, uint256 creditPowerUSD, uint256 issuedAt, bool active, uint256 loansDisbursed, uint256 totalRepaidCents))",
    "function totalSupply() view returns (uint256)",
    "function ownerOf(uint256) view returns (address)"
];

async function check() {
    try {
        const provider = new ethers.JsonRpcProvider(RPC);
        const usc = new ethers.Contract(USC_ADDR, ABI, provider);

        console.log("Checking USC status for:", USER_EVM);

        const tid = await usc.activeCreditLine(USER_EVM);
        console.log("Active Credit Line (activeCreditLine):", tid.toString());

        const total = await usc.totalSupply();
        console.log("Total NFTs (totalSupply):", total.toString());

        for (let i = 1; i <= Number(total); i++) {
            const owner = await usc.ownerOf(i);
            const cl = await usc.getActiveCreditLine(owner).catch(() => null);
            console.log(`Token ${i}: owner=${owner}, active=${cl ? cl.active : 'unknown'}, nonce=${cl ? cl.stacksNonce : 'unknown'}`);
        }

        const n2 = await usc.nonceToTokenId(2);
        console.log("Nonce 2 -> TokenId:", n2.toString());

        const n3 = await usc.nonceToTokenId(3);
        console.log("Nonce 3 -> TokenId:", n3.toString());

    } catch (e) { console.error(e); }
}

check();
