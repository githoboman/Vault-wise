;; Mock sBTC - LOCAL TESTING ONLY. Uses define-fungible-token so
;; Clarity 4 as-contract? (with-ft ...) resolves correctly.
(define-fungible-token sbtc)

(define-public (transfer
  (amount uint) (sender principal) (recipient principal)
  (memo (optional (buff 34))))
  (begin
    (asserts! (is-eq tx-sender sender) (err u1))
    (ft-transfer? sbtc amount sender recipient)
  )
)

(define-read-only (get-balance (owner principal))
  (ok (ft-get-balance sbtc owner))
)

(define-read-only (get-name)         (ok "Mock sBTC"))
(define-read-only (get-symbol)       (ok "msBTC"))
(define-read-only (get-decimals)     (ok u8))
(define-read-only (get-total-supply) (ok (ft-get-supply sbtc)))
(define-read-only (get-token-uri)    (ok none))

;; Test helper: give any wallet a starting balance
(define-public (mint (amount uint) (recipient principal))
  (ft-mint? sbtc amount recipient)
)
