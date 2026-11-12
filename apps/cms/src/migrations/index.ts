import * as migration_20260727_123459_initial from './20260727_123459_initial';
import * as migration_20260810_135732_r2_storage from './20260810_135732_r2_storage';
import * as migration_20260810_145335_image_sizes from './20260810_145335_image_sizes';
import * as migration_20261105_094814_article_previous_slugs from './20261105_094814_article_previous_slugs';
import * as migration_20261106_111409_article_featured from './20261106_111409_article_featured';
import * as migration_20261106_134415_payload_3_93 from './20261106_134415_payload_3_93';
import * as migration_20261107_161231_scheduled_publish from './20261107_161231_scheduled_publish';
import * as migration_20261107_161315_editorial_status_enum from './20261107_161315_editorial_status_enum';
import * as migration_20261109_094550_storage_object_key from './20261109_094550_storage_object_key';
import * as migration_20261109_102521_newsletter_subscribers from './20261109_102521_newsletter_subscribers';
import * as migration_20261110_095447_scout_step1 from './20261110_095447_scout_step1';
import * as migration_20261110_103703_scout_step2 from './20261110_103703_scout_step2';
import * as migration_20261112_144344_scout_events from './20261112_144344_scout_events';
import * as migration_20261112_155209_related_games_gallery from './20261112_155209_related_games_gallery';
import * as migration_20261112_163903_review_score from './20261112_163903_review_score';

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
    name: '20261106_111409_article_featured',
  },
  {
    up: migration_20261106_134415_payload_3_93.up,
    down: migration_20261106_134415_payload_3_93.down,
    name: '20261106_134415_payload_3_93',
  },
  {
    up: migration_20261107_161231_scheduled_publish.up,
    down: migration_20261107_161231_scheduled_publish.down,
    name: '20261107_161231_scheduled_publish',
  },
  {
    up: migration_20261107_161315_editorial_status_enum.up,
    down: migration_20261107_161315_editorial_status_enum.down,
    name: '20261107_161315_editorial_status_enum',
  },
  {
    up: migration_20261109_094550_storage_object_key.up,
    down: migration_20261109_094550_storage_object_key.down,
    name: '20261109_094550_storage_object_key',
  },
  {
    up: migration_20261109_102521_newsletter_subscribers.up,
    down: migration_20261109_102521_newsletter_subscribers.down,
    name: '20261109_102521_newsletter_subscribers',
  },
  {
    up: migration_20261110_095447_scout_step1.up,
    down: migration_20261110_095447_scout_step1.down,
    name: '20261110_095447_scout_step1',
  },
  {
    up: migration_20261110_103703_scout_step2.up,
    down: migration_20261110_103703_scout_step2.down,
    name: '20261110_103703_scout_step2',
  },
  {
    up: migration_20261112_144344_scout_events.up,
    down: migration_20261112_144344_scout_events.down,
    name: '20261112_144344_scout_events',
  },
  {
    up: migration_20261112_155209_related_games_gallery.up,
    down: migration_20261112_155209_related_games_gallery.down,
    name: '20261112_155209_related_games_gallery',
  },
  {
    up: migration_20261112_163903_review_score.up,
    down: migration_20261112_163903_review_score.down,
    name: '20261112_163903_review_score'
  },
];
