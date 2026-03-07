// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

contract BitCreditUSC is ERC721Enumerable, Ownable, ReentrancyGuard {
    using Counters for Counters.Counter;
    Counters.Counter private _tokenIds;

    mapping(address => bool)    public attestors;
    mapping(uint256 => uint256) public nonceToTokenId;
    mapping(address => uint256) public activeCreditLine;

    struct CreditLine {
        address borrower;
        string  stacksOwner;
        uint256 collateralSats;
        uint256 stacksNonce;
        uint256 creditPowerUSD;
        uint256 issuedAt;
        bool    active;
        uint256 loansDisbursed;
        uint256 totalRepaidCents;
    }

    mapping(uint256 => CreditLine) public creditLines;

    uint256 public constant LTV_NUM   = 700;
    uint256 public constant LTV_DENOM = 1000;
    uint256 public btcPriceUSD        = 97_000;

    event AttestorAdded(address indexed attestor);
    event AttestorRemoved(address indexed attestor);
    event CreditLineIssued(
        uint256 indexed tokenId, address indexed borrower,
        string stacksOwner, uint256 stacksNonce,
        uint256 collateralSats, uint256 creditPowerUSD
    );
    event LoanDisbursed(uint256 indexed tokenId, uint256 amountUSD, string borrowerRef);
    event LoanRepaid(uint256 indexed tokenId, uint256 amountUSDCents);
    event CreditLineClosed(uint256 indexed tokenId, address indexed borrower, uint256 stacksNonce);
    event BtcPriceUpdated(uint256 newPriceUSD);

    modifier onlyAttestor() {
        require(attestors[msg.sender], "BitCreditUSC: caller is not an attestor");
        _;
    }

    constructor(address initialAttestor) ERC721("BitCredit Power", "BCPWR") {
        require(initialAttestor != address(0), "BitCreditUSC: zero attestor address");
        attestors[initialAttestor] = true;
        emit AttestorAdded(initialAttestor);
    }

    function attestAndIssueCreditLine(
        address borrower, string calldata stacksOwner,
        uint256 stacksNonce, uint256 collateralSats
    ) external onlyAttestor nonReentrant returns (uint256 tokenId) {
        require(borrower != address(0),           "BitCreditUSC: zero borrower address");
        require(collateralSats > 0,               "BitCreditUSC: collateral must be non-zero");
        require(nonceToTokenId[stacksNonce] == 0, "BitCreditUSC: nonce already used");
        require(activeCreditLine[borrower] == 0,  "BitCreditUSC: borrower already has active credit line");

        uint256 creditPowerUSD = (collateralSats * btcPriceUSD * LTV_NUM) / (1e8 * LTV_DENOM);

        _tokenIds.increment();
        tokenId = _tokenIds.current();
        _safeMint(borrower, tokenId);

        creditLines[tokenId] = CreditLine({
            borrower: borrower, stacksOwner: stacksOwner,
            collateralSats: collateralSats, stacksNonce: stacksNonce,
            creditPowerUSD: creditPowerUSD, issuedAt: block.timestamp,
            active: true, loansDisbursed: 0, totalRepaidCents: 0
        });

        nonceToTokenId[stacksNonce] = tokenId;
        activeCreditLine[borrower]  = tokenId;

        emit CreditLineIssued(tokenId, borrower, stacksOwner, stacksNonce, collateralSats, creditPowerUSD);
    }

    function recordDisbursement(uint256 tokenId, uint256 amountUSD, string calldata borrowerRef)
        external onlyAttestor
    {
        require(creditLines[tokenId].active, "BitCreditUSC: credit line not active");
        creditLines[tokenId].loansDisbursed += 1;
        emit LoanDisbursed(tokenId, amountUSD, borrowerRef);
    }

    function recordRepayment(uint256 tokenId, uint256 amountUSDCents) external onlyAttestor {
        require(creditLines[tokenId].active, "BitCreditUSC: credit line not active");
        creditLines[tokenId].totalRepaidCents += amountUSDCents;
        emit LoanRepaid(tokenId, amountUSDCents);
    }

    function closeCreditLine(uint256 tokenId) external onlyAttestor {
        CreditLine storage cl = creditLines[tokenId];
        require(cl.active, "BitCreditUSC: credit line already closed");
        uint256 nonce    = cl.stacksNonce;
        address borrower = cl.borrower;
        cl.active                  = false;
        activeCreditLine[borrower] = 0;
        _burn(tokenId);
        emit CreditLineClosed(tokenId, borrower, nonce);
    }

    function getCreditLine(uint256 tokenId) external view returns (CreditLine memory) {
        return creditLines[tokenId];
    }

    function getActiveCreditLine(address borrower) external view returns (CreditLine memory) {
        uint256 tid = activeCreditLine[borrower];
        require(tid != 0, "BitCreditUSC: no active credit line");
        return creditLines[tid];
    }

    function getCreditScore(address borrower) external view returns (uint256) {
        uint256 tid = activeCreditLine[borrower];
        if (tid == 0) return 300;
        uint256 units = creditLines[tid].totalRepaidCents / 10_000;
        uint256 bonus = units > 550 ? 550 : units;
        return 300 + bonus;
    }

    function addAttestor(address a) external onlyOwner {
        require(a != address(0), "BitCreditUSC: zero address");
        attestors[a] = true;
        emit AttestorAdded(a);
    }

    function removeAttestor(address a) external onlyOwner {
        attestors[a] = false;
        emit AttestorRemoved(a);
    }

    function updateBtcPrice(uint256 newPriceUSD) external onlyAttestor {
        require(newPriceUSD > 0, "BitCreditUSC: price must be non-zero");
        btcPriceUSD = newPriceUSD;
        emit BtcPriceUpdated(newPriceUSD);
    }

    function _beforeTokenTransfer(
        address from, address to, uint256 tokenId, uint256 batchSize
    ) internal override {
        require(from == address(0) || to == address(0),
            "BitCreditUSC: Credit Power NFT is non-transferable");
        super._beforeTokenTransfer(from, to, tokenId, batchSize);
    }
}
