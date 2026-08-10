import * as migration_20260727_123459_initial from './20260727_123459_initial';
import * as migration_20260810_135732_r2_storage from './20260810_135732_r2_storage';

export const migrations = [
  {
    up: migration_20260727_123459_initial.up,
    down: migration_20260727_123459_initial.down,
    name: '20260727_123459_initial',
  },
  {
    up: migration_20260810_135732_r2_storage.up,
    down: migration_20260810_135732_r2_storage.down,
    name: '20260810_135732_r2_storage'
  },
];
