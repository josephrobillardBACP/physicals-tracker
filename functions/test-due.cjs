const { needsOutreach, nextOutreachFor } = require("./lib/due.js");
const asOf = new Date(2026, 8, 16); // 16 Sep 2026
const cases = [
  ["physical 8/1/2025 -> due 7/31/2026, overdue",      { lastPhysical: "8/1/2025" }, true],
  ["physical 12/1/2025 -> due 11/30/2026, not yet",    { lastPhysical: "12/1/2025" }, false],
  ["no physical on record",                            {}, true],
  ["overdue but voicemail left",                       { lastPhysical: "8/1/2025", outreachStatus: "Left Voicemail" }, false],
  ["overdue but visit booked",                         { lastPhysical: "8/1/2025", outreachStatus: "Physical Booked" }, false],
  ["overdue but a date is set",                        { lastPhysical: "8/1/2025", nextPhysical: "10/2/2026" }, false],
  ["child, no physical needed",                        { outreachStatus: "Not Needed" }, false],
  ["marked complete, awaiting confirm",                { lastPhysical: "8/1/2025", outreachStatus: "Completed" }, false],
  ["manual override pushes it into the future",        { lastPhysical: "8/1/2025", nextOutreachOverride: "1/15/2027" }, false],
  ["manual override pulls it earlier",                 { lastPhysical: "12/1/2025", nextOutreachOverride: "9/1/2026" }, true],
  ["due exactly today",                                { nextOutreachOverride: "9/16/2026" }, true],
  ["due tomorrow",                                     { nextOutreachOverride: "9/17/2026" }, false],
];
let bad = 0;
for (const [name, p, want] of cases) {
  const got = needsOutreach(p, asOf);
  if (got !== want) { bad++; console.log(`FAIL  ${name}: got ${got}, want ${want}`); }
  else console.log(`ok    ${name}`);
}
console.log("\n11-month rule:", "8/1/2025 ->", nextOutreachFor("8/1/2025"), "| 2/5/2025 ->", nextOutreachFor("2/5/2025"));
console.log(bad ? `\n${bad} FAILURES` : "\nall passed");
