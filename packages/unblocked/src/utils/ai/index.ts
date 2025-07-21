/**
 * AI utility functions for unblocked
 */

import type { LanguageModel, RequestHints, UIMessage } from '../../types/ai';
import { generateText } from '../../types/ai';

// Re-export streaming utilities
export * from './stream';
// Re-export tool execution utilities
export * from './tool-execution';

/**
 * Generate a title from a user message
 * @param options - The options for generating a title
 * @returns The generated title
 */
export async function generateTitle({
  message,
  model,
}: {
  message: UIMessage;
  model: LanguageModel;
}): Promise<string> {
  const { text: title } = await generateText({
    model,
    system: `
    - you will generate a short title based on the first message a user begins a conversation with
    - ensure it is not more than 80 characters long
    - the title should be a summary of the user's message
    - do not use quotes or colons`,
    prompt: JSON.stringify(message),
  });

  return title;
}

/**
 * Get geolocation from request headers
 * Based on Vercel's geolocation function
 * @param request - The incoming request
 * @returns The geolocation data
 */
export function getGeolocation(request: Request): RequestHints {
  // Safety check for headers
  if (!(request && request.headers)) {
    return {
      latitude: undefined,
      longitude: undefined,
      city: undefined,
      country: undefined,
      region: undefined,
    };
  }

  const headers = request.headers;

  // Try to get location from various headers
  const latitude =
    headers.get('x-vercel-ip-latitude') || headers.get('cf-iplatitude');
  const longitude =
    headers.get('x-vercel-ip-longitude') || headers.get('cf-iplongitude');
  const city = headers.get('x-vercel-ip-city') || headers.get('cf-ipcity');
  const country =
    headers.get('x-vercel-ip-country') || headers.get('cf-ipcountry');
  const region =
    headers.get('x-vercel-ip-country-region') || headers.get('cf-ipregion');

  return {
    latitude: latitude ? Number.parseFloat(latitude) : undefined,
    longitude: longitude ? Number.parseFloat(longitude) : undefined,
    city: city || undefined,
    country: country || undefined,
    region: region || undefined,
  };
}

/**
 * Format geolocation hints for system prompts
 * @param hints - The request hints containing geolocation
 * @returns Formatted location string or null
 */
export function formatLocationContext(hints: RequestHints): string | null {
  const parts: string[] = [];

  if (hints.city) parts.push(hints.city);
  if (hints.region) parts.push(hints.region);
  if (hints.country) parts.push(hints.country);

  if (parts.length === 0) return null;

  return `User location: ${parts.join(', ')}`;
}

/**
 * Select model based on user preferences and entitlements
 * @param options - The options for model selection
 * @returns The selected model name
 */
export function selectModel({
  requestedModel,
  allowedModels,
  defaultModel,
}: {
  requestedModel?: string;
  allowedModels?: string[];
  defaultModel: string;
}): string {
  // If no model requested, use default
  if (!requestedModel) return defaultModel;

  // If no restrictions, allow any model
  if (!allowedModels || allowedModels.length === 0) return requestedModel;

  // Check if requested model is allowed
  if (allowedModels.includes(requestedModel)) return requestedModel;

  // Fall back to default
  return defaultModel;
}
