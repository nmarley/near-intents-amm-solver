# Dash → NEAR Intents POC Architecture

## Overview

This document outlines the complete architecture for integrating Dash with NEAR Intents protocol, replicating the successful Litecoin (LTC) integration model.

## Complete System Architecture

```
┌─────────────────┐
│   Dash User     │ Wants to swap DASH → USDT
└────────┬────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────┐
│              NEAR Intents Frontend                       │
│  (User expresses intent: "Swap 10 DASH for USDT")      │
└────────┬────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────┐
│            Solver Relay Server                          │
│  wss://solver-relay-v2.chaindefuser.com/ws              │
│  - Broadcasts quote requests to all registered solvers  │
│  - Collects quotes from solvers                         │
│  - Routes best quote back to frontend                   │
└─────────┬───────────────────────────────────────────────┘
          │
          │ WebSocket Quote Request
          ▼
┌─────────────────────────────────────────────────────────┐
│         YOUR AMM SOLVER (This Codebase)                 │
│  ┌───────────────────────────────────────────────┐     │
│  │ WebSocket Service                              │     │
│  │  - Listens for quote requests                 │     │
│  │  - Validates token pair matches config        │     │
│  └──────────────┬─────────────────────────────────┘     │
│                 │                                        │
│                 ▼                                        │
│  ┌───────────────────────────────────────────────┐     │
│  │ Quoter Service (AMM Math)                     │     │
│  │  1. Fetch reserves from NEAR Intents contract │     │
│  │  2. Calculate swap quote:                     │     │
│  │     AmountOut = (AmountIn × ReserveOut) /     │     │
│  │                 (ReserveIn + AmountIn)        │     │
│  │  3. Apply margin (0.3% fee)                   │     │
│  │  4. Sign quote with NEP-413                   │     │
│  └──────────────┬─────────────────────────────────┘     │
│                 │                                        │
│                 ▼                                        │
│  ┌───────────────────────────────────────────────┐     │
│  │ NEAR Service                                   │     │
│  │  - RPC connection to NEAR blockchain          │     │
│  │  - Signs transactions                          │     │
│  │  - Queries token balances                      │     │
│  └────────────────────────────────────────────────┘     │
│                                                          │
│  Config: AMM_TOKEN1_ID=wdash.near                       │
│          AMM_TOKEN2_ID=usdt.tether-token.near          │
└──────────────────┬───────────────────────────────────────┘
                   │
                   │ RPC Calls
                   ▼
┌─────────────────────────────────────────────────────────┐
│              NEAR Blockchain                             │
│                                                          │
│  ┌────────────────────────────────────────────────┐    │
│  │   Intents Contract (intents.near)              │    │
│  │   - Stores solver token reserves               │    │
│  │   - Executes swaps when user accepts quote     │    │
│  │   - Escrows user deposits                      │    │
│  └────────────────────────────────────────────────┘    │
│                                                          │
│  ┌────────────────────────────────────────────────┐    │
│  │   wDASH Token Contract (wdash.near)            │    │
│  │   - NEP-141 fungible token                     │    │
│  │   - Represents locked DASH from bridge         │    │
│  └────────────────────────────────────────────────┘    │
│                                                          │
│  ┌────────────────────────────────────────────────┐    │
│  │   USDT Token Contract (usdt.tether-token.near) │    │
│  │   - NEP-141 fungible token                     │    │
│  └────────────────────────────────────────────────┘    │
└──────────────────┬───────────────────────────────────────┘
                   │
                   │ Bridge Events
                   ▼
┌─────────────────────────────────────────────────────────┐
│              Dash ↔ NEAR Bridge                          │
│  - Monitors Dash blockchain for deposits                │
│  - Mints wDASH on NEAR when DASH locked                │
│  - Burns wDASH and releases DASH on withdrawals         │
│  - Maintains 1:1 peg between DASH and wDASH            │
└──────────────────┬───────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────┐
│              Dash Blockchain                             │
│  - User locks DASH in bridge contract                   │
│  - Bridge releases DASH when wDASH burned               │
└──────────────────────────────────────────────────────────┘
```

## Step-by-Step Flow: User Swaps DASH → USDT

