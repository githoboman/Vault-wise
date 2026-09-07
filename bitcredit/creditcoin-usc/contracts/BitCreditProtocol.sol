// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract BitCreditProtocol is ReentrancyGuard, Ownable {
    IERC20 public immutable btcToken; // Collateral (e.g. Wrapped BTC with 8 decimals)
    IERC20 public immutable usdcToken; // Borrowed asset (USDC with 18 decimals)

    uint256 public constant BTC_DECIMALS = 1e8;
    uint256 public constant USDC_DECIMALS = 1e18;
    
    // Dynamic BTC Price in USD
    uint256 public btcPriceUSD;
    
    // Protocol Revenue Tracking
    uint256 public totalProtocolFeesCollected;
    uint256 public constant ORIGINATION_FEE_BPS = 100; // 100 basis points = 1%

    // LTV Ratio: 70% (expressed as out of 100)
    uint256 public constant MAX_LTV = 70;

    struct UserState {
        uint256 collateralSats;       // Deposited BTC in satoshis (8 decimals)
        uint256 amountBorrowedUSD;    // Borrowed USDC in whole dollars (Principal)
        uint256 amountRepaidCents;    // Total repaid in cents (used for credit score)
        uint256 creditScore;          // On-chain credit score
    }

    mapping(address => UserState) public users;

    event CollateralDeposited(address indexed user, uint256 amountSats);
    event CollateralWithdrawn(address indexed user, uint256 amountSats);
    event Borrowed(address indexed user, uint256 amountUSD, uint256 feeUSD);
    event Repaid(address indexed user, uint256 amountUSDCents, uint256 newCreditScore);
    event PriceUpdated(uint256 newPrice);
    event FeesWithdrawn(uint256 amount);

    constructor(address _btcToken, address _usdcToken, uint256 _initialBtcPrice) {
        require(_btcToken != address(0) && _usdcToken != address(0), "Zero address");
        btcToken = IERC20(_btcToken);
        usdcToken = IERC20(_usdcToken);
        btcPriceUSD = _initialBtcPrice;
    }

    // Admin function to update the live BTC price (In production, replace with Oracle)
    function updateBTCPrice(uint256 _newPrice) external onlyOwner {
        require(_newPrice > 0, "Invalid price");
        btcPriceUSD = _newPrice;
        emit PriceUpdated(_newPrice);
    }

    // Admin function to withdraw accumulated protocol revenue
    function withdrawFees() external onlyOwner {
        uint256 amountToWithdraw = totalProtocolFeesCollected;
        require(amountToWithdraw > 0, "No fees to withdraw");
        totalProtocolFeesCollected = 0;
        require(usdcToken.transfer(msg.sender, amountToWithdraw * USDC_DECIMALS), "Fee withdraw failed");
        emit FeesWithdrawn(amountToWithdraw);
    }

    // Admin function to fund the pool with USDC for borrowing
    function fundTreasury(uint256 amount) external onlyOwner {
        require(usdcToken.transferFrom(msg.sender, address(this), amount), "Fund failed");
    }

    // Admin function to withdraw from the treasury (not affecting collected fees)
    function withdrawTreasury(uint256 amount) external onlyOwner {
        require(usdcToken.transfer(msg.sender, amount), "Withdraw failed");
    }

    function calculateCreditPower(uint256 collateralSats) public view returns (uint256) {
        // collateralSats is 8 decimals
        uint256 totalValueUSD = (collateralSats * btcPriceUSD) / BTC_DECIMALS;
        return (totalValueUSD * MAX_LTV) / 100;
    }

    function getUserState(address user) external view returns (UserState memory, uint256 availableCreditUSD) {
        UserState memory state = users[user];
        uint256 maxCredit = calculateCreditPower(state.collateralSats);
        availableCreditUSD = 0;
        if (maxCredit > state.amountBorrowedUSD) {
            availableCreditUSD = maxCredit - state.amountBorrowedUSD;
        }
        return (state, availableCreditUSD);
    }

    function depositCollateral(uint256 amountSats) external nonReentrant {
        require(amountSats > 0, "Amount must be > 0");
        require(btcToken.transferFrom(msg.sender, address(this), amountSats), "Transfer failed");

        users[msg.sender].collateralSats += amountSats;
        
        // Initialize credit score to 300 if it's a new user
        if (users[msg.sender].creditScore == 0) {
            users[msg.sender].creditScore = 300;
        }

        emit CollateralDeposited(msg.sender, amountSats);
    }

    function withdrawCollateral(uint256 amountSats) external nonReentrant {
        require(amountSats > 0, "Amount must be > 0");
        UserState storage user = users[msg.sender];
        require(user.collateralSats >= amountSats, "Insufficient collateral");

        uint256 newCollateral = user.collateralSats - amountSats;
        uint256 newMaxCredit = calculateCreditPower(newCollateral);
        require(newMaxCredit >= user.amountBorrowedUSD, "Withdrawal would undercollateralize loan");

        user.collateralSats = newCollateral;
        require(btcToken.transfer(msg.sender, amountSats), "Transfer failed");

        emit CollateralWithdrawn(msg.sender, amountSats);
    }

    function borrow(uint256 amountUSD) external nonReentrant {
        require(amountUSD > 0, "Amount must be > 0");
        UserState storage user = users[msg.sender];
        
        uint256 maxCredit = calculateCreditPower(user.collateralSats);
        uint256 newTotal = user.amountBorrowedUSD + amountUSD;
        require(newTotal <= maxCredit, "Exceeds credit limit");

        // Calculate 1% Origination Fee
        uint256 feeUSD = (amountUSD * ORIGINATION_FEE_BPS) / 10000;
        uint256 netAmountUSD = amountUSD - feeUSD;
        
        // Add fee to protocol revenue tracker
        totalProtocolFeesCollected += feeUSD;
        
        // Update user debt (they owe the principal including the fee)
        user.amountBorrowedUSD = newTotal;
        
        // Transfer the net amount to the user
        require(usdcToken.transfer(msg.sender, netAmountUSD * USDC_DECIMALS), "USDC transfer failed");

        emit Borrowed(msg.sender, amountUSD, feeUSD);
    }

    function repay(uint256 amountUSD) external nonReentrant {
        require(amountUSD > 0, "Amount must be > 0");
        UserState storage user = users[msg.sender];
        require(user.amountBorrowedUSD > 0, "No outstanding debt");

        uint256 actualRepayUSD = amountUSD > user.amountBorrowedUSD ? user.amountBorrowedUSD : amountUSD;
        uint256 actualRepayCents = actualRepayUSD * 100;

        user.amountBorrowedUSD -= actualRepayUSD;
        user.amountRepaidCents += actualRepayCents;

        // Simple credit score gamification: +1 point per $1 repaid, max 850
        uint256 scoreIncrease = actualRepayUSD;
        if (user.creditScore + scoreIncrease > 850) {
            user.creditScore = 850;
        } else {
            user.creditScore += scoreIncrease;
        }

        require(usdcToken.transferFrom(msg.sender, address(this), actualRepayUSD * USDC_DECIMALS), "USDC Transfer failed");

        emit Repaid(msg.sender, actualRepayCents, user.creditScore);
    }
}
