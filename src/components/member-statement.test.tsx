// @vitest-environment jsdom
import { afterEach, it, expect } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { MemberStatement } from "./member-statement";
import { demo } from "../test/ledger-fixture";
afterEach(cleanup);
it("separates total cash paid from fee credit and remaining club debt", () => {
  const member = demo.members[0];
  render(<MemberStatement data={demo} member={member} />);
  const labels = [
    "Expected payment",
    "Cash paid to club",
    "Items / purchases provided",
    "Counted toward fees",
    "Still due from member",
    "Club owes member",
  ];
  for (const label of labels) expect(screen.getByText(label)).toBeTruthy();
  expect(screen.getByText("Entry and weekly fees fully paid")).toBeTruthy();
  expect(
    screen.getByText("Cash paid to club").closest("div")?.textContent,
  ).toContain("৳4,000");
  expect(
    screen.getByText("Club owes member").closest("div")?.textContent,
  ).toContain("৳2,000");
  expect(screen.getByText("Monthly court contribution")).toBeTruthy();
});
