import { Subject, Generics, RuleOf } from '@casl/ability';
import { QueryBuilderType, Model } from 'objection';
import { AnyObjectionAbility } from './Ability';

interface RulesToObjetionOptions {
  isRelation(field: string, subject: Subject, ability: AnyObjectionAbility): boolean
}

export function rulesToObjectionQuery<T extends AnyObjectionAbility, C extends Model>(
  qb: QueryBuilderType<C>,
  ability: AnyObjectionAbility,
  action: string,
  subject: Subject,
  options: RulesToObjetionOptions
) {
  const rules = ability.rulesFor(action, subject) as RuleOf<T>[];
  let hasQuery = false;
  let ors: Generics<T>['conditions'][] = [];
  for (let i = 0; i < rules.length; i++) {
    const rule = rules[i];
    if (!rule.conditions) {
      if (rule.inverted) {
        break;
      }
      ors = [];
      return qb;
    }
    hasQuery = true;

    if (options?.isRelation(rule.conditions, subject, ability)) {
      // JOIN
    }
    if (rule.inverted) {
      qb.whereNot(rule.conditions);
    } else {
      ors.push(rule.conditions);
    }
  }
  if (ors.length) {
    qb.where((builder: QueryBuilderType<C>) => {
      ors.forEach(v => builder.orWhere(v));
    });
  }
  return hasQuery ? qb : null;
}
