(define-constant CONTRACT-OWNER tx-sender)
(define-constant ERR-NOT-OWNER        (err u100))
(define-constant ERR-ZERO-AMOUNT      (err u101))
(define-constant ERR-VAULT-NOT-FOUND  (err u102))
(define-constant ERR-ALREADY-LOCKED   (err u103))
(define-constant ERR-LOCK-ACTIVE      (err u104))
(define-constant ERR-NOT-AUTHORIZED   (err u105))
(define-constant ERR-RELEASE-FAILED   (err u106))
(define-constant LOCK-EXPIRY-SECONDS u15552000)
(define-constant SBTC-CONTRACT 'ST9NSDHK5969YF6WJ2MRCVVAVTDENWBNTFJRVZ3E.mock-sbtc-token)
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
(define-read-only (get-vault (owner principal))
  (map-get? vaults { owner: owner })
)
(define-read-only (get-owner-by-nonce (nonce uint))
  (map-get? nonce-to-owner { nonce: nonce })
)
(define-read-only (is-expired (owner principal))
  (match (map-get? vaults { owner: owner })
    v (>= stacks-block-time (get expiry-time v))
    false
  )
)
(define-public (lock-collateral (amount uint))
  (let
    (
      (caller tx-sender)
      (nonce (+ (var-get nonce-counter) u1))
      (expiry (+ stacks-block-time LOCK-EXPIRY-SECONDS))
    )
    (asserts! (> amount u0) ERR-ZERO-AMOUNT)
    (asserts! (is-none (get-vault caller)) ERR-ALREADY-LOCKED)
    (try! (contract-call? SBTC-CONTRACT transfer
      amount caller current-contract none))
    (map-set vaults
      { owner: caller }
      {
        amount: amount,
        nonce: nonce,
        locked-at: stacks-block-time,
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
      locked-at: stacks-block-time,
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
      (is-expired-bool (>= stacks-block-time expiry))
    )
    (asserts! (or is-relayer (and (is-eq tx-sender target-owner) is-expired-bool)) ERR-LOCK-ACTIVE)
    (asserts! (not (get released vault)) ERR-NOT-AUTHORIZED)
    (try! (as-contract?
      (with-ft SBTC-CONTRACT sbtc amount)
      (contract-call? SBTC-CONTRACT transfer
        amount current-contract target-owner none)))
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
(define-public (set-relayer (new-relayer principal))
  (begin
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-NOT-OWNER)
    (var-set authorized-relayer new-relayer)
    (ok true)
  )
)