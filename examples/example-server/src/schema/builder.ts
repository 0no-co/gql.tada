import { initSchemaBuilder } from 'gql.tada/server';
import type { Context } from '../db.ts';

export const t = initSchemaBuilder<{ context: Context }>();
