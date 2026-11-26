import type { Migration } from './types.js';
import { NORMALIZED_USERNAME_SQL } from '../postgres/account-sql.js';

export const migration0003: Migration = {
  id: '0003_normalized_username',
  sql: `
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM users GROUP BY ${NORMALIZED_USERNAME_SQL} HAVING count(*) > 1) THEN
    RAISE EXCEPTION 'Username normalization conflicts: resolve duplicate usernames before retrying migration 0003; no accounts were renamed or removed';
  END IF;
END $$;
CREATE UNIQUE INDEX users_normalized_username ON users (${NORMALIZED_USERNAME_SQL});
`,
};
