export interface UserModel {
  id: string;
  name: string;
}

export interface TodoModel {
  id: string;
  text: string;
  status: 'open' | 'done';
  authorId: string;
  createdAt: Date;
}

export interface Database {
  users: UserModel[];
  todos: TodoModel[];
}

export const createDatabase = (): Database => ({
  users: [
    { id: 'u1', name: 'Phil' },
    { id: 'u2', name: 'Jovi' },
  ],
  todos: [
    {
      id: 't1',
      text: 'Define a schema with gql.tada/server',
      status: 'done',
      authorId: 'u1',
      createdAt: new Date('2025-09-03T10:00:00.000Z'),
    },
    {
      id: 't2',
      text: 'Query it with types, without codegen',
      status: 'open',
      authorId: 'u2',
      createdAt: new Date('2025-09-03T11:00:00.000Z'),
    },
  ],
});

export interface Context {
  db: Database;
  viewerId: string;
}
