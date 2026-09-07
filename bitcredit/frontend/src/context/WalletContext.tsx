"use client";
import { createContext, useContext, useState, useCallback, ReactNode, useEffect } from "react";
import { ethers } from "ethers";

interface WalletContextType {
    evmAddress: string | null;
    connectEVM: () => Promise<void>;
    disconnect: () => void;
    isConnecting: boolean;
    isFullyConnected: boolean;
    provider: ethers.BrowserProvider | null;
    signer: ethers.JsonRpcSigner | null;
    isGasless: boolean;
    sendGaslessTransaction: (contract: ethers.Contract, method: string, args: any[]) => Promise<any>;
}

const WalletContext = createContext<WalletContextType>({} as WalletContextType);

const BOT_CHAIN_CHAIN_ID = "0x3c8"; // 968
const BOT_CHAIN_CHAIN_ID_NAME = "BOT Chain Testnet";

export function WalletProvider({ children }: { children: ReactNode }) {
    const [evmAddress, setEvmAddress] = useState<string | null>(null);
    const [provider, setProvider] = useState<ethers.BrowserProvider | null>(null);
    const [signer, setSigner] = useState<ethers.JsonRpcSigner | null>(null);
    const [isConnecting, setIsConnecting] = useState(false);
    const [isInitializing, setIsInitializing] = useState(true);
    const [isGasless, setIsGasless] = useState(false);

    const connectEVM = useCallback(async () => {
        setIsConnecting(true);
        const eth = (window as any).ethereum;

        if (!eth) {
            const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
            if (isMobile) {
                const link = `https://metamask.app.link/dapp/${window.location.host}${window.location.pathname}`;
                window.location.href = link;
                return;
            }
            alert("Ethereum-compatible wallet not detected. Please install MetaMask, Rabby, or use a Web3 browser.");
            setIsConnecting(false);
            return;
        }

        try {
            const p = new ethers.BrowserProvider(eth);

            await eth.request({ method: "eth_requestAccounts", params: [] });

            try {
                await eth.request({
                    method: "wallet_switchEthereumChain",
                    params: [{ chainId: BOT_CHAIN_CHAIN_ID }]
                });
            } catch (err: any) {
                if (err.code === 4902) {
                    await eth.request({
                        method: "wallet_addEthereumChain",
                        params: [{
                            chainId: BOT_CHAIN_CHAIN_ID,
                            chainName: BOT_CHAIN_CHAIN_ID_NAME,
                            nativeCurrency: { name: "BOT", symbol: "BOT", decimals: 18 },
                            rpcUrls: ["https://rpc.bohr.life"],
                            blockExplorerUrls: ["https://scan.bohr.life/"],
                        }]
                    });
                }
            }

            const accounts = await eth.request({ method: "eth_accounts", params: [] });
            if (accounts.length > 0) {
                setEvmAddress(accounts[0]);
                setProvider(p);
                const s = await p.getSigner();
                setSigner(s);
            }
        } catch (e: any) {
            console.error("EVM Connection error", e);
        }
        setIsConnecting(false);
    }, []);

    const disconnect = useCallback(() => {
        setEvmAddress(null);
        setProvider(null);
        setSigner(null);
    }, []);

    const checkSponsorability = useCallback(async (): Promise<boolean> => {
        if (!evmAddress || !(window as any).ethereum) return false;
        try {
            const response = await fetch("https://rpc.bohr.life", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    jsonrpc: "2.0",
                    id: 1,
                    method: "pm_isSponsorable",
                    params: [{
                        from: evmAddress,
                        to: ethers.ZeroAddress,
                        value: "0x0",
                        data: "0x",
                        gas: "0x0"
                    }]
                })
            });
            const result = await response.json();
            return result?.result?.Sponsorable === true;
        } catch {
            return false;
        }
    }, [evmAddress]);

    const sendGaslessTransaction = useCallback(async (
        contract: ethers.Contract,
        method: string,
        args: any[]
    ): Promise<any> => {
        if (!signer || !evmAddress) throw new Error("Wallet not connected");

        const sponsored = await checkSponsorability();
        setIsGasless(sponsored);

        if (sponsored) {
            const populated = await contract.interface.populateCallParams(
                await contract.interface.encodeFunctionData(method, args)
            );
            const tx = await signer.sendTransaction({
                to: contract.target,
                data: populated.calldata,
                gasPrice: 0,
                gasLimit: 500_000,
            });
            return await tx.wait();
        } else {
            const tx = await contract.connect(signer)[method](...args);
            return await tx.wait();
        }
    }, [signer, evmAddress, checkSponsorability]);

    const onAccountChange = useCallback((accounts: string[]) => {
        if (accounts.length > 0) setEvmAddress(accounts[0]);
        else disconnect();
    }, [disconnect]);

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
            if (typeof window !== "undefined" && (window as any).ethereum) {
                try {
                    const p = new ethers.BrowserProvider((window as any).ethereum);
                    const accounts = await p.send("eth_accounts", []);
                    if (accounts.length > 0) {
                        setEvmAddress(accounts[0]);
                        setProvider(p);
                        const s = await p.getSigner();
                        setSigner(s);
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
            evmAddress, connectEVM, disconnect,
            isConnecting,
            isFullyConnected: !!evmAddress,
            provider, signer,
            isGasless, sendGaslessTransaction
        }}>
            {children}
        </WalletContext.Provider>
    );
}

export const useWallet = () => useContext(WalletContext);
