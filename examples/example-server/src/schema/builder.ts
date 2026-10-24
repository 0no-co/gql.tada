import { initSchemaBuilder } from '@gql.tada/server';
import type { Context } from '../db.ts';
import { plugins } from './plugins.ts';

export const t = initSchemaBuilder<{ context: Context }>({ plugins });
