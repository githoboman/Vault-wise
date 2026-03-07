import { expect } from "chai";
import { ethers } from "hardhat";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("BitCreditUSC", function () {
    let usc: any;
    let owner: SignerWithAddress, attestor: SignerWithAddress,
        borrower: SignerWithAddress, stranger: SignerWithAddress;

    const STACKS_OWNER = "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM";
    const COLLATERAL_SATS = 100_000;

    beforeEach(async function () {
        [owner, attestor, borrower, stranger] = await ethers.getSigners();
        const Factory = await ethers.getContractFactory("BitCreditUSC");
        usc = await Factory.deploy(attestor.address);
        await usc.waitForDeployment();
    });

    it("sets deployer as owner and registers initial attestor", async function () {
        expect(await usc.owner()).to.equal(owner.address);
        expect(await usc.attestors(attestor.address)).to.equal(true);
    });

    it("mints a credit line NFT and stores correct data", async function () {
        await usc.connect(attestor).attestAndIssueCreditLine(
            borrower.address, STACKS_OWNER, 1, COLLATERAL_SATS);
        expect(await usc.balanceOf(borrower.address)).to.equal(1);
        const cl = await usc.getCreditLine(1);
        expect(cl.borrower).to.equal(borrower.address);
        expect(cl.active).to.equal(true);
    });

    it("calculates credit power at 70% LTV", async function () {
        await usc.connect(attestor).attestAndIssueCreditLine(
            borrower.address, STACKS_OWNER, 1, COLLATERAL_SATS);
        const cl = await usc.getCreditLine(1);
        expect(cl.creditPowerUSD).to.equal(67);
    });

    it("rejects duplicate nonce", async function () {
        await usc.connect(attestor).attestAndIssueCreditLine(
            borrower.address, STACKS_OWNER, 1, COLLATERAL_SATS);
        await expect(usc.connect(attestor).attestAndIssueCreditLine(
            stranger.address, STACKS_OWNER, 1, COLLATERAL_SATS))
            .to.be.revertedWith("BitCreditUSC: nonce already used");
    });

    it("rejects second active credit line for same borrower", async function () {
        await usc.connect(attestor).attestAndIssueCreditLine(
            borrower.address, STACKS_OWNER, 1, COLLATERAL_SATS);
        await expect(usc.connect(attestor).attestAndIssueCreditLine(
            borrower.address, STACKS_OWNER, 2, COLLATERAL_SATS))
            .to.be.revertedWith("BitCreditUSC: borrower already has active credit line");
    });

    it("rejects non-attestor calls", async function () {
        await expect(usc.connect(stranger).attestAndIssueCreditLine(
            borrower.address, STACKS_OWNER, 1, COLLATERAL_SATS))
            .to.be.revertedWith("BitCreditUSC: caller is not an attestor");
    });

    it("credit score starts at 300 and increases with repayments, capped at 850", async function () {
        await usc.connect(attestor).attestAndIssueCreditLine(
            borrower.address, STACKS_OWNER, 1, COLLATERAL_SATS);
        expect(await usc.getCreditScore(borrower.address)).to.equal(300);
        await usc.connect(attestor).recordRepayment(1, 10_000);
        expect(await usc.getCreditScore(borrower.address)).to.equal(301);
        await usc.connect(attestor).recordRepayment(1, 10_000_000);
        expect(await usc.getCreditScore(borrower.address)).to.equal(850);
    });

    it("closeCreditLine burns NFT and emits event", async function () {
        await usc.connect(attestor).attestAndIssueCreditLine(
            borrower.address, STACKS_OWNER, 1, COLLATERAL_SATS);
        await expect(usc.connect(attestor).closeCreditLine(1))
            .to.emit(usc, "CreditLineClosed").withArgs(1, borrower.address, 1);
        expect(await usc.balanceOf(borrower.address)).to.equal(0);
    });

    it("blocks NFT transfers (soulbound)", async function () {
        await usc.connect(attestor).attestAndIssueCreditLine(
            borrower.address, STACKS_OWNER, 1, COLLATERAL_SATS);
        await expect(usc.connect(borrower).transferFrom(
            borrower.address, stranger.address, 1))
            .to.be.revertedWith("BitCreditUSC: Credit Power NFT is non-transferable");
    });
});
