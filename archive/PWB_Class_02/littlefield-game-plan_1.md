# Littlefield Game Plan

NCCY 5080, Assignment 2. Based on the course slides and the day 1 to 51 data. Updated Sept 23, 2026, with group feedback checked in the simulation (40 runs per scenario).

Visual version: https://claude.ai/artifact/1nEGUYfydKUf9RsiWky8cX

## 1. What the data shows (days 1 to 51)

| Metric | Value | Meaning |
|---|---|---|
| Demand | 12.1 orders/day (std 3.8, range 4 to 19) | Random, no significant trend (p = 0.16) |
| Capacity (3/1/1 machines) | 12.6 orders/day | About 96% used |
| Lead time | 0.9 days (days 1 to 10) → 2.7 days (days 41 to 51) | Fine for Contract 1, too slow for 2 or 3 |
| Kit stockouts | Days 14 to 15, 23 to 24, 34 to 35, 43 to 44 | Plant nearly idle each time |

**Station load at 12 orders/day** (one lot of 60 kits per order):

| Station | Machines | Hours/order | Max orders/day | Utilization |
|---|---|---|---|---|
| 1 Stuffing | 3 | 5.6 | 12.9 | 93% |
| 2 Testing (visited twice) | 1 | 1.9 | 12.6 | 95% (bottleneck) |
| 3 Tuning | 1 | 1.8 | 13.3 | 90% |

**Key insights**
- Each stockout releases 15 to 25 waiting jobs at once when kits arrive. The stuffing queue jumps to 1,400 to 2,200 kits and lead time to 2.3 to 3.3 days. The stockouts cause the lead time spikes.
- Kit orders are about 7,200 kits (cash drops of about $63k on days 11, 20, 31, 40). Stockouts hit 3 days after each order, before the 4 day delivery lands, so the reorder point is too low.

## 2. How the process works

Supplier (4 days, $10/kit + $1,000/shipment) → Kit inventory (60 kits per order) → Station 1 Stuffing → Station 2 Testing → Station 3 Tuning → Station 2 Testing again → Customer.

- The fastest possible lead time is 9.3 hours (0.39 days).
- Revenue gives full price up to the first number of the contract window, then drops in a straight line to $0 at the second number:
  - Contract 1: $750, 7 to 14 days
  - Contract 2: $1,000, 1 to 3 days
  - Contract 3: $1,250, 0.5 to 1 day
- Contract 3 beats Contract 2 at any lead time under 0.6 days.

## 3. What we tested (end cash on day 250)

| Strategy (flat demand) | End cash |
|---|---|
| Do nothing (3/1/1, Contract 1) | $1.56M |
| Fix kits only | $1.61M |
| 4/1/1 + Contract 3 | $0.62M |
| 4/2/2 + Contract 2 | $1.91M |
| 4/2/2 + Contract 3 | $2.37M |
| **Plan: 5/2/2 + Contract 3 + rules** | **$2.37M** |

| Demand after day 51 | Do nothing | 4/2/2 + C2, no rules | Plan |
|---|---|---|---|
| Flat at 12/day | $1.56M | $1.91M | $2.37M |
| Rises to 20/day by day 150 | −$0.30M | $0.13M | $2.71M |
| Rises to 18, then falls | −$0.15M | $1.13M | $2.50M |
| Falls slowly toward 6/day | $1.48M | $1.59M | $2.00M |

**Other checks**
- 5/2/2 beats 4/2/2 slightly and is more stable.
- Buying more (5/3/2, 6/3/2) doesn't pay back.
- Selling machines at day 230 lost $75k to $130k (tester or tuner). Selling a stuffer was a wash. Keep all machines.
- If processing is 15% slower than the slides, the fallback to Contract 2 kicks in and end cash stays about $2.28M.
- **Day one contract switch:** kits run out around 6:40 PM and land around 8:10 PM Wednesday. Contracts lock when an order arrives, and lead time counts time waiting for kits, so orders in that gap earn $0 on Contract 3 but $750 on Contract 1. Switching at 9 PM earns about $18k more than 5 PM. Waiting until Thu 9 AM loses about $60k.
- **Endgame kits:** with no change, the last automatic order fires around day 207 to 210 at full size, then another full order fires near the end and about 19,000 kits go unused (about $190k). Resizing Mon 5 PM and then setting order quantity to 0 adds about $150k. Tuesday is too late.
- Demand is expected to stay constant, so kit settings stay on the 12/day row all game. 5/2/2 and 4/2/2 end about equal ($2.37M vs $2.36M), but 5/2/2 is steadier.
- Safety stock at 3 standard deviations is slightly safer than 2.33, at about the same cash.

## 4. Day one actions (Wed Sep 23, 5:00 PM, sim day 51)

