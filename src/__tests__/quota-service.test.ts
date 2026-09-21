import assert from "node:assert/strict";
import { nextUtcMidnight, QuotaService, type QuotaStore } from "@/lib/services/quota-service";

export async function runQuotaServiceTests() {
  assert.equal(nextUtcMidnight(new Date("2026-12-31T23:59:59Z")).toISOString(), "2027-01-01T00:00:00.000Z");
  const quota = { limit: 2, used: 1, reset_at: "2026-09-21T00:00:00.000Z" };
  let refunds = 0;
  const store: QuotaStore = {
    read: async () => quota,
    reserve: async () => ({ reserved: true, quota }),
    refund: async (_owner, _kind, reset) => { assert.equal(reset, quota.reset_at); refunds++; },
  };
  const service = new QuotaService(store);
  const first = await service.reserve("a", "freesound_import");
  await Promise.all([first.refund(), first.refund(), first.commit()]);
  assert.equal(refunds, 1);
  const second = await service.reserve("a", "ai_background");
  await Promise.all([second.commit(), second.refund(), second.commit()]);
  assert.equal(refunds, 1);
  store.refund = async () => { refunds++; throw new Error("ambiguous connection failure"); };
  const third = await service.reserve("a", "ai_background");
  await assert.rejects(third.refund());
  await assert.rejects(third.refund());
  assert.equal(refunds, 2, "Never replay a potentially committed decrement");
  store.reserve = async () => ({ reserved: false, quota });
  await assert.rejects(service.reserve("a", "freesound_import"), { status: 429 });
}
