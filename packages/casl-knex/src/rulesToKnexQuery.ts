import { AnyAbility, Subject, RuleOf, Generics } from '@casl/ability';
import Knex, { QueryBuilder } from 'knex';

const knex = Knex({ client: 'sqlite3' });
interface RulesToKnexOptions {
  isRelation(field: string, subject: Subject, ability: AnyAbility): boolean
}

export function rulesToKnexQuery<T extends AnyAbility>(
  ability: AnyAbility, action: string, subject: Subject, options: RulesToKnexOptions
) {
  const rules = ability.rulesFor(action, subject) as RuleOf<T>[];
  const qb = knex(subject?.toString()).select('*');
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
    qb.where((builder: QueryBuilder) => {
      ors.forEach(v => builder.orWhere(v));
    });
  }
  return hasQuery ? qb : null;
}
