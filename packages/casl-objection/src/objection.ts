import { Abilities, AbilityTuple, AbilityParameters, Generics } from '@casl/ability';
import { AnyObjectionAbility } from './Ability';
import { rulesToObjectionQuery } from './rulesToObjectionQuery';

type ToObjectionQueryRestArgs<T extends Abilities> = AbilityParameters<
T,
T extends AbilityTuple ? (subject: T[1], action?: T[0]) => 0 : never,
(subject: 'all' | undefined, action?: T) => 0
>;

export function toObjectionQuery<T extends AnyObjectionAbility>(
  queryBuilder: T,
  ability: T,
  ...args: ToObjectionQueryRestArgs<Generics<T>['abilities']>
) {
  return (rulesToObjectionQuery as any)(queryBuilder, ability, args[1] || 'read', args[0]);
}
