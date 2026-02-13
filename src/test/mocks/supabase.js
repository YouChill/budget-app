import { vi } from 'vitest';

const mockChain = {
  select: vi.fn().mockReturnThis(),
  insert: vi.fn().mockReturnThis(),
  update: vi.fn().mockReturnThis(),
  delete: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  gte: vi.fn().mockReturnThis(),
  lt: vi.fn().mockReturnThis(),
  order: vi.fn().mockReturnThis(),
  is: vi.fn().mockReturnThis(),
  single: vi.fn(),
  upsert: vi.fn().mockReturnThis(),
};

export const supabase = {
  from: vi.fn(() => mockChain),
  auth: {
    getSession: vi.fn(),
    onAuthStateChange: vi.fn(() => ({ 
      data: { subscription: { unsubscribe: vi.fn() } } 
    })),
  },
};

vi.mock('../../lib/supabase', () => ({ supabase }));

