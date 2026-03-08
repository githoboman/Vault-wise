const { ethers } = require("ethers");

const RPC = "https://rpc.usc-testnet.creditcoin.network";
const USC_ADDR = "0xF37130A1869619F027268A5e3E28D60218bcB01f";

const ABI = [
    "event CreditLineClosed(uint256 indexed tokenId, address indexed borrower, uint256 stacksNonce)"
];

async function findEvents() {
    const provider = new ethers.JsonRpcProvider(RPC);
    const usc = new ethers.Contract(USC_ADDR, ABI, provider);
    const currentBlock = await provider.getBlockNumber();

    console.log("Current Block:", currentBlock);

    // Look back 100,000 blocks (~1M seconds / 15 hours is definitely within this)
    const events = await usc.queryFilter(usc.filters.CreditLineClosed(), currentBlock - 5000, currentBlock);

    events.forEach(e => {
        console.log(`Event: tokenId=${e.args[0]}, borrower=${e.args[1]}, stacksNonce=${e.args[2]}`);
    });
}

findEvents().catch(console.error);
