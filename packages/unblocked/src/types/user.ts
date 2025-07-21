/**
 * Base User interface for Unblocked
 *
 * Unblocked does NOT manage users in its database.
 * This interface defines the minimal contract that developers must provide
 * when implementing the getUser() function.
 *
 * Why this exists:
 * - Unblocked follows an "external auth" philosophy - authentication is handled
 *   by your existing auth system (NextAuth, Clerk, Auth0, etc.)
 * - There is no userSchema or user table in Unblocked's database
 * - Users are provided at runtime via the getUser() function
 * - This interface ensures type safety while maintaining flexibility
 *
 * The required `id` field is used throughout Unblocked for:
 * - Ownership checks (chat.userId, document.userId, etc.)
 * - Access control and permissions
 * - Associating AI conversations with users
 *
 * Developers can extend this with any additional properties their auth
 * system provides (roles, permissions, avatar, etc.) thanks to the index signature.
 */
export interface User {
  /**
   * Unique identifier for the user - required for all operations
   */
  id: string;
  /**
   * User's email address - commonly provided by auth systems
   */
  email?: string;
  /**
   * User's display name
   */
  name?: string;
  /**
   * Allow additional properties from your auth system
   * Examples: roles, permissions, avatar, organizationId, etc.
   */
  [key: string]: any;
}
