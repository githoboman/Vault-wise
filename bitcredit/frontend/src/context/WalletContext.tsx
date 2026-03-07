"use client";
import { createContext, useContext, useState, useCallback, ReactNode } from "react";
import { AppConfig, UserSession, authenticate } from "@stacks/connect";
import { ethers } from "ethers";

const appConfig = new AppConfig(["store_write", "publish_data"]);
const userSession = new UserSession({ appConfig });

interface WalletContextType {
    stacksAddress: string | null; evmAddress: string | null;
    connectStacks: () => void; connectEVM: () => Promise<void>;
    isFullyConnected: boolean;
}

const WalletContext = createContext<WalletContextType>({} as WalletContextType);

export function WalletProvider({ children }: { children: ReactNode }) {
    const [stacksAddress, setStacksAddress] = useState<string | null>(null);
    const [evmAddress, setEvmAddress] = useState<string | null>(null);

    const connectStacks = useCallback(() => {
        authenticate({
            appDetails: { name: "BitCredit", icon: "/favicon.ico" },
            userSession,
            onFinish: () => {
                const data = userSession.loadUserData();
                setStacksAddress(data.profile.stxAddress.testnet);
            },
            onCancel: () => { },
        });
    }, []);

    const connectEVM = useCallback(async () => {
        const eth = (window as any).ethereum;
        if (!eth) { alert("MetaMask not found."); return; }
        const p = new ethers.BrowserProvider(eth);
        try {
            await p.send("wallet_switchEthereumChain", [{ chainId: "0x18E91" }]);
        } catch {
            await p.send("wallet_addEthereumChain", [{
                chainId: "0x18E91", chainName: "Creditcoin USC Testnet",
                rpcUrls: ["https://rpc.usc-testnet.creditcoin.network"],
                nativeCurrency: { name: "tCTC", symbol: "tCTC", decimals: 18 },
                blockExplorerUrls: ["https://explorer.usc-testnet.creditcoin.network/"],
            }]);
        }
        const accounts = await p.send("eth_requestAccounts", []);
        setEvmAddress(accounts[0]);
    }, []);

    return (
        <WalletContext.Provider value={{
            stacksAddress, evmAddress, connectStacks, connectEVM,
            isFullyConnected: !!stacksAddress && !!evmAddress,
        }}>
            {children}
        </WalletContext.Provider>
    );
}

export const useWallet = () => useContext(WalletContext);
