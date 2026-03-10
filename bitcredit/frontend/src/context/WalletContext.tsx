"use client";
import { createContext, useContext, useState, useCallback, ReactNode, useEffect } from "react";
import { AppConfig, UserSession, authenticate } from "@stacks/connect";
import { ethers } from "ethers";

const appConfig = new AppConfig(["store_write", "publish_data"]);
const userSession = new UserSession({ appConfig });

interface WalletContextType {
    stacksAddress: string | null; evmAddress: string | null;
    connectStacks: () => void; connectEVM: () => Promise<void>;
    disconnect: () => void;
    isFullyConnected: boolean;
    isInitializing: boolean;
}

const WalletContext = createContext<WalletContextType>({} as WalletContextType);

export function WalletProvider({ children }: { children: ReactNode }) {
    const [stacksAddress, setStacksAddress] = useState<string | null>(null);
    const [evmAddress, setEvmAddress] = useState<string | null>(null);
    const [isInitializing, setIsInitializing] = useState(true);

    const connectStacks = useCallback(() => {
        authenticate({
            appDetails: {
                name: "BitCredit",
                icon: window.location.origin + "/favicon.ico"
            },
            userSession,
            onFinish: () => {
                const data = userSession.loadUserData();
                setStacksAddress(data.profile.stxAddress.testnet || data.profile.stxAddress.mainnet);
            },
            onCancel: () => { },
        });
    }, []);

    const connectEVM = useCallback(async () => {
        const eth = (window as any).ethereum;

        if (!eth) {
            // Mobile deep linking fallback for MetaMask
            const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
            if (isMobile) {
                const link = `https://metamask.app.link/dapp/${window.location.host}${window.location.pathname}`;
                window.location.href = link;
                return;
            }
            alert("Ethereum-compatible wallet not detected. Please install MetaMask, Rabby, or use a Web3 browser.");
            return;
        }

        const p = new ethers.BrowserProvider(eth);
        try {
            // Requesting account first to avoid issues on some mobile browsers
            const accounts = await p.send("eth_requestAccounts", []);
            setEvmAddress(accounts[0]);

            // Then handle chain switching
            try {
                await eth.request({ method: "wallet_switchEthereumChain", params: [{ chainId: "0x18E91" }] });
            } catch (err: any) {
                if (err.code === 4902) {
                    await eth.request({
                        method: "wallet_addEthereumChain",
                        params: [{
                            chainId: "0x18E91", chainName: "Creditcoin USC Testnet",
                            rpcUrls: ["https://rpc.usc-testnet.creditcoin.network"],
                            nativeCurrency: { name: "tCTC", symbol: "tCTC", decimals: 18 },
                            blockExplorerUrls: ["https://explorer.usc-testnet.creditcoin.network/"],
                        }]
                    });
                }
            }
        } catch (e: any) {
            console.error("EVM Connection error", e);
        }
    }, []);

    const disconnect = useCallback(() => {
        userSession.signUserOut();
        setStacksAddress(null);
        setEvmAddress(null);
    }, []);

    const onAccountChange = useCallback((accounts: string[]) => {
        if (accounts.length > 0) setEvmAddress(accounts[0]);
        else setEvmAddress(null);
    }, []);

    const onChainChange = useCallback(() => {
        window.location.reload();
    }, []);

    useEffect(() => {
        const eth = (window as any).ethereum;
        if (eth && eth.on) {
            eth.on("accountsChanged", onAccountChange);
            eth.on("chainChanged", onChainChange);
            return () => {
                eth.removeListener("accountsChanged", onAccountChange);
                eth.removeListener("chainChanged", onChainChange);
            };
        }
    }, [onAccountChange, onChainChange]);
    useEffect(() => {
        const restoreSession = async () => {
            // 1. Stacks restore
            if (userSession.isUserSignedIn()) {
                const data = userSession.loadUserData();
                setStacksAddress(data.profile.stxAddress.testnet || data.profile.stxAddress.mainnet);
            }

            // 2. EVM restore (silent reconnect)
            if (typeof window !== "undefined" && (window as any).ethereum) {
                try {
                    const provider = new ethers.BrowserProvider((window as any).ethereum);
                    const accounts = await provider.send("eth_accounts", []);
                    if (accounts.length > 0) {
                        setEvmAddress(accounts[0]);
                    }
                } catch (e) {
                    console.error("EVM restore failed", e);
                }
            }
            setIsInitializing(false);
        };
        restoreSession();
    }, []);

    return (
        <WalletContext.Provider value={{
            stacksAddress, evmAddress, connectStacks, connectEVM, disconnect,
            isFullyConnected: !!stacksAddress && !!evmAddress,
            isInitializing
        }}>
            {children}
        </WalletContext.Provider>
    );
}

export const useWallet = () => useContext(WalletContext);
