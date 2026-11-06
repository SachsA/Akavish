import * as migration_20260727_123459_initial from './20260727_123459_initial';
import * as migration_20260810_135732_r2_storage from './20260810_135732_r2_storage';
import * as migration_20260810_145335_image_sizes from './20260810_145335_image_sizes';
import * as migration_20261105_094814_article_previous_slugs from './20261105_094814_article_previous_slugs';
import * as migration_20261106_111409_article_featured from './20261106_111409_article_featured';

export const migrations = [
  {
    up: migration_20260727_123459_initial.up,
    down: migration_20260727_123459_initial.down,
    name: '20260727_123459_initial',
  },
  {
    up: migration_20260810_135732_r2_storage.up,
    down: migration_20260810_135732_r2_storage.down,
    name: '20260810_135732_r2_storage',
  },
  {
    up: migration_20260810_145335_image_sizes.up,
    down: migration_20260810_145335_image_sizes.down,
    name: '20260810_145335_image_sizes',
  },
  {
    up: migration_20261105_094814_article_previous_slugs.up,
    down: migration_20261105_094814_article_previous_slugs.down,
    name: '20261105_094814_article_previous_slugs',
  },
  {
    up: migration_20261106_111409_article_featured.up,
    down: migration_20261106_111409_article_featured.down,
    name: '20261106_111409_article_featured'
  },
];
