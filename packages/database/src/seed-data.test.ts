import assert from "node:assert/strict";
import test from "node:test";
import { buildDemoVoters, DEMO_VOTED_COUNT, DEMO_VOTER_COUNT } from "./seed-data.js";

test("demo voter seed is deterministic and contains 5,000 records", () => {
  const first = buildDemoVoters();
  const second = buildDemoVoters();
  assert.equal(first.length, DEMO_VOTER_COUNT);
  assert.deepEqual(first, second);
  assert.equal(first[0]?.voterId, "DEMO-00001");
  assert.equal(first.at(-1)?.voterId, "DEMO-05000");
});

test("demo voter seed has the documented baseline and district distribution", () => {
  const voters = buildDemoVoters();
  assert.equal(voters.filter((voter) => voter.hasVoted).length, DEMO_VOTED_COUNT);
  assert.equal(voters.filter((voter) => !voter.hasVoted).length, DEMO_VOTER_COUNT - DEMO_VOTED_COUNT);
  assert.deepEqual(new Set(voters.map((voter) => voter.districtId)), new Set(Array.from({ length: 12 }, (_, index) => `D${index + 1}`)));
  assert.equal(new Set(voters.map((voter) => voter.voterId)).size, DEMO_VOTER_COUNT);
});
