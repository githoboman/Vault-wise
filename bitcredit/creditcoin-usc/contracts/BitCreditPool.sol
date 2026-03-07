// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

interface IBitCreditUSC {
    struct CreditLine {
        address borrower;
        string stacksOwner;
        uint256 collateralSats;
        uint256 stacksNonce;
        uint256 creditPowerUSD;
        uint256 issuedAt;
        bool active;
        uint256 loansDisbursed;
        uint256 totalRepaidCents;
    }

    function getActiveCreditLine(address borrower) external view returns (CreditLine memory);
    function activeCreditLine(address borrower) external view returns (uint256);
    function recordDisbursement(uint256 tokenId, uint256 amountUSD, string calldata borrowerRef) external;
    function recordRepayment(uint256 tokenId, uint256 amountUSDCents) external;
    function closeCreditLine(uint256 tokenId) external;
}

contract BitCreditPool is ReentrancyGuard, Ownable {
    IERC20 public immutable usdc;
    IBitCreditUSC public immutable bitCreditUSC;

    uint256 public constant USDC_DECIMALS = 1e18; // Our mock USDC

    struct Loan {
        uint256 amountBorrowedUSD;   // In whole USD
        uint256 amountRepaidCents;   // In Cents
    }

    // tokenId => Loan state
    mapping(uint256 => Loan) public loans;

    event Borrowed(address indexed borrower, uint256 tokenId, uint256 amountUSD);
    event Repaid(address indexed borrower, uint256 tokenId, uint256 amountUSDCents);
    event CreditLineClosed(address indexed borrower, uint256 tokenId);

    constructor(address _usdc, address _bitCreditUSC) {
        require(_usdc != address(0) && _bitCreditUSC != address(0), "Zero address");
        usdc = IERC20(_usdc);
        bitCreditUSC = IBitCreditUSC(_bitCreditUSC);
    }

    // Admin function to fund or withdraw from the pool
    function withdrawTreasury(uint256 amount, address to) external onlyOwner {
        require(usdc.transfer(to, amount), "Transfer failed");
    }

    function getLoan(uint256 tokenId) external view returns (Loan memory) {
        return loans[tokenId];
    }

    /**
     * @dev User borrows USDC against their active Credit Power NFT limit.
     * @param amountUSD The WHOLE DOLLAR amount the user wants to borrow (e.g., 20)
     */
    function borrow(uint256 amountUSD) external nonReentrant {
        require(amountUSD > 0, "Amount must be > 0");

        // 1. Get the borrower's active credit line
        IBitCreditUSC.CreditLine memory cl;
        uint256 tokenId;
        try bitCreditUSC.activeCreditLine(msg.sender) returns (uint256 _tid) {
            require(_tid != 0, "No active credit line");
            tokenId = _tid;
            cl = bitCreditUSC.getActiveCreditLine(msg.sender);
        } catch {
            revert("Missing credit line");
        }

        require(cl.active, "Credit line is not active");

        // 2. Check limits
        Loan storage userLoan = loans[tokenId];
        uint256 newTotal = userLoan.amountBorrowedUSD + amountUSD;
        // The creditPowerUSD is already in whole dollars in BitCreditUSC
        require(newTotal <= cl.creditPowerUSD, "Exceeds credit limit");

        // 3. Update state
        userLoan.amountBorrowedUSD = newTotal;

        // 4. Record on the NFT (Requires this Pool to be an "Attestor" on BitCreditUSC)
        bitCreditUSC.recordDisbursement(tokenId, amountUSD, "BitCreditPool");

        // 5. Transfer to user (mUSDC has 18 decimals)
        require(usdc.transfer(msg.sender, amountUSD * USDC_DECIMALS), "USDC transfer failed");

        emit Borrowed(msg.sender, tokenId, amountUSD);
    }

    /**
     * @dev User repays USDC to free up their limit and build credit score.
     * @param amountUSD The WHOLE DOLLAR amount to repay (simplified for this V1).
     */
    function repay(uint256 amountUSD) external nonReentrant {
        require(amountUSD > 0, "Amount must be > 0");

        uint256 tokenId = bitCreditUSC.activeCreditLine(msg.sender);
        require(tokenId != 0, "No active loan");

        Loan storage userLoan = loans[tokenId];
        require(userLoan.amountBorrowedUSD > 0, "No outstanding debt");

        // Adjust constraints: can't overpay principal for simplicity in V1
        uint256 actualRepayUSD = amountUSD;
        if (amountUSD > userLoan.amountBorrowedUSD) {
            actualRepayUSD = userLoan.amountBorrowedUSD;
        }

        uint256 actualRepayCents = actualRepayUSD * 100;

        // Update state
        userLoan.amountBorrowedUSD -= actualRepayUSD;
        userLoan.amountRepaidCents += actualRepayCents;

        // Record repayment on NFT to boost Credit Score
        bitCreditUSC.recordRepayment(tokenId, actualRepayCents);

        // Transfer funds from user back to this Pool Treasury
        require(usdc.transferFrom(msg.sender, address(this), actualRepayUSD * USDC_DECIMALS), "USDC TransferFrom failed");

        emit Repaid(msg.sender, tokenId, actualRepayCents);
    }

    /**
     * @dev User closes their EVM credit line, which kicks off the Stacks cross-chain collateral release.
     */
    function closeCreditLine() external nonReentrant {
        uint256 tokenId = bitCreditUSC.activeCreditLine(msg.sender);
        require(tokenId != 0, "No active credit line");

        Loan storage userLoan = loans[tokenId];
        require(userLoan.amountBorrowedUSD == 0, "Must repay all debt to close");

        // Call the parent BitCreditUSC contract to burn the NFT
        bitCreditUSC.closeCreditLine(tokenId);

        emit CreditLineClosed(msg.sender, tokenId);
    }
}
