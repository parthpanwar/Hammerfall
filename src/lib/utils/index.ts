import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Format price in lakhs to crores display
export function formatPrice(lakhs: number): string {
  if (lakhs >= 100) {
    const crores = lakhs / 100;
    return `₹${crores.toFixed(crores % 1 === 0 ? 0 : 2)} Cr`;
  }
  return `₹${lakhs} L`;
}

// Format price for compact display
export function formatPriceShort(lakhs: number): string {
  if (lakhs >= 100) {
    return `${(lakhs / 100).toFixed(1)}Cr`;
  }
  return `${lakhs}L`;
}

// Get bid increment based on current bid
export function getBidIncrement(currentBid: number): number {
  if (currentBid < 100) return 5;     // Below 1Cr: 5L increments
  if (currentBid < 200) return 10;    // 1-2Cr: 10L increments
  if (currentBid < 500) return 20;    // 2-5Cr: 20L increments
  if (currentBid < 1000) return 25;   // 5-10Cr: 25L increments
  return 50;                          // Above 10Cr: 50L increments
}

// Calculate NRR
export function calculateNRR(
  runsScored: number,
  oversFaced: number,
  runsConceded: number,
  oversBowled: number
): number {
  if (oversFaced === 0 || oversBowled === 0) return 0;
  const runRate = runsScored / oversFaced;
  const concededRate = runsConceded / oversBowled;
  return Number((runRate - concededRate).toFixed(3));
}

// Convert overs.balls to decimal overs
export function oversToDecimal(overs: number, balls: number): number {
  return overs + balls / 6;
}

// Format overs display
export function formatOvers(overs: number, balls: number): string {
  return balls === 0 ? `${overs}` : `${overs}.${balls}`;
}

// Get match phase from over number
export function getMatchPhase(over: number): 'Powerplay' | 'Middle' | 'Death' {
  if (over < 6) return 'Powerplay';
  if (over < 15) return 'Middle';
  return 'Death';
}

// Clamp a value between min and max
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

