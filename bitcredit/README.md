# BitCredit: Cross-Chain Bitcoin-Backed Liquid Credit

BitCredit is a minimalist, high-fidelity DeFi protocol that unlocks Bitcoin liquidity through cross-chain credit lines. By locking **sBTC** on the Stacks network, users instantly establish a **Credit Power NFT** on the Creditcoin (CTC) network, allowing them to borrow real stablecoins against their reputation.

---

## 🚀 Key Features

- **Bitcoin-Backed Collateral**: Use your sBTC (Stacks) as secure, decentralized collateral.
- **Creditcoin Settlement**: Repayments and credit scores are immutably recorded on the **Creditcoin (CTC)** L1.
- **Liquid Borrowing**: Instant access to USD-denominated credit without selling your Bitcoin.
- **Dynamic Reputation**: Your On-Chain Credit Score grows with every successful repayment.
- **Vault Closure**: One-click settlement to burn your credit NFT and release your Stacks collateral via our automated Relayer.
- **Premium Design**: Modern, minimalist UI with full Light/Dark mode support.

---

## 🌐 The Creditcoin (CTC) Synergy

BitCredit is a strategic liquidity layer for the **Creditcoin (CTC)** ecosystem. 

### How we help CTC:
1. **Network Volume**: Every bridge, borrow, and repayment action generates transaction volume on the Creditcoin L1.
2. **Real-World Utility**: We bridge the gap between Bitcoin's massive store-of-value and Creditcoin's specialized credit recording infrastructure.
3. **Reputation Backbone**: By recording BitCredit scores on CTC, we create a global, verifiable credit standard that can be used by other fintechs and protocols in the Creditcoin ecosystem.
4. **Institutional Security**: Our protocol uses the same cryptographic attestation standards as the Creditcoin L1, ensuring institutional-grade reliability.

---

## 🛠 Project Architecture

BitCredit consists of four primary components:

1. **Stacks Vault (`/stacks-vault`)**: Harmony-compatible Clarity smart contracts (Clarity 4) for locking sBTC collateral.
2. **Creditcoin USC (`/creditcoin-usc`)**: Solidity smart contracts for the Credit Power NFT, MockUSDC, and the Lending Pool.
3. **Relayer Node (`/relayer`)**: A high-performance Node.js service that monitors EVM events and Stacks block headers to automate cross-chain settlement.
4. **Dashboard Frontend (`/frontend`)**: A Next.js application designed with `next-themes` and Tailwind for a premium user experience.

---

## ⚙️ Setup & Installation

### Prerequisites
- Node.js v18+
- [Leather Wallet](https://leather.io/) (Stacks Testnet)
- [MetaMask](https://metamask.io/) (Creditcoin Testnet)

### 1. Deployment
```bash
# Deploy Stacks Contracts
cd stacks-vault && npx clarinet deploy --testnet

# Deploy EVM Contracts
cd ../creditcoin-usc && npx hardhat run scripts/deploy.ts --network usc-testnet
```

### 2. Startup
```bash
# Start the Relayer node
cd ../relayer && npm run start

# Launch the Dashboard
cd ../frontend && npm run dev
```

---

## 📝 License
BitCredit is open-source software. Testnet only at this phase.