1. **Fix kits:** order quantity 22,920 kits (382 jobs), reorder point 4,140 kits (69 jobs). If kits on hand are already below 4,140, an order goes out right away.
2. **Buy 4 machines:** +2 stuffing ($180k), +1 testing ($80k), +1 tuning ($100k). Total $360k, new setup 5/2/2.
3. **Start the decision log:** date, sim day, action, and the number that triggered it.
4. **Stay on Contract 1 for now.** Kits run out around 6:40 PM and the order lands around 8:10 PM. Orders in that gap would earn $0 on Contract 3.
5. **9:00 PM (sim day 56): switch to Contract 3.** Confirm the kits landed and the stuffing queue is draining first.

## 5. Rules to follow at every check (about twice a day)

Demand is expected to stay constant at about 12 a day, so these are safety checks.

| If | Then |
|---|---|
| Stuffing utilization > 75% | Buy 1 stuffer (about 16/day with 5 machines, 19/day with 6) |
| Testing or tuning utilization > 65% | Buy 1 of that machine (about 16/day for testers, 17/day for tuners at 2 machines) |
| Lead time > 0.6 days | Switch to Contract 2. Fix the queue, then return to Contract 3 when under 0.5 days |
| Any jobs waiting for kits (after Wednesday) | Raise the reorder point |
| Mon 5 PM (day 201) | Resize the last kit order: Q = 720 × (250 − arrival day) − 540. Once it goes out, set Q to 0 (the game details confirm 0 stops ordering) |
| After Mon 5 PM (day 201) | Stop buying machines unless lead time > 0.6 days and demand is still rising |

**Kit settings** (stay on the 12/day row; other rows are only a backup if demand clearly shifts)

| Avg orders/day | Order quantity (kits) | Reorder point (kits) | Reorder point (jobs) | Days each order lasts |
|---|---|---|---|---|
| 10 | 20,880 | 3,540 | 59 | 35 |
| **12 (today)** | **22,920** | **4,140** | **69** | **32** |
| 14 | 24,720 | 4,740 | 79 | 29 |
| 16 | 26,460 | 5,280 | 88 | 28 |
| 18 | 28,020 | 5,880 | 98 | 26 |
| 20 | 29,580 | 6,420 | 107 | 25 |

**Formulas**
- Order quantity is the EOQ: √(2 × kits/day × $1,000 ÷ holding cost).
- Holding cost is the interest you give up: $10 × 10% ÷ 365 ≈ $0.0027 per kit per day.
- Reorder point in jobs is 4 days of demand + 3 × √(4 days of demand). Multiply by 60 to get kits.

## 6. Calendar

1 real hour ≈ 1.25 sim days. Each 9 AM check is 10 sim days before that day's 5 PM.

| Date | Sim days | Actions |
|---|---|---|
| Tue Sep 22 | Before start | Read "Getting Started" and "Assignment Details". Find the machine, contract and kit screens. Confirm the lot setting (1 lot of 60). Set up the decision log |
| Wed Sep 23 | 51 → 56 | 5 PM: kit settings, buy 5/2/2, stay on Contract 1. ~6:40 PM: kits run out (expected). ~8:10 PM: kits land. 9 PM: switch to Contract 3 |
| Thu Sep 24 | 71 → 81 | 9 AM: full check against the rules. 5 PM: lead time under 0.5 days, no jobs waiting for kits |
| Fri Sep 25 | 101 → 111 | Quick check and log |
| Sat Sep 26 | 131 → 141 | Quick check and log |
| Sun Sep 27 | 161 → 171 | Check and log |
| Mon Sep 28 | 191 → 201 | 9 AM: final machine decisions. 5 PM: resize the last kit order (see below). When it fires (~day 207 to 210, Mon night): set Q to 0 |
| Tue Sep 29 | 221 → 231 | 9 AM: confirm the last kit order landed and Q is 0. Before 5 PM: final contract check, screenshots |
| Thu Oct 1 | Report due | 5 pages max, double spaced. Cover capacity, inventory, endgame, what you'd change, and the transaction log exhibit. Grade: 25% final ranking, 75% report |

**Monday Sep 28, 5 PM endgame kit math**
1. Next trigger day = 201 + (kits on hand − 4,140) ÷ 720. Arrival day = trigger day + 4.
2. Set order quantity = 720 × (250 − arrival day) − 540. The 540 is the ~1,260 kits still on hand when it lands, minus 720 kits of buffer.
   Example: trigger day 207 → arrival 211 → 27,540 kits.
3. Once that order goes out (Mon night), set order quantity to 0.

**Tuesday Sep 29, before 5 PM (day 231)**: keep Contract 3 only if lead time was under 0.5 days all day, otherwise switch to Contract 2. Keep all machines and screenshot everything.

## Assumptions

- Orders arrive at random. The data's variance of 14.2 is close to its mean of 12.1, which fits.
- Processing times are exact, as the slides state.
- One lot of 60 kits per order, which matches the observed utilization.
- Revenue falls in a straight line inside each contract window, as in the slide's Contract 1 example.
- The day 51 starting state is estimated: about 10 jobs at stuffing, 5 at testing, 1,500 kits on hand. That matches the group's kit timing (out around day 53, order lands day 55).
- Results are simulation averages, not guarantees. The sim runs slightly faster than reality, so treat lead times as a bit optimistic.
