import { QueryBuilderType } from 'objection';
import { Ability } from '@casl/ability';

export type AnyObjectionAbility = Ability<any, QueryBuilderType<any>>;
