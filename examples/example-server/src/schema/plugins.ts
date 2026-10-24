/* eslint-disable no-console */
import type { Context } from '../db.ts';
import { authPlugin, type AuthRule } from '../plugins/auth.ts';
import { maskErrorsPlugin } from '../plugins/maskErrors.ts';
import { tracePlugin } from '../plugins/trace.ts';

export const plugins = [
  // Passed first, so that it also masks errors of the other plugins
  maskErrorsPlugin({ onError: (error) => console.error(error) }),
  authPlugin({ default: 'allow' }),
  tracePlugin,
];

export const signedIn: AuthRule<unknown, Context> = (_parent, _args, ctx) =>
  ctx.viewerId != null || new Error('Sign in first.');
