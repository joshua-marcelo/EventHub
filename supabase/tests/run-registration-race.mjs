import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

// No linked CLI, .env loading, implicit PGHOST, or remote connection strings.
const connection = process.env.EVENTHUB_LOCAL_TEST_DATABASE_URL;
if (!connection) throw new Error("Set EVENTHUB_LOCAL_TEST_DATABASE_URL to a disposable local PostgreSQL database.");
const url = new URL(connection);
if (!["postgres:", "postgresql:"].includes(url.protocol) || !["127.0.0.1", "localhost", "[::1]"].includes(url.hostname) || url.search || url.hash) {
  throw new Error("Only a loopback PostgreSQL URL without query parameters is permitted.");
}
const spec = readFileSync(new URL("./isolation/registration-attendance.spec", import.meta.url), "utf8");
const result = spawnSync("isolationtester", [connection], { input: spec, encoding: "utf8", timeout: 60000 });
if (result.error) throw result.error;
process.stdout.write(result.stdout ?? "");
process.stderr.write(result.stderr ?? "");
if (result.status !== 0 || /ERROR:|FATAL:|deadlock detected/.test((result.stdout ?? "") + (result.stderr ?? ""))) process.exit(1);
if ((result.stdout.match(/starting permutation:/gi) ?? []).length !== 2) throw new Error("Both race permutations must execute.");
