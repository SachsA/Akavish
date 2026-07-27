import * as migration_20260727_123459_initial from './20260727_123459_initial';

export const migrations = [
  {
    up: migration_20260727_123459_initial.up,
    down: migration_20260727_123459_initial.down,
    name: '20260727_123459_initial'
  },
];
