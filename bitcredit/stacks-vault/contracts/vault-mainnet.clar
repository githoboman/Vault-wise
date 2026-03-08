;; ============================================================
;; BitCredit: Collateral Vault - Clarity 4 (Testnet/Mainnet)
;; vault-mainnet.clar
;; ============================================================

(define-constant CONTRACT-OWNER tx-sender)

(define-constant ERR-NOT-OWNER        (err u100))
(define-constant ERR-ZERO-AMOUNT      (err u101))
(define-constant ERR-VAULT-NOT-FOUND  (err u102))
(define-constant ERR-ALREADY-LOCKED   (err u103))
(define-constant ERR-LOCK-ACTIVE      (err u104))
(define-constant ERR-NOT-AUTHORIZED   (err u105))
(define-constant ERR-RELEASE-FAILED   (err u106))

;; ~6 months duration (10 min/block)
(define-constant LOCK-EXPIRY-BLOCKS u25920)

;; SBTC-CONTRACT is inlined below

;; --- State ---

(define-data-var nonce-counter uint u0)
(define-data-var authorized-relayer principal CONTRACT-OWNER)

(define-map vaults
  { owner: principal }
  {
    amount:          uint,
    nonce:           uint,
    locked-at:       uint,
    expiry-time:     uint,
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

(define-read-only (get-owner-by-nonce (nonce uint))
  (map-get? nonce-to-owner { nonce: nonce })
)

(define-read-only (is-expired (owner principal))
  (match (map-get? vaults { owner: owner })
    v (>= block-height (get expiry-time v))
    false
  )
)

;; --- Public Functions ---

(define-public (lock-collateral (amount uint))
  (let
    (
      (caller tx-sender)
      (nonce (+ (var-get nonce-counter) u1))
      (expiry (+ block-height LOCK-EXPIRY-BLOCKS))
      (existing-vault (get-vault caller))
      (contract-principal (as-contract tx-sender))
    )
    (asserts! (> amount u0) ERR-ZERO-AMOUNT)
    ;; Allow re-locking if No vault exists OR if the existing one is fully released
    (asserts! (or (is-none existing-vault) (get released (unwrap-panic existing-vault))) ERR-ALREADY-LOCKED)

    ;; Transfer sBTC from user to this contract
    (try! (contract-call? 'ST9NSDHK5969YF6WJ2MRCVVAVTDENWBNTFJRVZ3E.mock-sbtc-token transfer
      amount caller contract-principal none))

    ;; Update state
    (map-set vaults
      { owner: caller }
      {
        amount: amount,
        nonce: nonce,
        locked-at: block-height,
        expiry-time: expiry,
        released: false,
        credit-active: false
      }
    )
    (map-set nonce-to-owner { nonce: nonce } { owner: caller })
    (var-set nonce-counter nonce)

    (print {
      event: "CollateralLocked",
      owner: caller,
      amount: amount,
      nonce: nonce,
      locked-at: block-height,
      expiry-time: expiry
    })
    (ok nonce)
  )
)

(define-public (mark-credit-active (nonce uint))
  (let
    (
      (owner (unwrap! (get owner (map-get? nonce-to-owner { nonce: nonce })) ERR-VAULT-NOT-FOUND))
      (vault (unwrap! (map-get? vaults { owner: owner }) ERR-VAULT-NOT-FOUND))
    )
    ;; Only authorized relayer can call
    (asserts! (is-eq tx-sender (var-get authorized-relayer)) ERR-NOT-AUTHORIZED)
    (asserts! (not (get released vault)) ERR-NOT-AUTHORIZED)

    (map-set vaults
      { owner: owner }
      (merge vault { credit-active: true })
    )

    (print {
      event: "CreditLineActivated",
      owner: owner,
      nonce: nonce
    })
    (ok true)
  )
)

(define-public (release-collateral (target-owner principal))
  (let
    (
      (vault (unwrap! (map-get? vaults { owner: target-owner }) ERR-VAULT-NOT-FOUND))
      (amount (get amount vault))
      (nonce (get nonce vault))
      (expiry (get expiry-time vault))
      (is-relayer (is-eq tx-sender (var-get authorized-relayer)))
      (is-expired-bool (>= block-height expiry))
      (contract-principal (as-contract tx-sender))
    )
    ;; Relayer can release anytime; owner can only release after expiry
    (asserts! (or is-relayer (and (is-eq tx-sender target-owner) is-expired-bool)) ERR-LOCK-ACTIVE)
    (asserts! (not (get released vault)) ERR-NOT-AUTHORIZED)

    ;; Transfer sBTC back to owner
    (try! (as-contract
      (contract-call? 'ST9NSDHK5969YF6WJ2MRCVVAVTDENWBNTFJRVZ3E.mock-sbtc-token transfer
        amount contract-principal target-owner none)))

    ;; Mark as released
    (map-set vaults
      { owner: target-owner }
      (merge vault { released: true, credit-active: false })
    )

    (print {
      event: "CollateralReleased",
      owner: target-owner,
      amount: amount,
      nonce: nonce
    })
    (ok amount)
  )
)

;; --- Admin ---

(define-public (set-relayer (new-relayer principal))
  (begin
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-NOT-OWNER)
    (var-set authorized-relayer new-relayer)
    (ok true)
  )
)
