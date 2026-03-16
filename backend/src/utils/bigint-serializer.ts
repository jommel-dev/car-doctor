/**
 * Recursively converts BigInt values to strings in objects and arrays
 * This is needed because JSON.stringify doesn't support BigInt serialization
 */
export function convertBigIntToString(obj: any): any {
  return JSON.parse(
    JSON.stringify(obj, (_key, value) =>
      typeof value === 'bigint' ? value.toString() : value,
    ),
  );
}