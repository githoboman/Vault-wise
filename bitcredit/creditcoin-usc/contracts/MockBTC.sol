// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract MockBTC is ERC20, Ownable {
    uint256 public constant DECIMALS = 8;
    mapping(address => uint256) public lastClaim;

    constructor() ERC20("Mock BTC", "mBTC") {}

    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }

    function testnetDrip(address to) external {
        uint256 claimInterval = 1 hours;
        require(block.timestamp - lastClaim[to] >= claimInterval, "MockBTC: claim cooldown");
        uint256 amount = 1_000_000; // 0.01 mBTC (8 decimals)
        lastClaim[to] = block.timestamp;
        _mint(to, amount);
    }
}
