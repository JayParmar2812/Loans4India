import { randomInt } from "node:crypto";
import { brand } from "@/config/brand";

// No 0/O/1/I/L — easy to read out on a call.
const ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

export function newReference(): string {
  let s = "";
  for (let i = 0; i < 6; i++) s += ALPHABET[randomInt(ALPHABET.length)];
  return `${brand.referencePrefix}-${s}`;
}
