import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Normalize phone number to 10 digits by removing country code prefixes
export function normalizePhoneNumber(phoneNumber: string): string {
  // Remove all non-digit characters
  let cleaned = phoneNumber.replace(/\D/g, '');
  
  // Handle different country code formats
  if (cleaned.startsWith('1') && cleaned.length === 11) {
    // Remove leading "1" from 11-digit numbers (e.g., "16024461135" -> "6024461135")
    cleaned = cleaned.substring(1);
  } else if (cleaned.length > 10) {
    // For numbers longer than 10 digits, take the last 10 digits
    cleaned = cleaned.slice(-10);
  }
  
  return cleaned;
}
