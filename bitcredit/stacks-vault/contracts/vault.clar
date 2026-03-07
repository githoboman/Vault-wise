;; ============================================================
;; BitCredit: Collateral Vault - Clarity 3
;; vault.clar
;;
;; Downgraded from Clarity 4 to Clarity 3 because the
;; clarinet-sdk WASM only supports simnet up to Clarity 3.
;;
;; Clarity 4 features removed:
;;   - current-contract     -> replaced with (as-contract tx-sender)
;;   - as-contract? with-ft -> replaced with plain as-contract
;;   - stacks-block-time    -> replaced with burn-block-height
;;
;; The Clarity 4 versions of all three are still used on testnet
;; and mainnet where epoch 3.1 is active. This file is for
;; local testing only. Keep a separate vault-mainnet.clar with
;; the Clarity 4 version for deployment.
;; ============================================================

(define-constant CONTRACT-OWNER tx-sender)

(define-constant ERR-NOT-OWNER        (err u100))
(define-constant ERR-ZERO-AMOUNT      (err u101))
(define-constant ERR-VAULT-NOT-FOUND  (err u102))
(define-constant ERR-ALREADY-LOCKED   (err u103))
(define-constant ERR-LOCK-ACTIVE      (err u104))
(define-constant ERR-NOT-AUTHORIZED   (err u105))
(define-constant ERR-RELEASE-FAILED   (err u106))

;; ~6 months at 10 min/block = 25920 blocks
(define-constant LOCK-EXPIRY-BLOCKS u25920)

(define-constant SBTC-CONTRACT .mock-sbtc-token)

;; --- State ---

(define-data-var nonce-counter uint u0)
(define-data-var authorized-relayer principal CONTRACT-OWNER)

(define-map vaults
  { owner: principal }
  {
    amount:          uint,
    nonce:           uint,
    locked-at-block: uint,
    expiry-block:    uint,
    released:        bool,
    credit-active:   bool
  }
)

(define-map nonce-to-owner
  { nonce: uint }
  { owner: principal }
)

;; --- Read-Only ---

(define-read-only (get-vault (owner principal))
  (map-get? vaults { owner: owner })
)

(define-read-only (get-owner-by-nonce (n uint))
  (map-get? nonce-to-owner { nonce: n })
)

(define-read-only (get-nonce-counter)
  (var-get nonce-counter)
)

(define-read-only (get-relayer)
  (var-get authorized-relayer)
)

(define-read-only (is-expired (owner principal))
  (match (map-get? vaults { owner: owner })
    vault (>= burn-block-height (get expiry-block vault))
    false
  )
)

;; --- Public ---

(define-public (lock-collateral (amount uint))
  (let
    (
      (caller    tx-sender)
      (new-nonce (+ (var-get nonce-counter) u1))
      (now       burn-block-height)
      (expiry    (+ now LOCK-EXPIRY-BLOCKS))
    )
    (asserts! (> amount u0) ERR-ZERO-AMOUNT)
    (asserts! (is-none (map-get? vaults { owner: caller })) ERR-ALREADY-LOCKED)

    (try! (contract-call? .mock-sbtc-token transfer
      amount caller (as-contract tx-sender) none))

    (var-set nonce-counter new-nonce)

    (map-set vaults { owner: caller }
      {
        amount:          amount,
        nonce:           new-nonce,
        locked-at-block: now,
        expiry-block:    expiry,
        released:        false,
        credit-active:   false
      }
    )

    (map-set nonce-to-owner { nonce: new-nonce } { owner: caller })

    (print {
      event:           "CollateralLocked",
      owner:           caller,
      amount:          amount,
      nonce:           new-nonce,
      locked-at-block: now,
      expiry-block:    expiry
    })

    (ok new-nonce)
  )
)

(define-public (mark-credit-active (target-nonce uint))
  (let
    (
      (owner-record
        (unwrap! (map-get? nonce-to-owner { nonce: target-nonce })
          ERR-VAULT-NOT-FOUND))
      (owner (get owner owner-record))
      (vault
        (unwrap! (map-get? vaults { owner: owner })
          ERR-VAULT-NOT-FOUND))
    )
    (asserts! (is-eq tx-sender (var-get authorized-relayer)) ERR-NOT-AUTHORIZED)
    (asserts! (not (get released vault)) ERR-NOT-AUTHORIZED)

    (map-set vaults { owner: owner }
      (merge vault { credit-active: true })
    )

    (print {
      event: "CreditLineActivated",
      owner: owner,
      nonce: target-nonce
    })

    (ok true)
  )
)

(define-public (release-collateral (target-owner principal))
  (let
    (
      (caller tx-sender)
      (vault
        (unwrap! (map-get? vaults { owner: target-owner })
          ERR-VAULT-NOT-FOUND))
      (amount (get amount vault))
    )
    (asserts! (not (get released vault)) ERR-NOT-AUTHORIZED)
    (asserts!
      (or
        (is-eq caller (var-get authorized-relayer))
        (and
          (is-eq caller target-owner)
          (>= burn-block-height (get expiry-block vault))
        )
      )
      ERR-LOCK-ACTIVE
    )

    (try! (as-contract
      (contract-call? .mock-sbtc-token transfer
        amount (as-contract tx-sender) target-owner none)))

    (map-set vaults { owner: target-owner }
      (merge vault { released: true, credit-active: false })
    )

    (print {
      event:  "CollateralReleased",
      owner:  target-owner,
      amount: amount,
      nonce:  (get nonce vault)
    })

    (ok amount)
  )
)

(define-public (set-relayer (new-relayer principal))
  (begin
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-NOT-OWNER)
    (var-set authorized-relayer new-relayer)
    (ok true)
  )
)
