import type { TodoModel, UserModel } from '../db.ts';
import { t } from './builder.ts';

// References only carry a type's name and its backing type. Declaring them in a module that
// doesn't import any other schema modules lets every module use them without circular imports.

export const Query = t.objectRef()('Query');
export const Mutation = t.objectRef()('Mutation');

export const Node = t.interfaceRef<UserModel | TodoModel>()('Node');
export const User = t.objectRef<UserModel>()('User');
export const Todo = t.objectRef<TodoModel>()('Todo');
