# 🎮 Esports Platform - Improvements & Feature Roadmap

> Last Updated: December 26, 2025

## 📋 Table of Contents
- [Current Architecture](#current-architecture)
- [Code Improvements](#code-improvements)
- [Bug Fixes](#bug-fixes)
- [New Features](#new-features)
- [Implementation Priority](#implementation-priority)
- [File Structure](#file-structure)

---

## 🏗️ Current Architecture

| Layer | Tech Stack |
|-------|------------|
| Frontend | Next.js 15 (App Router), React 19, Tailwind CSS 4 |
| Backend | Next.js API Routes, PostgreSQL, Socket.io |
| Auth | JWT (7-day expiry), httpOnly cookies, CSRF tokens |
| Real-time | Socket.io (separate port 3001) |
| Notifications | Web Push (web-push library) |
| Database | PostgreSQL with pg pool (Aiven free tier) |

---

## 🛠️ Code Improvements

### 1. Security Improvements

| Issue | Current State | Recommendation | Priority | Status |
|-------|---------------|----------------|----------|--------|
| JWT secret | Hardcoded fallback in `auth.ts` | Remove fallback, require env var | 🔴 High | ✅ Done |
| Token storage | Both localStorage + cookie | Use httpOnly cookie only | 🔴 High | ✅ Done |
| CSRF protection | Missing | Add CSRF tokens for mutations | 🔴 High | ✅ Done |
| Rate limiting | None | Add rate limiting to auth endpoints | 🔴 High | ✅ Done |
| Input validation | Partial (some zod) | Consistent zod validation on all routes | 🟡 Medium | ✅ Done |

### 2. Database Optimizations

| Issue | Current State | Recommendation | Priority |
|-------|---------------|----------------|----------|
| Pool size | 3 connections (Aiven limit) | Add connection queue management | 🟡 Medium |
| Missing indexes | Unknown | Add indexes on `tournament_id`, `user_id`, `status` | 🔴 High |
| N+1 queries | Some endpoints fetch in loops | Use JOINs and batch queries | 🟡 Medium |
| Raw SQL | String concatenation | Use parameterized prepared statements | 🟡 Medium |

### 3. Frontend Optimizations

| Issue | Current State | Recommendation | Priority |
|-------|---------------|----------------|----------|
| Module-level cache | Works but not hydration-safe | Use React Context + localStorage sync | 🟡 Medium |
| Duplicate fetches | fetchedRef pattern | Use SWR or TanStack Query | 🟢 Low |
| Image optimization | Using next/image ✅ | Add blur placeholders | 🟢 Low |
| Bundle size | MUI + Emotion included | Remove MUI (only Tailwind needed) | 🟡 Medium |
| Loading states | Custom spinners everywhere | Create shared Skeleton components | 🟢 Low |

### 4. Code Architecture

| Issue | Current State | Recommendation | Priority |
|-------|---------------|----------------|----------|
| Error handling | Inconsistent try/catch | Create centralized error handler | 🟡 Medium |
| API response format | Helper functions exist ✅ | Add TypeScript generics for type safety | 🟢 Low |
| Duplicate code | Same fetch patterns repeated | Create custom `useApi` hook | 🟡 Medium |
| Type definitions | Good base in `types/index.ts` | Add Zod schemas that match types | 🟡 Medium |

---

## 🐛 Bug Fixes Required

| # | Issue | Location | Severity | Status |
|---|-------|----------|----------|--------|
| 1 | Wallet link disabled but shows in menu | `src/app/(dashboard)/layout.tsx` | 🟢 Low | ⬜ Open |
| 2 | `url.parse()` deprecation warning | `server.ts` | 🟢 Low | ⬜ Open |
| 3 | My Registrations links to `/tournaments` (doesn't exist) | `src/app/(dashboard)/my-registrations/page.tsx` | 🟡 Medium | ⬜ Open |
| 4 | User type mismatch (`id: string` vs `id: number`) | `src/types/index.ts` | 🟡 Medium | ⬜ Open |
| 5 | No error boundary in dashboard layout | `src/app/(dashboard)/layout.tsx` | 🟡 Medium | ⬜ Open |
| 6 | Chat doesn't show historical messages on reconnect | Socket.io implementation | 🟢 Low | ⬜ Open |

---

## ✨ New Features

### 🎯 Phase 1: Core Features (High Priority)

| # | Feature | Description | Complexity | Status |
|---|---------|-------------|------------|--------|
| 1 | **Wallet System** | Deposits, withdrawals, entry fee payments, prize distribution | High | ⬜ Not Started |
| 2 | **Leaderboard System** | Global rankings, tournament standings, kill tracking | Medium | ⬜ Not Started |
| 3 | **Match Results Submission** | Players submit kills/placement, host verifies | Medium | ⬜ Not Started |
| 4 | **Notification Center** | In-app notification inbox (not just push) | Medium | ⬜ Not Started |
| 5 | **Tournament Brackets** | Visual bracket display for knockout stages | High | ⬜ Not Started |

### 💡 Phase 2: UX Enhancements (Medium Priority)

| # | Feature | Description | Complexity | Status |
|---|---------|-------------|------------|--------|
| 6 | **Search & Filters** | Search tournaments by name, advanced filters | Low | ⬜ Not Started |
| 7 | **Tournament Banner Upload** | Cloudinary is configured but not wired up | Low | ⬜ Not Started |
| 8 | **Player Stats Profile** | Win rate, kill ratio, tournaments played | Medium | ⬜ Not Started |
| 9 | **Team Invites System** | Send invite links, accept/decline in-app | Medium | ⬜ Not Started |
| 10 | **Check-in System** | Players check-in before tournament starts | Low | ⬜ Not Started |

### 🚀 Phase 3: Advanced Features

| # | Feature | Description | Complexity | Status |
|---|---------|-------------|------------|--------|
| 11 | **Spectator Mode** | Non-registered users can follow live tournaments | Medium | ⬜ Not Started |
| 12 | **Tournament Series** | Link multiple tournaments into a season | High | ⬜ Not Started |
| 13 | **Referral System** | Earn wallet credits for inviting friends | Medium | ⬜ Not Started |
| 14 | **Discord Integration** | Post updates to Discord server | Low | ⬜ Not Started |
| 15 | **Admin Analytics Dashboard** | Charts for registrations, revenue, user growth | High | ⬜ Not Started |

### 🎨 Phase 4: Polish & Scaling

| # | Feature | Description | Complexity | Status |
|---|---------|-------------|------------|--------|
| 16 | **Multi-language Support** | i18n for Hindi, regional languages | Medium | ⬜ Not Started |
| 17 | **Dark Mode** | Theme toggle | Low | ⬜ Not Started |
| 18 | **PWA Enhancements** | Offline page, install prompts, better caching | Medium | ⬜ Not Started |
| 19 | **Dispute System** | Players can dispute results | Medium | ⬜ Not Started |
| 20 | **Automated Matchmaking** | Auto-create match brackets | High | ⬜ Not Started |

---

## 📊 Implementation Priority

```
┌─────────────────────────────────────────────────────────────────┐
│  PHASE 1 (Weeks 1-4): CORE                                      │
│  ├── Wallet System (deposits, withdrawals, payments)            │
│  ├── Match Results Submission                                   │
│  └── Leaderboard System                                         │
├─────────────────────────────────────────────────────────────────┤
│  PHASE 2 (Weeks 5-8): UX                                        │
│  ├── Search & Filters                                           │
│  ├── Tournament Banner Upload                                   │
│  ├── Check-in System                                            │
│  └── Notification Inbox                                         │
├─────────────────────────────────────────────────────────────────┤
│  PHASE 3 (Weeks 9-12): GROWTH                                   │
│  ├── Referral System                                            │
│  ├── Discord Integration                                        │
│  └── Analytics Dashboard                                        │
├─────────────────────────────────────────────────────────────────┤
│  PHASE 4 (Weeks 13+): POLISH                                    │
│  ├── Dark Mode                                                  │
│  ├── PWA Improvements                                           │
│  └── Multi-language (i18n)                                      │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🏗️ Suggested File Structure Additions

```
src/
├── app/
│   ├── (dashboard)/
│   │   ├── wallet/                     # NEW - Wallet management
│   │   │   └── page.tsx
│   │   ├── notifications/              # NEW - Notification inbox
│   │   │   └── page.tsx
│   │   ├── leaderboard/                # NEW - Global rankings
│   │   │   └── page.tsx
│   │   └── settings/                   # NEW - User settings
│   │       └── page.tsx
│   └── api/
│       ├── wallet/                     # NEW - Wallet APIs
│       │   ├── balance/
│       │   │   └── route.ts
│       │   ├── deposit/
│       │   │   └── route.ts
│       │   ├── withdraw/
│       │   │   └── route.ts
│       │   └── transactions/
│       │       └── route.ts
│       ├── matches/                    # NEW - Match management
│       │   ├── [matchId]/
│       │   │   └── route.ts
│       │   ├── submit-result/
│       │   │   └── route.ts
│       │   └── verify/
│       │       └── route.ts
│       ├── leaderboard/                # NEW - Leaderboard APIs
│       │   ├── global/
│       │   │   └── route.ts
│       │   └── tournament/
│       │       └── [id]/
│       │           └── route.ts
│       └── referrals/                  # NEW - Referral system
│           └── route.ts
├── components/
│   ├── bracket/                        # NEW - Tournament brackets
│   │   ├── Bracket.tsx
│   │   └── BracketMatch.tsx
│   ├── wallet/                         # NEW - Wallet components
│   │   ├── BalanceCard.tsx
│   │   ├── DepositModal.tsx
│   │   └── TransactionHistory.tsx
│   ├── stats/                          # NEW - Player statistics
│   │   ├── PlayerCard.tsx
│   │   └── StatsBadge.tsx
│   └── leaderboard/                    # NEW - Leaderboard components
│       ├── LeaderboardTable.tsx
│       └── RankBadge.tsx
└── lib/
    ├── payment.ts                      # NEW - Payment gateway (Razorpay/UPI)
    ├── analytics.ts                    # NEW - Analytics helpers
    └── discord.ts                      # NEW - Discord webhook integration
```

---

## 📝 Database Schema Additions

### Wallet Transactions Table
```sql
CREATE TABLE wallet_transactions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    amount DECIMAL(10,2) NOT NULL,
    type VARCHAR(20) NOT NULL, -- 'deposit', 'withdrawal', 'entry_fee', 'prize', 'refund'
    status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'completed', 'failed'
    reference_id VARCHAR(100), -- External payment reference
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Match Results Table
```sql
CREATE TABLE match_results (
    id SERIAL PRIMARY KEY,
    match_id INTEGER REFERENCES matches(id),
    tournament_id INTEGER REFERENCES tournaments(id),
    team_id INTEGER REFERENCES teams(id),
    user_id INTEGER REFERENCES users(id), -- For solo
    kills INTEGER DEFAULT 0,
    placement INTEGER,
    points INTEGER DEFAULT 0,
    submitted_by INTEGER REFERENCES users(id),
    verified BOOLEAN DEFAULT FALSE,
    verified_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Leaderboard Table
```sql
CREATE TABLE player_stats (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) UNIQUE,
    total_tournaments INTEGER DEFAULT 0,
    total_wins INTEGER DEFAULT 0,
    total_kills INTEGER DEFAULT 0,
    total_earnings DECIMAL(10,2) DEFAULT 0,
    win_rate DECIMAL(5,2) DEFAULT 0,
    avg_kills DECIMAL(5,2) DEFAULT 0,
    rank_points INTEGER DEFAULT 0,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Referrals Table
```sql
CREATE TABLE referrals (
    id SERIAL PRIMARY KEY,
    referrer_id INTEGER REFERENCES users(id),
    referred_id INTEGER REFERENCES users(id),
    status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'completed', 'rewarded'
    reward_amount DECIMAL(10,2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add referral_code to users table
ALTER TABLE users ADD COLUMN referral_code VARCHAR(10) UNIQUE;
```

---

## 🔗 Useful Resources

- [Next.js 15 Documentation](https://nextjs.org/docs)
- [Tailwind CSS v4](https://tailwindcss.com/docs)
- [Socket.io Documentation](https://socket.io/docs/v4/)
- [Razorpay Integration](https://razorpay.com/docs/)
- [Web Push Notifications](https://web.dev/push-notifications/)

---

## 📞 Contact

For questions about this roadmap, reach out to the development team.

---

*This document should be updated as features are completed or priorities change.*
