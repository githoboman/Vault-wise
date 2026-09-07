// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

interface IBitCreditUSC {
    function nonceToTokenId(uint256) external view returns (uint256);
    function activeCreditLine(address) external view returns (uint256);
}

contract BTCCollateralVault is Ownable {
    IERC20 public immutable btcToken;

    address public authorizedRelayer;

    uint256 public constant LOCK_EXPIRY_BLOCKS = 25920;

    uint256 public nonceCounter;

    struct Vault {
        uint256 amount;
        uint256 nonce;
        uint256 lockedAtBlock;
        uint256 expiryBlock;
        bool   released;
        bool   creditActive;
    }

    mapping(address => Vault) public vaults;
    mapping(uint256 => address) public nonceToOwner;

    event CollateralLocked(address indexed owner, uint256 amount, uint256 nonce, uint256 lockedAtBlock, uint256 expiryBlock);
    event CreditLineActivated(uint256 nonce, address indexed owner);
    event CollateralReleased(address indexed owner, uint256 amount, uint256 nonce);
    event RelayerUpdated(address indexed oldRelayer, address indexed newRelayer);

    constructor(address _btcToken, address _initialRelayer) {
        require(_btcToken != address(0), "BTCCollateralVault: zero BTC token");
        btcToken = IERC20(_btcToken);
        authorizedRelayer = _initialRelayer;
    }

    modifier onlyRelayer() {
        require(msg.sender == authorizedRelayer, "BTCCollateralVault: caller is not the relayer");
        _;
    }

    function lockCollateral(uint256 amount) external returns (uint256 nonce) {
        require(amount > 0, "BTCCollateralVault: amount must be > 0");

        Vault storage existing = vaults[msg.sender];
        require(
            existing.amount == 0 || existing.released,
            "BTCCollateralVault: vault already locked"
        );

        require(btcToken.transferFrom(msg.sender, address(this), amount), "BTCCollateralVault: transfer failed");

        nonce = ++nonceCounter;
        uint256 expiry = block.number + LOCK_EXPIRY_BLOCKS;

        vaults[msg.sender] = Vault({
            amount: amount,
            nonce: nonce,
            lockedAtBlock: block.number,
            expiryBlock: expiry,
            released: false,
            creditActive: false
        });

        nonceToOwner[nonce] = msg.sender;

        emit CollateralLocked(msg.sender, amount, nonce, block.number, expiry);
    }

    function markCreditActive(uint256 targetNonce) external onlyRelayer {
        address owner = nonceToOwner[targetNonce];
        require(owner != address(0), "BTCCollateralVault: vault not found");

        Vault storage vault = vaults[owner];
        require(vault.nonce == targetNonce, "BTCCollateralVault: nonce mismatch");
        require(!vault.creditActive, "BTCCollateralVault: credit already active");

        vault.creditActive = true;

        emit CreditLineActivated(targetNonce, owner);
    }

    function releaseCollateral(address targetOwner) external returns (uint256 amount) {
        Vault storage vault = vaults[targetOwner];
        require(vault.amount > 0, "BTCCollateralVault: vault not found");
        require(!vault.released, "BTCCollateralVault: already released");

        bool isRelayer = msg.sender == authorizedRelayer;
        bool isOwnerAndExpired = msg.sender == targetOwner && block.number >= vault.expiryBlock;

        require(isRelayer || isOwnerAndExpired, "BTCCollateralVault: not authorized");

        amount = vault.amount;

        vault.released = true;
        vault.creditActive = false;

        require(btcToken.transfer(targetOwner, amount), "BTCCollateralVault: release transfer failed");

        emit CollateralReleased(targetOwner, amount, vault.nonce);
    }

    function isExpired(address owner) external view returns (bool) {
        Vault storage vault = vaults[owner];
        if (vault.amount == 0) return false;
        return block.number >= vault.expiryBlock;
    }

    function setRelayer(address newRelayer) external onlyOwner {
        require(newRelayer != address(0), "BTCCollateralVault: zero address");
        address oldRelayer = authorizedRelayer;
        authorizedRelayer = newRelayer;
        emit RelayerUpdated(oldRelayer, newRelayer);
    }

    function emergencyWithdrawBTC(uint256 amount) external onlyOwner {
        require(btcToken.transfer(msg.sender, amount), "BTCCollateralVault: withdraw failed");
    }
}
