import { PermanentGms } from "./access.ts";

const [command, number] = process.argv.slice(2);
try {
  const store = new PermanentGms();
  if (command === "add" && number) {
    store.add(number);
    console.log("Permanent Game Master saved locally. This setting survives bot restarts and git updates. Use !gm in the group to check access.");
  } else if (command === "remove" && number) {
    store.remove(number);
    console.log("Permanent Game Master removed.");
  } else if (command === "list") {
    console.log(`${store.list().length} permanent Game Master(s) configured locally.`);
  } else throw new Error("Usage: npm run gm -- add <international-number> | remove <international-number> | list");
} catch (error) {
  console.error(error instanceof Error ? error.message : "Could not update Game Master access.");
  process.exitCode = 1;
}
