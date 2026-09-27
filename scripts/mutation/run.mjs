#!/usr/bin/env node
/**
 * Targeted mutation check (design phase 13). Does a test fail when a rule is
 * broken? Each mutant in ./mutants.json breaks ONE named rule of the client;
 * it is applied to the real file, the package's unit tests run, and the file
 * is restored whatever happens. A mutant the tests do not notice "survives".
 *
 * Why not Stryker: Stryker 10's vitest runner, measured against this repo's
 * Vitest 5, reported 0 kills on files whose tests do kill the same mutant by
 * hand (docs/design/PHASE_13_DIAGNOSTIC.md). An instrument that cannot see a
 * known kill is not an instrument.
 *
 * Usage: node scripts/mutation/run.mjs [--out results.json] [--only id,id]
 * Exits 1 when a mutant survives: a rule no test notices is a gap, not a detail.
 */
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const args = process.argv.slice(2);
const option = (name) => {
  const index = args.indexOf(name);
  return index === -1 ? undefined : args[index + 1];
};
const out = option("--out");
const only = option("--only")?.split(",");
const mutants = JSON.parse(readFileSync(join(ROOT, "scripts/mutation/mutants.json"), "utf8")).filter((m) => !only || only.includes(m.id));

function testsFail(pkg) {
  try {
    execFileSync("npx", ["vitest", "run", "--reporter=dot"], { cwd: join(ROOT, pkg), stdio: "pipe", shell: true, timeout: 120_000 });
    return false;
  } catch {
    return true;
  }
}

function runMutant(mutant) {
  // An equivalent mutant behaves exactly like the original: no test can tell them apart.
  if (mutant.equivalent) return { ...mutant, status: "EQUIVALENT" };
  const path = join(ROOT, mutant.pkg, mutant.file);
  const original = readFileSync(path, "utf8");
  const occurrences = original.split(mutant.find).length - 1;
  if (occurrences !== 1) {
    return { ...mutant, status: `INVALID (${occurrences.toString()} occurrences)` };
  }
  try {
    writeFileSync(path, original.replace(mutant.find, mutant.replace));
    return { ...mutant, status: testsFail(mutant.pkg) ? "KILLED" : "SURVIVED" };
  } finally {
    writeFileSync(path, original);
  }
}

const results = mutants.map((mutant) => {
  const result = runMutant(mutant);
  process.stdout.write(`${result.status.padEnd(9)} ${result.id} — ${result.rule}\n`);
  return result;
});
const killed = results.filter((r) => r.status === "KILLED").length;
const valid = results.filter((r) => r.status === "KILLED" || r.status === "SURVIVED").length;
process.stdout.write(`\n${killed.toString()}/${valid.toString()} killed\n`);
if (out) {
  const summary = { killed, valid, results: results.map(({ id, pkg, file, rule, status }) => ({ id, pkg, file, rule, status })) };
  writeFileSync(resolve(out), JSON.stringify(summary, null, 2));
}
process.exitCode = killed === valid && results.every((r) => !r.status.startsWith("INVALID")) ? 0 : 1;
