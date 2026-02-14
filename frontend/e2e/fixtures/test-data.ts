export const TEST_CREDENTIALS = {
  email: 'admin@ecoscan.local',
  password: 'admin123',
};

export const SEEDED_BINS = [
  {
    id: '00000000-0000-0000-0000-000000000001',
    name: 'Old Town Square Bin',
    type: 'General Waste',
  },
  {
    id: '00000000-0000-0000-0000-000000000002',
    name: 'Charles Bridge Bin',
    type: 'Recycling',
  },
  {
    id: '00000000-0000-0000-0000-000000000003',
    name: 'Prague Castle Bin',
    type: 'General Waste',
  },
] as const;

export const INVALID_BIN_ID = '00000000-0000-0000-0000-000000000099';

export const API_BASE = '/api';
