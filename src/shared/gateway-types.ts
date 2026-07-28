/**
 * Shared types for multi-gateway management.
 */

export interface GatewayInstance {
  id: string
  name: string
  url: string          // e.g. http://127.0.0.1:18789 or ws://192.168.x.x:18789
  token: string
  status: 'online' | 'offline' | 'unknown'
  lastSeen?: number
}
