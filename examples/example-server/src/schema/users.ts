import { t } from './builder.ts';
import { Query, Node, User } from './refs.ts';
import { usersById } from './common.ts';

export const UserType = t.object(User, {
  interfaces: [Node],
  fields: (f) => ({
    // Fields without a resolver read the property of the same name from `UserModel`
    id: f.field({ type: t.nonNull(t.ID) }),
    name: f.field({ type: t.nonNull(t.String) }),
  }),
});

export const UserQueries = t.object(Query, {
  fields: (f) => ({
    viewer: f.field({
      type: t.nonNull(User),
      resolve: (_, _args, ctx) => usersById(ctx).get(ctx.viewerId)!,
    }),
    user: f.field({
      type: User,
      args: { id: t.nonNull(t.ID) },
      resolve: (_, args, ctx) => usersById(ctx).get(args.id),
    }),
  }),
});
