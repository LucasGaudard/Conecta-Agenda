import assert from "node:assert/strict";
import { test } from "node:test";
import { calendarDateKey, monthCalendar } from "./calendar";

test("calendário começa na segunda e preserva todas as datas do mês", () => {
  const cells = monthCalendar(2026, 9);
  const first = cells[0];
  assert.ok(first);
  assert.equal(first.date.getDay(), 1);
  assert.equal(cells.length % 7, 0);
  assert.equal(cells.filter((cell) => cell.inMonth).length, 31);
  assert.equal(new Set(cells.map((cell) => cell.key)).size, cells.length);
  assert.equal(first.key, "2026-09-28");
});
test("fevereiro bissexto e meses de seis semanas não perdem dias", () => {
  assert.equal(monthCalendar(2028, 1).filter((cell) => cell.inMonth).length, 29);
  const cells = monthCalendar(2026, 2);
  assert.equal(cells.length, 42);
  assert.equal(cells.filter((cell) => cell.inMonth).length, 31);
});
test("virada de ano e datas civis não dependem de conversão UTC", () => {
  assert.equal(calendarDateKey(new Date(2026, 11, 31, 23, 59)), "2026-12-31");
  const first = monthCalendar(2027, 0).find((cell) => cell.inMonth);
  assert.ok(first);
  assert.equal(first.key, "2027-01-01");
  assert.ok(monthCalendar(2026, 11).some((cell) => cell.key === "2027-01-01"));
});