### 1. User Initiates Intent

```
User: "I want to swap 10 DASH for USDT"
Frontend → Relay Server with quote request
```

### 2. Relay Broadcasts to Solvers

```javascript
{
  quote_id: "uuid-123",
  defuse_asset_identifier_in: "nep141:wdash.near",
  defuse_asset_identifier_out: "nep141:usdt.tether-token.near",
  exact_amount_in: "10000000000", // 10 DASH (8 decimals)
  min_deadline_ms: 300000 // 5 minutes
}
```

### 3. Your Solver Calculates Quote

```typescript
// Fetch current reserves from intents.near
const reserves = await intentsContract.mt_batch_balance_of({
  account_id: "your-solver.near",
  token_ids: ["nep141:wdash.near", "nep141:usdt.tether-token.near"]
});
// Example reserves: { wdash: 1000 DASH, usdt: 50000 USDT }

// Calculate output using constant product formula
// (10 × 50000) / (1000 + 10) = 495.05 USDT
const amountOut = getAmountOut(10, 1000, 50000, 0.3);
// After 0.3% fee = 493.56 USDT
```

### 4. Solver Signs Quote

```javascript
{
  quote_id: "uuid-123",
  quote_output: {
    amount_in: "10000000000",
    amount_out: "493560000000" // 493.56 USDT
  },
  signed_data: {
    standard: "nep413",
    signature: "ed25519:...",
    public_key: "ed25519:..."
  }
}
```

### 5. User Accepts Quote

- Frontend shows: "You'll receive 493.56 USDT for 10 DASH"
- User clicks "Accept"
- Intents contract executes swap:
  - Debits 10 DASH from solver reserves
  - Credits 493.56 USDT to user
  - Credits 10 DASH to user
  - Debits 493.56 USDT from solver reserves

### 6. Bridge Handles DASH Transfer (Optional)

- User burns wDASH on NEAR
- Bridge releases DASH to user's Dash address

## Key Components Status

### ✅ Already Have

- **AMM Solver** (this codebase) - calculates quotes
- **Quoter logic** - constant product AMM formula
- **NEAR integration** - connects to NEAR RPC

### ❌ Still Need for Full Dash POC

#### 1. Wrapped Dash Token (wDASH)

- NEP-141 contract on NEAR representing DASH
- Reference: [Wrapped NEAR contract](https://github.com/near/core-contracts/tree/master/w-near)

#### 2. Dash ↔ NEAR Bridge

- Smart contract on Dash side (lock/unlock DASH)
- Relayer service watching both chains
- Bridge contract on NEAR (mint/burn wDASH)
- Reference: [Rainbow Bridge](https://near.org/bridge)

#### 3. Liquidity

- Deposit wDASH into NEAR Intents contract
- Deposit USDT (or other token) into NEAR Intents contract
- Solver account must own these reserves

#### 4. Relay Server Access

- Production: wss://solver-relay-v2.chaindefuser.com/ws
- May need authentication (`RELAY_AUTH_KEY`)
- Need to register solver's public key

## AMM Solver Configuration

### Required Environment Variables

```bash
# Network Configuration
NEAR_NETWORK_ID=testnet  # or mainnet

# Token Pair Configuration
AMM_TOKEN1_ID=wdash.testnet           # Wrapped Dash token
AMM_TOKEN2_ID=usdt.fakes.testnet      # USDT on testnet

# Non-TEE Mode (for testing)
TEE_ENABLED=false
NEAR_ACCOUNT_ID=your-solver.testnet
NEAR_PRIVATE_KEY=ed25519:your_private_key

# Optional Configuration
APP_PORT=3000
LOG_LEVEL=debug
MARGIN_PERCENT=0.3
INTENTS_CONTRACT=intents.testnet
RELAY_WS_URL=wss://solver-relay-v2.chaindefuser.com/ws
```

### TEE Mode (Production)

```bash
TEE_ENABLED=true
SOLVER_REGISTRY_CONTRACT=solver-registry.near
SOLVER_POOL_ID=0
MARGIN_PERCENT=0.3
```

## Implementation Phases

### Phase 1: Test AMM Solver Only (Current)

**Goal:** Verify solver mechanics work with existing tokens

**Tasks:**
- [x] Set up NEAR testnet account
- [ ] Create `env/.env.development` with testnet configuration
- [ ] Use existing testnet tokens (no bridge needed)
  ```
  AMM_TOKEN1_ID=usdt.fakes.testnet
  AMM_TOKEN2_ID=wrap.testnet
  ```
- [ ] Test quote calculation works
- [ ] Verify WebSocket connection to relay
- [ ] Run solver locally with `bun run dev`

**Success Criteria:**
- Solver starts without errors
- Connects to NEAR testnet RPC
- Can fetch token reserves
- Calculates valid quotes

### Phase 2: Deploy wDASH Token

**Goal:** Create wrapped Dash token on NEAR

**Tasks:**
- [ ] Fork/modify NEP-141 token contract
- [ ] Deploy as `wdash.testnet`
- [ ] Manually mint test wDASH (no bridge yet)
- [ ] Update solver config to use wDASH
- [ ] Test quotes with wDASH ↔ USDT pair

**Success Criteria:**
- wDASH token deployed and functional
- Solver can query wDASH balances
- Quotes calculated correctly for wDASH pairs

### Phase 3: Build Bridge Infrastructure

**Goal:** Enable DASH ↔ wDASH conversions

**Tasks:**
- [ ] Design bridge architecture
- [ ] Implement Dash watch service (monitor deposits)
- [ ] Create NEAR bridge contract (mint/burn wDASH)
- [ ] Build relayer service (cross-chain messaging)
- [ ] Security audit
- [ ] Multi-sig setup
- [ ] Integration testing

**Success Criteria:**
- Users can lock DASH and receive wDASH
- Users can burn wDASH and receive DASH
- Bridge maintains 1:1 peg
- No security vulnerabilities

### Phase 4: Production Deployment

**Goal:** Launch on mainnet with real liquidity

**Tasks:**
- [ ] Deploy to mainnet
- [ ] Configure TEE mode
- [ ] Provide initial liquidity
- [ ] Register with solver relay
- [ ] Monitor and maintain

## Technical Details

### AMM Formula

The solver uses a constant product AMM formula (Uniswap v2 style):

```typescript
// For input amount → output amount
getAmountOut(amountIn, reserveIn, reserveOut, marginPercent) {
  const marginBips = Math.floor(marginPercent * 100);
  const amountInWithFee = amountIn * (10000 - marginBips);
  const numerator = amountInWithFee * reserveOut;
  const denominator = reserveIn * 10000 + amountInWithFee;
  return numerator / denominator;
}

// For output amount → input amount
getAmountIn(amountOut, reserveIn, reserveOut, marginPercent) {
  const marginBips = Math.floor(marginPercent * 100);
  const numerator = reserveIn * amountOut * 10000;
  const denominator = (reserveOut - amountOut) * (10000 - marginBips);
  return numerator / denominator;
}
```

### Quote Signing (NEP-413)

Quotes are signed using NEAR's NEP-413 standard:

```typescript
{
  standard: "nep413",
  payload: {
    message: "token_diff intent",
    nonce: "deterministic nonce based on reserves",
    recipient: "intents.near"
  },
  signature: "ed25519:...",
  public_key: "ed25519:..."
}
```

## References

- [NEAR Intents LTC Integration](https://www.gate.com/news/detail/15807432)
- [NEP-141 Token Standard](https://nomicon.io/Standards/FungibleToken/Core.html)
- [NEP-413 Signature Standard](https://github.com/near/NEPs/blob/master/neps/nep-0413.md)
- [NEAR API JS Documentation](https://docs.near.org/tools/near-api-js/quick-reference)
- [Wrapped NEAR Contract](https://github.com/near/core-contracts/tree/master/w-near)
- [Rainbow Bridge](https://near.org/bridge)

## Next Steps

1. Complete Phase 1 configuration
2. Test solver with existing testnet tokens
3. Plan wDASH token deployment
4. Design bridge architecture
5. Build and test bridge components
6. Deploy to production

---

**Last Updated:** December 24, 2025
